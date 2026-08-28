import Image from "next/image";
import Link from "next/link";

import { RevealGroup, RevealItem } from "@/components/motion/reveal";
import { staggerStep } from "@/lib/motion";

/**
 * Round category links — Figma 222:351.
 *
 *   circles  216px, fully rounded, five across a 1200px row
 *   labels   Segoe UI Regular 24.55/31, #191919, centred
 *   gaps     29.5px column, 34px row
 *
 * The design names five categories — Crochets, eBooks, Accessories,
 * Invitations, Stickers — that do not exist in the database, which holds six
 * crochet categories. Rather than link five tiles to 404s, each `href` is
 * resolved against the real catalogue by the page and falls back to `/shop`.
 * See the note in the homepage.
 */

export type CircleTile = {
  label: string;
  href: string;
  image: string;
  /** Object-position from the design's crop, which is not always centred. */
  position?: string;
};

export function CategoryCircles({ tiles }: { tiles: CircleTile[] }) {
  return (
    <section className="w-full bg-paper py-[60px]">
      <div className="container-figma">
        <RevealGroup
          step={staggerStep.small}
          className="grid grid-cols-2 gap-x-[29px] gap-y-[34px] sm:grid-cols-3 lg:grid-cols-5"
        >
          {tiles.map((tile) => (
            <RevealItem key={tile.label}>
              <Link href={tile.href} className="group/tile block focus-visible:outline-none">
                <span className="relative block aspect-square w-full overflow-hidden rounded-full bg-white ring-offset-4 transition-shadow group-focus-visible/tile:ring-2 group-focus-visible/tile:ring-forest">
                  <Image
                    src={tile.image}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 216px, 45vw"
                    style={{ objectPosition: tile.position }}
                    className="object-cover transition-transform duration-500 ease-out group-hover/tile:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover/tile:scale-100"
                  />
                </span>
                <span className="font-ui mt-[5px] block pt-[10px] text-center text-[1.25rem] leading-[31px] text-near-black lg:text-[1.53rem]">
                  {tile.label}
                </span>
              </Link>
            </RevealItem>
          ))}
        </RevealGroup>
      </div>
    </section>
  );
}
