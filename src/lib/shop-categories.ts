/**
 * The shop's five top-level categories, in the order the design draws them.
 *
 * Shared by the desktop Shop menu and the mobile drawer so the two can never
 * list different things. The slugs are what a category must be called in the
 * CMS for the menus to link to it; until it exists (or has anything listed) the
 * entry is drawn with "Soon" and is not a link, and it becomes one by itself
 * the moment a product is published into it.
 */
export type ShopCategorySpec = {
  name: string;
  slug: string;
  /** "All …" label that ends a category's list in the mobile drawer. */
  allLabel: string;
  /** What one of its products is called, for counts: "4 patterns". */
  singular: string;
  plural: string;
  /** Resting tint — the design's `tint/*` — as a full class so Tailwind sees it. */
  tint: string;
  /**
   * The category's character or object, as drawn in the page band, and where
   * the artwork sits inside its box (CSS `inset`: top right bottom left) —
   * the same Figma "Illustration" instances the homepage tiles use.
   */
  art: string;
  placement: { group: string; bleed: string };
};

export const SHOP_CATEGORIES: readonly ShopCategorySpec[] = [
  {
    name: "Crochet patterns",
    slug: "crochet-patterns",
    allLabel: "All crochet patterns",
    singular: "pattern",
    plural: "patterns",
    tint: "bg-pl-tint-crochet",
    art: "/home/plum/cat-loop.svg",
    placement: { group: "13.5% 13.73% 13.5% 13.75%", bleed: "-1.37% -1.38%" },
  },
  {
    name: "Templates",
    slug: "templates",
    allLabel: "All templates",
    singular: "template",
    plural: "templates",
    tint: "bg-pl-tint-templates",
    art: "/home/plum/cat-templates.svg",
    placement: { group: "15% 18.35% 15% 18.65%", bleed: "-1.43% -1.59% -1.43% -1.98%" },
  },
  {
    name: "Printables",
    slug: "printables",
    allLabel: "All printables",
    singular: "printable",
    plural: "printables",
    tint: "bg-pl-tint-printables",
    art: "/home/plum/cat-printables.svg",
    placement: { group: "10.83% 15.58% 10.83% 16.08%", bleed: "-1.6% -1.83% -1.6% -2.44%" },
  },
  {
    name: "Creator assets",
    slug: "creator-assets",
    allLabel: "All creator assets",
    singular: "pack",
    plural: "packs",
    tint: "bg-pl-tint-assets",
    art: "/home/plum/cat-assets.svg",
    placement: { group: "18% 13%", bleed: "-1.56% -1.35%" },
  },
  {
    name: "eBooks & guides",
    slug: "ebooks-guides",
    allLabel: "All eBooks & guides",
    singular: "guide",
    plural: "guides",
    tint: "bg-pl-tint-ebooks",
    art: "/home/plum/cat-ebooks.svg",
    placement: { group: "11.67% 18.33%", bleed: "-1.63% -1.97%" },
  },
];

/** The design's entry for a slug, or undefined for any other category. */
export function shopCategoryFor(slug: string): ShopCategorySpec | undefined {
  return SHOP_CATEGORIES.find((category) => category.slug === slug);
}

export const SHOP_CATEGORY_SLUGS = SHOP_CATEGORIES.map((category) => category.slug);

/** A category as the menus receive it: what is in it right now. */
export type ShopMenuCategory = {
  slug: string;
  /** Products the category page lists today. Zero means "Soon". */
  count: number;
  /** Sub-categories that have something listed, in CMS order. */
  subs: { name: string; slug: string; count: number }[];
};
