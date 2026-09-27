import { z } from "zod";

import { TECHNIQUE_SLUGS } from "@/lib/difficulty/techniques";

/**
 * What the admin may submit for an article.
 *
 * Strict objects throughout: a payload carrying a field this does not name is
 * refused rather than quietly stripped. Two values are never accepted from a
 * browser and are always derived on the server — `readingMinutes`, computed
 * from the body, and `publishedAt`, set by the publish action — because a form
 * should not be able to claim a piece was published last year.
 *
 * `body` arrives as authoring text and is converted to blocks server-side; the
 * browser never submits block JSON.
 */

const slug = z
  .string()
  .trim()
  .min(3, "Enter a slug")
  .max(90)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens");

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value.length === 0 ? null : value))
    .nullable();

export const articleInputSchema = z.strictObject({
  title: z.string().trim().min(8, "Give the article a title").max(160),
  slug,
  excerpt: z
    .string()
    .trim()
    .min(60, "Write a summary of at least 60 characters — it is the card and the meta description")
    .max(320),
  /** Authoring text; converted to blocks on the server. */
  body: z.string().trim().min(400, "An article this short is not worth publishing"),
  topicId: z
    .string()
    .trim()
    .max(40)
    .transform((value) => (value.length === 0 ? null : value))
    .nullable(),
  coverImageUrl: optionalText(500),
  coverImageAlt: optionalText(300),
  seoTitle: optionalText(70),
  seoDescription: optionalText(180),
  canonicalUrl: optionalText(500),
  teaches: z.array(z.enum(TECHNIQUE_SLUGS)).max(12),
  tags: z.array(z.string().trim().min(2).max(40)).max(8),
  productIds: z.array(z.string().trim().min(1).max(40)).max(6),
});

export type ArticleInput = z.infer<typeof articleInputSchema>;

/**
 * What the admin may submit for a tutorial.
 *
 * Shaped like the article schema on purpose — same slug rule, same optional
 * text, same derived-on-the-server values — with the three body fields a
 * tutorial actually has. `steps` is authoring text whose `##` headings become
 * the numbered steps, so the browser never submits step JSON either.
 */
export const tutorialInputSchema = z.strictObject({
  title: z.string().trim().min(8, "Give the tutorial a title").max(160),
  slug,
  excerpt: z
    .string()
    .trim()
    .min(60, "Write a summary of at least 60 characters — it is the card and the meta description")
    .max(320),
  /** Authoring text; converted to blocks on the server. */
  intro: z.string().trim().min(120, "Say what the reader will be able to do by the end"),
  /** Authoring text; each `## heading` becomes a step. */
  steps: z.string().trim().min(200, "A tutorial needs steps"),
  outro: z
    .string()
    .trim()
    .max(8000)
    .transform((value) => (value.length === 0 ? null : value))
    .nullable(),
  materials: z.array(z.string().trim().min(2).max(120)).max(12),
  difficulty: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]),
  minutesMin: z.number().int().min(5).max(6000).nullable(),
  minutesMax: z.number().int().min(5).max(6000).nullable(),
  topicId: z
    .string()
    .trim()
    .max(40)
    .transform((value) => (value.length === 0 ? null : value))
    .nullable(),
  coverImageUrl: optionalText(500),
  coverImageAlt: optionalText(300),
  seoTitle: optionalText(70),
  seoDescription: optionalText(180),
  canonicalUrl: optionalText(500),
  teaches: z.array(z.enum(TECHNIQUE_SLUGS)).max(12),
  tags: z.array(z.string().trim().min(2).max(40)).max(8),
  productIds: z.array(z.string().trim().min(1).max(40)).max(6),
}).superRefine((data, ctx) => {
  if (data.minutesMin !== null && data.minutesMax !== null && data.minutesMin > data.minutesMax) {
    ctx.addIssue({ code: "custom", path: ["minutesMax"], message: "The maximum can't be less than the minimum" });
  }
});

export type TutorialInput = z.infer<typeof tutorialInputSchema>;

/**
 * A tutorial must actually teach something before it can be published.
 *
 * Steps rather than headings, because a tutorial with two steps is a note. The
 * word floor is the same as an article's: the bar for being worth indexing does
 * not change with the format.
 */
export const TUTORIAL_PUBLISH_REQUIREMENTS = {
  minWords: 400,
  minSteps: 3,
} as const;

export const topicInputSchema = z.strictObject({
  name: z.string().trim().min(3, "Name the topic").max(60),
  slug,
  description: z.string().trim().min(20, "Describe the topic in a sentence").max(240),
  sortOrder: z.number().int().min(0).max(999),
});

export type TopicInput = z.infer<typeof topicInputSchema>;

/**
 * An article must be worth reading before it can be published.
 *
 * Checked at publish time rather than at save time, so a draft can be saved
 * half-written — which is what drafts are for.
 */
export const PUBLISH_REQUIREMENTS = {
  minWords: 400,
  minHeadings: 2,
} as const;
