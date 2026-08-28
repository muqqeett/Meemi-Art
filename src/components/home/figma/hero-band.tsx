"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";

import { duration, ease, staggerContainer, fadeUp } from "@/lib/motion";

/**
 * Hero — Figma 222:49.
 *
 *   band      #155A33, 1200px content, 120px x / 60px y padding
 *   headline  Segoe Print 64/54, white, "Freely" in #FFA61E, 480px column
 *   body      Segoe UI Semibold 24/32, #FAF8F5
 *   buttons   48px tall, fully rounded; white fill / white 2px outline
 *   collage   558 × 540 group, right-aligned
 *
 * The collage is one flat PNG exported from the group rather than the twenty
 * masked, rotated layers the design is built from. Reproducing those in DOM
 * would mean twenty absolutely-positioned mask-image nodes that drift at every
 * breakpoint and cost twenty composited layers — for artwork that never
 * reflows internally. The export is pixel-identical and scales as one image.
 */

const copy = staggerContainer(0.09, 0.12);

export function HeroBand() {
  return (
    <section className="w-full overflow-hidden bg-forest">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col items-center gap-10 px-5 py-12 sm:px-8 lg:flex-row lg:justify-between lg:gap-10 lg:px-[120px] lg:py-[60px]">
        <motion.div
          data-reveal
          variants={copy}
          initial="hidden"
          animate="visible"
          className="w-full lg:w-[480px] lg:shrink-0"
        >
          <motion.h1
            data-reveal
            variants={fadeUp}
            // text-white is explicit: globals.css sets every h1–h4 to brand
            // purple in the base layer, which beats the colour on a parent.
            className="font-hand text-[2.5rem] leading-[1.05] font-bold text-white sm:text-[3.25rem] lg:text-[4rem] lg:leading-[0.84]"
          >
            Real Art,
            <br />
            <span className="text-amber">Freely</span> Shared
          </motion.h1>

          <motion.p
            data-reveal
            variants={fadeUp}
            className="font-ui mt-6 text-base leading-[1.5] font-semibold text-paper sm:text-lg lg:text-2xl lg:leading-8"
          >
            Immerse yourself in a premium gallery of authentic and human made art with
            open access.
          </motion.p>

          <motion.div
            data-reveal
            variants={fadeUp}
            className="mt-8 flex flex-wrap items-center gap-4"
          >
            <Link
              href="/shop"
              className="font-ui inline-flex h-12 items-center justify-center rounded-full bg-white px-6 text-xl leading-[30px] font-semibold text-near-black shadow-[0px_3px_4px_-1px_rgba(0,0,0,0.15),0px_5px_10px_0px_rgba(0,0,0,0.1),0px_1px_12px_0px_rgba(0,0,0,0.1)] transition-transform duration-200 ease-out hover:scale-[1.02] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white active:scale-[0.99] motion-reduce:transition-none motion-reduce:hover:scale-100"
            >
              Shop Now
            </Link>
            <Link
              href="/contact"
              className="font-ui inline-flex h-12 items-center justify-center rounded-full border-2 border-white px-6 text-xl leading-[30px] font-semibold text-white shadow-[0px_3px_4px_0px_rgba(0,0,0,0.15),0px_5px_10px_0px_rgba(0,0,0,0.1),0px_1px_12px_0px_rgba(0,0,0,0.1)] transition-transform duration-200 ease-out hover:scale-[1.02] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white active:scale-[0.99] motion-reduce:transition-none motion-reduce:hover:scale-100"
            >
              Sell Art
            </Link>
          </motion.div>
        </motion.div>

        <motion.div
          data-reveal
          initial={{ opacity: 0, scale: 1.03 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: duration.cinematic, ease: ease.enter, delay: 0.1 }}
          className="relative aspect-[558/540] w-full max-w-[558px] lg:w-[558px] lg:shrink-0"
        >
          <Image
            src="/home/hero-collage.png"
            alt="A collage of handmade work: a potter at the wheel, hands shaping clay, baked goods, a hand-lettered welcome card and pressed leaves, with a sticker reading up to 40% off everything"
            fill
            priority
            sizes="(min-width: 1024px) 558px, 100vw"
            className="object-contain"
          />
        </motion.div>
      </div>
    </section>
  );
}
