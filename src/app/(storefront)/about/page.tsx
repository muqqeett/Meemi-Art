import type { Metadata } from "next";
import Image from "next/image";

import { Breadcrumbs } from "@/components/brand/breadcrumbs";
import { ButtonLink } from "@/components/ui/button-link";
import { siteConfig } from "@/lib/config";

export const metadata: Metadata = {
  title: "Our Story",
  description: `How ${siteConfig.name} makes handmade crochet — the yarn we choose, how long a piece takes, and what we stand behind.`,
  alternates: { canonical: "/about" },
  openGraph: {
    title: `Our Story | ${siteConfig.name}`,
    description: `How ${siteConfig.name} makes handmade crochet.`,
    url: `${siteConfig.url}/about`,
  },
};

/**
 * How a pattern gets made.
 *
 * The shop sells digital crochet patterns and resources, so the last step used
 * to be wrong in a way that mattered: "Packing — wrapped in tissue, boxed in
 * recycled kraft, and sent without plastic" described posting a parcel that is
 * never posted. The craft steps are kept, because they are true — a sample is
 * crocheted by hand before a pattern can be written — and the process now ends
 * where it actually ends, with a file.
 */
const CRAFT = [
  {
    step: "01",
    title: "Designing the piece",
    body: "Every pattern starts as an object. It is worked out on the hook first — shaping, gauge, where the increases fall — because a pattern that has never been crocheted is a guess written down.",
  },
  {
    step: "02",
    title: "Crocheting the sample",
    body: "The finished sample is made by hand at a deliberately tight gauge, then photographed as you see it on the product page. Nothing is rendered, and nothing is shown that was not actually made.",
  },
  {
    step: "03",
    title: "Writing it up",
    body: "Round by round, with stitch counts at the end of each. Ends woven rather than knotted, handles worked into the body instead of sewn on, structural joins reinforced — the finishing is written down, not left to guesswork.",
  },
  {
    step: "04",
    title: "Testing, then publishing",
    body: "The written pattern is worked again from the page to catch anything the designer's hands knew but the text left out. Then it becomes a file you download the moment you have paid for it.",
  },
] as const;

export default function AboutPage() {
  return (
    <>
      <div className="container-page pt-8">
        <Breadcrumbs items={[{ label: "Our Story" }]} />
      </div>

      <section className="container-page pt-10 pb-16 lg:pt-14 lg:pb-24">
        <div className="max-w-3xl">
          <p className="label-caps text-brand-500">Our story</p>
          <h1 className="heading-hero mt-4">Made by hand. Made to last.</h1>
          <p className="text-body mt-6 max-w-2xl text-base">
            {siteConfig.name} is a small crochet studio. Everything listed here was worked
            by hand — there is no factory line, and there is no version of this that a
            machine could produce faster.
          </p>
        </div>

        <div className="relative mt-12 aspect-[16/9] overflow-hidden bg-surface-alt lg:mt-16">
          <Image
            src="https://images.unsplash.com/photo-1516981879613-9f5da904015f?auto=format&fit=crop&w=2000&q=80"
            alt="Cotton yarn in warm neutral shades arranged on a work surface"
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        </div>
      </section>

      <section id="craft" className="scroll-mt-24 border-t border-border bg-surface-alt">
        <div className="container-page section-y">
          <div className="max-w-2xl">
            <p className="label-caps text-brand-500">Craftsmanship</p>
            <h2 className="heading-section mt-4">How a piece gets made</h2>
          </div>

          <ol className="mt-12 grid gap-px overflow-hidden border border-border bg-border sm:grid-cols-2">
            {CRAFT.map((item) => (
              <li key={item.step} className="bg-surface p-7 lg:p-9">
                <p className="font-display text-3xl text-brand-300">{item.step}</p>
                <h3 className="font-display mt-3 text-xl">{item.title}</h3>
                <p className="text-body mt-2.5">{item.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="container-page section-y">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-20">
          <div>
            <h2 className="heading-section">What we stand behind</h2>
          </div>

          <div className="space-y-8">
            {/* These three commitments describe what this shop can actually
                do. They previously promised a made-to-order lead time, a
                delivery window and a repair service for a returned physical
                item — none of which apply when what you receive is a file. */}
            <div className="border-t border-border pt-6">
              <h3 className="font-display text-lg">Nothing is padded out</h3>
              <p className="text-body mt-2">
                We release work when it is finished rather than filling a catalogue to a
                schedule. Each product page tells you exactly what you are getting — the
                format, the file size — before you spend anything.
              </p>
            </div>

            <div className="border-t border-border pt-6">
              <h3 className="font-display text-lg">Yours once you have bought it</h3>
              <p className="text-body mt-2">
                A purchase is not a one-time link. Everything you buy stays in your
                account and can be downloaded again whenever you need it, on whatever
                device you happen to be using.
              </p>
            </div>

            <div className="border-t border-border pt-6">
              <h3 className="font-display text-lg">A fix before a refund</h3>
              <p className="text-body mt-2">
                If a file will not open or something is wrong with it, tell us. We would
                rather send you a working version than process a refund, and we will
                offer that first.
              </p>
            </div>

            <ButtonLink href="/shop" variant="brand" size="pill">
              Shop the collection
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
