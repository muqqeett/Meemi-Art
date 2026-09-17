import { z } from "zod";

import { PRICE_BOUNDS } from "@/lib/config";
import { ESTIMATE_MINUTES_MAX, ESTIMATE_MINUTES_MIN, type DifficultyLevel } from "@/lib/difficulty/engine";
import { isTechniqueSlug } from "@/lib/difficulty/techniques";
import {
  DEFAULT_MODE_FOR_LEVEL,
  TIME_PHRASE_MINUTES,
  cleanProductName,
  resolveTechniquePhrases,
  type DifficultyCriterion,
} from "@/lib/assistant/parse";
import { ASSISTANT_LIMITS } from "@/lib/assistant/types";

/**
 * Everything the model says passes through here before anything else uses it.
 *
 * Pure functions, no I/O, so the rules that keep the assistant honest can be
 * tested without a database or an API key (`scripts/test-assistant.ts`).
 *
 * The principle: the model is trusted to understand language, never to be a
 * source of facts. It proposes filters and picks from a list; the server
 * decides what a filter may be and which products exist.
 */

// ---------------------------------------------------------------- intent

/** Sort orders the catalogue query actually supports. */
export const INTENT_SORTS = ["relevance", "price-asc", "price-desc", "newest", "rating"] as const;

/**
 * Attributes shoppers ask about that the catalogue has no structured field
 * for. The model reports them so the reply can say so honestly, instead of the
 * query pretending to filter on something that does not exist.
 */
export const UNSUPPORTED_ATTRIBUTES = [
  "hook_size",
  "yarn",
  "page_count",
] as const;

/**
 * What the turn is about. "search" is the original behaviour; "compare" and
 * "explain" name specific patterns; "why" asks for the reasons behind a
 * recommendation.
 */
export const INTENT_KINDS = ["search", "compare", "explain", "why"] as const;

const INTENT_LEVELS = ["beginner", "easy", "intermediate", "advanced", "expert"] as const;
const INTENT_MODES = ["exact", "at_most", "at_least"] as const;
const INTENT_TIME_PHRASES = ["quick", "tonight", "weekend"] as const;

/** What the intent model is asked to return. Nullable, never optional. */
export const IntentSchema = z.object({
  categorySlug: z.string().nullable(),
  minPriceDollars: z.number().nullable(),
  maxPriceDollars: z.number().nullable(),
  keywords: z.array(z.string()),
  sort: z.enum(INTENT_SORTS),
  similarToCurrentProduct: z.boolean(),
  outOfScope: z.boolean(),
  needsClarification: z.boolean(),
  requestedUnsupportedAttributes: z.array(z.enum(UNSUPPORTED_ATTRIBUTES)),
  kind: z.enum(INTENT_KINDS),
  difficultyLevel: z.enum(INTENT_LEVELS).nullable(),
  difficultyMode: z.enum(INTENT_MODES).nullable(),
  maxHours: z.number().nullable(),
  timePhrase: z.enum(INTENT_TIME_PHRASES).nullable(),
  techniques: z.array(z.string()),
  productNames: z.array(z.string()),
  aboutViewedProduct: z.boolean(),
});

export type RawIntent = z.infer<typeof IntentSchema>;

/** The intent after the server has decided what is allowed. */
export type CatalogIntent = {
  categorySlug: string | null;
  minPriceCents: number | null;
  maxPriceCents: number | null;
  keywords: string[];
  sort: (typeof INTENT_SORTS)[number];
  similarToCurrentProduct: boolean;
  outOfScope: boolean;
  needsClarification: boolean;
  unsupportedAttributes: (typeof UNSUPPORTED_ATTRIBUTES)[number][];
  kind: (typeof INTENT_KINDS)[number];
  /** A stated skill level — a hard filter on the derived Difficulty level. */
  difficulty: DifficultyCriterion | null;
  /** A stated time cap in minutes — a hard filter on the assessment's upper estimate. */
  maxMinutes: number | null;
  /** Requested techniques: each group is slugs from the vocabulary, at least one required. */
  techniqueGroups: string[][];
  /** Pattern names to compare or explain, as the customer wrote them. */
  productNames: string[];
  /** The customer referred to the product they are viewing. */
  useViewingProduct: boolean;
};

export const EMPTY_INTENT: CatalogIntent = {
  categorySlug: null,
  minPriceCents: null,
  maxPriceCents: null,
  keywords: [],
  sort: "relevance",
  similarToCurrentProduct: false,
  outOfScope: false,
  needsClarification: false,
  unsupportedAttributes: [],
  kind: "search",
  difficulty: null,
  maxMinutes: null,
  techniqueGroups: [],
  productNames: [],
  useViewingProduct: false,
};

const MAX_KEYWORDS = 5;
const MAX_TECHNIQUE_GROUPS = 6;
const MAX_PRODUCT_NAMES = 2;

function toDifficulty(
  level: (typeof INTENT_LEVELS)[number] | null,
  mode: (typeof INTENT_MODES)[number] | null,
): DifficultyCriterion | null {
  if (!level) return null;
  const upper = level.toUpperCase() as DifficultyLevel;
  const resolved = mode === "at_most" ? "atMost" : mode === "at_least" ? "atLeast" : mode === "exact" ? "exact" : null;
  return { level: upper, mode: resolved ?? DEFAULT_MODE_FOR_LEVEL[upper] };
}

/** Hours become whole minutes within the assessment range; a vague phrase has a fixed meaning. */
function toMaxMinutes(hours: number | null, phrase: (typeof INTENT_TIME_PHRASES)[number] | null): number | null {
  if (hours !== null && Number.isFinite(hours) && hours > 0) {
    return Math.min(ESTIMATE_MINUTES_MAX, Math.max(ESTIMATE_MINUTES_MIN, Math.round(hours * 60)));
  }
  return phrase ? TIME_PHRASE_MINUTES[phrase] : null;
}

/**
 * Techniques the model named become groups of vocabulary slugs. A slug passes
 * as itself; a phrase is resolved through the same table the pre-parser uses;
 * anything unrecognised is dropped rather than guessed at.
 */
function toTechniqueGroups(values: string[]): string[][] {
  const groups: string[][] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const text = value.normalize("NFKC").toLowerCase().trim();
    const resolved = isTechniqueSlug(text) ? [[text]] : resolveTechniquePhrases(text).groups;
    for (const group of resolved) {
      const key = group.join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      groups.push([...group]);
    }
  }
  return groups.slice(0, MAX_TECHNIQUE_GROUPS);
}

function toCents(dollars: number | null): number | null {
  if (dollars === null || !Number.isFinite(dollars) || dollars < 0) return null;
  const cents = Math.round(dollars * 100);
  return Math.min(cents, PRICE_BOUNDS.max);
}

/**
 * Keywords become `ILIKE` terms, so they are reduced to plain words: letters,
 * digits, spaces and hyphens, 2–30 characters. Prisma parameterises them either
 * way; this keeps a model or a customer from turning search into anything but
 * a word match.
 */
function cleanKeyword(value: string): string | null {
  const cleaned = value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length >= 2 && cleaned.length <= 30 ? cleaned : null;
}

/**
 * Turn the model's proposed intent into filters the server is willing to run.
 *
 * Returns the empty intent for anything that does not match the schema, so a
 * malformed model response degrades to "show a general selection" rather than
 * an error or an unbounded query.
 */
export function sanitizeIntent(raw: unknown, knownCategorySlugs: ReadonlySet<string>): CatalogIntent {
  const parsed = IntentSchema.safeParse(raw);
  if (!parsed.success) return EMPTY_INTENT;
  const intent = parsed.data;

  let minPriceCents = toCents(intent.minPriceDollars);
  let maxPriceCents = toCents(intent.maxPriceDollars);
  if (minPriceCents !== null && maxPriceCents !== null && minPriceCents > maxPriceCents) {
    [minPriceCents, maxPriceCents] = [maxPriceCents, minPriceCents];
  }

  const keywords = [
    ...new Set(intent.keywords.map(cleanKeyword).filter((k): k is string => k !== null)),
  ].slice(0, MAX_KEYWORDS);

  return {
    // A category the model invented is dropped, not guessed at.
    categorySlug:
      intent.categorySlug && knownCategorySlugs.has(intent.categorySlug) ? intent.categorySlug : null,
    minPriceCents,
    maxPriceCents,
    keywords,
    sort: intent.sort,
    similarToCurrentProduct: intent.similarToCurrentProduct,
    outOfScope: intent.outOfScope,
    needsClarification: intent.needsClarification,
    unsupportedAttributes: [...new Set(intent.requestedUnsupportedAttributes)],
    kind: intent.kind,
    difficulty: toDifficulty(intent.difficultyLevel, intent.difficultyMode),
    maxMinutes: toMaxMinutes(intent.maxHours, intent.timePhrase),
    techniqueGroups: toTechniqueGroups(intent.techniques),
    productNames: intent.productNames
      .map(cleanProductName)
      .filter((name): name is string => name !== null)
      .slice(0, MAX_PRODUCT_NAMES),
    useViewingProduct: intent.aboutViewedProduct,
  };
}

// ---------------------------------------------------------------- reply

/** What the reply model is asked to return. */
export const ReplySchema = z.object({
  message: z.string(),
  recommendations: z.array(z.object({ productRef: z.string(), reason: z.string() })),
  followUpQuestion: z.string().nullable(),
  quickReplies: z.array(z.string()),
});

export type ValidatedReply<T> = {
  message: string;
  recommendations: { product: T; reason: string }[];
  followUpQuestion: string | null;
  quickReplies: string[];
};

/** Control characters out, whitespace collapsed at the ends, length capped. */
export function cleanText(value: string, max: number): string {
  const text = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/**
 * Validate a reply against the products the server retrieved for this turn.
 *
 * ── Why references are resolved here and never trusted ─────────────────────
 *
 * The model sees products only under per-turn references ("p1", "p2") — never
 * a database id — and it can still emit a reference that is not in the set: a
 * typo, one from an earlier turn, or text a customer pasted to steer it. Every
 * recommendation is resolved against `refs`; anything that does not resolve is
 * dropped. The card the customer sees is then built from the resolved record,
 * so its name, price, image, link and difficulty come from the database.
 *
 * Returns null when the reply does not match the schema at all; the caller
 * turns that into the generic "having trouble" message.
 */
export function validateReply<T>(raw: unknown, refs: ReadonlyMap<string, T>): ValidatedReply<T> | null {
  const parsed = ReplySchema.safeParse(raw);
  if (!parsed.success) return null;
  const reply = parsed.data;

  const message = cleanText(reply.message, ASSISTANT_LIMITS.maxAssistantChars);
  if (!message) return null;

  const seen = new Set<string>();
  const recommendations: { product: T; reason: string }[] = [];

  for (const recommendation of reply.recommendations) {
    const ref = recommendation.productRef.trim();
    const product = refs.get(ref);
    if (product === undefined || seen.has(ref)) continue;
    seen.add(ref);
    recommendations.push({ product, reason: cleanText(recommendation.reason, 200) });
    if (recommendations.length === ASSISTANT_LIMITS.maxRecommendations) break;
  }

  const followUp = reply.followUpQuestion ? cleanText(reply.followUpQuestion, 200) : "";

  const quickReplies = [
    ...new Set(reply.quickReplies.map((q) => cleanText(q, 40)).filter(Boolean)),
  ].slice(0, 4);

  return {
    message,
    recommendations,
    followUpQuestion: followUp || null,
    quickReplies,
  };
}
