import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { evaluatePublicDifficulty, type DifficultyResult } from "@/lib/difficulty/engine";
import { productDifficultySelect } from "@/lib/difficulty/records";
import {
  rankProducts,
  statedCriteria,
  type CriterionKey,
  type MatchableAssessment,
  type MatchCriteria,
} from "@/lib/assistant/matching";
import { resolveProductName, type NameMatch } from "@/lib/assistant/parse";
import { prisma } from "@/lib/prisma";
import type { AssistantProduct } from "@/lib/assistant/types";
import type { CatalogIntent } from "@/lib/assistant/validate";

/**
 * The assistant's only window onto the catalogue.
 *
 * Every query here is built by the server from a sanitised `CatalogIntent` —
 * the browser never supplies a filter and the model never writes one. The
 * rules are the storefront's own: only published products with a deliverable
 * file, in a published category, and only public fields. Database ids are not
 * selected at all.
 *
 * Difficulty comes from the product's `ProductDifficulty` row, loaded in the
 * same query and read through the Difficulty engine. A product without an
 * enabled row is simply unassessed: its difficulty, time and techniques are
 * unavailable, and it can never match a constraint on them.
 */

/** Candidates handed to the model per turn. Small on purpose: cost and focus. */
export const CANDIDATE_LIMIT = 8;

/**
 * Products ranked in memory when the customer states criteria. Price, time and
 * techniques are filtered in SQL; the level is derived, never stored, so it is
 * filtered here, over this pool.
 */
export const MATCH_POOL_LIMIT = 50;

/** Sellable products considered when resolving a name the customer typed. */
const NAME_POOL_LIMIT = 200;

/** Characters of description the model sees per product. */
const DESCRIPTION_CHARS = 600;

const productSelect = {
  name: true,
  slug: true,
  shortDescription: true,
  description: true,
  priceCents: true,
  compareAtCents: true,
  ratingAvg: true,
  reviewCount: true,
  category: { select: { name: true, slug: true } },
  images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true, alt: true } },
  difficulty: { select: productDifficultySelect },
} satisfies Prisma.ProductSelect;

type ProductRow = Prisma.ProductGetPayload<{ select: typeof productSelect }>;

/** What the storefront would sell right now. */
const SELLABLE: Prisma.ProductWhereInput = {
  isActive: true,
  asset: { isNot: null },
  category: { isActive: true },
};

/** A candidate, with the server-side detail the reply may reason over. */
export type CandidateProduct = {
  slug: string;
  name: string;
  categoryName: string;
  categorySlug: string;
  priceCents: number;
  compareAtCents: number | null;
  imageUrl: string | null;
  imageAlt: string;
  ratingAvg: number | null;
  reviewCount: number;
  /** Plain-text excerpt for the model only; never sent to the browser. */
  descriptionExcerpt: string;
  /** The Difficulty engine's result for an enabled assessment; null when unassessed. */
  difficulty: DifficultyResult | null;
  /** The same assessment, shaped for the matching engine. */
  assessment: MatchableAssessment | null;
  /** Set when the product was ranked against criteria the customer stated. */
  match: { score: number; reasons: string[] } | null;
};

/**
 * Descriptions are written with decorative Unicode — mathematical bold and
 * italic letters that render like styled text. NFKC folds them back to plain
 * letters so the model reads words, not symbols, and the excerpt stays short.
 */
function excerpt(row: ProductRow): string {
  const text = (row.shortDescription || row.description)
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > DESCRIPTION_CHARS ? `${text.slice(0, DESCRIPTION_CHARS)}…` : text;
}

function toCandidate(row: ProductRow): CandidateProduct {
  const difficulty = evaluatePublicDifficulty(row.difficulty);
  return {
    slug: row.slug,
    name: row.name,
    categoryName: row.category.name,
    categorySlug: row.category.slug,
    priceCents: row.priceCents,
    compareAtCents: row.compareAtCents,
    imageUrl: row.images[0]?.url ?? null,
    imageAlt: row.images[0]?.alt ?? row.name,
    ratingAvg: row.reviewCount > 0 ? row.ratingAvg : null,
    reviewCount: row.reviewCount,
    descriptionExcerpt: excerpt(row),
    difficulty,
    assessment:
      difficulty && row.difficulty
        ? {
            level: difficulty.level,
            levelLabel: difficulty.levelLabel,
            estimatedTime: difficulty.estimatedTime,
            minutesMin: row.difficulty.minutesMin,
            minutesMax: row.difficulty.minutesMax,
            techniqueSlugs: difficulty.techniques.map((technique) => technique.slug),
          }
        : null,
    match: null,
  };
}

function toMatchCriteria(intent: CatalogIntent): MatchCriteria {
  return {
    maxPriceCents: intent.maxPriceCents,
    difficulty: intent.difficulty,
    maxMinutes: intent.maxMinutes,
    techniqueGroups: intent.techniqueGroups,
  };
}

/** Published categories, with how many sellable products each holds. */
export async function getAssistantCategories() {
  const categories = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: {
      slug: true,
      name: true,
      _count: { select: { products: { where: SELLABLE } } },
    },
  });
  return categories.map((c) => ({ slug: c.slug, name: c.name, productCount: c._count.products }));
}

function orderFor(sort: CatalogIntent["sort"]): Prisma.ProductOrderByWithRelationInput[] {
  switch (sort) {
    case "price-asc":
      return [{ priceCents: "asc" }, { name: "asc" }];
    case "price-desc":
      return [{ priceCents: "desc" }, { name: "asc" }];
    case "rating":
      return [{ ratingAvg: "desc" }, { reviewCount: "desc" }];
    case "newest":
      return [{ createdAt: "desc" }];
    case "relevance":
    default:
      return [{ featured: "desc" }, { reviewCount: "desc" }, { createdAt: "desc" }];
  }
}

/** A single sellable product by slug, or null — the storefront's own rules. */
export async function findSellableProduct(slug: string): Promise<CandidateProduct | null> {
  const row = await prisma.product.findFirst({
    where: { ...SELLABLE, slug },
    select: productSelect,
  });
  return row ? toCandidate(row) : null;
}

export type Relaxation = { criterion: CriterionKey; matches: number };

export type Retrieval = {
  products: CandidateProduct[];
  /**
   * True when nothing matched the keywords and the query was re-run without
   * them. The reply is told, so it never presents a broader result as an exact
   * match.
   */
  broadened: boolean;
  /** The product the customer is viewing, when "similar" was asked for. */
  current: CandidateProduct | null;
  /** The criteria the customer stated, in reason order. */
  criteria: CriterionKey[];
  /**
   * True when a difficulty, time or technique constraint was stated and no
   * sellable product in scope has a difficulty assessment at all.
   */
  notAssessed: boolean;
  /** When nothing matched: each stated criterion that, dropped, would find patterns. */
  relaxations: Relaxation[];
};

function whereFor(
  intent: CatalogIntent,
  current: CandidateProduct | null,
  useKeywords: boolean,
): Prisma.ProductWhereInput[] {
  const where: Prisma.ProductWhereInput[] = [SELLABLE];

  if (intent.similarToCurrentProduct && current) {
    where.push({ category: { slug: current.categorySlug }, slug: { not: current.slug } });
  } else if (intent.categorySlug) {
    where.push({ category: { slug: intent.categorySlug } });
  }

  if (intent.minPriceCents !== null || intent.maxPriceCents !== null) {
    where.push({
      priceCents: {
        ...(intent.minPriceCents !== null ? { gte: intent.minPriceCents } : {}),
        ...(intent.maxPriceCents !== null ? { lte: intent.maxPriceCents } : {}),
      },
    });
  }

  if (intent.difficulty || intent.maxMinutes !== null || intent.techniqueGroups.length > 0) {
    where.push({
      difficulty: {
        is: {
          enabled: true,
          ...(intent.maxMinutes !== null ? { minutesMax: { lte: intent.maxMinutes } } : {}),
        },
      },
    });
  }
  for (const group of intent.techniqueGroups) {
    where.push({ difficulty: { is: { techniques: { hasSome: [...group] } } } });
  }

  if (useKeywords && intent.keywords.length > 0) {
    where.push({
      OR: intent.keywords.flatMap((keyword) => [
        { name: { contains: keyword, mode: "insensitive" } },
        { shortDescription: { contains: keyword, mode: "insensitive" } },
        { description: { contains: keyword, mode: "insensitive" } },
        { category: { name: { contains: keyword, mode: "insensitive" } } },
      ]),
    });
  }

  return where;
}

async function queryMatches(
  intent: CatalogIntent,
  current: CandidateProduct | null,
  useKeywords: boolean,
  limit: number,
): Promise<CandidateProduct[]> {
  const criteria = toMatchCriteria(intent);
  const stated = statedCriteria(criteria);

  const rows = await prisma.product.findMany({
    where: { AND: whereFor(intent, current, useKeywords) },
    select: productSelect,
    orderBy: orderFor(intent.sort),
    take: stated.length > 0 ? MATCH_POOL_LIMIT : limit,
  });
  const candidates = rows.map(toCandidate);
  if (stated.length === 0) return candidates.slice(0, limit);

  return rankProducts(candidates, criteria)
    .slice(0, limit)
    .map(({ product, score, reasons }) => ({ ...product, match: { score, reasons } }));
}

function withoutCriterion(intent: CatalogIntent, criterion: CriterionKey): CatalogIntent {
  switch (criterion) {
    case "price":
      return { ...intent, minPriceCents: null, maxPriceCents: null };
    case "difficulty":
      return { ...intent, difficulty: null };
    case "time":
      return { ...intent, maxMinutes: null };
    case "techniques":
      return { ...intent, techniqueGroups: [] };
  }
}

/**
 * Retrieve a small, relevant candidate set for one turn.
 *
 * Stated constraints are hard filters and the survivors are ranked by the
 * matching engine. Keywords are soft: if nothing matches they are dropped once
 * and the result is flagged as broader. When nothing matches at all, the
 * retrieval reports whether the constraints need assessments that do not exist
 * yet, and which single constraint, relaxed, would find real patterns.
 *
 * `currentProductSlug` is resolved here, against the same sellable rules, so a
 * slug from the browser can never surface an unpublished product.
 */
export async function retrieveCandidates(
  intent: CatalogIntent,
  currentProductSlug: string | null,
): Promise<Retrieval> {
  const currentRow = currentProductSlug
    ? await prisma.product.findFirst({ where: { ...SELLABLE, slug: currentProductSlug }, select: productSelect })
    : null;
  const current = currentRow ? toCandidate(currentRow) : null;

  const hasKeywords = intent.keywords.length > 0;
  let products = await queryMatches(intent, current, hasKeywords, CANDIDATE_LIMIT);
  let broadened = false;

  if (products.length === 0 && hasKeywords) {
    products = await queryMatches(intent, current, false, CANDIDATE_LIMIT);
    broadened = products.length > 0;
  }

  const criteria = statedCriteria(toMatchCriteria(intent));
  let notAssessed = false;
  const relaxations: Relaxation[] = [];

  if (products.length === 0 && criteria.length > 0) {
    if (criteria.some((criterion) => criterion !== "price")) {
      const inScope = whereFor(
        { ...intent, minPriceCents: null, maxPriceCents: null, difficulty: null, maxMinutes: null, techniqueGroups: [] },
        current,
        false,
      );
      const assessed = await prisma.product.count({
        where: { AND: [...inScope, { difficulty: { is: { enabled: true } } }] },
      });
      notAssessed = assessed === 0;
    }

    if (!notAssessed) {
      for (const criterion of criteria) {
        const relaxed = await queryMatches(withoutCriterion(intent, criterion), current, false, MATCH_POOL_LIMIT);
        if (relaxed.length > 0) relaxations.push({ criterion, matches: relaxed.length });
      }
    }
  }

  return { products, broadened, current, criteria, notAssessed, relaxations };
}

/**
 * Resolve names the customer typed to sellable products — found, missing, or
 * ambiguous. Unpublished products are never candidates, so asking about one by
 * name reads exactly like asking about a product that does not exist.
 */
export async function findProductsByName(names: string[]): Promise<NameMatch<CandidateProduct>[]> {
  if (names.length === 0) return [];
  const rows = await prisma.product.findMany({
    where: SELLABLE,
    select: productSelect,
    orderBy: { name: "asc" },
    take: NAME_POOL_LIMIT,
  });
  const pool = rows.map(toCandidate);
  return names.map((name) => resolveProductName(name, pool));
}

/**
 * The public projection sent to the browser.
 *
 * Fields are listed rather than spread-and-omitted: a field added to the
 * candidate later stays server-side until someone decides it is public.
 */
export function toPublicProduct(product: CandidateProduct): AssistantProduct {
  return {
    slug: product.slug,
    name: product.name,
    categoryName: product.categoryName,
    priceCents: product.priceCents,
    compareAtCents: product.compareAtCents,
    imageUrl: product.imageUrl,
    imageAlt: product.imageAlt,
    ratingAvg: product.ratingAvg,
    reviewCount: product.reviewCount,
    difficulty: product.difficulty
      ? {
          levelLabel: product.difficulty.levelLabel,
          score: product.difficulty.score,
          estimatedTime: product.difficulty.estimatedTime,
          techniques: product.difficulty.techniques.map((technique) => technique.label),
        }
      : null,
  };
}
