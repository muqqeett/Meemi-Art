import { DIFFICULTY_LEVELS, type DifficultyLevel } from "@/lib/difficulty/engine";
import { techniqueLabel } from "@/lib/difficulty/techniques";
import { formatMoney } from "@/lib/money";
import type { DifficultyCriterion } from "@/lib/assistant/parse";

/**
 * The Pattern Concierge's matching engine.
 *
 * Pure and deterministic. Gemini never computes a score, a rank or a reason:
 * this module does, and the model is only asked to phrase what it produced.
 *
 * ── Hard filters ──────────────────────────────────────────────────────────
 *
 * Every constraint the customer states is a hard filter. A product that fails
 * one is excluded, not ranked lower:
 *
 *   price       priceCents ≤ the stated cap
 *   difficulty  the product's derived level satisfies the level and mode
 *               (at most / exactly / at least)
 *   time        minutesMax ≤ the stated cap — conservative: the pattern's
 *               upper estimate must fit
 *   techniques  for every requested group, the product uses at least one
 *
 * Difficulty, time and techniques exist only in an enabled `ProductDifficulty`
 * row, read through the Difficulty engine. A product without one can never
 * satisfy those constraints — nothing is inferred from a description.
 *
 * ── Ranking ───────────────────────────────────────────────────────────────
 *
 * Products that pass are ranked by a weighted average over only the criteria
 * the customer stated, re-normalised to those weights (approved):
 *
 *   difficulty fit  40   1000 − 250 × level distance from the target
 *   time fit        30   1000 − ⌊minutesMax × 500 ÷ cap⌋        (500–1000)
 *   technique fit   20   average over groups of ⌊1000 × used ÷ group size⌋
 *   price headroom  10   1000 − ⌊priceCents × 1000 ÷ cap⌋        (0–1000)
 *
 *   score = ⌊ Σ fit × weight ÷ Σ weight ⌋    over stated criteria only
 *
 * All integer arithmetic. Ties break by lower price, then name, so the order is
 * identical on every run. The score is never shown: customers see "Best match"
 * and "Also worth considering" with the reasons below.
 */

export const MATCH_WEIGHTS = { difficulty: 40, time: 30, techniques: 20, price: 10 } as const;
export type CriterionKey = keyof typeof MATCH_WEIGHTS;

/** Criteria, in the order reasons and relaxations are listed. */
const CRITERION_ORDER: CriterionKey[] = ["difficulty", "time", "techniques", "price"];

export type MatchCriteria = {
  maxPriceCents: number | null;
  difficulty: DifficultyCriterion | null;
  maxMinutes: number | null;
  techniqueGroups: readonly (readonly string[])[];
};

/** A product's assessment, as derived by the Difficulty engine. */
export type MatchableAssessment = {
  level: DifficultyLevel;
  levelLabel: string;
  estimatedTime: string;
  minutesMin: number;
  minutesMax: number;
  techniqueSlugs: readonly string[];
};

export type MatchableProduct = {
  name: string;
  priceCents: number;
  assessment: MatchableAssessment | null;
};

export type Ranked<T> = { product: T; score: number; reasons: string[] };

const LEVEL_INDEX = new Map<DifficultyLevel, number>(DIFFICULTY_LEVELS.map((entry, index) => [entry.level, index]));

export function statedCriteria(criteria: MatchCriteria): CriterionKey[] {
  return CRITERION_ORDER.filter((key) => {
    switch (key) {
      case "difficulty":
        return criteria.difficulty !== null;
      case "time":
        return criteria.maxMinutes !== null;
      case "techniques":
        return criteria.techniqueGroups.length > 0;
      case "price":
        return criteria.maxPriceCents !== null;
    }
  });
}

/** Levels between the product and the target, or null when the mode excludes it. */
function levelDistance(level: DifficultyLevel, criterion: DifficultyCriterion): number | null {
  const actual = LEVEL_INDEX.get(level) ?? 0;
  const target = LEVEL_INDEX.get(criterion.level) ?? 0;
  switch (criterion.mode) {
    case "exact":
      return actual === target ? 0 : null;
    case "atMost":
      return actual <= target ? target - actual : null;
    case "atLeast":
      return actual >= target ? actual - target : null;
  }
}

export function passesHardFilters(product: MatchableProduct, criteria: MatchCriteria): boolean {
  if (criteria.maxPriceCents !== null && product.priceCents > criteria.maxPriceCents) return false;

  const needsAssessment =
    criteria.difficulty !== null || criteria.maxMinutes !== null || criteria.techniqueGroups.length > 0;
  if (!needsAssessment) return true;

  const assessment = product.assessment;
  if (!assessment) return false;
  if (criteria.difficulty && levelDistance(assessment.level, criteria.difficulty) === null) return false;
  if (criteria.maxMinutes !== null && assessment.minutesMax > criteria.maxMinutes) return false;
  for (const group of criteria.techniqueGroups) {
    if (!group.some((slug) => assessment.techniqueSlugs.includes(slug))) return false;
  }
  return true;
}

/** Per-criterion fit in thousandths, for a product that passes the hard filters. */
export function criterionFits(product: MatchableProduct, criteria: MatchCriteria): Partial<Record<CriterionKey, number>> {
  const fits: Partial<Record<CriterionKey, number>> = {};
  const assessment = product.assessment;

  if (criteria.difficulty && assessment) {
    const distance = levelDistance(assessment.level, criteria.difficulty) ?? 4;
    fits.difficulty = Math.max(0, 1000 - 250 * distance);
  }
  if (criteria.maxMinutes !== null && assessment) {
    fits.time = Math.max(0, 1000 - Math.floor((assessment.minutesMax * 500) / criteria.maxMinutes));
  }
  if (criteria.techniqueGroups.length > 0 && assessment) {
    const total = criteria.techniqueGroups.reduce((sum, group) => {
      const used = group.filter((slug) => assessment.techniqueSlugs.includes(slug)).length;
      return sum + Math.floor((1000 * used) / group.length);
    }, 0);
    fits.techniques = Math.floor(total / criteria.techniqueGroups.length);
  }
  if (criteria.maxPriceCents !== null) {
    fits.price =
      criteria.maxPriceCents > 0
        ? Math.max(0, 1000 - Math.floor((product.priceCents * 1000) / criteria.maxPriceCents))
        : 1000;
  }
  return fits;
}

/** The weighted, re-normalised score in thousandths; 0 when nothing was stated. */
export function matchScore(product: MatchableProduct, criteria: MatchCriteria): number {
  const stated = statedCriteria(criteria);
  if (stated.length === 0) return 0;
  const fits = criterionFits(product, criteria);
  let total = 0;
  let weight = 0;
  for (const key of stated) {
    total += (fits[key] ?? 0) * MATCH_WEIGHTS[key];
    weight += MATCH_WEIGHTS[key];
  }
  return Math.floor(total / weight);
}

function lowerFirst(label: string): string {
  return /^[A-Z][a-z]/.test(label) ? label.charAt(0).toLowerCase() + label.slice(1) : label;
}

/** The verified facts that make a product fit, for the criteria that were stated. */
export function matchReasons(product: MatchableProduct, criteria: MatchCriteria): string[] {
  const reasons: string[] = [];
  const assessment = product.assessment;

  if (criteria.difficulty && assessment) reasons.push(assessment.levelLabel);
  if (criteria.maxMinutes !== null && assessment) reasons.push(assessment.estimatedTime);
  if (criteria.techniqueGroups.length > 0 && assessment) {
    const used = new Set<string>();
    for (const group of criteria.techniqueGroups) {
      for (const slug of group) if (assessment.techniqueSlugs.includes(slug)) used.add(slug);
    }
    for (const slug of [...used].slice(0, 2)) {
      const label = techniqueLabel(slug);
      if (label) reasons.push(`Uses ${lowerFirst(label)}`);
    }
  }
  if (criteria.maxPriceCents !== null) reasons.push(`Within your ${formatMoney(criteria.maxPriceCents)} budget`);
  return reasons;
}

/** Products that pass the hard filters, best first, with their score and reasons. */
export function rankProducts<T extends MatchableProduct>(products: readonly T[], criteria: MatchCriteria): Ranked<T>[] {
  return products
    .filter((product) => passesHardFilters(product, criteria))
    .map((product) => ({ product, score: matchScore(product, criteria), reasons: matchReasons(product, criteria) }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.product.priceCents - b.product.priceCents ||
        a.product.name.localeCompare(b.product.name),
    );
}

/** "2 hours", "1.5 hours", "45 minutes" — for describing a time cap. */
export function describeTimeCap(minutes: number): string {
  if (minutes % 60 === 0) return `${minutes / 60} ${minutes === 60 ? "hour" : "hours"}`;
  if (minutes % 30 === 0 && minutes > 60) return `${Math.floor(minutes / 60)}.5 hours`;
  return `${minutes} minutes`;
}
