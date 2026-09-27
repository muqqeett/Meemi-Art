"use server";

import { revalidatePath } from "next/cache";

import { adminOrDenied, type AdminResult } from "@/lib/actions/admin/guard";
import { recordActivity } from "@/lib/admin/activity";
import { parseAuthoringSteps, parseAuthoringText } from "@/lib/content/authoring";
import { countWords, parseBlocks, parseSteps, readingMinutes, tutorialBlocks } from "@/lib/content/blocks";
import { prisma } from "@/lib/prisma";
import { TUTORIAL_PUBLISH_REQUIREMENTS, tutorialInputSchema } from "@/lib/validations/content";

/**
 * Tutorial management.
 *
 * Deliberately the same shape as the article actions: every action re-checks
 * the admin through `adminOrDenied`, records the same audit trail, and derives
 * on the server the two things a browser must never decide — the stored blocks
 * (parsed from authoring text, so nothing stored can be markup) and the reading
 * time. `publishedAt` is set by the publish action and preserved afterwards.
 */

function issues(error: { issues: { path: PropertyKey[]; message: string }[] }) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return fieldErrors;
}

function revalidateTutorial(slug?: string) {
  revalidatePath("/tutorials");
  revalidatePath("/learn");
  revalidatePath("/admin/content/tutorials");
  if (slug) revalidatePath(`/tutorials/${slug}`);
}

/** The three content fields, parsed once, so create and update cannot drift. */
function contentFrom(data: { intro: string; steps: string; outro: string | null }) {
  const intro = parseAuthoringText(data.intro);
  const steps = parseAuthoringSteps(data.steps);
  const outro = data.outro ? parseAuthoringText(data.outro) : [];
  return { intro, steps, outro, minutes: readingMinutes(tutorialBlocks(intro, steps, outro)) };
}

export async function createTutorial(input: unknown): Promise<AdminResult<{ id: string }>> {
  const { admin, denied } = await adminOrDenied();
  if (denied) return denied;

  const parsed = tutorialInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Check the highlighted fields.", fieldErrors: issues(parsed.error) };
  }
  const data = parsed.data;

  const clash = await prisma.tutorial.findUnique({ where: { slug: data.slug }, select: { id: true } });
  if (clash) {
    return {
      ok: false,
      error: "That slug is already in use.",
      fieldErrors: { slug: "A tutorial with this slug already exists." },
    };
  }

  const content = contentFrom(data);
  if (content.steps.length === 0) {
    return { ok: false, error: "No steps found.", fieldErrors: { steps: "Start each step with a ## heading." } };
  }

  try {
    const tutorial = await prisma.tutorial.create({
      data: {
        title: data.title,
        slug: data.slug,
        excerpt: data.excerpt,
        intro: content.intro,
        steps: content.steps,
        outro: content.outro,
        materials: data.materials,
        difficulty: data.difficulty,
        minutesMin: data.minutesMin,
        minutesMax: data.minutesMax,
        topicId: data.topicId,
        coverImageUrl: data.coverImageUrl,
        coverImageAlt: data.coverImageAlt,
        seoTitle: data.seoTitle,
        seoDescription: data.seoDescription,
        canonicalUrl: data.canonicalUrl,
        teaches: data.teaches,
        tags: data.tags,
        readingMinutes: content.minutes,
        // New tutorials are always drafts. Publishing is a separate, deliberate act.
        status: "DRAFT",
        products: { create: data.productIds.map((productId, index) => ({ productId, sortOrder: index })) },
      },
      select: { id: true },
    });

    await recordActivity({
      actorId: admin.id,
      action: "tutorial.created",
      entityType: "tutorial",
      entityId: tutorial.id,
      meta: { title: data.title, slug: data.slug },
    });

    revalidateTutorial();
    return { ok: true, message: "Draft created.", data: { id: tutorial.id } };
  } catch {
    return { ok: false, error: "That tutorial could not be saved." };
  }
}

export async function updateTutorial(id: string, input: unknown): Promise<AdminResult> {
  const { admin, denied } = await adminOrDenied();
  if (denied) return denied;

  const parsed = tutorialInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Check the highlighted fields.", fieldErrors: issues(parsed.error) };
  }
  const data = parsed.data;

  const existing = await prisma.tutorial.findUnique({ where: { id }, select: { id: true, slug: true } });
  if (!existing) return { ok: false, error: "That tutorial no longer exists." };

  const clash = await prisma.tutorial.findFirst({ where: { slug: data.slug, id: { not: id } }, select: { id: true } });
  if (clash) {
    return {
      ok: false,
      error: "That slug is already in use.",
      fieldErrors: { slug: "Another tutorial already uses this slug." },
    };
  }

  const content = contentFrom(data);
  if (content.steps.length === 0) {
    return { ok: false, error: "No steps found.", fieldErrors: { steps: "Start each step with a ## heading." } };
  }

  try {
    await prisma.$transaction([
      prisma.tutorialProduct.deleteMany({ where: { tutorialId: id } }),
      prisma.tutorial.update({
        where: { id },
        data: {
          title: data.title,
          slug: data.slug,
          excerpt: data.excerpt,
          intro: content.intro,
          steps: content.steps,
          outro: content.outro,
          materials: data.materials,
          difficulty: data.difficulty,
          minutesMin: data.minutesMin,
          minutesMax: data.minutesMax,
          topicId: data.topicId,
          coverImageUrl: data.coverImageUrl,
          coverImageAlt: data.coverImageAlt,
          seoTitle: data.seoTitle,
          seoDescription: data.seoDescription,
          canonicalUrl: data.canonicalUrl,
          teaches: data.teaches,
          tags: data.tags,
          readingMinutes: content.minutes,
          products: { create: data.productIds.map((productId, index) => ({ productId, sortOrder: index })) },
        },
      }),
    ]);

    await recordActivity({
      actorId: admin.id,
      action: "tutorial.updated",
      entityType: "tutorial",
      entityId: id,
      meta: { title: data.title, slug: data.slug },
    });

    revalidateTutorial(existing.slug);
    revalidateTutorial(data.slug);
    return { ok: true, message: "Saved." };
  } catch {
    return { ok: false, error: "That tutorial could not be saved." };
  }
}

/**
 * Publish.
 *
 * Refuses a tutorial that does not yet teach anything: below the word floor, or
 * with fewer steps than a sequence needs to be worth following. The first
 * publish stamps `publishedAt`; later ones keep the original date.
 */
export async function publishTutorial(id: string): Promise<AdminResult> {
  const { admin, denied } = await adminOrDenied();
  if (denied) return denied;

  const tutorial = await prisma.tutorial.findUnique({
    where: { id },
    select: { id: true, slug: true, title: true, intro: true, steps: true, outro: true, publishedAt: true },
  });
  if (!tutorial) return { ok: false, error: "That tutorial no longer exists." };

  const steps = parseSteps(tutorial.steps);
  const all = tutorialBlocks(parseBlocks(tutorial.intro), steps, parseBlocks(tutorial.outro));
  const words = countWords(all);

  if (words < TUTORIAL_PUBLISH_REQUIREMENTS.minWords) {
    return {
      ok: false,
      error: `Too short to publish — ${words} words, and ${TUTORIAL_PUBLISH_REQUIREMENTS.minWords} is the floor.`,
    };
  }
  if (steps.length < TUTORIAL_PUBLISH_REQUIREMENTS.minSteps) {
    return {
      ok: false,
      error: `A tutorial needs at least ${TUTORIAL_PUBLISH_REQUIREMENTS.minSteps} steps — this one has ${steps.length}.`,
    };
  }

  await prisma.tutorial.update({
    where: { id },
    data: {
      status: "PUBLISHED",
      publishedAt: tutorial.publishedAt ?? new Date(),
      readingMinutes: readingMinutes(all),
    },
  });

  await recordActivity({
    actorId: admin.id,
    action: "tutorial.published",
    entityType: "tutorial",
    entityId: id,
    meta: { title: tutorial.title, slug: tutorial.slug },
  });

  revalidateTutorial(tutorial.slug);
  return { ok: true, message: "Published." };
}

/** Unpublish. The tutorial keeps its date, so re-publishing does not move it. */
export async function unpublishTutorial(id: string): Promise<AdminResult> {
  const { admin, denied } = await adminOrDenied();
  if (denied) return denied;

  const tutorial = await prisma.tutorial.findUnique({ where: { id }, select: { slug: true, title: true } });
  if (!tutorial) return { ok: false, error: "That tutorial no longer exists." };

  await prisma.tutorial.update({ where: { id }, data: { status: "DRAFT" } });
  await recordActivity({
    actorId: admin.id,
    action: "tutorial.unpublished",
    entityType: "tutorial",
    entityId: id,
    meta: { title: tutorial.title, slug: tutorial.slug },
  });

  revalidateTutorial(tutorial.slug);
  return { ok: true, message: "Unpublished — it is a draft again." };
}

export async function deleteTutorial(id: string): Promise<AdminResult> {
  const { admin, denied } = await adminOrDenied();
  if (denied) return denied;

  const tutorial = await prisma.tutorial.findUnique({ where: { id }, select: { slug: true, title: true } });
  if (!tutorial) return { ok: false, error: "That tutorial no longer exists." };

  await prisma.tutorial.delete({ where: { id } });
  await recordActivity({
    actorId: admin.id,
    action: "tutorial.deleted",
    entityType: "tutorial",
    entityId: id,
    meta: { title: tutorial.title, slug: tutorial.slug },
  });

  revalidateTutorial(tutorial.slug);
  return { ok: true, message: "Deleted." };
}
