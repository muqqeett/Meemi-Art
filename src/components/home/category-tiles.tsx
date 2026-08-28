import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { SectionHeader } from "@/components/brand/section-header";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/reveal";
import { staggerStep } from "@/lib/motion";

type CategoryTile = {
  id: string;
  name: string;
  slug: string;
  image: string | null;
  description: string | null;
  _count: { products: number };
};

/**
 * First sentence only. Category descriptions are written as two sentences —
 * the promise, then the detail — and the tile has room for the promise.
 */
function firstSentence(text: string): string {
  const end = text.indexOf(". ");
  return end === -1 ? text : text.slice(0, end + 1);
}

/**
 * Editorial category tiles.
 *
 * The first tile spans two columns on desktop so the row reads as a composed
 * layout rather than a uniform grid of equal boxes. Images are large on
 * purpose — this is the section that has to make the catalogue feel desirable.
 */
export function CategoryTiles({ categories }: { categories: CategoryTile[] }) {
  if (categories.length === 0) return null;

  return (
    <section className="section-y">
      <div className="container-page">
        <Reveal>
          <SectionHeader
            eyebrow="Shop by category"
            title="Find your piece"
            description="Six small collections, each worked in its own weight of yarn."
            align="start"
            action={
              <Link
                href="/shop"
                className="label-caps hidden items-center gap-2 text-brand-600 hover:underline sm:inline-flex"
              >
                View all
                <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            }
          />
        </Reveal>

        <RevealGroup
          as="ul"
          step={staggerStep.medium}
          className="mt-10 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4"
        >
          {categories.map((category, index) => {
            // The lead tile gets double width and a taller crop on desktop.
            const lead = index === 0;

            return (
              <RevealItem
                key={category.id}
                as="li"
                className={lead ? "col-span-2 lg:row-span-2" : undefined}
              >
                <Link
                  href={`/shop/${category.slug}`}
                  className="group/tile relative block h-full overflow-hidden bg-surface-alt focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                >
                  <span
                    className={
                      lead
                        ? "relative block aspect-[4/3] lg:aspect-[4/5]"
                        : "relative block aspect-[4/3]"
                    }
                  >
                    {category.image && (
                      <Image
                        src={category.image}
                        alt={`${category.name} — handmade by Meemi Art`}
                        fill
                        sizes={
                          lead
                            ? "(min-width: 1024px) 50vw, 100vw"
                            : "(min-width: 1024px) 25vw, 50vw"
                        }
                        priority={lead}
                        className="object-cover transition-transform duration-700 ease-out group-hover/tile:scale-[1.04]"
                      />
                    )}
                    <span
                      aria-hidden
                      className="absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/10 to-transparent"
                    />
                  </span>

                  <span className="absolute inset-x-0 bottom-0 p-4 text-white transition-transform duration-500 ease-out group-hover/tile:-translate-y-1 sm:p-5 sm:pr-6">
                    <span
                      className={
                        lead
                          ? "font-display block text-2xl leading-tight sm:text-3xl"
                          : "font-display block text-lg leading-tight sm:text-xl"
                      }
                    >
                      {category.name}
                    </span>

                    {/* The description is already written per category in the
                        database — showing it turns a label into a reason to
                        click. Only the lead tile has the room for it, and only
                        the first sentence, which is where the promise lives. */}
                    {lead && category.description && (
                      <span className="mt-2 hidden max-w-sm text-sm leading-relaxed text-white/75 sm:block">
                        {firstSentence(category.description)}
                      </span>
                    )}

                    <span className="mt-2 flex items-center gap-2 text-xs text-white/70">
                      <span className="label-caps text-white">Explore</span>
                      <ArrowRight
                        aria-hidden
                        className="size-3.5 transition-transform duration-300 group-hover/tile:translate-x-1.5"
                      />
                      <span className="ml-auto tabular-nums">
                        {category._count.products}{" "}
                        {category._count.products === 1 ? "piece" : "pieces"}
                      </span>
                    </span>
                  </span>
                </Link>
              </RevealItem>
            );
          })}
        </RevealGroup>
      </div>
    </section>
  );
}
