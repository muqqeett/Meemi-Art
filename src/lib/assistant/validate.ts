import { z } from "zod";

import { PRICE_BOUNDS } from "@/lib/config";
import {
  ASSISTANT_LIMITS,
  type AssistantProduct,
  type AssistantRecommendation,
} from "@/lib/assistant/types";

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
  "difficulty",
  "hook_size",
  "yarn",
  "page_count",
] as const;

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
};

const MAX_KEYWORDS = 5;

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
  };
}

// ---------------------------------------------------------------- reply

/** What the reply model is asked to return. */
export const ReplySchema = z.object({
  message: z.string(),
  recommendations: z.array(z.object({ productId: z.string(), reason: z.string() })),
  followUpQuestion: z.string().nullable(),
  quickReplies: z.array(z.string()),
});

export type ValidatedReply = {
  message: string;
  recommendations: AssistantRecommendation[];
  followUpQuestion: string | null;
  quickReplies: string[];
};

/** Control characters out, whitespace collapsed at the ends, length capped. */
function cleanText(value: string, max: number): string {
  const text = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/**
 * Validate a reply against the products the server actually retrieved.
 *
 * ── Why product ids are checked here and not trusted ───────────────────────
 *
 * The model only ever sees the candidate list, but it can still emit an id
 * that is not on it — a typo, one from earlier in the conversation, or one a
 * customer pasted in an attempt to steer it. Every recommendation is resolved
 * against `candidates` by id; anything that does not resolve is dropped. The
 * card the customer sees is then built from the candidate record, so its name,
 * price, image and link come from the database even when the id is valid.
 *
 * Returns null when the reply does not match the schema at all; the caller
 * turns that into the generic "having trouble" message.
 */
export function validateReply(raw: unknown, candidates: readonly AssistantProduct[]): ValidatedReply | null {
  const parsed = ReplySchema.safeParse(raw);
  if (!parsed.success) return null;
  const reply = parsed.data;

  const message = cleanText(reply.message, ASSISTANT_LIMITS.maxAssistantChars);
  if (!message) return null;

  const byId = new Map(candidates.map((product) => [product.id, product]));
  const seen = new Set<string>();
  const recommendations: AssistantRecommendation[] = [];

  for (const recommendation of reply.recommendations) {
    const product = byId.get(recommendation.productId);
    if (!product || seen.has(product.id)) continue;
    seen.add(product.id);
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
