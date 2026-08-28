import Image from "next/image";
import Link from "next/link";

import { Reveal, RevealGroup, RevealItem } from "@/components/motion/reveal";
import { staggerStep } from "@/lib/motion";

/**
 * "Who Are We?" — Figma 222:427.
 *
 *   band     #F2AFBD, 120px side padding, 60px top, nothing at the bottom —
 *            the photograph runs to the band's edge and is clipped there
 *   columns  two 600px halves with NO gap between them: the image ends at
 *            x=720 and the text begins at x=720
 *   heading  Segoe Print Regular 24/28, #191919
 *   body     Segoe UI Regular 18/28, #191919, three paragraphs with no space
 *            between them, so they read as one block
 *   button   white pill, 48px tall
 *
 * The halves are a two-column grid rather than a flex row with fixed 600px
 * children. Two rigid 600s plus a gap need 1240 of the 1200 available, so
 * below a 1440 viewport the text was pushed past the band's edge and clipped
 * by `overflow-hidden` — losing the right-hand ~95px of every line. A grid
 * splits whatever width there is, which is what the drawn 50/50 actually means.
 */
export function WhoAreWe() {
  return (
    <section className="w-full overflow-hidden bg-blush">
      <div className="container-figma pt-[60px]">
        <div className="grid items-center lg:grid-cols-2">
          <Reveal variant="scale">
            <div className="relative aspect-[600/545] w-full">
              <Image
                src="/home/who-are-we-hands.png"
                alt="Two people bringing their palms together"
                fill
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="object-cover"
              />
            </div>
          </Reveal>

          <RevealGroup step={staggerStep.medium} className="pt-10 pb-[60px] lg:pt-0">
            <RevealItem>
              <h2 className="font-hand text-2xl leading-7 font-normal text-near-black">
                Who Are We?
              </h2>
            </RevealItem>

            {/* No margin between the paragraphs — the design runs them
                together as a single column of text. */}
            <RevealItem as="div" className="font-ui mt-6 text-lg leading-7 text-near-black">
              <p className="leading-7">
                Every piece of art begins with a feeling, but its true purpose is realized
                when it becomes part of your story.
              </p>
              <p className="leading-7">
                We pour our craftsmanship into every digital brushstroke, creating and
                bringing you elements that elevate your vision.
              </p>
              <p className="leading-7">
                By crafting the distinctive details, we give you the freedom to focus on
                your bigger picture. This is more than a collection of digital assets.
                It&rsquo;s a creative partnership ready to breathe life into your ideas.
              </p>
            </RevealItem>

            <RevealItem className="mt-8">
              <Link
                href="/contact"
                className="font-ui inline-flex h-12 items-center justify-center rounded-full bg-white px-6 text-xl leading-[30px] font-semibold text-near-black shadow-[0px_3px_4px_-1px_rgba(0,0,0,0.15),0px_5px_10px_0px_rgba(0,0,0,0.1),0px_1px_12px_0px_rgba(0,0,0,0.1)] transition-transform duration-200 ease-out hover:scale-[1.02] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-near-black active:scale-[0.99] motion-reduce:transition-none motion-reduce:hover:scale-100"
              >
                Get in Touch
              </Link>
            </RevealItem>
          </RevealGroup>
        </div>
      </div>
    </section>
  );
}
