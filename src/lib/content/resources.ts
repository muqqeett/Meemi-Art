/**
 * The resource pages, as data.
 *
 * Resources are reference material — the abbreviation list, the hook table,
 * the yarn weights — and reference material belongs in code rather than in a
 * CMS: it is checked by the type system, covered by tests, and reviewed in a
 * diff when it changes. Articles and tutorials, which are editorial and
 * change often, live in the database instead.
 *
 * One registry so the hub page, the sitemap, the breadcrumbs and the
 * cross-links between pages can never disagree about what exists.
 */

export type ResourceSlug =
  | "abbreviations"
  | "hook-sizes"
  | "yarn-weights"
  | "beginner-guide"
  | "reading-patterns";

export type Resource = {
  slug: ResourceSlug;
  title: string;
  /** The <title> and card heading. */
  shortTitle: string;
  /** Meta description and hub blurb — one sentence, no marketing. */
  description: string;
  /** Who it is for, said plainly. */
  audience: string;
  /** Technique slugs this resource explains, from the Project Difficulty vocabulary. */
  teaches: string[];
};

export const RESOURCES: Resource[] = [
  {
    slug: "beginner-guide",
    title: "Beginner's guide to crochet",
    shortTitle: "Beginner's guide",
    description:
      "What you need to start crocheting, how to choose a hook and yarn, the first stitches to learn, and the mistakes that trip most people up in week one.",
    audience: "Anyone who has never held a hook, or who started once and stopped.",
    teaches: ["chain", "single-crochet", "working-in-rows"],
  },
  {
    slug: "reading-patterns",
    title: "Crochet pattern notation reference",
    shortTitle: "Pattern notation",
    description:
      "What the brackets, asterisks, repeats and stitch counts in a crochet pattern mean, in one place you can check mid-project.",
    audience: "Anyone holding a pattern and unsure what a line is asking for.",
    teaches: ["reading-charts", "multiple-sizes"],
  },
  {
    slug: "abbreviations",
    title: "Crochet abbreviations dictionary",
    shortTitle: "Abbreviations",
    description:
      "Every abbreviation a pattern is likely to use, what it stands for, what it asks you to do, and where US and UK terms mean different stitches.",
    audience: "Anyone reading a pattern who has hit letters they do not recognise.",
    teaches: ["chain", "slip-stitch", "single-crochet", "half-double-crochet", "double-crochet", "treble-crochet"],
  },
  {
    slug: "hook-sizes",
    title: "Crochet hook size guide",
    shortTitle: "Hook sizes",
    description:
      "Millimetre, US and old UK hook sizes side by side, which yarn each is usually paired with, and why the size on the pattern is a starting point.",
    audience: "Anyone converting a pattern's hook size to the hooks they own.",
    teaches: [],
  },
  {
    slug: "yarn-weights",
    title: "Yarn weight guide for crochet",
    shortTitle: "Yarn weights",
    description:
      "The standard yarn weight numbers from lace to jumbo, the names each goes by, the hooks they suit, and how to substitute one yarn for another.",
    audience: "Anyone choosing yarn for a pattern, or substituting what they have.",
    teaches: [],
  },
];

export const RESOURCE_BY_SLUG = new Map(RESOURCES.map((resource) => [resource.slug, resource]));

export function resourcePath(slug: ResourceSlug): string {
  return `/resources/${slug}`;
}

export function resourceBySlug(slug: string): Resource | undefined {
  return RESOURCE_BY_SLUG.get(slug as ResourceSlug);
}

/** Resources that explain any of these technique slugs. */
export function resourcesForTechniques(techniques: readonly string[]): Resource[] {
  if (techniques.length === 0) return [];
  const wanted = new Set(techniques);
  return RESOURCES.filter((resource) => resource.teaches.some((slug) => wanted.has(slug)));
}
