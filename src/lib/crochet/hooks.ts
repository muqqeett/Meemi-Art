/**
 * Crochet hook sizes, as a conversion table plus the context a table alone
 * cannot give.
 *
 * Millimetres are the real size: they are measured, they are the same
 * everywhere, and every modern pattern quotes them. US letter/number sizes and
 * the old UK numbers are conventions layered on top, and they do not line up
 * perfectly — the Craft Yarn Council itself lists "G" against both 4.0 mm and
 * 4.25 mm, and the old UK numbers run backwards (a bigger number is a smaller
 * hook).
 *
 * Sourcing, because a permanent reference table should say where it came from:
 *
 *   - The millimetre and US columns are checked against the Craft Yarn
 *     Council's hook and needle chart. Every mm/US pair below appears there.
 *   - The old UK column is NOT a Craft Yarn Council standard — the Council is a
 *     US body and publishes no UK column. It is cross-checked across published
 *     conversion charts, and it is left blank wherever those charts disagree,
 *     because the old UK system was defined on a different set of physical
 *     sizes (2.5, 3.0, 7.0 mm) that the modern metric set does not line up
 *     with. Guessing a number here would be inventing one.
 *   - Steel hooks for thread work use a separate scale entirely, which also
 *     runs backwards. They are deliberately not mixed into this table.
 *
 * Brands vary regardless, which is exactly why gauge exists; the pages that
 * render this say so rather than implying a hook size alone guarantees a size.
 */

export type HookSize = {
  /** Millimetres — the authoritative measurement. */
  mm: number;
  /** US letter/number, where the standard names one. */
  us: string | null;
  /** The old UK/Canadian number, where one existed. Kept as text: "00" is a size, not a number. */
  uk: string | null;
  /** The yarn weights this hook is usually paired with, by CYC number. */
  yarnWeights: number[];
  /** What it is typically used for, in practice. */
  typicalUse: string;
};

export const HOOK_SIZES: HookSize[] = [
  { mm: 2.25, us: "B-1", uk: "13", yarnWeights: [1], typicalUse: "Socks and fine thread-weight work." },
  { mm: 2.75, us: "C-2", uk: null, yarnWeights: [1], typicalUse: "Fingering yarn; tight amigurumi in fine yarn." },
  { mm: 3.125, us: "D", uk: null, yarnWeights: [1, 2], typicalUse: "An in-between size; the Council lists D against both this and 3.25 mm." },
  { mm: 3.25, us: "D-3", uk: "10", yarnWeights: [1, 2], typicalUse: "Sport-weight yarn and dense small toys." },
  { mm: 3.5, us: "E-4", uk: null, yarnWeights: [2], typicalUse: "Baby yarns, lightweight accessories." },
  { mm: 3.75, us: "F-5", uk: "9", yarnWeights: [2, 3], typicalUse: "A common amigurumi choice with DK yarn — tight enough to hide stuffing." },
  { mm: 4.0, us: "G-6", uk: "8", yarnWeights: [3], typicalUse: "DK garments and blankets." },
  { mm: 4.25, us: "G", uk: null, yarnWeights: [3], typicalUse: "Also sold as G, which is why a letter alone is not enough to match a pattern." },
  { mm: 4.5, us: "7", uk: "7", yarnWeights: [3, 4], typicalUse: "Between DK and worsted; useful when your gauge runs tight." },
  { mm: 5.0, us: "H-8", uk: "6", yarnWeights: [4], typicalUse: "Worsted yarn; a common general-purpose size." },
  { mm: 5.5, us: "I-9", uk: "5", yarnWeights: [4], typicalUse: "Worsted with more drape; wearables." },
  { mm: 6.0, us: "J-10", uk: "4", yarnWeights: [4, 5], typicalUse: "Heavy worsted and light bulky; fast blankets." },
  { mm: 6.5, us: "K-10½", uk: "3", yarnWeights: [5], typicalUse: "Bulky yarn, bags and baskets." },
  { mm: 7.0, us: null, uk: "2", yarnWeights: [5], typicalUse: "Bulky yarn. The Council's chart lists no US letter for this size." },
  { mm: 8.0, us: "L-11", uk: "0", yarnWeights: [5], typicalUse: "Chunky yarn; open, drapey fabric." },
  { mm: 9.0, us: "M/N-13", uk: "00", yarnWeights: [6], typicalUse: "Super bulky yarn and quick throws." },
  { mm: 10.0, us: "N/P-15", uk: "000", yarnWeights: [6], typicalUse: "Super bulky; loose, airy fabric." },
  { mm: 15.0, us: "P/Q", uk: null, yarnWeights: [7], typicalUse: "Jumbo yarn, arm-knitting-scale work." },
  { mm: 16.0, us: "Q", uk: null, yarnWeights: [7], typicalUse: "Jumbo yarn." },
  { mm: 19.0, us: "S", uk: null, yarnWeights: [7], typicalUse: "Jumbo yarn and rope; very open fabric." },
];

/**
 * Where the table comes from and what it cannot tell you.
 *
 * Rendered under the chart, because a reference table that hides its sourcing
 * is asking to be trusted further than it deserves.
 */
export const HOOK_TABLE_NOTES: string[] = [
  "Millimetre and US sizes are checked against the Craft Yarn Council's hook and needle chart. US letters vary between manufacturers — the Council itself lists G against both 4.0 mm and 4.25 mm — so the millimetres on the packaging are the measurement to trust.",
  "The old UK numbers are not part of that standard; the Craft Yarn Council publishes no UK column. They are cross-checked across published conversion charts and left blank where those charts disagree, which happens at 2.75 mm and 3.5 mm because the old UK system was built around 2.5, 3.0 and 7.0 mm rather than the modern metric set.",
  "This chart covers the sizes commonly sold for yarn. The Council's full chart also lists 2.5, 5.25, 5.75, 11.5, 12, 15.75, 25 and 30 mm, and steel hooks for thread work use a separate scale of their own that runs from about 3.5 mm down to 0.6 mm.",
];

/** "2.25 mm" and "3.125 mm" both read correctly; "3.13 mm" would not. */
export function formatHookMm(mm: number): string {
  return Number.isInteger(mm * 100) ? mm.toFixed(2) : mm.toFixed(3);
}

/** The parts of a hook, because pattern and product descriptions name them. */
export const HOOK_ANATOMY: { part: string; what: string }[] = [
  { part: "Head", what: "The tip that goes into the stitch. Rounder heads push through more easily; pointier heads split yarn less." },
  { part: "Throat", what: "The hooked part that catches the yarn. A deeper throat holds a loop more securely." },
  { part: "Shaft", what: "The straight section whose diameter is the hook's real size — this is what makes your stitches their size." },
  { part: "Thumb rest", what: "The flattened part where most people pivot the hook. Its position decides how the hook sits in your hand." },
  { part: "Handle", what: "The remainder of the grip. Thicker handles reduce strain over long sessions for some hands." },
];

export function hookByMm(mm: number): HookSize | undefined {
  return HOOK_SIZES.find((hook) => hook.mm === mm);
}

/** Hooks a given CYC yarn weight is usually worked with. */
export function hooksForYarnWeight(weight: number): HookSize[] {
  return HOOK_SIZES.filter((hook) => hook.yarnWeights.includes(weight));
}
