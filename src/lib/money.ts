/**
 * All monetary values are stored and passed around as integer minor units
 * (cents). Formatting happens at the very edge, in the UI.
 */

export const CURRENCY = "USD";
export const CURRENCY_LOCALE = "en-US";

const formatter = new Intl.NumberFormat(CURRENCY_LOCALE, {
  style: "currency",
  currency: CURRENCY,
});

const compactFormatter = new Intl.NumberFormat(CURRENCY_LOCALE, {
  style: "currency",
  currency: CURRENCY,
  notation: "compact",
  maximumFractionDigits: 1,
});

/** 2899 -> "$28.99" */
export function formatMoney(cents: number): string {
  return formatter.format(cents / 100);
}

/** 1234567 -> "$12.3K" — for dashboard stat tiles. */
export function formatMoneyCompact(cents: number): string {
  return compactFormatter.format(cents / 100);
}

/** "28.99" -> 2899. Returns null when the input is not a valid amount. */
export function parseMoneyToCents(input: string | number): number | null {
  const value = typeof input === "number" ? input : Number(input.replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}

/** Percentage saved when a compare-at price is present. */
export function discountPercent(
  priceCents: number,
  compareAtCents: number | null | undefined,
): number | null {
  if (!compareAtCents || compareAtCents <= priceCents) return null;
  return Math.round(((compareAtCents - priceCents) / compareAtCents) * 100);
}
