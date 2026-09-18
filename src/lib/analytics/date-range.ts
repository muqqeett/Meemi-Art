/**
 * Reporting periods for admin analytics, in the shop's own time zone.
 *
 * MeemiArt reports in Asia/Karachi. "Today" means today in Pakistan, and every
 * range is built from whole Pakistani calendar days:
 *
 *   start  00:00 on the first day, local time   — inclusive
 *   end    00:00 on the day after the last day  — exclusive
 *
 * so a range is always `start <= t < end`, and two adjacent ranges never share
 * or skip an instant. "Last 7 days" is today and the six days before it.
 *
 * Pakistan has no daylight saving today, but nothing here assumes a fixed
 * offset: the zone's offset is asked of `Intl` for the actual instant, and
 * midnight is found by correcting for the offset at that midnight. The same
 * code is correct for a zone that does observe DST (the harness proves it with
 * America/New_York across a transition).
 *
 * Pure: no database, no clock of its own (`now` is passed in), no Node APIs —
 * safe to import from the harness and from client components alike.
 */

export const ANALYTICS_TIME_ZONE = "Asia/Karachi";

export const RANGE_PRESETS = ["today", "7d", "30d", "90d", "custom", "all"] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];

const PRESET_DAYS: Record<Exclude<RangePreset, "custom" | "all">, number> = {
  today: 1,
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

export const PRESET_LABELS: Record<RangePreset, string> = {
  today: "Today",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  custom: "Custom",
  all: "All time",
};

/** The longest custom range accepted, in days. */
export const MAX_CUSTOM_DAYS = 366;

export type DateRange = {
  preset: RangePreset;
  /** First calendar day, YYYY-MM-DD in the zone, inclusive. Null for all time. */
  fromDate: string | null;
  /** Last calendar day, YYYY-MM-DD in the zone, inclusive. */
  toDate: string;
  /** Inclusive lower bound. Null for all time. */
  start: Date | null;
  /** Exclusive upper bound: midnight after `toDate`. */
  end: Date;
  /** Number of calendar days covered. Null for all time. */
  days: number | null;
  label: string;
  timeZone: string;
};

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

// ---------------------------------------------------------------- zone arithmetic

const dayFormatters = new Map<string, Intl.DateTimeFormat>();
const offsetFormatters = new Map<string, Intl.DateTimeFormat>();

/** The calendar day an instant falls on in the zone, as YYYY-MM-DD. */
export function dateKeyInZone(instant: Date, timeZone = ANALYTICS_TIME_ZONE): string {
  let formatter = dayFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
    dayFormatters.set(timeZone, formatter);
  }
  return formatter.format(instant);
}

/** The zone's offset from UTC at an instant, in minutes (Karachi: +300). */
export function zoneOffsetMinutes(instant: Date, timeZone = ANALYTICS_TIME_ZONE): number {
  let formatter = offsetFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" });
    offsetFormatters.set(timeZone, formatter);
  }
  const name = formatter.formatToParts(instant).find((part) => part.type === "timeZoneName")?.value ?? "GMT";
  const match = /GMT([+-])(\d{2}):?(\d{2})?/.exec(name);
  if (!match) return 0;
  const minutes = Number(match[2]) * 60 + Number(match[3] ?? 0);
  return match[1] === "-" ? -minutes : minutes;
}

function parseKey(key: string): { year: number; month: number; day: number } | null {
  const match = DATE_KEY.exec(key);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const check = new Date(Date.UTC(year, month - 1, day));
  // Rejects 2026-02-31 and friends rather than letting Date roll them over.
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
  return { year, month, day };
}

export function isDateKey(value: unknown): value is string {
  return typeof value === "string" && parseKey(value) !== null;
}

/** Calendar arithmetic on a YYYY-MM-DD key — zone-free, so it cannot drift. */
export function addDays(key: string, days: number): string {
  const parts = parseKey(key);
  if (!parts) throw new RangeError(`Not a date: ${key}`);
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days)).toISOString().slice(0, 10);
}

/** Whole days from `a` to `b` (b − a). */
export function daysBetween(a: string, b: string): number {
  const pa = parseKey(a);
  const pb = parseKey(b);
  if (!pa || !pb) throw new RangeError("Not a date");
  return Math.round((Date.UTC(pb.year, pb.month - 1, pb.day) - Date.UTC(pa.year, pa.month - 1, pa.day)) / 86_400_000);
}

/**
 * The instant local midnight begins on a calendar day in the zone.
 *
 * Start from that wall-clock midnight read as UTC, subtract the zone's offset,
 * then check the offset at the result: across a DST change the two differ, and
 * the second one is the one in force at that midnight.
 */
export function startOfDayInZone(key: string, timeZone = ANALYTICS_TIME_ZONE): Date {
  const parts = parseKey(key);
  if (!parts) throw new RangeError(`Not a date: ${key}`);
  const wallClock = Date.UTC(parts.year, parts.month - 1, parts.day);
  const firstGuess = wallClock - zoneOffsetMinutes(new Date(wallClock), timeZone) * 60_000;
  const settled = wallClock - zoneOffsetMinutes(new Date(firstGuess), timeZone) * 60_000;
  return new Date(settled);
}

// ---------------------------------------------------------------- ranges

function formatDay(key: string): string {
  const parts = parseKey(key)!;
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function fromDays(preset: RangePreset, fromDate: string, toDate: string, timeZone: string, label?: string): DateRange {
  return {
    preset,
    fromDate,
    toDate,
    start: startOfDayInZone(fromDate, timeZone),
    end: startOfDayInZone(addDays(toDate, 1), timeZone),
    days: daysBetween(fromDate, toDate) + 1,
    label: label ?? PRESET_LABELS[preset],
    timeZone,
  };
}

export type RangeInput = { preset?: string | null; from?: string | null; to?: string | null };

export type ParsedRange = {
  range: DateRange;
  /** Set when the request asked for a custom range that could not be honoured. */
  invalid: string | null;
};

/**
 * Turn untrusted query values into a range. Anything malformed falls back to
 * `fallback` and says why, rather than guessing at what was meant.
 */
export function resolveRange(
  input: RangeInput,
  now: Date,
  { fallback = "30d", allowAll = false, timeZone = ANALYTICS_TIME_ZONE }: { fallback?: Exclude<RangePreset, "custom">; allowAll?: boolean; timeZone?: string } = {},
): ParsedRange {
  const today = dateKeyInZone(now, timeZone);
  const preset = (RANGE_PRESETS as readonly string[]).includes(input.preset ?? "") ? (input.preset as RangePreset) : null;

  const build = (key: Exclude<RangePreset, "custom">): DateRange => {
    if (key === "all") {
      return {
        preset: "all",
        fromDate: null,
        toDate: today,
        start: null,
        end: startOfDayInZone(addDays(today, 1), timeZone),
        days: null,
        label: PRESET_LABELS.all,
        timeZone,
      };
    }
    return fromDays(key, addDays(today, -(PRESET_DAYS[key] - 1)), today, timeZone);
  };

  if (preset === "custom") {
    const from = input.from ?? "";
    const to = input.to ?? "";
    const reject = (reason: string) => ({ range: build(fallback), invalid: reason });
    if (!isDateKey(from) || !isDateKey(to)) return reject("Enter both dates as YYYY-MM-DD.");
    if (from > to) return reject("The start date is after the end date.");
    if (from > today) return reject("The range starts in the future.");
    const clampedTo = to > today ? today : to;
    if (daysBetween(from, clampedTo) + 1 > MAX_CUSTOM_DAYS) return reject(`Custom ranges can cover at most ${MAX_CUSTOM_DAYS} days.`);
    const label = from === clampedTo ? formatDay(from) : `${formatDay(from)} – ${formatDay(clampedTo)}`;
    return { range: fromDays("custom", from, clampedTo, timeZone, label), invalid: null };
  }

  if (preset === "all" && !allowAll) return { range: build(fallback), invalid: null };
  return { range: build(preset ?? fallback), invalid: null };
}

/**
 * The equal-length period immediately before a range: for the last 30 days,
 * the 30 days before those. Null for all time, which has no "before".
 */
export function previousRange(range: DateRange): DateRange | null {
  if (range.days === null || range.fromDate === null) return null;
  const toDate = addDays(range.fromDate, -1);
  const fromDate = addDays(range.fromDate, -range.days);
  return fromDays(range.preset, fromDate, toDate, range.timeZone, `Previous ${range.days === 1 ? "day" : `${range.days} days`}`);
}

/** Every calendar day in a bounded range, oldest first, for zero-filled series. */
export function eachDay(range: DateRange): string[] {
  if (range.fromDate === null || range.days === null) return [];
  return Array.from({ length: range.days }, (_, index) => addDays(range.fromDate as string, index));
}

/** The query string that reproduces a range, for links that keep the period. */
export function rangeSearch(range: DateRange): string {
  if (range.preset === "custom" && range.fromDate) {
    return `range=custom&from=${range.fromDate}&to=${range.toDate}`;
  }
  return `range=${range.preset}`;
}

/** Read the range parameters from Next's `searchParams`. */
export function rangeInputFrom(params: Record<string, string | string[] | undefined>): RangeInput {
  const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? null;
  return { preset: one(params.range), from: one(params.from), to: one(params.to) };
}
