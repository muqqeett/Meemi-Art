import Image from "next/image";
import Link from "next/link";
import { Search } from "lucide-react";

import { Reveal, RevealGroup, RevealItem } from "@/components/motion/reveal";
import { staggerStep } from "@/lib/motion";

/**
 * "Shop our top gifting ideas" — Figma 222:377.
 *
 * The two rows are not the same shape, which is the whole character of the
 * block:
 *
 *   row 1  a 797.375 × 392.625 landscape tile beside a 392.625 square
 *   row 2  three 393 × 392.625 squares
 *   gap    10px in both directions
 *
 * Row one is expressed as `797fr 393fr`. Those two numbers sum to the 1190 of
 * usable width left after the 10px gap at the drawn 1200, so the ratio is
 * exact at 1200 and holds at every other width — where a fixed `393px` column
 * would not. The square sets the row height and the landscape tile stretches
 * to meet it.
 *
 *   heading  Segoe UI Regular 48/48, black, 1px tracking
 *   pill     #FAF8F5, 16px x / 6px y, fully rounded, bottom-RIGHT of each
 *            tile — ~19px in from the right edge, ~16px up from the bottom.
 *            Label Segoe UI Bold 14/24, #312B36, with a search glyph.
 */

export type GiftTile = {
  label: string;
  href: string;
  image: string;
  /** Natural pixel size of the export, used to set the tile's aspect. */
  width: number;
  height: number;
};

function Tile({
  tile,
  priority,
  className,
}: {
  tile: GiftTile;
  priority?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={tile.href}
      className={`group/gift relative block overflow-hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest ${className ?? ""}`}
    >
      <Image
        src={tile.image}
        alt=""
        fill
        priority={priority}
        sizes="(min-width: 1024px) 800px, 100vw"
        className="object-cover transition-transform duration-700 ease-out group-hover/gift:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover/gift:scale-100"
      />

      <span className="font-ui absolute right-[19px] bottom-4 inline-flex items-center gap-2 rounded-full bg-paper px-4 py-1.5 text-sm leading-6 font-bold tracking-[-0.15px] whitespace-nowrap text-[#312b36]">
        <Search className="size-4 shrink-0" aria-hidden />
        {tile.label}
      </span>
    </Link>
  );
}

export function GiftingGrid({ tiles }: { tiles: GiftTile[] }) {
  if (tiles.length === 0) return null;

  const [wide, square, ...rest] = tiles;

  return (
    <section className="w-full bg-paper pt-5 pb-[60px]">
      <div className="container-figma">
        <Reveal>
          <h2 className="font-ui text-[2rem] leading-tight tracking-[1px] text-black sm:text-[2.5rem] lg:text-[3rem] lg:leading-[48px]">
            Shop our top gifting ideas
          </h2>
        </Reveal>

        <RevealGroup step={staggerStep.small} className="mt-6 space-y-[10px]">
          {/* Row one: landscape beside square. Stacks below sm, where two
              tiles this wide would each be unreadably short. */}
          <RevealItem className="grid gap-[10px] sm:grid-cols-[797fr_393fr]">
            {wide && (
              <Tile
                tile={wide}
                priority
                className="aspect-[797/393] sm:aspect-auto sm:h-full"
              />
            )}
            {square && <Tile tile={square} priority className="aspect-square" />}
          </RevealItem>

          {rest.length > 0 && (
            <RevealItem className="grid gap-[10px] sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((tile) => (
                <Tile key={tile.label} tile={tile} className="aspect-square" />
              ))}
            </RevealItem>
          )}
        </RevealGroup>
      </div>
    </section>
  );
}
