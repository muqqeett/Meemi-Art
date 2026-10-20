import Image from "next/image";
import Link from "next/link";

import { cn } from "@/lib/utils";

/** What the homepage needs to know about a shop category. */
export type ShopCategory = {
  slug: string;
  /** Products the category page will actually list — see getCategoriesWithListedCounts. */
  productCount: number;
};

/**
 * Where an illustration's artwork sits inside its 128px box, and how far the
 * stroke bleeds past it — both straight from the Figma "Illustration" instances,
 * as CSS `inset` shorthand (top right bottom left).
 */
type Placement = { group: string; bleed: string };

type TileSpec = {
  /** Display name, exactly as the design sets it. */
  name: string;
  /** The slug the category must have for the tile to link to it. */
  slug: string;
  singular: string;
  plural: string;
  /** Resting fill. */
  tint: string;
  /** Hover and pressed fill — the design's `tint/*-deep`. */
  tintDeep: string;
  art: string;
  placement: Placement;
};

/**
 * "Shop by category" — Figma "Categories" (17:262).
 *
 * These five are fixed: the design makes them the shop's top-level categories,
 * in this order, each with its own tint and its own mascot or object. They are
 * not derived from whatever categories happen to exist.
 */
const TILES: readonly TileSpec[] = [
  {
    name: "Crochet patterns",
    slug: "crochet-patterns",
    singular: "pattern",
    plural: "patterns",
    tint: "bg-pl-tint-crochet",
    tintDeep: "hover:bg-pl-tint-crochet-deep active:bg-pl-tint-crochet-deep",
    art: "/home/plum/cat-loop.svg",
    placement: { group: "13.5% 13.73% 13.5% 13.75%", bleed: "-1.37% -1.38%" },
  },
  {
    name: "Templates",
    slug: "templates",
    singular: "template",
    plural: "templates",
    tint: "bg-pl-tint-templates",
    tintDeep: "hover:bg-pl-tint-templates-deep active:bg-pl-tint-templates-deep",
    art: "/home/plum/cat-templates.svg",
    placement: { group: "15% 18.35% 15% 18.65%", bleed: "-1.43% -1.59% -1.43% -1.98%" },
  },
  {
    name: "Printables",
    slug: "printables",
    singular: "printable",
    plural: "printables",
    tint: "bg-pl-tint-printables",
    tintDeep: "hover:bg-pl-tint-printables-deep active:bg-pl-tint-printables-deep",
    art: "/home/plum/cat-printables.svg",
    placement: { group: "10.83% 15.58% 10.83% 16.08%", bleed: "-1.6% -1.83% -1.6% -2.44%" },
  },
  {
    name: "Creator assets",
    slug: "creator-assets",
    singular: "pack",
    plural: "packs",
    tint: "bg-pl-tint-assets",
    tintDeep: "hover:bg-pl-tint-assets-deep active:bg-pl-tint-assets-deep",
    art: "/home/plum/cat-assets.svg",
    placement: { group: "18% 13%", bleed: "-1.56% -1.35%" },
  },
  {
    name: "eBooks & guides",
    slug: "ebooks-guides",
    singular: "guide",
    plural: "guides",
    tint: "bg-pl-tint-ebooks",
    tintDeep: "hover:bg-pl-tint-ebooks-deep active:bg-pl-tint-ebooks-deep",
    art: "/home/plum/cat-ebooks.svg",
    placement: { group: "11.67% 18.33%", bleed: "-1.63% -1.97%" },
  },
];

/**
 * The 128px illustration box, with the artwork placed exactly as drawn.
 *
 * The design's hover state grows the box to 140px and lifts it 8px; pressed
 * grows it to 134px and lifts it 3px. Those are the scale and translate below
 * (140/128, 134/128), applied to the box rather than the artwork so it scales
 * about its own centre, as the design's does.
 */
function Illustration({ src, placement }: { src: string; placement: Placement }) {
  return (
    <span
      aria-hidden
      className="relative block size-32 shrink-0 transition-transform duration-300 ease-out group-hover:-translate-y-2 group-hover:scale-[1.09375] group-focus-visible:-translate-y-2 group-focus-visible:scale-[1.09375] group-active:-translate-y-[3px] group-active:scale-[1.046875] motion-reduce:transition-none"
    >
      <span className="absolute" style={{ inset: placement.group }}>
        <span className="absolute" style={{ inset: placement.bleed }}>
          <Image src={src} alt="" fill unoptimized className="max-w-none object-fill" />
        </span>
      </span>
    </span>
  );
}

/**
 * Five tiles, always. A tile links to its category and shows the real number of
 * products in it. Where the category does not exist yet, or has nothing in it,
 * the tile is drawn but is not a link and says "Coming soon": `/shop/<slug>` is
 * a 404 for a missing category and an empty page for an empty one, and neither
 * is a promise worth making. No count is ever invented.
 *
 * From 820px the five share the content width in equal columns with a 24px gap;
 * below that the row scrolls sideways with scroll-snap and a 12px gap. Both
 * switches are the design's own ("5 equal columns, 24px gap. Under 820px becomes
 * a horizontal scroller with scroll-snap and 12px gap.").
 */
export function CategoryTiles({ categories }: { categories: ShopCategory[] }) {
  return (
    <section
      aria-labelledby="home-categories"
      className="font-figtree mx-auto w-full max-w-[1280px] px-4 py-10 sm:px-8 lg:py-14"
    >
      <h2 id="home-categories" className="pl-display pl-h2">
        Shop by category
      </h2>

      {/* `scroll-px-*` repeats the padding as scroll-padding. Without it the
          first snap point is the tile's own edge, which scrolls the row past its
          padding on load and leaves the first tile flush against the screen. */}
      <ul className="no-scrollbar -mx-4 mt-6 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 sm:-mx-8 sm:scroll-px-8 sm:px-8 min-[820px]:mx-0 min-[820px]:grid min-[820px]:grid-cols-5 min-[820px]:gap-6 min-[820px]:overflow-visible min-[820px]:px-0 min-[820px]:pb-0">
        {TILES.map((spec) => {
          const category = categories.find((candidate) => candidate.slug === spec.slug);
          const count = category?.productCount ?? 0;
          const live = count > 0;

          const body = (
            <>
              <span className="relative flex h-[140px] w-full items-center justify-center overflow-hidden">
                <Illustration src={spec.art} placement={spec.placement} />
              </span>
              <span className="relative flex flex-col gap-0.5 pl-2">
                <span className="text-base leading-[22px] font-bold tracking-[-0.005em] text-pl-text">
                  {spec.name}
                </span>
                {live ? (
                  /* The count gives way to "Shop →" on hover, focus and press. */
                  <span className="relative block h-[18px] text-[13px] leading-[18px] font-medium text-pl-muted">
                    <span className="transition-opacity group-hover:opacity-0 group-focus-visible:opacity-0 group-active:opacity-0">
                      {count} {count === 1 ? spec.singular : spec.plural}
                    </span>
                    <span
                      aria-hidden
                      className="absolute inset-0 font-bold text-pl-text opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 group-active:opacity-100"
                    >
                      Shop →
                    </span>
                  </span>
                ) : (
                  <span className="block h-[18px] text-[13px] leading-[18px] font-medium text-pl-muted">
                    Coming soon
                  </span>
                )}
              </span>
            </>
          );

          return (
            <li
              key={spec.slug}
              className="w-[184px] shrink-0 snap-start min-[820px]:w-auto"
            >
              {live ? (
                <Link
                  href={`/shop/${spec.slug}`}
                  className={cn(
                    "pl-focus group flex h-full flex-col gap-2 rounded-[20px] px-2 pt-2 pb-4 transition-[background-color,box-shadow] duration-200 hover:shadow-[0_14px_28px_-12px_rgba(36,18,64,0.32)] active:shadow-[0_6px_14px_-12px_rgba(36,18,64,0.18)] motion-reduce:transition-none",
                    spec.tint,
                    spec.tintDeep,
                  )}
                >
                  {body}
                </Link>
              ) : (
                <div
                  className={cn(
                    "flex h-full flex-col gap-2 rounded-[20px] px-2 pt-2 pb-4",
                    spec.tint,
                  )}
                >
                  {body}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
