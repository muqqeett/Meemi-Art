import Link from "next/link";

import { RevealGroup, RevealItem } from "@/components/motion/reveal";
import { staggerStep } from "@/lib/motion";

/**
 * Trust signals — Figma 222:438.
 *
 *   row      four items across 1200px
 *   title    Segoe UI Semibold 14.6/25, #191919
 *   body     Segoe UI Regular 14.6/25, #5E5E5E, 183px measure
 *   link     Segoe UI Semibold 14.6/25, #FF596F
 *
 * Text only. The design's four icon slots all point at the same 1px
 * transparent placeholder, so there is no artwork to export — and rather than
 * stand in Lucide glyphs the designer never chose, the row runs without them.
 *
 * Copy is a prop rather than hard-coded because these four claims are the ones
 * a payment provider reads during verification, and two of them are not true
 * of a digital shop. See the note in the homepage.
 */

export type TrustItem = {
  title: string;
  body: string;
  href?: string;
  linkLabel?: string;
};

export function TrustRow({ items }: { items: TrustItem[] }) {
  return (
    <section className="w-full bg-paper py-[60px]">
      <div className="container-figma">
        <RevealGroup
          step={staggerStep.small}
          as="ul"
          className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4"
        >
          {items.map((item) => (
            <RevealItem as="li" key={item.title} className="min-w-0">
              <p className="font-ui text-[0.915rem] leading-[25px] font-semibold text-near-black">
                {item.title}
              </p>
              <p className="font-ui max-w-[183px] text-[0.915rem] leading-[25px] text-grey-text">
                {item.body}
              </p>
              {item.href && (
                <Link
                  href={item.href}
                  className="font-ui mt-0.5 inline-block text-[0.915rem] leading-[25px] font-semibold text-rose-link hover:underline"
                >
                  {item.linkLabel ?? "Learn more"}
                </Link>
              )}
            </RevealItem>
          ))}
        </RevealGroup>
      </div>
    </section>
  );
}
