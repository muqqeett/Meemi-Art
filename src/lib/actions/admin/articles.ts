"use server";

import { revalidatePath } from "next/cache";

import { adminOrDenied, type AdminResult } from "@/lib/actions/admin/guard";
import { recordActivity } from "@/lib/admin/activity";
import { parseAuthoringText } from "@/lib/content/authoring";
import { countWords, outline, readingMinutes } from "@/lib/content/blocks";
import { prisma } from "@/lib/prisma";
import { articleInputSchema, PUBLISH_REQUIREMENTS, topicInputSchema } from "@/lib/validations/content";

/**
 * Article management.
 *
 * Every action re-checks the admin itself through `adminOrDenied` — a server
 * action is its own entry point and must never trust that a layout ran — and
 * records what happened in the existing audit trail.
 *
 * Two things are computed here and never accepted from the browser: the body
 * blocks (parsed from authoring text, so nothing stored can be markup) and the
 * reading time (derived from those blocks). `publishedAt` is set by the
 * publish action and preserved afterwards, so re-publishing does not rewrite
 * the original date.
 */

function issues(error: { issues: { path: PropertyKey[]; message: string }[] }) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return fieldErrors;
}

function revalidateArticle(slug?: string) {
  revalidatePath("/blog");
  revalidatePath("/learn");
  revalidatePath("/admin/content/articles");
  if (slug) revalidatePath(`/blog/${slug}`);
}

export async function createArticle(input: unknown): Promise<AdminResult<{ id: string }>> {
  const { admin, denied } = await adminOrDenied();
  if (denied) return denied;

  const parsed = articleInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Check the highlighted fields.", fieldErrors: issues(parsed.error) };
  }
  const data = parsed.data;

  const clash = await prisma.article.findUnique({ where: { slug: data.slug }, select: { id: true } });
  if (clash) {
    return { ok: false, error: "That slug is already in use.", fieldErrors: { slug: "An article with this slug already exists." } };
  }

  const body = parseAuthoringText(data.body);

  try {
    const article = await prisma.article.create({
      data: {
        title: data.title,
        slug: data.slug,
        excerpt: data.excerpt,
        body,
        topicId: data.topicId,
        coverImageUrl: data.coverImageUrl,
        coverImageAlt: data.coverImageAlt,
        seoTitle: data.seoTitle,
        seoDescription: data.seoDescription,
        canonicalUrl: data.canonicalUrl,
        teaches: data.teaches,
        tags: data.tags,
        readingMinutes: readingMinutes(body),
        // New articles are always drafts. Publishing is a separate, deliberate act.
        status: "DRAFT",
        products: { create: data.productIds.map((productId, index) => ({ productId, sortOrder: index })) },
      },
      select: { id: true },
    });

    await recordActivity({
      actorId: admin.id,
      action: "article.created",
      entityType: "article",
      entityId: article.id,
      meta: { title: data.title, slug: data.slug },
    });

    revalidateArticle();
    return { ok: true, message: "Draft created.", data: { id: article.id } };
  } catch {
    return { ok: false, error: "That article could not be saved." };
  }
}

export async function updateArticle(id: string, input: unknown): Promise<AdminResult> {
  const { admin, denied } = await adminOrDenied();
  if (denied) return denied;

  const parsed = articleInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Check the highlighted fields.", fieldErrors: issues(parsed.error) };
  }
  const data = parsed.data;

  const existing = await prisma.article.findUnique({ where: { id }, select: { id: true, slug: true } });
  if (!existing) return { ok: false, error: "That article no longer exists." };

  const clash = await prisma.article.findFirst({ where: { slug: data.slug, id: { not: id } }, select: { id: true } });
  if (clash) {
    return { ok: false, error: "That slug is already in use.", fieldErrors: { slug: "Another article already uses this slug." } };
  }

  const body = parseAuthoringText(data.body);

  try {
    await prisma.$transaction([
      prisma.articleProduct.deleteMany({ where: { articleId: id } }),
      prisma.article.update({
        where: { id },
        data: {
          title: data.title,
          slug: data.slug,
          excerpt: data.excerpt,
          body,
          topicId: data.topicId,
          coverImageUrl: data.coverImageUrl,
          coverImageAlt: data.coverImageAlt,
          seoTitle: data.seoTitle,
          seoDescription: data.seoDescription,
          canonicalUrl: data.canonicalUrl,
          teaches: data.teaches,
          tags: data.tags,
          readingMinutes: readingMinutes(body),
          products: { create: data.productIds.map((productId, index) => ({ productId, sortOrder: index })) },
        },
      }),
    ]);

    await recordActivity({
      actorId: admin.id,
      action: "article.updated",
      entityType: "article",
      entityId: id,
      meta: { title: data.title, slug: data.slug },
    });

    revalidateArticle(existing.slug);
    revalidateArticle(data.slug);
    return { ok: true, message: "Saved." };
  } catch {
    return { ok: false, error: "That article could not be saved." };
  }
}

/**
 * Publish.
 *
 * Refuses a piece that is not finished — a body below the word floor, or with
 * no sections — because an article too thin to be worth reading is exactly
 * what a search engine calls low-value content. The first publish stamps
 * `publishedAt`; later ones keep the original date.
 */
export async function publishArticle(id: string): Promise<AdminResult> {
  const { admin, denied } = await adminOrDenied();
  if (denied) return denied;

  const article = await prisma.article.findUnique({
    where: { id },
    select: { id: true, slug: true, title: true, body: true, excerpt: true, publishedAt: true },
  });
  if (!article) return { ok: false, error: "That article no longer exists." };

  const { parseBlocks } = await import("@/lib/content/blocks");
  const body = parseBlocks(article.body);
  const words = countWords(body);
  if (words < PUBLISH_REQUIREMENTS.minWords) {
    return { ok: false, error: `Too short to publish — ${words} words, and ${PUBLISH_REQUIREMENTS.minWords} is the floor.` };
  }
  if (outline(body).length < PUBLISH_REQUIREMENTS.minHeadings) {
    return { ok: false, error: `Add at least ${PUBLISH_REQUIREMENTS.minHeadings} sections before publishing.` };
  }

  await prisma.article.update({
    where: { id },
    data: { status: "PUBLISHED", publishedAt: article.publishedAt ?? new Date(), readingMinutes: readingMinutes(body) },
  });

  await recordActivity({
    actorId: admin.id,
    action: "article.published",
    entityType: "article",
    entityId: id,
    meta: { title: article.title, slug: article.slug },
  });

  revalidateArticle(article.slug);
  return { ok: true, message: "Published." };
}

/** Unpublish. The article keeps its date, so re-publishing does not move it. */
export async function unpublishArticle(id: string): Promise<AdminResult> {
  const { admin, denied } = await adminOrDenied();
  if (denied) return denied;

  const article = await prisma.article.findUnique({ where: { id }, select: { slug: true, title: true } });
  if (!article) return { ok: false, error: "That article no longer exists." };

  await prisma.article.update({ where: { id }, data: { status: "DRAFT" } });
  await recordActivity({
    actorId: admin.id,
    action: "article.unpublished",
    entityType: "article",
    entityId: id,
    meta: { title: article.title, slug: article.slug },
  });

  revalidateArticle(article.slug);
  return { ok: true, message: "Unpublished — it is a draft again." };
}

export async function deleteArticle(id: string): Promise<AdminResult> {
  const { admin, denied } = await adminOrDenied();
  if (denied) return denied;

  const article = await prisma.article.findUnique({ where: { id }, select: { slug: true, title: true } });
  if (!article) return { ok: false, error: "That article no longer exists." };

  await prisma.article.delete({ where: { id } });
  await recordActivity({
    actorId: admin.id,
    action: "article.deleted",
    entityType: "article",
    entityId: id,
    meta: { title: article.title, slug: article.slug },
  });

  revalidateArticle(article.slug);
  return { ok: true, message: "Deleted." };
}

// ---------------------------------------------------------------- topics

export async function createTopic(input: unknown): Promise<AdminResult<{ id: string }>> {
  const { admin, denied } = await adminOrDenied();
  if (denied) return denied;

  const parsed = topicInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Check the highlighted fields.", fieldErrors: issues(parsed.error) };
  }

  const clash = await prisma.contentTopic.findUnique({ where: { slug: parsed.data.slug }, select: { id: true } });
  if (clash) return { ok: false, error: "That slug is already in use.", fieldErrors: { slug: "A topic with this slug already exists." } };

  const topic = await prisma.contentTopic.create({ data: parsed.data, select: { id: true } });
  await recordActivity({
    actorId: admin.id,
    action: "topic.created",
    entityType: "article",
    entityId: topic.id,
    meta: { name: parsed.data.name, slug: parsed.data.slug },
  });

  revalidateArticle();
  return { ok: true, message: "Topic created.", data: { id: topic.id } };
}

export async function deleteTopic(id: string): Promise<AdminResult> {
  const { admin, denied } = await adminOrDenied();
  if (denied) return denied;

  const topic = await prisma.contentTopic.findUnique({
    where: { id },
    select: { name: true, slug: true, _count: { select: { articles: true, tutorials: true } } },
  });
  if (!topic) return { ok: false, error: "That topic no longer exists." };
  if (topic._count.articles > 0 || topic._count.tutorials > 0) {
    return { ok: false, error: "Move its articles to another topic first." };
  }

  await prisma.contentTopic.delete({ where: { id } });
  await recordActivity({
    actorId: admin.id,
    action: "topic.deleted",
    entityType: "article",
    entityId: id,
    meta: { name: topic.name, slug: topic.slug },
  });

  revalidateArticle();
  return { ok: true, message: "Topic deleted." };
}
