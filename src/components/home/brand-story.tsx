import Image from "next/image";

import { ButtonLink } from "@/components/ui/button-link";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/reveal";
import { staggerStep } from "@/lib/motion";

const PILLARS = [
  {
    title: "Natural fibres",
    body: "Cotton and wool blends chosen for how they wear, not for how cheaply they work up.",
  },
  {
    title: "Made in batches",
    body: "Small, considered releases rather than a catalogue padded out to fill a page.",
  },
  {
    title: "Meant to be kept",
    body: "Reinforced at the joins that usually fail first, and repairable if they ever do.",
  },
] as const;

/**
 * Brand story: an offset two-image composition beside the copy. Claims here are
 * about method rather than heritage — there is no invented company history.
 */
export function BrandStory() {
  return (
    <section className="section-y bg-surface-alt">
      <div className="container-page">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
          {/* The composition arrives as one piece — animating the two frames
              separately would draw attention to the overlap rather than to the
              photographs. */}
          <Reveal variant="scale" className="relative">
            <div className="relative aspect-[4/5] w-[78%] overflow-hidden bg-surface">
              <Image
                src="https://images.unsplash.com/photo-1516981879613-9f5da904015f?auto=format&fit=crop&w=1200&q=80"
                alt="Balls of cotton yarn in warm neutral shades"
                fill
                sizes="(min-width: 1024px) 32vw, 78vw"
                className="object-cover"
              />
            </div>

            {/* Offset second frame — overlaps the first to break the grid. */}
            <div className="absolute right-0 bottom-[-2.5rem] aspect-square w-[46%] overflow-hidden border-4 border-surface-alt bg-surface sm:bottom-[-3rem]">
              <Image
                src="https://images.unsplash.com/photo-1563901935883-cb61f5d49be4?auto=format&fit=crop&w=900&q=80"
                alt="Hands working a crochet hook through cotton yarn"
                fill
                sizes="(min-width: 1024px) 20vw, 46vw"
                className="object-cover"
              />
            </div>
          </Reveal>

          <RevealGroup
            step={staggerStep.medium}
            delayChildren={0.1}
            className="mt-14 lg:mt-0"
          >
            <RevealItem as="p" className="label-caps text-brand-500">
              Our story
            </RevealItem>

            <RevealItem>
              <h2 className="heading-section mt-4">Made by hand. Made to last.</h2>
            </RevealItem>

            <RevealItem as="p" className="text-body mt-5">
              Meemi Art began with a hook, a basket of cotton and a stubborn dislike of things
              that fall apart. Everything we sell is worked by hand, and we would rather
              make fewer pieces properly than more pieces quickly.
            </RevealItem>

            {/* The three pillars read as one block, so they share one step. */}
            <RevealItem as="dl" className="mt-9 space-y-6">
              {PILLARS.map((pillar) => (
                <div key={pillar.title} className="border-t border-border pt-5">
                  <dt className="font-display text-lg">{pillar.title}</dt>
                  <dd className="text-body mt-1.5">{pillar.body}</dd>
                </div>
              ))}
            </RevealItem>

            <RevealItem>
              <ButtonLink href="/about" variant="brand" size="pill" className="mt-9">
                About Meemi Art
              </ButtonLink>
            </RevealItem>
          </RevealGroup>
        </div>
      </div>
    </section>
  );
}
