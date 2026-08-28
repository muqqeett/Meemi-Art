"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";

import { duration, ease, staggerContainer, fadeUp } from "@/lib/motion";

/**
 * Campaign hero — built to the Figma frame `D` (node 83-3).
 *
 * Measurements taken from the file rather than eyeballed:
 *
 *   frame      1440 × 682 hug · fill #155A33 · padding 120 x / 60 y · gap 10
 *   headline   Segoe Print Bold 64 / 54 · #FFFFFF · 480 wide
 *   body       Segoe UI Semibold 24 / 32 · #FFFFFF · 480 wide
 *   button     178.66 × 48 · #FFFFFF · fully rounded · 24 padding-x · shadow
 *   label      Segoe UI Semibold 20 / 30 · #19124F
 *   collage    600 × 562
 *
 * The design is drawn at one width. Everything below `lg` is a judgement call
 * made here: the two columns stack with the collage second, the padding steps
 * down from 120 to the page gutter, and the headline scales with the viewport
 * so 64px never has to fit a 375px screen.
 *
 * Type sizes are set in rem against a 16px root, so a reader who has raised
 * their browser's base font size gets a hero that grows with it — a hero
 * pinned to px is the one part of a page that ignores that preference.
 */

/** One timeline for the four rows of copy. */
const copy = staggerContainer(0.09, 0.15);

export function Hero({ collageSrc }: { collageSrc: string | null }) {
  return (
    <section className="bg-[#155A33]">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col items-center gap-10 px-5 py-14 sm:px-8 lg:flex-row lg:justify-between lg:gap-10 lg:px-[120px] lg:py-[60px]">
        <motion.div
          data-reveal
          variants={copy}
          initial="hidden"
          animate="visible"
          className="w-full text-white lg:w-[480px] lg:shrink-0"
        >
          {/* 64/54 in the file — a line height below the font size, which is
              what gives the two lines their tight stacked look. Held exactly
              at `lg`, opened up below it so the descenders do not collide at
              small sizes. */}
          <motion.h1
            data-reveal
            variants={fadeUp}
            // `text-white` is explicit, not inherited: globals.css sets every
            // h1–h4 to brand purple in the base layer, and that beats the
            // colour on the parent.
            className="font-hand text-[2.5rem] leading-[1.05] font-bold text-white sm:text-[3.25rem] lg:text-[4rem] lg:leading-[0.84]"
          >
            Real Art,
            <br />
            Freely Shared
          </motion.h1>

          <motion.p
            data-reveal
            variants={fadeUp}
            // 24 / 32 at `lg`, exactly as drawn.
            className="font-ui mt-6 text-base leading-[1.5] font-semibold sm:text-lg lg:mt-5 lg:text-2xl lg:leading-8"
          >
            Immerse yourself in a premium gallery of authentic and human made art with
            open access. when you find a piece that speaks to you, collaborate directly
            with the original artist to tailor it exclusively for your vision.
          </motion.p>

          <motion.div data-reveal variants={fadeUp} className="mt-8">
            <Link
              href="/shop"
              // h-12 / px-6 / 20px label reproduces the 178.66 × 48 pill.
              className="font-ui inline-flex h-12 items-center justify-center rounded-full bg-white px-6 text-xl leading-[30px] font-semibold text-[#19124F] shadow-[0_2px_8px_rgba(0,0,0,0.16)] transition-transform duration-200 ease-out hover:scale-[1.02] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white active:scale-[0.99] motion-reduce:transition-none motion-reduce:hover:scale-100"
            >
              Shop All Deals
            </Link>
          </motion.div>
        </motion.div>

        {/*
          The collage is a 600 × 562 group of layered photographs, stickers and
          torn-paper edges. It goes in as one flat asset rather than being
          reassembled in DOM: rebuilding thirty absolutely-positioned fragments
          would drift from the design at every breakpoint and cost thirty
          layout boxes for something that never reflows internally.

          Export from Figma: select the `Group` inside frame `D`, export PNG at
          2x, save as `public/hero/collage.png`.

          Until then the column is simply absent — the hero renders as green
          panel, headline, body and button, and the text column widens to fill.
          A placeholder box would only advertise the gap.

          `priority` because on the homepage this is the LCP candidate.
        */}
        {collageSrc && (
          <motion.div
            data-reveal
            initial={{ opacity: 0, scale: 1.03 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: duration.cinematic, ease: ease.enter, delay: 0.1 }}
            className="relative aspect-[600/562] w-full max-w-[600px] lg:w-[600px] lg:shrink-0"
          >
            <Image
              src={collageSrc}
              alt="A collage of handmade work: a potter at the wheel, hands shaping clay, baked goods, a hand-lettered welcome card and pressed leaves, with a sticker reading up to 40% off everything"
              fill
              priority
              sizes="(min-width: 1024px) 600px, 100vw"
              className="object-contain"
            />
          </motion.div>
        )}
      </div>
    </section>
  );
}
