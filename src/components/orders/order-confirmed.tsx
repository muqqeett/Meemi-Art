"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import type { ReactNode } from "react";

import { duration, ease, fadeUp, staggerContainer } from "@/lib/motion";

/**
 * The moment an order lands — Plum Studio "Order success" (28:2946).
 *
 * A centred panel: a plum tick that draws itself in, a large Bricolage heading,
 * what happens next, then the ways onward. It is a beat of acknowledgement, not
 * a celebration — no confetti, no bounce, nothing that has to finish before the
 * shopper can read their order number.
 *
 * The design opens on a mascot illustration and lists each file with its own
 * download button, and closes on a "Makers who bought this also liked" rail.
 * The tick stands in for the mascot; the files are listed, with their download
 * links, in the order view directly beneath; and there is no "also liked"
 * recommendation to show, so that rail is not drawn.
 *
 * The panel is a client component only because of this animation; the order
 * data it displays is still rendered on the server and passed through.
 */
export function OrderConfirmed({
  heading,
  children,
  actions,
}: {
  heading: ReactNode;
  children: ReactNode;
  actions: ReactNode;
}) {
  return (
    <motion.div
      data-reveal
      variants={staggerContainer(0.09, 0.12)}
      initial="hidden"
      animate="visible"
      className="font-figtree mb-10 rounded-[24px] bg-pl-subtle px-6 py-10 text-center sm:px-10"
    >
      <motion.span
        aria-hidden
        data-reveal
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: duration.slow, ease: ease.enter }}
        className="mx-auto flex size-16 items-center justify-center rounded-full bg-plum-500 text-pl-on-dark"
      >
        <Check className="size-8" strokeWidth={3} />
      </motion.span>

      <motion.h1
        data-reveal
        variants={fadeUp}
        className="pl-display mx-auto mt-5 max-w-[16ch] text-[34px] leading-[38px] tracking-[-0.03em] text-balance sm:max-w-none sm:text-[44px] sm:leading-[48px]"
      >
        {heading}
      </motion.h1>

      <motion.div
        data-reveal
        variants={fadeUp}
        className="mx-auto mt-3 max-w-xl text-base leading-[26px] text-pl-muted [&_span]:font-bold [&_span]:text-pl-text"
      >
        {children}
      </motion.div>

      <motion.div
        data-reveal
        variants={fadeUp}
        className="mt-6 flex flex-wrap justify-center gap-3"
      >
        {actions}
      </motion.div>
    </motion.div>
  );
}
