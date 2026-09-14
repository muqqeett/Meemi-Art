import "server-only";

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { AssistantProduct } from "@/lib/assistant/types";
import type { CatalogIntent } from "@/lib/assistant/validate";

/**
 * The assistant's only window onto the catalogue.
 *
 * Every query here is built by the server from a sanitised `CatalogIntent` —
 * the browser never supplies a filter and the model never writes one. The
 * rules are the storefront's own: only published products with a deliverable
 * file, in a published category, and only public fields.
 */

/** Candidates handed to the model per turn. Small on purpose: cost and focus. */
export const CANDIDATE_LIMIT = 8;

/** Characters of description the model sees per product. */
const DESCRIPTION_CHARS = 600;

const productSelect = {
  id: true,
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
} satisfies Prisma.ProductSelect;

type ProductRow = Prisma.ProductGetPayload<{ select: typeof productSelect }>;

/** What the storefront would sell right now. */
const SELLABLE: Prisma.ProductWhereInput = {
  isActive: true,
  asset: { isNot: null },
  category: { isActive: true },
};

/** A candidate plus the description text the model may reason over. */
export type CandidateProduct = AssistantProduct & {
  categorySlug: string;
  /** Plain-text excerpt for the model only; never sent to the browser. */
  descriptionExcerpt: string;
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
  return {
    id: row.id,
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
};

/**
 * Retrieve a small, relevant candidate set for one turn.
 *
 * Price and category are hard filters. Keywords are soft: they are matched
 * against name, short description, description and category name, and if
 * nothing matches they are dropped once — the customer then sees what does
 * exist within their price and category, flagged as broader.
 *
 * `currentProductSlug` is resolved here, against the same sellable rules, so a
 * slug from the browser can never surface an unpublished product.
 */
export async function retrieveCandidates(
  intent: CatalogIntent,
  currentProductSlug: string | null,
): Promise<Retrieval> {
  const current = currentProductSlug
    ? await prisma.product.findFirst({
        where: { ...SELLABLE, slug: currentProductSlug },
        select: productSelect,
      })
    : null;

  const base: Prisma.ProductWhereInput[] = [SELLABLE];

  if (intent.similarToCurrentProduct && current) {
    base.push({ category: { slug: current.category.slug }, id: { not: current.id } });
  } else if (intent.categorySlug) {
    base.push({ category: { slug: intent.categorySlug } });
  }

  if (intent.minPriceCents !== null || intent.maxPriceCents !== null) {
    base.push({
      priceCents: {
        ...(intent.minPriceCents !== null ? { gte: intent.minPriceCents } : {}),
        ...(intent.maxPriceCents !== null ? { lte: intent.maxPriceCents } : {}),
      },
    });
  }

  const keywordClause: Prisma.ProductWhereInput | null =
    intent.keywords.length > 0
      ? {
          OR: intent.keywords.flatMap((keyword) => [
            { name: { contains: keyword, mode: "insensitive" } },
            { shortDescription: { contains: keyword, mode: "insensitive" } },
            { description: { contains: keyword, mode: "insensitive" } },
            { category: { name: { contains: keyword, mode: "insensitive" } } },
          ]),
        }
      : null;

  const run = (where: Prisma.ProductWhereInput[]) =>
    prisma.product.findMany({
      where: { AND: where },
      select: productSelect,
      orderBy: orderFor(intent.sort),
      take: CANDIDATE_LIMIT,
    });

  let rows = await run(keywordClause ? [...base, keywordClause] : base);
  let broadened = false;

  if (rows.length === 0 && keywordClause) {
    rows = await run(base);
    broadened = rows.length > 0;
  }

  return {
    products: rows.map(toCandidate),
    broadened,
    current: current ? toCandidate(current) : null,
  };
}

/**
 * The public projection sent to the browser.
 *
 * Fields are listed rather than spread-and-omitted: a field added to the
 * candidate later stays server-side until someone decides it is public.
 */
export function toPublicProduct(product: CandidateProduct): AssistantProduct {
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    categoryName: product.categoryName,
    priceCents: product.priceCents,
    compareAtCents: product.compareAtCents,
    imageUrl: product.imageUrl,
    imageAlt: product.imageAlt,
    ratingAvg: product.ratingAvg,
    reviewCount: product.reviewCount,
  };
}
