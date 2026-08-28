import Image from "next/image";

import { ButtonLink } from "@/components/ui/button-link";
import { RevealGroup, RevealItem } from "@/components/motion/reveal";
import { staggerStep } from "@/lib/motion";

/**
 * Full-bleed campaign break.
 *
 * Deliberately placed between two product grids to stop the homepage reading as
 * one long catalogue. Text sits on an ink panel beside the image rather than on
 * top of it, so contrast is guaranteed regardless of the photograph.
 */
export function CampaignBanner() {
  return (
    <section className="bg-brand-700 text-white">
      <div className="grid lg:grid-cols-2">
        <div className="relative aspect-[4/3] lg:aspect-auto lg:min-h-[560px]">
          <Image
            src="https://images.unsplash.com/photo-1584589167171-541ce45f1eea?auto=format&fit=crop&w=1800&q=80"
            alt="Close-up of crochet stitches showing the texture of the worked fabric"
            fill
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover"
          />
        </div>

        <div className="flex items-center px-6 py-16 sm:px-10 lg:px-16 lg:py-24">
          <RevealGroup step={staggerStep.medium} className="max-w-lg">
            <RevealItem as="p" className="label-caps text-royal-300">
              The art of handmade
            </RevealItem>

            <RevealItem>
              <h2 className="font-display mt-4 text-4xl leading-[1.05] font-semibold tracking-[-0.015em] text-white sm:text-5xl">
                Every stitch is a decision
              </h2>
            </RevealItem>

            <RevealItem as="p" className="mt-5 text-[0.9375rem] leading-relaxed text-white/75">
              A bag takes around nine hours. A bouquet takes longer. There is no machine
              that can shortcut it — which is why no two pieces come out identical, and
              why we make in small batches rather than to a forecast.
            </RevealItem>

            <RevealItem
              as="dl"
              className="mt-10 grid grid-cols-3 gap-6 border-t border-white/15 pt-8"
            >
              <div>
                <dt className="text-xs text-white/55">Worked by</dt>
                <dd className="font-display mt-1 text-2xl">Hand</dd>
              </div>
              <div>
                <dt className="text-xs text-white/55">Batch size</dt>
                <dd className="font-display mt-1 text-2xl">Small</dd>
              </div>
              <div>
                <dt className="text-xs text-white/55">Yarn</dt>
                <dd className="font-display mt-1 text-2xl">Cotton</dd>
              </div>
            </RevealItem>

            <RevealItem>
              <ButtonLink href="/about" variant="onDark" size="pill" className="mt-10">
                Read our story
              </ButtonLink>
            </RevealItem>
          </RevealGroup>
        </div>
      </div>
    </section>
  );
}

