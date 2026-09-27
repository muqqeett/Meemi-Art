import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { toAuthoringSteps, toAuthoringText } from "@/lib/content/authoring";
import { countWords, parseBlocks, parseSteps, tutorialBlocks } from "@/lib/content/blocks";

/**
 * Reading tutorials as an editor sees them — drafts included.
 *
 * A separate module from `queries/tutorials.ts` for the same reason the article
 * queries are split: the publication rule lives there, nothing here is reachable
 * from a public route, and every caller sits behind `requireAdmin`.
 */

export const ADMIN_TUTORIALS_PER_PAGE = 20;

export type AdminTutorialRow = {
  id: string;
  title: string;
  slug: string;
  status: "DRAFT" | "PUBLISHED";
  difficulty: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  publishedAt: Date | null;
  updatedAt: Date;
  readingMinutes: number;
  words: number;
  steps: number;
  topic: string | null;
};

export async function listAdminTutorials({
  page = 1,
  status,
}: { page?: number; status?: "DRAFT" | "PUBLISHED" } = {}) {
  const where: Prisma.TutorialWhereInput = status ? { status } : {};

  const total = await prisma.tutorial.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / ADMIN_TUTORIALS_PER_PAGE));
  const current = Math.min(Math.max(1, page), pageCount);

  const rows = await prisma.tutorial.findMany({
    where,
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      difficulty: true,
      publishedAt: true,
      updatedAt: true,
      readingMinutes: true,
      intro: true,
      steps: true,
      outro: true,
      topic: { select: { name: true } },
    },
    orderBy: [{ updatedAt: "desc" }],
    skip: (current - 1) * ADMIN_TUTORIALS_PER_PAGE,
    take: ADMIN_TUTORIALS_PER_PAGE,
  });

  const tutorials: AdminTutorialRow[] = rows.map((row) => {
    const steps = parseSteps(row.steps);
    return {
      id: row.id,
      title: row.title,
      slug: row.slug,
      status: row.status,
      difficulty: row.difficulty,
      publishedAt: row.publishedAt,
      updatedAt: row.updatedAt,
      readingMinutes: row.readingMinutes,
      words: countWords(tutorialBlocks(parseBlocks(row.intro), steps, parseBlocks(row.outro))),
      steps: steps.length,
      topic: row.topic?.name ?? null,
    };
  });

  const counts = await prisma.tutorial.groupBy({ by: ["status"], _count: { _all: true } });

  return {
    tutorials,
    total,
    page: current,
    pageCount,
    drafts: counts.find((row) => row.status === "DRAFT")?._count._all ?? 0,
    published: counts.find((row) => row.status === "PUBLISHED")?._count._all ?? 0,
  };
}

/** One tutorial, with its content turned back into the text an editor wrote. */
export async function getAdminTutorial(id: string) {
  const tutorial = await prisma.tutorial.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      intro: true,
      steps: true,
      outro: true,
      materials: true,
      difficulty: true,
      minutesMin: true,
      minutesMax: true,
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
  if (!tutorial) return null;

  const intro = parseBlocks(tutorial.intro);
  const steps = parseSteps(tutorial.steps);
  const outro = parseBlocks(tutorial.outro);
  const all = tutorialBlocks(intro, steps, outro);

  return {
    ...tutorial,
    intro,
    steps,
    outro,
    introText: toAuthoringText(intro),
    stepsText: toAuthoringSteps(steps),
    outroText: toAuthoringText(outro),
    words: countWords(all),
    stepCount: steps.length,
    productIds: tutorial.products.map((link) => link.productId),
  };
}
