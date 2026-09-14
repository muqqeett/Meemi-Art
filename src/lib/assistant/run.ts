import "server-only";

import {
  findSellableProduct,
  getAssistantCategories,
  retrieveCandidates,
  toPublicProduct,
  type CandidateProduct,
  type Retrieval,
} from "@/lib/assistant/catalog";
import type { AssistantRequest } from "@/lib/assistant/request";
import type { AssistantReply, ChatTurn } from "@/lib/assistant/types";
import {
  EMPTY_INTENT,
  sanitizeIntent,
  validateReply,
  type CatalogIntent,
} from "@/lib/assistant/validate";

/**
 * One assistant turn, end to end.
 *
 *   1. The intent model proposes filters            (untrusted)
 *   2. The server sanitises them                     (validate.ts)
 *   3. The server queries the catalogue              (catalog.ts)
 *   4. The reply model picks from what was retrieved (untrusted)
 *   5. The server validates the reply against it     (validate.ts)
 *
 * The model is injected rather than imported, so the whole flow can be tested
 * against the real catalogue with a scripted model and no API key.
 */

export type AssistantCategory = { slug: string; name: string; productCount: number };

export type ReplyContext = {
  history: ChatTurn[];
  intent: CatalogIntent;
  retrieval: Retrieval;
  categories: AssistantCategory[];
  viewing: CandidateProduct | null;
};

/** Returned by `composeReply` when the model declined to answer. */
export const REFUSED = Symbol("refused");

export interface AssistantLlm {
  extractIntent(input: {
    history: ChatTurn[];
    categories: AssistantCategory[];
    viewing: CandidateProduct | null;
  }): Promise<unknown>;
  composeReply(context: ReplyContext): Promise<unknown | typeof REFUSED>;
}

export const FALLBACK_HREF = "/shop";

export const STARTER_REPLIES = [
  "Show me flower patterns",
  "Something under $5",
  "Good gift ideas",
  "Help me choose",
];

const TROUBLE: AssistantReply = {
  ok: false,
  error:
    "Sorry, I'm having trouble finding recommendations right now. Try browsing our patterns instead.",
  fallbackHref: FALLBACK_HREF,
};

/**
 * Run one turn. Errors from the database or the model propagate; use
 * `runAssistantSafely` at the edge.
 */
export async function runAssistant(
  request: AssistantRequest,
  llm: AssistantLlm,
): Promise<AssistantReply> {
  const [categories, viewing] = await Promise.all([
    getAssistantCategories(),
    request.productSlug ? findSellableProduct(request.productSlug) : Promise.resolve(null),
  ]);

  // A failed intent call degrades to an unfiltered search instead of failing
  // the turn: the reply model can still help, and still sees only real data.
  let intent: CatalogIntent;
  try {
    const raw = await llm.extractIntent({ history: request.history, categories, viewing });
    intent = sanitizeIntent(raw, new Set(categories.map((c) => c.slug)));
  } catch (error) {
    // Logged, not surfaced: the turn carries on unfiltered, but an operator
    // needs to see that the intent step is failing — an exhausted credit
    // balance first shows up here.
    console.error("[assistant] intent step failed:", describeError(error));
    intent = EMPTY_INTENT;
  }

  // Off-topic turns never reach the catalogue or the second model.
  if (intent.outOfScope) {
    return {
      ok: true,
      message:
        "I'm here to help you find Meemi Art crochet patterns. Tell me what you'd like to make and I'll look through the catalogue.",
      recommendations: [],
      followUpQuestion: null,
      quickReplies: STARTER_REPLIES,
    };
  }

  const retrieval = await retrieveCandidates(intent, viewing?.slug ?? null);
  const raw = await llm.composeReply({
    history: request.history,
    intent,
    retrieval,
    categories,
    viewing,
  });

  if (raw === REFUSED) return TROUBLE;

  const reply = validateReply(raw, retrieval.products.map(toPublicProduct));
  if (!reply) return TROUBLE;

  return { ok: true, ...reply };
}

/**
 * A log-safe description of a failure.
 *
 * Enough to diagnose without a debugger — the error class, the HTTP status
 * (429 for exhausted quota, 400/403 for a bad key), and the API's error type
 * and request id when the provider supplies them — and deliberately nothing
 * else. The message itself is
 * never logged: provider and database messages can echo request content, and
 * this runs on text a customer typed.
 *
 * Duck-typed rather than importing the SDK's error classes, so this module
 * stays independent of which provider sits behind `AssistantLlm`.
 */
export function describeError(error: unknown): string {
  if (!(error instanceof Error)) return "non-Error thrown";

  const e = error as Error & {
    status?: unknown;
    requestID?: unknown;
    error?: { type?: unknown; error?: { type?: unknown } };
  };

  const parts = [`class=${e.constructor?.name || e.name}`];
  if (typeof e.status === "number") parts.push(`status=${e.status}`);

  const type = e.error?.error?.type ?? e.error?.type;
  if (typeof type === "string" && /^[a-z_]{1,64}$/.test(type)) parts.push(`type=${type}`);

  if (typeof e.requestID === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(e.requestID)) {
    parts.push(`request_id=${e.requestID}`);
  }

  return parts.join(" ");
}

/**
 * `runAssistant`, with every failure turned into the customer-safe message.
 *
 * The log line carries `describeError` only; nothing about the failure is
 * returned to the browser.
 */
export async function runAssistantSafely(
  request: AssistantRequest,
  llm: AssistantLlm,
): Promise<AssistantReply> {
  try {
    return await runAssistant(request, llm);
  } catch (error) {
    console.error("[assistant] turn failed:", describeError(error));
    return TROUBLE;
  }
}
