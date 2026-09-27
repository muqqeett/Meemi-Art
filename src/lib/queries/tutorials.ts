import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { parseBlocks, parseSteps, type Block, type TutorialStep } from "@/lib/content/blocks";
import { resourcesForTechniques } from "@/lib/content/resources";
import { productsForTechniques, type LinkedProduct } from "@/lib/queries/content-links";

/**
 * Reading the tutorials.
 *
 * The same publication rule as the blog, expressed once for tutorials: public
 * when PUBLISHED and `publishedAt` has arrived. A draft 404s, is absent from
 * every index, absent from the topic listing and absent from the sitemap — so
 * an unfinished tutorial cannot be found by guessing a URL or by a crawler.
 *
 * Related content is inferred from the technique slugs a tutorial declares,
 * exactly as it is for articles, with curated `TutorialProduct` links taking
 * precedence where a person's judgement beats the inference.
 */

/** Published, and not scheduled for later. */
export function publishedTutorialWhere(now: Date = new Date()): Prisma.TutorialWhereInput {
  return { status: "PUBLISHED", publishedAt: { not: null, lte: now } };
}

export const TUTORIALS_PER_PAGE = 9;

export type TutorialDifficulty = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";

export const TUTORIAL_DIFFICULTY_LABELS: Record<TutorialDifficulty, string> = {
  BEGINNER: "Beginner",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
};

export type TutorialCard = {
  slug: string;
  title: string;
  excerpt: string;
  publishedAt: Date;
  readingMinutes: number;
  difficulty: TutorialDifficulty;
  minutesMin: number | null;
  minutesMax: number | null;
  coverImageUrl: string | null;
  coverImageAlt: string | null;
  topic: { slug: string; name: string } | null;
};

const CARD_SELECT = {
  slug: true,
  title: true,
  excerpt: true,
  publishedAt: true,
  readingMinutes: true,
  difficulty: true,
  minutesMin: true,
  minutesMax: true,
  coverImageUrl: true,
  coverImageAlt: true,
  topic: { select: { slug: true, name: true } },
} as const;

type CardRow = Omit<TutorialCard, "publishedAt"> & { publishedAt: Date | null };

function toCard(row: CardRow): TutorialCard {
  return { ...row, publishedAt: row.publishedAt as Date };
}

export async function listPublishedTutorials({
  page = 1,
  topicSlug,
  now = new Date(),
}: { page?: number; topicSlug?: string; now?: Date } = {}) {
  const where: Prisma.TutorialWhereInput = {
    ...publishedTutorialWhere(now),
    ...(topicSlug ? { topic: { slug: topicSlug } } : {}),
  };

  const total = await prisma.tutorial.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / TUTORIALS_PER_PAGE));
  const current = Math.min(Math.max(1, page), pageCount);

  const rows = await prisma.tutorial.findMany({
    where,
    select: CARD_SELECT,
    orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    skip: (current - 1) * TUTORIALS_PER_PAGE,
    take: TUTORIALS_PER_PAGE,
  });

  return { tutorials: rows.map(toCard), total, page: current, pageCount };
}

/** Topics that actually have a published tutorial under them. */
export async function listTopicsWithTutorials(now: Date = new Date()) {
  const topics = await prisma.contentTopic.findMany({
    where: { tutorials: { some: publishedTutorialWhere(now) } },
    select: {
      slug: true,
      name: true,
      description: true,
      _count: { select: { tutorials: { where: publishedTutorialWhere(now) } } },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return topics.map((topic) => ({
    slug: topic.slug,
    name: topic.name,
    description: topic.description,
    count: topic._count.tutorials,
  }));
}

export type PublishedTutorial = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  intro: Block[];
  steps: TutorialStep[];
  outro: Block[];
  materials: string[];
  difficulty: TutorialDifficulty;
  minutesMin: number | null;
  minutesMax: number | null;
  publishedAt: Date;
  updatedAt: Date;
  readingMinutes: number;
  coverImageUrl: string | null;
  coverImageAlt: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  canonicalUrl: string | null;
  teaches: string[];
  tags: string[];
  topic: { slug: string; name: string } | null;
};

export async function getPublishedTutorial(slug: string, now: Date = new Date()): Promise<PublishedTutorial | null> {
  const row = await prisma.tutorial.findFirst({
    where: { slug, ...publishedTutorialWhere(now) },
    select: {
      id: true,
      slug: true,
      title: true,
      excerpt: true,
      intro: true,
      steps: true,
      outro: true,
      materials: true,
      difficulty: true,
      minutesMin: true,
      minutesMax: true,
      publishedAt: true,
      updatedAt: true,
      readingMinutes: true,
      coverImageUrl: true,
      coverImageAlt: true,
      seoTitle: true,
      seoDescription: true,
      canonicalUrl: true,
      teaches: true,
      tags: true,
      topic: { select: { slug: true, name: true } },
    },
  });
  if (!row) return null;

  return {
    ...row,
    publishedAt: row.publishedAt as Date,
    // Validated again on the way out: stored content is still input.
    intro: parseBlocks(row.intro),
    steps: parseSteps(row.steps),
    outro: parseBlocks(row.outro),
  };
}

/** Everything that should appear beneath a tutorial. */
export async function getTutorialRelations(tutorial: PublishedTutorial, now: Date = new Date()) {
  const [curated, byTechnique, siblings, articles] = await Promise.all([
    prisma.tutorialProduct.findMany({
      where: { tutorialId: tutorial.id, product: { isActive: true } },
      select: {
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            priceCents: true,
            images: { select: { url: true }, orderBy: { sortOrder: "asc" }, take: 1 },
            difficulty: { select: { techniques: true } },
          },
        },
      },
      orderBy: { sortOrder: "asc" },
      take: 3,
    }),
    productsForTechniques(tutorial.teaches, 3),
    prisma.tutorial.findMany({
      where: {
        ...publishedTutorialWhere(now),
        slug: { not: tutorial.slug },
        ...(tutorial.topic ? { topic: { slug: tutorial.topic.slug } } : {}),
      },
      select: CARD_SELECT,
      orderBy: [{ publishedAt: "desc" }],
      take: 3,
    }),
    // Articles that cover the same ground, so a reader can move from doing to
    // understanding without hunting for it.
    tutorial.teaches.length > 0
      ? prisma.article.findMany({
          where: {
            status: "PUBLISHED",
            publishedAt: { not: null, lte: now },
            teaches: { hasSome: tutorial.teaches },
          },
          select: { slug: true, title: true, excerpt: true },
          orderBy: [{ publishedAt: "desc" }],
          take: 2,
        })
      : Promise.resolve([]),
  ]);

  const curatedProducts: LinkedProduct[] = curated.map(({ product }) => ({
    id: product.id,
    name: product.name,
    slug: product.slug,
    priceCents: product.priceCents,
    imageUrl: product.images[0]?.url ?? null,
    techniques: product.difficulty?.techniques ?? [],
  }));

  // Curated first, then inferred, without repeating a pattern.
  const seen = new Set(curatedProducts.map((product) => product.id));
  const products = [...curatedProducts, ...byTechnique.filter((product) => !seen.has(product.id))].slice(0, 3);

  return {
    products,
    resources: resourcesForTechniques(tutorial.teaches),
    tutorials: siblings.map(toCard),
    articles,
  };
}

/** Published slugs for the sitemap. Drafts never appear here. */
export async function getPublishedTutorialSlugs(now: Date = new Date()) {
  return prisma.tutorial.findMany({
    where: publishedTutorialWhere(now),
    select: { slug: true, updatedAt: true },
    orderBy: { publishedAt: "desc" },
  });
}

/** A few recent tutorials, for the learning hub. */
export async function recentTutorials(take = 3, now: Date = new Date()): Promise<TutorialCard[]> {
  const rows = await prisma.tutorial.findMany({
    where: publishedTutorialWhere(now),
    select: CARD_SELECT,
    orderBy: [{ publishedAt: "desc" }],
    take,
  });
  return rows.map(toCard);
}

/** "About 20–30 minutes", or null when no estimate was recorded. */
export function tutorialTimeLabel(minutesMin: number | null, minutesMax: number | null): string | null {
  if (minutesMin === null && minutesMax === null) return null;
  const low = minutesMin ?? minutesMax!;
  const high = minutesMax ?? minutesMin!;
  const unit = (value: number) => (value >= 60 && value % 60 === 0 ? `${value / 60} hr` : `${value} min`);
  return low === high ? `About ${unit(low)}` : `About ${low}–${unit(high)}`;
}

/** ISO 8601 duration for structured data, from the upper estimate. */
export function tutorialIsoDuration(minutesMax: number | null): string | null {
  if (minutesMax === null || minutesMax <= 0) return null;
  const hours = Math.floor(minutesMax / 60);
  const minutes = minutesMax % 60;
  return `PT${hours > 0 ? `${hours}H` : ""}${minutes > 0 ? `${minutes}M` : ""}`;
}
