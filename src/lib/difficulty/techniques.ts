/**
 * The fixed technique vocabulary for Project Difficulty.
 *
 * A technique is a stable slug with a display label. Slugs are what is stored
 * and validated; labels are only ever looked up from here. There is no free
 * text: a typo cannot become a technique, and the same skill cannot appear
 * under three spellings — which is what lets a future version ask "which of
 * these does this customer already know?".
 *
 * Adding a technique is a code change on purpose. Renaming a label is safe;
 * changing or removing a slug is not, because saved products reference it.
 *
 * Pure and dependency-free, so the admin form (in the browser) and the server
 * validate against the same list.
 */

export const TECHNIQUE_GROUP_LABELS = {
  stitches: "Stitches",
  shaping: "Shaping",
  color: "Color",
  construction: "Construction",
  assembly: "Assembly",
  reading: "Pattern reading",
} as const;

export type TechniqueGroup = keyof typeof TECHNIQUE_GROUP_LABELS;

/** In display order. Stored technique lists are normalised to this order. */
export const TECHNIQUES = [
  { slug: "chain", label: "Chain", group: "stitches" },
  { slug: "slip-stitch", label: "Slip stitch", group: "stitches" },
  { slug: "single-crochet", label: "Single crochet", group: "stitches" },
  { slug: "half-double-crochet", label: "Half double crochet", group: "stitches" },
  { slug: "double-crochet", label: "Double crochet", group: "stitches" },
  { slug: "treble-crochet", label: "Treble crochet", group: "stitches" },
  { slug: "front-back-loop-only", label: "Front/back loop only", group: "stitches" },
  { slug: "magic-ring", label: "Magic ring", group: "shaping" },
  { slug: "increase", label: "Increase", group: "shaping" },
  { slug: "invisible-decrease", label: "Invisible decrease", group: "shaping" },
  { slug: "working-in-rounds", label: "Working in rounds", group: "shaping" },
  { slug: "working-in-rows", label: "Working in rows", group: "shaping" },
  { slug: "color-changes", label: "Color changes", group: "color" },
  { slug: "tapestry-crochet", label: "Tapestry crochet", group: "color" },
  { slug: "motifs", label: "Motifs", group: "construction" },
  { slug: "joining-pieces", label: "Joining pieces", group: "construction" },
  { slug: "surface-crochet", label: "Surface crochet", group: "construction" },
  { slug: "3d-elements", label: "3D elements", group: "construction" },
  { slug: "stuffing", label: "Stuffing", group: "assembly" },
  { slug: "safety-eyes", label: "Safety eyes", group: "assembly" },
  { slug: "sewing-pieces", label: "Sewing pieces together", group: "assembly" },
  { slug: "reading-charts", label: "Reading charts", group: "reading" },
  { slug: "multiple-sizes", label: "Multiple sizes", group: "reading" },
] as const satisfies readonly { slug: string; label: string; group: TechniqueGroup }[];

export type TechniqueSlug = (typeof TECHNIQUES)[number]["slug"];

/** Every slug, as the non-empty tuple a Zod enum wants. */
export const TECHNIQUE_SLUGS = TECHNIQUES.map((technique) => technique.slug) as [TechniqueSlug, ...TechniqueSlug[]];

const ORDER = new Map<string, number>(TECHNIQUES.map((technique, index) => [technique.slug, index]));
const LABELS = new Map<string, string>(TECHNIQUES.map((technique) => [technique.slug, technique.label]));

export function isTechniqueSlug(value: unknown): value is TechniqueSlug {
  return typeof value === "string" && ORDER.has(value);
}

/** The label for a known slug, or null for anything else. */
export function techniqueLabel(slug: string): string | null {
  return LABELS.get(slug) ?? null;
}

/**
 * Known slugs only, each once, in vocabulary order — so the same selection is
 * always stored and shown identically, whatever order it was ticked in.
 */
export function normalizeTechniques(slugs: readonly string[]): TechniqueSlug[] {
  const known = slugs.filter(isTechniqueSlug);
  return [...new Set(known)].sort((a, b) => (ORDER.get(a) ?? 0) - (ORDER.get(b) ?? 0));
}
