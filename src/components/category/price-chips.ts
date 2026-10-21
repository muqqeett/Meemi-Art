/**
 * The design's four price chips, as cents in the same `minPrice` / `maxPrice`
 * parameters the rest of the shop already uses, so a price filter means the
 * same thing here as on `/shop`. The ranges do not overlap.
 *
 * In its own module, not the client filter component, so the server page can
 * read it too.
 */
export const PRICE_CHIPS = [
  { key: "free", label: "Free", min: null, max: 0 },
  { key: "under-10", label: "Under $10", min: null, max: 999 },
  { key: "10-20", label: "$10–$20", min: 1000, max: 1999 },
  { key: "20-plus", label: "$20+", min: 2000, max: null },
] as const;

/** Which price chip, if any, the URL's `minPrice` / `maxPrice` pair selects. */
export function activePriceChip(minPrice?: string, maxPrice?: string) {
  const min = minPrice ? Number(minPrice) : null;
  const max = maxPrice ? Number(maxPrice) : null;
  return PRICE_CHIPS.find((chip) => chip.min === min && chip.max === max);
}
