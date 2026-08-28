import { ArrowRight } from "lucide-react";

import { ButtonLink } from "@/components/ui/button-link";
import { RevealGroup, RevealItem } from "@/components/motion/reveal";
import { staggerStep } from "@/lib/motion";

/**
 * Shown on the homepage in place of the product rails when the catalogue is
 * empty.
 *
 * The alternative — silently dropping both product sections — leaves the
 * homepage jumping from categories straight to the story, which reads as a
 * page that failed to load rather than a shop that has not opened yet. This
 * says so plainly and sends the reader somewhere real.
 *
 * Deliberately not a grid of placeholder cards: fake product shapes suggest
 * stock that does not exist.
 */
export function CatalogueComingSoon() {
  return (
    <section className="section-y">
      <div className="container-page">
        <RevealGroup
          step={staggerStep.medium}
          className="mx-auto max-w-xl border-y border-border py-16 text-center sm:py-20"
        >
          <RevealItem as="p" className="eyebrow justify-center">
            The shop
          </RevealItem>

          <RevealItem>
            <h2 className="heading-section mt-5 text-balance">
              Your collection is coming together
            </h2>
          </RevealItem>

          <RevealItem as="p" className="text-lede mx-auto mt-5 max-w-md">
            Pieces are still on the hook. Browse the categories to see what is coming, or
            join the list below and we will tell you the moment the first one is listed.
          </RevealItem>

          <RevealItem className="mt-9 flex flex-wrap justify-center gap-3">
            <ButtonLink href="/shop" variant="brand" size="pill">
              Browse categories
              <ArrowRight aria-hidden />
            </ButtonLink>
            <ButtonLink href="/about" variant="brandOutline" size="pill">
              How we work
            </ButtonLink>
          </RevealItem>
        </RevealGroup>
      </div>
    </section>
  );
}
