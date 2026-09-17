import { PRICE_BOUNDS } from "@/lib/config";
import { ESTIMATE_MINUTES_MAX, ESTIMATE_MINUTES_MIN, type DifficultyLevel } from "@/lib/difficulty/engine";
import type { TechniqueSlug } from "@/lib/difficulty/techniques";

/**
 * The Pattern Concierge's deterministic pre-parser.
 *
 * Common, unambiguous requests — "Something under $5", "Find me a beginner
 * pattern", "I only have about 2 hours", "Compare Garden Bunny and Rainbow
 * Blanket" — are turned into structured criteria here, without the intent
 * model. That saves one Gemini call per turn and makes the everyday requests
 * behave identically every time.
 *
 * It is deliberately conservative. It answers only when every word of the
 * message is accounted for: a recognised constraint, a comparison or product
 * question, or generic filler ("show me", "something", "pattern"). Anything
 * else — a theme ("flower"), a follow-up ("any cheaper?", "why?"), a minimum
 * price, two conflicting amounts — returns null and the validated intent model
 * handles it as before.
 *
 * Pure: no I/O, no clock, no randomness.
 */

// ---------------------------------------------------------------- fixed meanings

/**
 * Vague time requests, given fixed, conservative meanings (approved):
 *
 *   quick    at most 2 hours
 *   tonight  at most 3 hours
 *   weekend  at most 10 hours
 */
export const TIME_PHRASE_MINUTES = { quick: 120, tonight: 180, weekend: 600 } as const;
export type TimePhrase = keyof typeof TIME_PHRASE_MINUTES;

export type DifficultyMode = "exact" | "atMost" | "atLeast";
export type DifficultyCriterion = { level: DifficultyLevel; mode: DifficultyMode };

/**
 * How a bare level word is read. Asking for a beginner or easy pattern means
 * "no harder than that"; asking for advanced or expert means "at least that";
 * intermediate means intermediate.
 */
export const DEFAULT_MODE_FOR_LEVEL: Readonly<Record<DifficultyLevel, DifficultyMode>> = {
  BEGINNER: "atMost",
  EASY: "atMost",
  INTERMEDIATE: "exact",
  ADVANCED: "atLeast",
  EXPERT: "atLeast",
};

export type PreParsed = {
  kind: "search" | "compare" | "explain";
  maxPriceCents: number | null;
  sort: "relevance" | "price-asc";
  difficulty: DifficultyCriterion | null;
  maxMinutes: number | null;
  techniqueGroups: TechniqueSlug[][];
  /** Product names as the customer wrote them, for compare and explain. */
  productNames: string[];
  /** The customer referred to the product they are viewing ("this pattern"). */
  useViewingProduct: boolean;
};

// ---------------------------------------------------------------- helpers

function normalize(message: string): string {
  return message
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/'/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Remove every match of a pattern, so matched words do not count as leftovers. */
function strip(text: string, pattern: RegExp): string {
  return text.replace(new RegExp(pattern.source, "g"), " ");
}

function clampMinutes(minutes: number): number | null {
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  return Math.min(ESTIMATE_MINUTES_MAX, Math.max(ESTIMATE_MINUTES_MIN, Math.round(minutes)));
}

const VIEWING_REFERENCE = /^(?:this|this one|this pattern|it|that one|that pattern)$/;

/**
 * A product name as the customer (or the intent model) wrote it, reduced to
 * plain text: no quotes or symbols, a leading article and a trailing "pattern"
 * removed, 2–80 characters. Null for anything else.
 */
export function cleanProductName(value: string): string | null {
  const text = value
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}\s&-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(?:the|a|an)\s+/i, "")
    .replace(/\s+(?:crochet\s+)?patterns?$/i, "")
    .trim();
  return text.length >= 2 && text.length <= 80 ? text : null;
}

// ---------------------------------------------------------------- techniques

/**
 * Phrases a shopper uses for techniques in the controlled vocabulary. Each maps
 * to a group of slugs, of which a product must use at least one. Ordered so a
 * longer phrase is consumed before a shorter one inside it ("half double
 * crochet" before "double crochet").
 */
const TECHNIQUE_PHRASES: { pattern: RegExp; slugs: TechniqueSlug[] }[] = [
  { pattern: /\bhalf[ -]double(?: crochet)?s?\b|\bhdc\b/, slugs: ["half-double-crochet"] },
  { pattern: /\btreble(?: crochet)?s?\b/, slugs: ["treble-crochet"] },
  { pattern: /\bdouble crochets?\b/, slugs: ["double-crochet"] },
  { pattern: /\bsingle crochets?\b/, slugs: ["single-crochet"] },
  { pattern: /\bslip ?stitch(?:es)?\b/, slugs: ["slip-stitch"] },
  { pattern: /\bchain stitch(?:es)?\b|\bchains?\b/, slugs: ["chain"] },
  { pattern: /\b(?:front|back)[ -]loops?(?: only)?\b|\bflo\b|\bblo\b/, slugs: ["front-back-loop-only"] },
  { pattern: /\bmagic (?:ring|circle|loop)s?\b/, slugs: ["magic-ring"] },
  { pattern: /\binvisible decreases?\b|\bdecreases?\b|\bdecreasing\b/, slugs: ["invisible-decrease"] },
  { pattern: /\bincreases?\b|\bincreasing\b/, slugs: ["increase"] },
  { pattern: /\bshaping\b/, slugs: ["increase", "invisible-decrease"] },
  { pattern: /\bworking in rounds\b|\bin (?:the )?rounds?\b/, slugs: ["working-in-rounds"] },
  { pattern: /\bworking in rows\b|\bin rows\b/, slugs: ["working-in-rows"] },
  { pattern: /\btapestry(?: crochet)?\b/, slugs: ["tapestry-crochet"] },
  { pattern: /\bcolou?r ?work\b|\bcolou?r chang(?:es|e|ing)\b|\bmulti-?colou?r(?:ed)?\b/, slugs: ["color-changes", "tapestry-crochet"] },
  { pattern: /\bgranny squares?\b|\bmotifs?\b/, slugs: ["motifs"] },
  { pattern: /\bjoining(?: pieces)?\b/, slugs: ["joining-pieces"] },
  { pattern: /\bsurface crochet\b/, slugs: ["surface-crochet"] },
  { pattern: /\b3 ?d(?: elements?| details?| shapes?)?\b/, slugs: ["3d-elements"] },
  { pattern: /\bstuff(?:ing|ed)\b/, slugs: ["stuffing"] },
  { pattern: /\bsafety eyes\b/, slugs: ["safety-eyes"] },
  { pattern: /\bsewing(?: pieces)?\b|\bsew(?:n|ing)? (?:pieces )?together\b/, slugs: ["sewing-pieces"] },
  { pattern: /\b(?:reading )?charts?\b|\bdiagrams?\b/, slugs: ["reading-charts"] },
  { pattern: /\bmultiple sizes\b|\bseveral sizes\b|\bsizing\b/, slugs: ["multiple-sizes"] },
];

/**
 * Technique groups named in free text, and the text with those phrases (and a
 * "no-sew", which is a product line, not a technique) removed.
 */
export function resolveTechniquePhrases(text: string): { groups: TechniqueSlug[][]; rest: string } {
  let rest = strip(text.toLowerCase(), /\bno[- ]?sew\b/);
  const groups: TechniqueSlug[][] = [];
  const seen = new Set<string>();
  for (const { pattern, slugs } of TECHNIQUE_PHRASES) {
    if (new RegExp(pattern.source).test(rest)) {
      const key = slugs.join("|");
      if (!seen.has(key)) {
        seen.add(key);
        groups.push([...slugs]);
      }
      rest = strip(rest, pattern);
    }
  }
  return { groups, rest };
}

// ---------------------------------------------------------------- levels

const LEVEL_PHRASES: { pattern: RegExp; level: DifficultyLevel }[] = [
  {
    pattern:
      /\bcomplete beginners?\b|\bbeginner[- ]friendly\b|\bbeginners?\b|\bfirst (?:ever )?(?:crochet )?project\b|\bnew to crochet\b|\bnever crocheted\b/,
    level: "BEGINNER",
  },
  { pattern: /\bexperts?\b/, level: "EXPERT" },
  { pattern: /\badvanced\b|\bdifficult\b|\bhard\b|\bchallenging\b|\bchallenge\b|\bcomplex\b/, level: "ADVANCED" },
  { pattern: /\bintermediate\b/, level: "INTERMEDIATE" },
  { pattern: /\beasy\b|\beasier\b|\bsimple\b/, level: "EASY" },
];

// ---------------------------------------------------------------- time

const WORD_NUMBERS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
};

const HOUR_RANGE = /\b(\d{1,3}(?:\.\d)?)\s*(?:-|–|to)\s*(\d{1,3}(?:\.\d)?)\s*(?:hours?|hrs?|h)\b/;
const HOUR_AND_HALF = /\b(?:an?|one) hour and a half\b|\bone and a half hours?\b/;
const HALF_HOUR = /\bhalf an? hour\b/;
const HOURS = /\b(\d{1,3}(?:\.\d{1,2})?|an?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s*(?:hours?|hrs?|h)\b/;
const MINUTES = /\b(\d{1,4})\s*(?:minutes?|mins?)\b/;
const WEEKEND = /\b(?:this |a |one |over the |on the )?weekends?\b/;
const TONIGHT = /\btonight\b|\bthis evening\b|\bin (?:one|an) evening\b|\bone evening\b/;
const QUICK = /\bquick(?:ly)?\b|\bfast\b/;

function parseTime(input: string): { minutes: number | null; conflict: boolean; rest: string } {
  let rest = input;
  const explicit: number[] = [];

  const collect = (pattern: RegExp, toMinutes: (match: RegExpMatchArray) => number) => {
    for (const match of rest.matchAll(new RegExp(pattern.source, "g"))) explicit.push(toMinutes(match));
    rest = strip(rest, pattern);
  };

  collect(HOUR_RANGE, (m) => Math.round(parseFloat(m[2]) * 60));
  collect(HOUR_AND_HALF, () => 90);
  collect(HALF_HOUR, () => 30);
  collect(HOURS, (m) => Math.round((WORD_NUMBERS[m[1]] ?? parseFloat(m[1])) * 60));
  collect(MINUTES, (m) => parseInt(m[1], 10));

  const phrases: number[] = [];
  for (const [pattern, minutes] of [
    [WEEKEND, TIME_PHRASE_MINUTES.weekend],
    [TONIGHT, TIME_PHRASE_MINUTES.tonight],
    [QUICK, TIME_PHRASE_MINUTES.quick],
  ] as const) {
    if (new RegExp(pattern.source).test(rest)) {
      phrases.push(minutes);
      rest = strip(rest, pattern);
    }
  }

  const distinct = [...new Set(explicit.map(clampMinutes).filter((m): m is number => m !== null))];
  if (distinct.length > 1) return { minutes: null, conflict: true, rest };
  if (distinct.length === 1) return { minutes: distinct[0], conflict: false, rest };
  // Several vague phrases ("a quick weekend project"): the tighter one wins.
  return { minutes: phrases.length > 0 ? Math.min(...phrases) : null, conflict: false, rest };
}

// ---------------------------------------------------------------- price

const AMOUNT = /\$\s*(\d{1,4}(?:\.\d{1,2})?)|\b(\d{1,4}(?:\.\d{1,2})?)\s*(?:dollars?|usd|bucks)\b/;
const MIN_PRICE = /\b(?:over|above|more than|at least|from|starting at|minimum)\s*\$?\s*\d/;
const CHEAP = /\bcheap(?:est|er)?\b|\binexpensive\b|\baffordable\b|\blow[- ]budget\b|\bbudget[- ]friendly\b/;

function parsePrice(input: string): { maxPriceCents: number | null; conflict: boolean; cheap: boolean; rest: string } {
  if (new RegExp(MIN_PRICE.source).test(input)) return { maxPriceCents: null, conflict: true, cheap: false, rest: input };

  const amounts = [...input.matchAll(new RegExp(AMOUNT.source, "g"))].map((m) =>
    Math.round(parseFloat(m[1] ?? m[2]) * 100),
  );
  let rest = strip(input, AMOUNT);
  const distinct = [...new Set(amounts.filter((c) => Number.isFinite(c) && c > 0))];
  if (distinct.length > 1) return { maxPriceCents: null, conflict: true, cheap: false, rest };

  const cheap = new RegExp(CHEAP.source).test(rest);
  rest = strip(rest, CHEAP);
  return {
    maxPriceCents: distinct.length === 1 ? Math.min(distinct[0], PRICE_BOUNDS.max) : null,
    conflict: false,
    cheap,
    rest,
  };
}

// ---------------------------------------------------------------- compare & explain

const COMPARE_WORD = /\bcompare\b|\bcomparison\b|\bversus\b|\bvs\b|\bdifferences? between\b/;
const COMPARE_NAMES = [
  /\b(?:compare|comparison (?:of|between)|differences? between)\s+(.+?)\s+(?:and|with|to|vs|versus|&)\s+(.+)$/,
  /^(.+?)\s+(?:vs|versus)\s+(.+)$/,
];

const EXPLAIN_NAMES = [
  /^(?:is|are)\s+(.+?)\s+(?:(?:very |too |really |quite )?(?:difficult|hard|easy|tricky|challenging)|beginner[- ]friendly|good for (?:a |an )?(?:complete )?beginners?|suitable for (?:a |an )?beginners?)$/,
  /^how\s+(?:hard|difficult|easy|tricky|challenging)\s+is\s+(.+)$/,
  /^how\s+long\s+(?:does|will|would)\s+(.+?)\s+take(?:\s+to\s+(?:make|finish|crochet))?$/,
  /^what\s+(?:techniques|skills|stitches)\s+(?:does|do|will)\s+(.+?)\s+(?:use|need|require)$/,
  /^whats?\s+(?:is\s+)?the\s+difficulty\s+(?:of|for)\s+(.+)$/,
];

function namesFrom(raw: string[]): { productNames: string[]; useViewingProduct: boolean } {
  const productNames: string[] = [];
  let useViewingProduct = false;
  for (const value of raw) {
    const trimmed = value.trim();
    if (VIEWING_REFERENCE.test(trimmed)) {
      useViewingProduct = true;
      continue;
    }
    const name = cleanProductName(trimmed);
    if (name) productNames.push(name);
  }
  return { productNames, useViewingProduct };
}

// ---------------------------------------------------------------- confidence

/** Words that point back into the conversation; only the intent model can resolve them. */
const FOLLOW_UP = /\bwhy\b|\bcheaper\b|\banother\b|\bothers?\b|\belse\b|\binstead\b|\bsimilar\b|\bthose\b|\bthem\b|\bthese\b|\bprevious\b|\bagain\b|\bmore like\b|\blike (?:that|this|it)\b/;

/** Filler that carries no search meaning. Any other word sends the turn to the intent model. */
const GENERIC_WORDS = new Set(
  `a an the i im ive id me my we our you your it its is are am be been to for of in on at by with and or but so if
  this that which what whats who how
  something anything some any one ones pattern patterns project projects crochet crocheting piece pieces
  find show give get got recommend suggest suggestion suggestions want wants need needs like would love looking look search see
  have has only just about around roughly approximately under below less than up max maximum most no within budget spend spending
  dollar dollars usd bucks hours hour hrs hr minutes mins time finish finished done complete make making made do can could should will
  level skill skilled skills practice practise learn learning try trying uses use using used good great nice perfect ideal suitable friendly
  please thanks thank hi hello hey there evening available`
    .split(/\s+/)
    .filter(Boolean),
);

function onlyGenericWords(rest: string): boolean {
  return rest
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => GENERIC_WORDS.has(word));
}

// ---------------------------------------------------------------- entry point

const EMPTY: Omit<PreParsed, "kind"> = {
  maxPriceCents: null,
  sort: "relevance",
  difficulty: null,
  maxMinutes: null,
  techniqueGroups: [],
  productNames: [],
  useViewingProduct: false,
};

/**
 * Structured criteria for a message, or null when the message should go to the
 * intent model.
 */
export function preParse(message: string): PreParsed | null {
  const text = normalize(message).replace(/[?.!]+$/g, "").trim();
  if (!text) return null;

  // Comparisons: names are free text, so no leftover check applies. With fewer
  // than two names the run asks which patterns to compare — it never guesses.
  if (new RegExp(COMPARE_WORD.source).test(text)) {
    for (const pattern of COMPARE_NAMES) {
      const match = text.match(pattern);
      if (match) return { ...EMPTY, kind: "compare", ...namesFrom([match[1], match[2]]) };
    }
    return { ...EMPTY, kind: "compare" };
  }

  for (const pattern of EXPLAIN_NAMES) {
    const match = text.match(pattern);
    if (match) {
      const names = namesFrom([match[1]]);
      if (names.productNames.length > 0 || names.useViewingProduct) return { ...EMPTY, kind: "explain", ...names };
    }
  }

  if (new RegExp(FOLLOW_UP.source).test(text)) return null;

  const price = parsePrice(text);
  if (price.conflict) return null;

  const time = parseTime(price.rest);
  if (time.conflict) return null;

  let rest = time.rest;
  const levels = new Set<DifficultyLevel>();
  for (const { pattern, level } of LEVEL_PHRASES) {
    if (new RegExp(pattern.source).test(rest)) {
      levels.add(level);
      rest = strip(rest, pattern);
    }
  }
  if (levels.size > 1) return null;
  const level = [...levels][0] ?? null;

  const techniques = resolveTechniquePhrases(rest);
  rest = techniques.rest;

  if (!onlyGenericWords(rest)) return null;

  const hasCriterion =
    price.maxPriceCents !== null || level !== null || time.minutes !== null || techniques.groups.length > 0;
  if (!hasCriterion && !price.cheap) return null;

  return {
    ...EMPTY,
    kind: "search",
    maxPriceCents: price.maxPriceCents,
    sort: price.cheap || price.maxPriceCents !== null ? "price-asc" : "relevance",
    difficulty: level ? { level, mode: DEFAULT_MODE_FOR_LEVEL[level] } : null,
    maxMinutes: time.minutes,
    techniqueGroups: techniques.groups,
  };
}

// ---------------------------------------------------------------- name resolution

const NAME_STOPWORDS = new Set(["the", "a", "an", "pattern", "patterns", "crochet", "pdf", "digital", "download", "file"]);

function nameTokens(name: string): string[] {
  return name
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(" ")
    .filter((token) => token.length > 0 && !NAME_STOPWORDS.has(token));
}

export type NameMatch<T> =
  | { status: "found"; query: string; product: T }
  | { status: "missing"; query: string }
  | { status: "ambiguous"; query: string; options: T[] };

/**
 * Resolve a name the customer typed to one product, or say it cannot.
 *
 * A product matches when every meaningful word of the query is in its name. One
 * match is found; several are ambiguous unless exactly one name is the query
 * itself; none is missing. It never picks "the closest" product.
 */
export function resolveProductName<T extends { name: string }>(query: string, products: readonly T[]): NameMatch<T> {
  const wanted = nameTokens(query);
  if (wanted.length === 0) return { status: "missing", query };

  const matches = products.filter((product) => {
    const tokens = new Set(nameTokens(product.name));
    return wanted.every((token) => tokens.has(token));
  });

  if (matches.length === 1) return { status: "found", query, product: matches[0] };
  if (matches.length === 0) return { status: "missing", query };

  const exact = matches.filter((product) => nameTokens(product.name).join(" ") === wanted.join(" "));
  if (exact.length === 1) return { status: "found", query, product: exact[0] };

  return { status: "ambiguous", query, options: matches.slice(0, 4) };
}
