import { normalizeTechniques, techniqueLabel } from "@/lib/difficulty/techniques";

/**
 * Project Difficulty — the one place the score is worked out.
 *
 * Pure and deterministic: no database, no network, no clock, no AI. The admin
 * form imports it for its live preview and the server imports it to render
 * the product page, so there is a single formula. Nothing a browser sends is
 * ever treated as a score; only the six ratings are stored.
 *
 * ── Inputs ────────────────────────────────────────────────────────────────
 *
 * Six ratings, each a whole number from 1 to 10:
 *
 *   dimension        weight
 *   stitches           25%   how advanced the stitches are
 *   construction       20%   pieces, joins, 3D structure
 *   shaping            20%   increases, decreases, fitted or 3D shaping
 *   colorwork          10%   color changes, tapestry, charted color
 *   assembly           15%   stuffing, sewing, finishing
 *   patternReading     10%   charts, sizes, notation to keep track of
 *
 * Shaping outweighs assembly because the catalogue is amigurumi and garments,
 * where shaping decides the result, and its No-Sew Collection deliberately
 * keeps assembly light.
 *
 * ── The formula, in integer tenths ────────────────────────────────────────
 *
 * Scores are held as integer tenths (74 means 7.4) so no floating-point value
 * is ever compared or rounded. Decimals appear only when formatting.
 *
 *   1. Weighted sum      S = Σ rating × weight          weights sum to 100,
 *                                                        so 100 ≤ S ≤ 1000
 *   2. Weighted average  avg = floor((S + 5) / 10)      S/10 rounded half up:
 *                                                        10..100 tenths
 *   3. Hardest part      floor = (hardest − 2) × 10     in tenths
 *   4. Score             score = max(avg, floor)
 *
 * The hardest-part rule exists because an average hides a single hard skill:
 * a pattern that is simple except for detailed colorwork would otherwise read
 * as "Easy", and a beginner who cannot do that colorwork cannot finish it. So
 * a pattern is never scored more than two points below its most demanding
 * part. It never lifts a score above 8.0 on its own.
 *
 * ── Levels ────────────────────────────────────────────────────────────────
 *
 *   1.0–2.9  Beginner      (10–29 tenths)
 *   3.0–4.9  Easy          (30–49)
 *   5.0–6.9  Intermediate  (50–69)
 *   7.0–8.4  Advanced      (70–84)
 *   8.5–10   Expert        (85–100)
 *
 * ── Later ─────────────────────────────────────────────────────────────────
 *
 * Personal difficulty ("your estimated difficulty") can adjust the ratings for
 * a customer — say, lowering `colorwork` for someone who knows tapestry
 * crochet — and pass the result to `difficultyScoreTenths`. The stored inputs
 * and the general score do not change.
 */

/** Bumped if the formula ever changes, so a change is deliberate and visible. */
export const DIFFICULTY_MODEL_VERSION = 1;

export const DIFFICULTY_DIMENSIONS = [
  "stitches",
  "construction",
  "shaping",
  "colorwork",
  "assembly",
  "patternReading",
] as const;

export type DifficultyDimension = (typeof DIFFICULTY_DIMENSIONS)[number];

export const DIFFICULTY_WEIGHTS: Readonly<Record<DifficultyDimension, number>> = {
  stitches: 25,
  construction: 20,
  shaping: 20,
  colorwork: 10,
  assembly: 15,
  patternReading: 10,
};

/** Labels and a scoring guide, so different admins rate the same way. */
export const DIFFICULTY_DIMENSION_INFO: Readonly<Record<DifficultyDimension, { label: string; guide: string }>> = {
  stitches: {
    label: "Stitch complexity",
    guide: "1 basic stitches only · 5 several stitch types · 10 advanced or unusual stitches",
  },
  construction: {
    label: "Construction",
    guide: "1 one flat piece · 5 a few pieces or a 3D form · 10 many parts or an unusual structure",
  },
  shaping: {
    label: "Shaping",
    guide: "1 no shaping · 5 regular increases and decreases · 10 intricate 3D or fitted shaping",
  },
  colorwork: {
    label: "Colorwork",
    guide: "1 a single color · 5 a few color changes · 10 detailed tapestry or charted color",
  },
  assembly: {
    label: "Assembly",
    guide: "1 nothing to assemble · 5 some joining or stuffing · 10 extensive sewing and finishing",
  },
  patternReading: {
    label: "Pattern reading",
    guide: "1 short written steps · 5 longer rounds to track · 10 charts, sizes or dense notation",
  },
};

export const RATING_MIN = 1;
export const RATING_MAX = 10;
export const ESTIMATE_MINUTES_MIN = 15;
export const ESTIMATE_MINUTES_MAX = 12_000;
export const MAX_TECHNIQUES = 12;

export type DifficultyRatings = Readonly<Record<DifficultyDimension, number>>;

export type DifficultyProfile = DifficultyRatings & {
  readonly minutesMin: number;
  readonly minutesMax: number;
  readonly techniques: readonly string[];
};

/** A stored row, as the product page receives it. */
export type StoredDifficulty = DifficultyProfile & { readonly enabled: boolean };

export type DifficultyLevel = "BEGINNER" | "EASY" | "INTERMEDIATE" | "ADVANCED" | "EXPERT";

/** Lower bounds in tenths, ascending. */
export const DIFFICULTY_LEVELS: readonly { level: DifficultyLevel; label: string; fromTenths: number }[] = [
  { level: "BEGINNER", label: "Beginner", fromTenths: 10 },
  { level: "EASY", label: "Easy", fromTenths: 30 },
  { level: "INTERMEDIATE", label: "Intermediate", fromTenths: 50 },
  { level: "ADVANCED", label: "Advanced", fromTenths: 70 },
  { level: "EXPERT", label: "Expert", fromTenths: 85 },
];

export function isValidRating(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= RATING_MIN && value <= RATING_MAX;
}

function assertRatings(ratings: DifficultyRatings): void {
  for (const dimension of DIFFICULTY_DIMENSIONS) {
    if (!isValidRating(ratings[dimension])) {
      throw new RangeError(`The ${dimension} rating must be a whole number from ${RATING_MIN} to ${RATING_MAX}.`);
    }
  }
}

/** Step 1–2: the weighted average in tenths, rounded half up. */
export function weightedAverageTenths(ratings: DifficultyRatings): number {
  assertRatings(ratings);
  let sum = 0;
  for (const dimension of DIFFICULTY_DIMENSIONS) sum += ratings[dimension] * DIFFICULTY_WEIGHTS[dimension];
  return Math.floor((sum + 5) / 10);
}

/** Step 3: the hardest-part floor in tenths. */
export function hardestPartFloorTenths(ratings: DifficultyRatings): number {
  assertRatings(ratings);
  const hardest = Math.max(...DIFFICULTY_DIMENSIONS.map((dimension) => ratings[dimension]));
  return (hardest - 2) * 10;
}

/** Step 4: the overall score in tenths, 10–100. */
export function difficultyScoreTenths(ratings: DifficultyRatings): number {
  return Math.max(weightedAverageTenths(ratings), hardestPartFloorTenths(ratings));
}

export function difficultyLevelFor(tenths: number): { level: DifficultyLevel; label: string } {
  if (!Number.isInteger(tenths) || tenths < 10 || tenths > 100) {
    throw new RangeError("A difficulty score must be whole tenths from 10 to 100.");
  }
  let found = DIFFICULTY_LEVELS[0];
  for (const candidate of DIFFICULTY_LEVELS) if (tenths >= candidate.fromTenths) found = candidate;
  return { level: found.level, label: found.label };
}

/** 74 → "7.4". Integer arithmetic, so there is no float to misprint. */
export function formatTenths(tenths: number): string {
  return `${Math.floor(tenths / 10)}.${tenths % 10}`;
}

/** Filled segments of a ten-segment meter: 7.4 → 7, 7.5 → 8. */
export function meterSegmentsFor(tenths: number): number {
  return Math.floor((tenths + 5) / 10);
}

export function isValidEstimate(minutesMin: unknown, minutesMax: unknown): boolean {
  const valid = (value: unknown) =>
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= ESTIMATE_MINUTES_MIN &&
    value <= ESTIMATE_MINUTES_MAX;
  return valid(minutesMin) && valid(minutesMax) && (minutesMin as number) <= (minutesMax as number);
}

/**
 * Hours as an admin types them, in half-hour steps, to whole minutes.
 * Returns null for anything that is not a positive multiple of 0.5.
 */
export function hoursToMinutes(hours: unknown): number | null {
  if (typeof hours !== "number" || !Number.isFinite(hours)) return null;
  const halves = hours * 2;
  if (!Number.isInteger(halves) || halves < 1) return null;
  return halves * 30;
}

/** "1", "1.5", or null when the minutes are not a whole half hour. */
function wholeOrHalfHours(minutes: number): string | null {
  if (minutes % 60 === 0) return String(minutes / 60);
  if (minutes % 30 === 0) return `${Math.floor(minutes / 60)}.5`;
  return null;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = wholeOrHalfHours(minutes);
  if (hours) return `${hours} ${minutes === 60 ? "hour" : "hours"}`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

/** "About 2–3 hours", "About 45 min–1 hour", "About 30 min". */
export function formatEstimatedTime(minutesMin: number, minutesMax: number): string {
  if (!isValidEstimate(minutesMin, minutesMax)) {
    throw new RangeError("The time estimate must be whole minutes, 15 to 12,000, minimum no more than maximum.");
  }
  if (minutesMin === minutesMax) return `About ${formatDuration(minutesMin)}`;

  const low = wholeOrHalfHours(minutesMin);
  const high = wholeOrHalfHours(minutesMax);
  if (minutesMin >= 60 && low && high) return `About ${low}–${high} hours`;

  return `About ${formatDuration(minutesMin)}–${formatDuration(minutesMax)}`;
}

/** What each dimension says about a pattern once it is demanding. */
const CHALLENGE_PHRASES: Readonly<Record<DifficultyDimension, { moderate: string; high: string }>> = {
  stitches: { moderate: "Several stitch techniques", high: "Advanced stitch work" },
  construction: { moderate: "Multi-piece construction", high: "Complex construction" },
  shaping: { moderate: "Moderate shaping", high: "Complex shaping" },
  colorwork: { moderate: "Some color changes", high: "Detailed colorwork" },
  assembly: { moderate: "Some assembly", high: "Involved assembly" },
  patternReading: { moderate: "Careful pattern reading", high: "Charts or dense pattern reading" },
};

/** A rating from this upward is worth calling out; from `HIGH` it is "high". */
const CHALLENGE_FROM = 6;
const CHALLENGE_HIGH_FROM = 8;
const MAX_CHALLENGES = 3;

/**
 * Up to three fixed phrases for the most demanding dimensions, hardest first,
 * then by weight, then in dimension order — so ties always resolve the same way.
 */
export function difficultyChallenges(ratings: DifficultyRatings): string[] {
  assertRatings(ratings);
  return DIFFICULTY_DIMENSIONS.map((dimension, index) => ({ dimension, index, rating: ratings[dimension] }))
    .filter((entry) => entry.rating >= CHALLENGE_FROM)
    .sort(
      (a, b) =>
        b.rating - a.rating ||
        DIFFICULTY_WEIGHTS[b.dimension] - DIFFICULTY_WEIGHTS[a.dimension] ||
        a.index - b.index,
    )
    .slice(0, MAX_CHALLENGES)
    .map((entry) => CHALLENGE_PHRASES[entry.dimension][entry.rating >= CHALLENGE_HIGH_FROM ? "high" : "moderate"]);
}

export type DifficultyResult = {
  modelVersion: number;
  scoreTenths: number;
  /** "7.4" */
  score: string;
  level: DifficultyLevel;
  levelLabel: string;
  /** Filled segments of ten. */
  meterSegments: number;
  estimatedTime: string;
  challenges: string[];
  techniques: { slug: string; label: string }[];
  breakdown: { dimension: DifficultyDimension; label: string; rating: number; weight: number }[];
};

/** Everything the product page shows. Throws on invalid input. */
export function evaluateDifficulty(profile: DifficultyProfile): DifficultyResult {
  const scoreTenths = difficultyScoreTenths(profile);
  const { level, label } = difficultyLevelFor(scoreTenths);

  return {
    modelVersion: DIFFICULTY_MODEL_VERSION,
    scoreTenths,
    score: formatTenths(scoreTenths),
    level,
    levelLabel: label,
    meterSegments: meterSegmentsFor(scoreTenths),
    estimatedTime: formatEstimatedTime(profile.minutesMin, profile.minutesMax),
    challenges: difficultyChallenges(profile),
    techniques: normalizeTechniques(profile.techniques).map((slug) => ({ slug, label: techniqueLabel(slug) as string })),
    breakdown: DIFFICULTY_DIMENSIONS.map((dimension) => ({
      dimension,
      label: DIFFICULTY_DIMENSION_INFO[dimension].label,
      rating: profile[dimension],
      weight: DIFFICULTY_WEIGHTS[dimension],
    })),
  };
}

/**
 * What the public may see for a product's stored row: nothing when there is no
 * row, when it is switched off, or — defensively — when it is somehow invalid.
 * Never throws, so a bad row can never break a product page.
 */
export function evaluatePublicDifficulty(row: StoredDifficulty | null | undefined): DifficultyResult | null {
  if (!row || row.enabled !== true) return null;
  try {
    return evaluateDifficulty(row);
  } catch {
    return null;
  }
}
