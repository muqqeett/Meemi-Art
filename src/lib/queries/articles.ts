import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { parseBlocks, type Block } from "@/lib/content/blocks";
import { resourcesForTechniques } from "@/lib/content/resources";
import { productsForTechniques, type LinkedProduct } from "@/lib/queries/content-links";

/**
 * Reading the blog.
 *
 * One publication rule, defined once and used by the index, the article page,
 * the hub and the sitemap: an article is public when it is PUBLISHED and its
 * `publishedAt` has arrived. A draft is invisible everywhere, including in
 * structured data and in the sitemap — which is what stops half-written work
 * from being indexed.
 *
 * Related content is computed, not curated by hand: the technique slugs an
 * article declares find the patterns and resources that share them, and the
 * topic finds its siblings. Curated product links are additional, for the
 * cases where judgement beats inference.
 */

export const PUBLISHED_ARTICLE = {
  status: "PUBLISHED",
  publishedAt: { not: null },
} as const satisfies Prisma.ArticleWhereInput;

/** Published, and not scheduled for later. */
export function publishedArticleWhere(now: Date = new Date()): Prisma.ArticleWhereInput {
  return { status: "PUBLISHED", publishedAt: { not: null, lte: now } };
}

export const ARTICLES_PER_PAGE = 9;

export type ArticleCard = {
  slug: string;
  title: string;
  excerpt: string;
  publishedAt: Date;
  readingMinutes: number;
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
  coverImageUrl: true,
  coverImageAlt: true,
  topic: { select: { slug: true, name: true } },
} as const;

function toCard(row: {
  slug: string;
  title: string;
  excerpt: string;
  publishedAt: Date | null;
  readingMinutes: number;
  coverImageUrl: string | null;
  coverImageAlt: string | null;
  topic: { slug: string; name: string } | null;
}): ArticleCard {
  return { ...row, publishedAt: row.publishedAt as Date };
}

export async function listPublishedArticles({
  page = 1,
  topicSlug,
  now = new Date(),
}: { page?: number; topicSlug?: string; now?: Date } = {}) {
  const where: Prisma.ArticleWhereInput = {
    ...publishedArticleWhere(now),
    ...(topicSlug ? { topic: { slug: topicSlug } } : {}),
  };

  const total = await prisma.article.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / ARTICLES_PER_PAGE));
  const current = Math.min(Math.max(1, page), pageCount);

  const rows = await prisma.article.findMany({
    where,
    select: CARD_SELECT,
    orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    skip: (current - 1) * ARTICLES_PER_PAGE,
    take: ARTICLES_PER_PAGE,
  });

  return { articles: rows.map(toCard), total, page: current, pageCount };
}

/** Topics that actually have something published under them. */
export async function listTopicsWithArticles(now: Date = new Date()) {
  const topics = await prisma.contentTopic.findMany({
    where: { articles: { some: publishedArticleWhere(now) } },
    select: {
      slug: true,
      name: true,
      description: true,
      _count: { select: { articles: { where: publishedArticleWhere(now) } } },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return topics.map((topic) => ({
    slug: topic.slug,
    name: topic.name,
    description: topic.description,
    count: topic._count.articles,
  }));
}

export async function getTopic(slug: string) {
  return prisma.contentTopic.findUnique({ where: { slug }, select: { slug: true, name: true, description: true } });
}

export type PublishedArticle = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: Block[];
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

export async function getPublishedArticle(slug: string, now: Date = new Date()): Promise<PublishedArticle | null> {
  const row = await prisma.article.findFirst({
    where: { slug, ...publishedArticleWhere(now) },
    select: {
      id: true,
      slug: true,
      title: true,
      excerpt: true,
      body: true,
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
    body: parseBlocks(row.body),
  };
}

/** Everything that should appear beneath an article. */
export async function getArticleRelations(article: PublishedArticle, now: Date = new Date()) {
  const [curated, byTechnique, siblings, tutorials] = await Promise.all([
    prisma.articleProduct.findMany({
      where: { articleId: article.id, product: { isActive: true } },
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
    productsForTechniques(article.teaches, 3),
    prisma.article.findMany({
      where: {
        ...publishedArticleWhere(now),
        slug: { not: article.slug },
        ...(article.topic ? { topic: { slug: article.topic.slug } } : {}),
      },
      select: CARD_SELECT,
      orderBy: [{ publishedAt: "desc" }],
      take: 3,
    }),
    // Tutorials that teach what this article explains, so a reader can move
    // from understanding to doing. Published only, by the tutorials' own rule:
    // nothing here can surface a draft, which is what makes this safe to render
    // on a public page without hand-maintained links between the two.
    article.teaches.length > 0
      ? prisma.tutorial.findMany({
          where: {
            status: "PUBLISHED",
            publishedAt: { not: null, lte: now },
            teaches: { hasSome: article.teaches },
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
    resources: resourcesForTechniques(article.teaches),
    articles: siblings.map(toCard),
    tutorials,
  };
}

/** Published slugs for the sitemap. Drafts never appear here. */
export async function getPublishedArticleSlugs(now: Date = new Date()) {
  return prisma.article.findMany({
    where: publishedArticleWhere(now),
    select: { slug: true, updatedAt: true },
    orderBy: { publishedAt: "desc" },
  });
}

export async function getTopicSlugs(now: Date = new Date()) {
  const topics = await prisma.contentTopic.findMany({
    where: { articles: { some: publishedArticleWhere(now) } },
    select: { slug: true, updatedAt: true },
  });
  return topics;
}

/** A few recent articles, for the learning hub. */
export async function recentArticles(take = 3, now: Date = new Date()): Promise<ArticleCard[]> {
  const rows = await prisma.article.findMany({
    where: publishedArticleWhere(now),
    select: CARD_SELECT,
    orderBy: [{ publishedAt: "desc" }],
    take,
  });
  return rows.map(toCard);
}
