import Image from "next/image";

import { Reveal, RevealGroup, RevealItem } from "@/components/motion/reveal";
import { staggerStep } from "@/lib/motion";

/**
 * The craft statement.
 *
 * A quiet, type-led band on undyed-cotton sand — the one warm ground in the
 * palette, and the only place it appears on the homepage. It sits between the
 * catalogue and the story so the page has somewhere to breathe between two
 * sections that are both asking for something.
 *
 * Three numbers, all of them true and none of them sales figures: the time a
 * piece takes, the run size, and the fibre. Nothing here is a claim that would
 * need a citation.
 */

const FACTS = [
  { value: "9 hrs", label: "Average time on the hook for a single bag" },
  { value: "Small", label: "Considered releases, not a padded catalogue" },
  { value: "100%", label: "Natural cotton and wool blends, no acrylic" },
] as const;

export function CraftSection() {
  return (
    <section className="section-y bg-sand">
      <div className="container-page">
        <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-20">
          <RevealGroup step={staggerStep.medium}>
            <RevealItem as="p" className="eyebrow text-brand-500">
              The work
            </RevealItem>

            <RevealItem>
              <h2 className="heading-display mt-5 text-balance">
                Slowly made.
                <br />
                Beautifully finished.
              </h2>
            </RevealItem>

            <RevealItem as="p" className="text-lede mt-6 max-w-md">
              A stitch takes as long as it takes. We work in small runs because that is
              the only way to check every join, block every piece properly, and put a
              name to who made it.
            </RevealItem>

            <RevealItem as="dl" className="mt-10 grid grid-cols-3 gap-6 border-t border-sand-deep pt-8">
              {FACTS.map((fact) => (
                <div key={fact.value}>
                  <dt className="font-display text-2xl leading-none text-brand-700 sm:text-3xl">
                    {fact.value}
                  </dt>
                  <dd className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    {fact.label}
                  </dd>
                </div>
              ))}
            </RevealItem>
          </RevealGroup>

          {/* Close-up photography: the texture is the argument, so the crop is
              tight enough that individual stitches are legible. */}
          <Reveal variant="scale">
            <div className="relative aspect-[5/4] overflow-hidden bg-sand-deep">
              <Image
                src="https://images.unsplash.com/photo-1584589167171-541ce45f1eea?auto=format&fit=crop&w=1600&q=80"
                alt="Close-up of crochet stitches, showing the texture of the worked fabric"
                fill
                sizes="(min-width: 1024px) 52vw, 100vw"
                className="object-cover"
              />
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
