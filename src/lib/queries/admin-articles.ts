import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { toAuthoringText } from "@/lib/content/authoring";
import { countWords, outline, parseBlocks } from "@/lib/content/blocks";

/**
 * Reading articles as an editor sees them — drafts included.
 *
 * Everything here is for the admin area only, and every caller sits behind
 * `requireAdmin`. The public queries in `queries/articles.ts` are a separate
 * module precisely so that a page cannot reach a draft by accident: the
 * publication rule lives there, and nothing in this file is reachable from a
 * public route.
 */

export const ADMIN_ARTICLES_PER_PAGE = 20;

export type AdminArticleRow = {
  id: string;
  title: string;
  slug: string;
  status: "DRAFT" | "PUBLISHED";
  publishedAt: Date | null;
  updatedAt: Date;
  readingMinutes: number;
  words: number;
  topic: string | null;
};

export async function listAdminArticles({
  page = 1,
  status,
}: { page?: number; status?: "DRAFT" | "PUBLISHED" } = {}) {
  const where: Prisma.ArticleWhereInput = status ? { status } : {};

  const total = await prisma.article.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / ADMIN_ARTICLES_PER_PAGE));
  const current = Math.min(Math.max(1, page), pageCount);

  const rows = await prisma.article.findMany({
    where,
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      publishedAt: true,
      updatedAt: true,
      readingMinutes: true,
      body: true,
      topic: { select: { name: true } },
    },
    orderBy: [{ updatedAt: "desc" }],
    skip: (current - 1) * ADMIN_ARTICLES_PER_PAGE,
    take: ADMIN_ARTICLES_PER_PAGE,
  });

  const articles: AdminArticleRow[] = rows.map((row) => ({
    id: row.id,
    title: row.title,
    slug: row.slug,
    status: row.status,
    publishedAt: row.publishedAt,
    updatedAt: row.updatedAt,
    readingMinutes: row.readingMinutes,
    words: countWords(parseBlocks(row.body)),
    topic: row.topic?.name ?? null,
  }));

  const counts = await prisma.article.groupBy({ by: ["status"], _count: { _all: true } });

  return {
    articles,
    total,
    page: current,
    pageCount,
    drafts: counts.find((row) => row.status === "DRAFT")?._count._all ?? 0,
    published: counts.find((row) => row.status === "PUBLISHED")?._count._all ?? 0,
  };
}

/** One article, with its body turned back into the text an editor wrote. */
export async function getAdminArticle(id: string) {
  const article = await prisma.article.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      body: true,
      status: true,
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
      topicId: true,
      products: { select: { productId: true }, orderBy: { sortOrder: "asc" } },
    },
  });
  if (!article) return null;

  const blocks = parseBlocks(article.body);
  return {
    ...article,
    blocks,
    bodyText: toAuthoringText(blocks),
    words: countWords(blocks),
    sections: outline(blocks).length,
    productIds: article.products.map((link) => link.productId),
  };
}

export async function listTopics() {
  const topics = await prisma.contentTopic.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      sortOrder: true,
      _count: { select: { articles: true, tutorials: true } },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return topics.map((topic) => ({
    id: topic.id,
    name: topic.name,
    slug: topic.slug,
    description: topic.description,
    sortOrder: topic.sortOrder,
    articles: topic._count.articles,
    tutorials: topic._count.tutorials,
  }));
}

/** Published patterns an editor can link an article to. */
export async function listLinkableProducts() {
  return prisma.product.findMany({
    where: { isActive: true },
    select: { id: true, name: true, slug: true },
    orderBy: { name: "asc" },
    take: 100,
  });
}
