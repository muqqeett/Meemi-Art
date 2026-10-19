import Image from "next/image";

import { YarnDivider } from "@/components/home/plum/yarn-divider";

/**
 * "How it works" — Figma "How it works" (17:762): the yarn divider, a heading
 * and three steps, each a 64px drawing beside a bold line and a 14/22 line.
 *
 * The design's copy makes claims this shop cannot: "Mix any 3 to save 20%"
 * (there is no bundle discount), "Card, PayPal, Apple Pay or Google Pay" (the
 * methods are Paddle's to offer) and "Updates are free forever". Each step says
 * only what the shop does, using the wording the product and checkout pages
 * already use.
 */
const STEPS = [
  {
    title: "Pick a pattern",
    body: "Browse the crochet patterns and add what you like to your cart.",
    art: { src: "/home/plum/step-bag.svg", w: 40, h: 47, inset: "inset-[15.25%_20%_14.33%_20%]" },
  },
  {
    title: "Pay securely",
    body: "Paddle handles payment, tax and receipts, so card details never touch this site.",
    art: { src: "/home/plum/step-laptop.svg", w: 55, h: 39, inset: "inset-[20.83%_8.33%]" },
  },
  {
    title: "Download and make",
    body: "Your files appear in My Downloads the moment payment clears, and stay there to download again.",
    art: {
      src: "/home/plum/step-gift.svg",
      w: 51,
      h: 48,
      inset: "inset-[13.84%_11.67%_15.83%_11.67%]",
    },
  },
] as const;

export function HowItWorks() {
  return (
    <section
      aria-labelledby="home-how"
      className="font-figtree mx-auto w-full max-w-[1280px] px-4 pt-10 pb-12 sm:px-8 lg:pt-14 lg:pb-16"
    >
      <YarnDivider />

      <h2 id="home-how" className="pl-display pl-h2 mt-6">
        How it works
      </h2>

      <ol className="mt-6 grid gap-8 md:grid-cols-3">
        {STEPS.map((step) => (
          <li key={step.title} className="flex items-center gap-3">
            <span aria-hidden className="relative size-16 shrink-0">
              <Image
                src={step.art.src}
                alt=""
                width={step.art.w}
                height={step.art.h}
                unoptimized
                className={`absolute max-w-none ${step.art.inset}`}
                style={{ width: "auto", height: "auto" }}
              />
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-base leading-[22px] font-bold tracking-[-0.005em] text-pl-text">
                {step.title}
              </span>
              <span className="text-sm leading-[22px] text-pl-muted">{step.body}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
