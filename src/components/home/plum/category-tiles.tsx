import Image from "next/image";
import Link from "next/link";

import { cn } from "@/lib/utils";

export type CategoryTile = {
  id: string;
  name: string;
  slug: string;
  image: string | null;
  productCount: number;
};

/** The design's five category tints, in the order it draws them. */
const TINTS = [
  "bg-pl-tint-crochet hover:bg-[#e3d6f7]",
  "bg-pl-tint-templates hover:bg-[#ffe7b8]",
  "bg-pl-tint-printables hover:bg-[#cfe9db]",
  "bg-pl-tint-assets hover:bg-[#cfe0f6]",
  "bg-pl-tint-ebooks hover:bg-[#ddd3ef]",
] as const;

/**
 * "Shop by category" — Figma "Categories" (17:262).
 *
 * Tiles are the shop's real categories, each with its real product count, and a
 * category appears only once it has something in it: a tile that leads to an
 * empty page is a worse promise than a shorter row. The design's five fixed
 * tiles (Crochet patterns, Templates, Printables, Creator assets, eBooks) are a
 * different catalogue and are not drawn.
 *
 * A tile shows the category's own picture when it has one. The design's
 * illustrations belong to its categories, so a tile without a picture takes the
 * crochet-loop drawing rather than a bare tint.
 *
 * From lg the tiles sit in a row at the design's 232px; below that the row
 * scrolls sideways with scroll-snap, as the design specifies for under 820px.
 */
export function CategoryTiles({ tiles }: { tiles: CategoryTile[] }) {
  if (tiles.length === 0) return null;

  return (
    <section
      aria-labelledby="home-categories"
      className="font-figtree mx-auto w-full max-w-[1280px] px-4 py-10 sm:px-8 lg:py-14"
    >
      <h2 id="home-categories" className="pl-display pl-h2">
        Shop by category
      </h2>

      <ul className="no-scrollbar -mx-4 mt-6 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 sm:-mx-8 sm:px-8 lg:mx-0 lg:flex-wrap lg:gap-6 lg:overflow-visible lg:px-0">
        {tiles.map((tile, index) => (
          <li key={tile.id} className="w-[184px] shrink-0 snap-start lg:w-[232px]">
            <Link
              href={`/shop/${tile.slug}`}
              className={cn(
                "pl-focus group flex h-full flex-col gap-2 rounded-[20px] px-2 pt-2 pb-4 transition-[background-color,box-shadow] duration-200 hover:shadow-pl-md",
                TINTS[index % TINTS.length],
              )}
            >
              <span className="relative block h-[140px] w-full overflow-hidden rounded-[12px]">
                {tile.image ? (
                  <Image
                    src={tile.image}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 232px, 184px"
                    className="object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                  />
                ) : (
                  <Image
                    src="/home/plum/cat-loop.svg"
                    alt=""
                    width={95}
                    height={96}
                    unoptimized
                    className="absolute top-1/2 left-1/2 h-auto w-[95px] max-w-none -translate-x-1/2 -translate-y-1/2 transition-transform duration-300 group-hover:-translate-y-[58%]"
                  />
                )}
              </span>
              <span className="relative flex flex-col gap-0.5 pl-2">
                <span className="text-base leading-[22px] font-bold tracking-[-0.005em] text-pl-text">
                  {tile.name}
                </span>
                {/* The count swaps for "Shop →" on hover and keyboard focus. */}
                <span className="relative block h-[18px] text-[13px] leading-[18px] font-medium text-pl-muted">
                  <span className="transition-opacity group-hover:opacity-0 group-focus-visible:opacity-0">
                    {tile.productCount} {tile.productCount === 1 ? "pattern" : "patterns"}
                  </span>
                  <span
                    aria-hidden
                    className="absolute inset-0 font-bold text-pl-text opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                  >
                    Shop →
                  </span>
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
