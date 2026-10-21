import "server-only";

import {
  findProductsByName,
  findSellableProduct,
  getAssistantCategories,
  retrieveCandidates,
  toPublicProduct,
  withoutCriterion,
  type CandidateProduct,
  type Relaxation,
  type Retrieval,
} from "@/lib/assistant/catalog";
import { MATCH_WEIGHTS, describeTimeCap, type CriterionKey } from "@/lib/assistant/matching";
import { preParse, type NameMatch, type PreParsed } from "@/lib/assistant/parse";
import type { AssistantRequest } from "@/lib/assistant/request";
import type {
  AssistantChip,
  AssistantComparison,
  AssistantLink,
  AssistantMood,
  AssistantRecommendation,
  AssistantReply,
  ChatTurn,
} from "@/lib/assistant/types";
import {
  EMPTY_INTENT,
  cleanText,
  sanitizeIntent,
  validateReply,
  type CatalogIntent,
} from "@/lib/assistant/validate";
import { DIFFICULTY_LEVELS, type DifficultyLevel } from "@/lib/difficulty/engine";
import { formatMoney } from "@/lib/money";

/**
 * One Pattern Concierge turn, end to end.
 *
 *   1. The deterministic pre-parser reads the latest message     (parse.ts)
 *      — when it is confident, the intent model is not called
 *   2. Otherwise the intent model proposes filters               (untrusted)
 *      and the server sanitises them                             (validate.ts)
 *   3. The server queries the catalogue, applies hard filters
 *      and ranks the survivors                                   (catalog.ts, matching.ts)
 *   4. The reply model phrases a reply over per-turn references  (untrusted)
 *   5. The server validates the reply against those references  (validate.ts)
 *      and attaches its own reasons, ranks and comparison table
 *
 * Replies that need no phrasing — "which patterns?", "I couldn't find that
 * pattern", "not assessed yet", "nothing matches, but without X there are N" —
 * are written here, deterministically, with no model call at all.
 *
 * The model and the catalogue are injected rather than imported, so the whole
 * flow can be tested with a scripted model, no API key and a failing database.
 */

export type AssistantCategory = { slug: string; name: string; productCount: number };

/** A product as the reply model sees it: under a per-turn reference, never a database id. */
export type ReferencedProduct = { ref: string; product: CandidateProduct };

export type ReplyContext = {
  history: ChatTurn[];
  intent: CatalogIntent;
  retrieval: Retrieval;
  categories: AssistantCategory[];
  viewing: CandidateProduct | null;
  /** Every product the reply may mention, aliased "p1", "p2", … for this turn only. */
  products: ReferencedProduct[];
  /** Set for a comparison: the server-built table the reply must stay within. */
  comparison: AssistantComparison | null;
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

/** The catalogue operations a turn needs. The default is the real database. */
export type AssistantCatalog = {
  getAssistantCategories: typeof getAssistantCategories;
  findSellableProduct: typeof findSellableProduct;
  retrieveCandidates: typeof retrieveCandidates;
  findProductsByName: typeof findProductsByName;
};

const DATABASE_CATALOG: AssistantCatalog = {
  getAssistantCategories,
  findSellableProduct,
  retrieveCandidates,
  findProductsByName,
};

export const FALLBACK_HREF = "/shop";

/**
 * How long a turn may take on the server. The browser gives up at 12 seconds
 * and shows Meemi napping; answering a little sooner than that means the
 * customer normally sees the server's own explanation rather than a timeout.
 */
export const TURN_TIMEOUT_MS = 10_000;

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

type OkReply = Extract<AssistantReply, { ok: true }>;

/** Plain labels as tappable chips: tapping sends the label itself. */
function chipsOf(labels: readonly string[]): AssistantChip[] {
  return labels.map((label) => ({ label, query: label }));
}

/**
 * A reply the server writes itself.
 *
 * Meemi's face follows what the reply does unless the caller says otherwise:
 * happy with results, curious with a question or nothing to show.
 */
function say(
  message: string,
  extra: Partial<Omit<OkReply, "ok" | "message">> = {},
): OkReply {
  const recommendations = extra.recommendations ?? [];
  const mood: AssistantMood = extra.mood ?? (recommendations.length > 0 ? "happy" : "curious");
  return {
    ok: true,
    message,
    recommendations,
    followUpQuestion: null,
    chips: [],
    links: [],
    comparison: null,
    ...extra,
    mood,
  };
}

// ---------------------------------------------------------------- intent

function intentFromPreParse(parsed: PreParsed): CatalogIntent {
  return {
    ...EMPTY_INTENT,
    kind: parsed.kind,
    maxPriceCents: parsed.maxPriceCents,
    sort: parsed.sort,
    difficulty: parsed.difficulty,
    maxMinutes: parsed.maxMinutes,
    techniqueGroups: parsed.techniqueGroups,
    productNames: parsed.productNames,
    useViewingProduct: parsed.useViewingProduct,
  };
}

/**
 * Whether the pre-parse can stand in for the intent model.
 *
 * On the first customer message there is no earlier context to carry, so a
 * confident parse is complete. Later in a conversation a bare "under $5" may
 * mean "those flower patterns, under $5", which only the intent model can read
 * from the history — except a comparison or question that names its patterns
 * (or "this pattern"), which is self-contained by construction.
 */
function preParseStandsAlone(parsed: PreParsed | null, history: ChatTurn[]): parsed is PreParsed {
  if (!parsed) return false;
  if (history.filter((turn) => turn.role === "user").length === 1) return true;
  return parsed.kind !== "search" && (parsed.productNames.length > 0 || parsed.useViewingProduct);
}

// ---------------------------------------------------------------- facts the server writes

const LEVEL_LABELS = new Map<DifficultyLevel, string>(DIFFICULTY_LEVELS.map((entry) => [entry.level, entry.label]));

const SUITED_FOR: Readonly<Record<DifficultyLevel, string>> = {
  BEGINNER: "New crocheters",
  EASY: "Crocheters who know the basics",
  INTERMEDIATE: "Confident crocheters",
  ADVANCED: "Experienced crocheters",
  EXPERT: "Very experienced crocheters",
};

const NOT_ASSESSED = "Not assessed yet";

/** The server-built comparison table. Every cell is catalogue data or an honest "not assessed". */
export function buildComparison(products: CandidateProduct[]): AssistantComparison {
  const cell = (fn: (p: CandidateProduct) => string) => products.map(fn);
  return {
    products: products.map((p) => ({ slug: p.slug, name: p.name })),
    rows: [
      { label: "Price", values: cell((p) => formatMoney(p.priceCents)) },
      { label: "Category", values: cell((p) => p.categoryName) },
      {
        label: "Difficulty",
        values: cell((p) => (p.difficulty ? `${p.difficulty.levelLabel} · ${p.difficulty.score}/10` : NOT_ASSESSED)),
      },
      { label: "Estimated time", values: cell((p) => p.difficulty?.estimatedTime ?? NOT_ASSESSED) },
      {
        label: "Techniques",
        values: cell((p) =>
          !p.difficulty
            ? NOT_ASSESSED
            : p.difficulty.techniques.length > 0
              ? p.difficulty.techniques.map((t) => t.label).join(", ")
              : "None listed",
        ),
      },
      {
        label: "Main challenges",
        values: cell((p) =>
          !p.difficulty
            ? NOT_ASSESSED
            : p.difficulty.challenges.length > 0
              ? p.difficulty.challenges.join(", ")
              : "No standout challenges",
        ),
      },
      { label: "Best suited for", values: cell((p) => (p.difficulty ? SUITED_FOR[p.difficulty.level] : NOT_ASSESSED)) },
      {
        label: "Reviews",
        values: cell((p) =>
          p.reviewCount > 0 && p.ratingAvg !== null
            ? `${p.ratingAvg.toFixed(1)} from ${p.reviewCount} ${p.reviewCount === 1 ? "review" : "reviews"}`
            : "No reviews yet",
        ),
      },
    ],
  };
}

function explainFacts(product: CandidateProduct): string {
  const d = product.difficulty;
  if (!d) {
    return `${product.name} hasn't had a difficulty assessment yet, so I can't say how hard it is or how long it takes.`;
  }
  const challenges = d.challenges.length > 0 ? ` Main challenges: ${d.challenges.join(", ").toLowerCase()}.` : "";
  return `${product.name} is rated ${d.levelLabel} (${d.score} out of 10) and takes ${d.estimatedTime.toLowerCase()}.${challenges}`;
}

// ---------------------------------------------------------------- fabrication guard

const LEVEL_WORDS = /\b(beginners?|easy|intermediate|advanced|expert)\b/gi;
const DURATION_CLAIM = /\b\d+(?:[.,]\d+)?\s*(?:[-–]\s*\d+(?:[.,]\d+)?\s*)?(?:hours?|hrs?|minutes?|mins?)\b/i;
const PERCENT = /\d\s*%|\bpercent\b/i;

/**
 * True when model text states a difficulty level, a duration or a percentage
 * that the server did not supply this turn.
 *
 * Level words are allowed only when a product in context carries that level or
 * the customer asked for it; durations only when a product in context has a
 * time estimate. Percentages are never allowed — there is no match percentage.
 */
function makesUnsupportedClaim(text: string, products: CandidateProduct[], intent: CatalogIntent): boolean {
  if (PERCENT.test(text)) return true;

  const assessed = products.filter((p) => p.difficulty !== null);
  if (assessed.length === 0 && DURATION_CLAIM.test(text)) return true;

  const allowed = new Set<string>(assessed.map((p) => p.difficulty!.levelLabel.toLowerCase()));
  if (intent.difficulty) allowed.add(LEVEL_LABELS.get(intent.difficulty.level)!.toLowerCase());

  for (const match of text.matchAll(LEVEL_WORDS)) {
    const word = match[1].toLowerCase().replace(/s$/, "");
    if (!allowed.has(word)) return true;
  }
  return false;
}

// ---------------------------------------------------------------- name resolution replies

/** A deterministic reply for names that did not resolve to exactly one product, or null. */
function unresolvedNames(matches: NameMatch<CandidateProduct>[]): OkReply | null {
  const ambiguous = matches.find((m) => m.status === "ambiguous");
  if (ambiguous && ambiguous.status === "ambiguous") {
    const query = cleanText(ambiguous.query, 60);
    return say(`I found more than one pattern matching "${query}". Which one did you mean?`, {
      chips: chipsOf(ambiguous.options.map((p) => cleanText(p.name, 40)).slice(0, 4)),
    });
  }
  const missing = matches.find((m) => m.status === "missing");
  if (missing) {
    const query = cleanText(missing.query, 60);
    return say(
      `I couldn't find a pattern called "${query}" in the Meemi Art catalogue. Could you check the name, or tell me what you'd like to make?`,
      { chips: chipsOf(STARTER_REPLIES), mood: "unsure" },
    );
  }
  return null;
}

// ---------------------------------------------------------------- never a dead end

/** Questions about an order or a file: not Meemi's job, but not a dead end either. */
const ACCOUNT_QUESTION =
  /\b(downloads?|library|orders?|refunds?|receipts?|invoices?|account|password|log ?in|sign ?in|where is my)\b/i;

/** Where an account or order question is sent, written here so a model can never invent one. */
const ACCOUNT_LINKS: AssistantLink[] = [
  { label: "Open My library", href: "/account/downloads" },
  { label: "Help: downloads", href: "/faq" },
  { label: "Contact us", href: "/contact" },
];

function offTopicReply(latest: string): OkReply {
  if (ACCOUNT_QUESTION.test(latest)) {
    return say(
      "I only help with finding patterns. Your files are always in My library, and the download link is in your order email.",
      { mood: "helping", links: ACCOUNT_LINKS },
    );
  }
  return say(
    "I'm here to help you find Meemi Art crochet patterns. Tell me what you'd like to make and I'll look through the catalogue.",
    { mood: "helping", chips: chipsOf(STARTER_REPLIES) },
  );
}

/** What a customer was asking for, in the words they would use: "flower pattern". */
function subjectOf(intent: CatalogIntent, categories: AssistantCategory[]): string {
  const words = intent.keywords.join(" ").trim();
  if (words) return `${words} pattern`;
  const category = categories.find((c) => c.slug === intent.categorySlug)?.name;
  return category ? category.toLowerCase() : "pattern";
}

/** The filter that was let go, as the customer said it: "beginner", "under $5". */
function droppedPhrase(criterion: CriterionKey, intent: CatalogIntent): string {
  switch (criterion) {
    case "difficulty":
      return LEVEL_LABELS.get(intent.difficulty?.level ?? "BEGINNER")?.toLowerCase() ?? "that skill level";
    case "price":
      return intent.maxPriceCents !== null
        ? `under ${formatMoney(intent.maxPriceCents)}`
        : intent.minPriceCents !== null
          ? `over ${formatMoney(intent.minPriceCents)}`
          : "that price";
    case "time":
      return `under ${describeTimeCap(intent.maxMinutes ?? 0)}`;
    case "techniques":
      return "that technique";
  }
}

/**
 * The relaxation to use: the one that finds the most patterns, and among ties
 * the least important filter (the matching engine's own weights), so a stated
 * skill level outlives a stated budget.
 */
function pickRelaxation(relaxations: Relaxation[]): Relaxation {
  return [...relaxations].sort(
    (a, b) => b.matches - a.matches || MATCH_WEIGHTS[a.criterion] - MATCH_WEIGHTS[b.criterion],
  )[0];
}

function cardsFor(products: CandidateProduct[]): AssistantRecommendation[] {
  return products.slice(0, 4).map((product) => ({
    product: toPublicProduct(product),
    reason: "",
    reasons: product.match?.reasons ?? [],
    rank: null,
  }));
}

/**
 * "No beginner flower pattern yet, so I dropped "beginner". This is the closest
 * match." — nothing matched everything, so show what matches almost everything
 * and say exactly which filter was let go.
 *
 * Written entirely by the server from retrieved products: no model is asked, so
 * it also works while the model is down.
 */
async function closestReply(
  intent: CatalogIntent,
  catalog: AssistantCatalog,
  categories: AssistantCategory[],
  viewing: CandidateProduct | null,
  relaxations: Relaxation[],
): Promise<OkReply | null> {
  if (relaxations.length === 0) return null;
  const { criterion } = pickRelaxation(relaxations);
  const relaxed = withoutCriterion(intent, criterion);
  const closest = await catalog.retrieveCandidates(relaxed, viewing?.slug ?? null);
  if (closest.products.length === 0) return null;

  const dropped = droppedPhrase(criterion, intent);
  const subject = subjectOf(intent, categories);
  const tail = closest.products.length === 1 ? "This is the closest match." : "These are the closest matches.";
  const message =
    criterion === "techniques"
      ? `No ${subject} with that technique yet, so I dropped the technique request. ${tail}`
      : criterion === "difficulty"
        ? `No ${dropped} ${subject} yet, so I dropped "${dropped}". ${tail}`
        : `No ${subject} ${dropped} yet, so I dropped "${dropped}". ${tail}`;

  const keepQuery =
    criterion === "difficulty"
      ? `${dropped.charAt(0).toUpperCase()}${dropped.slice(1)} patterns`
      : criterion === "price" || criterion === "time"
        ? `Patterns ${dropped}`
        : null;
  const chips: AssistantChip[] = [
    ...(keepQuery ? [{ label: `Keep ${dropped}, any kind`, query: keepQuery }] : []),
    { label: "Gift ideas", query: "Gift ideas" },
  ];

  return say(message, { recommendations: cardsFor(closest.products), chips, mood: "unsure" });
}

/**
 * The same for a keyword nothing matched: the search was re-run without it, so
 * say which words were let go rather than presenting the result as a match.
 */
function broadenedReply(intent: CatalogIntent, retrieval: Retrieval): OkReply {
  const words = intent.keywords.join(" ").trim();
  const tail = retrieval.products.length === 1 ? "This is the closest match." : "These are the closest matches.";
  return say(`No ${words} pattern yet, so I dropped "${words}". ${tail}`, {
    recommendations: cardsFor(retrieval.products),
    chips: chipsOf(["Gift ideas", "Help me choose"]),
    mood: "unsure",
  });
}

// ---------------------------------------------------------------- the turn

function referenced(products: CandidateProduct[]): ReferencedProduct[] {
  return products.map((product, index) => ({ ref: `p${index + 1}`, product }));
}

/**
 * Run one turn. Errors from the database or the model propagate; use
 * `runAssistantSafely` at the edge.
 */
export async function runAssistant(
  request: AssistantRequest,
  llm: AssistantLlm,
  catalog: AssistantCatalog = DATABASE_CATALOG,
): Promise<AssistantReply> {
  const [categories, viewing] = await Promise.all([
    catalog.getAssistantCategories(),
    request.productSlug ? catalog.findSellableProduct(request.productSlug) : Promise.resolve(null),
  ]);

  const latest = request.history.findLast((turn) => turn.role === "user")?.content ?? "";
  const parsed = preParse(latest);

  let intent: CatalogIntent;
  if (preParseStandsAlone(parsed, request.history)) {
    intent = intentFromPreParse(parsed);
  } else {
    // A failed intent call degrades to an unfiltered search instead of failing
    // the turn: the reply model can still help, and still sees only real data.
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
  }

  // Off-topic turns never reach the catalogue or the second model.
  if (intent.outOfScope) return offTopicReply(latest);

  if (intent.kind === "compare" || intent.kind === "explain") {
    return runNamedTurn(request, llm, catalog, intent, categories, viewing);
  }

  const retrieval = await catalog.retrieveCandidates(intent, viewing?.slug ?? null);

  // Nothing matched stated criteria: say so from the catalogue, without a model.
  if (retrieval.products.length === 0 && retrieval.criteria.length > 0) {
    if (retrieval.notAssessed) {
      return say(
        "Our patterns haven't been given difficulty, time or technique assessments yet, so I can't match them by skill level, time or technique. I can still help you find patterns by theme or budget.",
        { chips: chipsOf(STARTER_REPLIES), mood: "unsure" },
      );
    }

    // Show the closest patterns and say which filter was dropped.
    const closest = await closestReply(intent, catalog, categories, viewing, retrieval.relaxations);
    if (closest) return closest;

    return say("Nothing in the catalogue matches that yet. Try a broader search or browse all patterns.", {
      chips: chipsOf(STARTER_REPLIES),
      mood: "unsure",
    });
  }

  // Nothing matched the keywords: the search was widened, so say what was dropped.
  if (retrieval.broadened && retrieval.products.length > 0 && intent.keywords.length > 0) {
    return broadenedReply(intent, retrieval);
  }

  const products = referenced(retrieval.products);
  const raw = await llm.composeReply({
    history: request.history,
    intent,
    retrieval,
    categories,
    viewing,
    products,
    comparison: null,
  });

  if (raw === REFUSED) return TROUBLE;

  const refs = new Map(products.map(({ ref, product }) => [ref, product]));
  const reply = validateReply(raw, refs);
  if (!reply) return TROUBLE;

  const inContext = [...retrieval.products, ...(viewing ? [viewing] : [])];
  const ranked = retrieval.criteria.length > 0;
  const order = new Map(retrieval.products.map((p, index) => [p.slug, index]));

  // With stated criteria the server's ranking decides the order, not the model.
  const chosen = ranked
    ? [...reply.recommendations].sort((a, b) => (order.get(a.product.slug) ?? 0) - (order.get(b.product.slug) ?? 0))
    : reply.recommendations;
  const topScore = retrieval.products[0]?.match?.score ?? null;

  const recommendations: AssistantRecommendation[] = chosen.map((rec, index) => ({
    product: toPublicProduct(rec.product),
    reason: makesUnsupportedClaim(rec.reason, inContext, intent) ? "" : rec.reason,
    reasons: rec.product.match?.reasons ?? [],
    rank: !ranked ? null : index === 0 && rec.product.match?.score === topScore ? "best" : "also",
  }));

  const followUp =
    reply.followUpQuestion && makesUnsupportedClaim(reply.followUpQuestion, inContext, intent)
      ? null
      : reply.followUpQuestion;

  const message = makesUnsupportedClaim(reply.message, inContext, intent)
    ? ranked
      ? "Here are the patterns that match what you asked for."
      : "Here are some patterns from the Meemi Art catalogue."
    : reply.message;

  return {
    ok: true,
    message,
    recommendations,
    followUpQuestion: followUp,
    chips: chipsOf(reply.quickReplies),
    links: [],
    mood: recommendations.length > 0 ? "happy" : "curious",
    comparison: null,
  };
}

/** A comparison of two named patterns, or a question about one. */
async function runNamedTurn(
  request: AssistantRequest,
  llm: AssistantLlm,
  catalog: AssistantCatalog,
  intent: CatalogIntent,
  categories: AssistantCategory[],
  viewing: CandidateProduct | null,
): Promise<AssistantReply> {
  const compare = intent.kind === "compare";
  const needed = compare ? 2 : 1;

  if (intent.useViewingProduct && !viewing && intent.productNames.length === 0) {
    return say(
      compare
        ? "Which two patterns would you like me to compare? Tell me their names."
        : "Which pattern would you like to know about? Tell me its name.",
    );
  }

  const matches = await catalog.findProductsByName(intent.productNames.slice(0, needed));
  const unresolved = unresolvedNames(matches);
  if (unresolved) return unresolved;

  const found = matches.flatMap((m) => (m.status === "found" ? [m.product] : []));
  const targets = [...(intent.useViewingProduct && viewing ? [viewing] : []), ...found]
    .filter((product, index, all) => all.findIndex((p) => p.slug === product.slug) === index)
    .slice(0, needed);

  if (targets.length < needed) {
    return say(
      compare
        ? targets.length === 1
          ? `Which pattern would you like to compare with ${targets[0].name}? Tell me its name.`
          : "Which two patterns would you like me to compare? Tell me their names."
        : "Which pattern would you like to know about? Tell me its name.",
    );
  }

  const comparison = compare ? buildComparison(targets) : null;
  const fallbackMessage = compare
    ? `Here's how ${targets[0].name} and ${targets[1].name} compare.`
    : explainFacts(targets[0]);

  const cards = (reasons: Map<string, string>): AssistantRecommendation[] =>
    targets.map((product) => ({
      product: toPublicProduct(product),
      reason: reasons.get(product.slug) ?? "",
      reasons: [],
      rank: null,
    }));

  const products = referenced(targets);
  const retrieval: Retrieval = {
    products: targets,
    broadened: false,
    current: viewing,
    criteria: [],
    notAssessed: false,
    relaxations: [],
  };

  const raw = await llm.composeReply({
    history: request.history,
    intent,
    retrieval,
    categories,
    viewing,
    products,
    comparison,
  });

  // The facts are already in hand, so a refused or malformed phrasing still
  // answers the question — from the server's own wording.
  const reply = raw === REFUSED ? null : validateReply(raw, new Map(products.map(({ ref, product }) => [ref, product])));
  if (!reply || makesUnsupportedClaim(reply.message, targets, intent)) {
    return say(fallbackMessage, { recommendations: cards(new Map()), comparison });
  }

  const reasons = new Map(
    reply.recommendations
      .filter((rec) => !makesUnsupportedClaim(rec.reason, targets, intent))
      .map((rec) => [rec.product.slug, rec.reason]),
  );

  return {
    ok: true,
    message: reply.message,
    recommendations: cards(reasons),
    followUpQuestion:
      reply.followUpQuestion && !makesUnsupportedClaim(reply.followUpQuestion, targets, intent)
        ? reply.followUpQuestion
        : null,
    chips: chipsOf(reply.quickReplies),
    links: [],
    mood: "happy",
    comparison,
  };
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
  catalog?: AssistantCatalog,
  timeoutMs: number = TURN_TIMEOUT_MS,
): Promise<AssistantReply> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      runAssistant(request, llm, catalog),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("assistant turn timed out")), timeoutMs);
      }),
    ]);
  } catch (error) {
    console.error("[assistant] turn failed:", describeError(error));
    return TROUBLE;
  } finally {
    clearTimeout(timer);
  }
}
