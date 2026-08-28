"use client";

import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import type { ReactNode } from "react";

import { duration, ease, fadeUp, staggerContainer } from "@/lib/motion";

/**
 * The moment an order lands.
 *
 * The tick draws itself in, then the confirmation reveals in order: heading,
 * what happens next, then the ways onward. It is a beat of acknowledgement, not
 * a celebration — no confetti, no bounce, nothing that has to finish before the
 * shopper can read their order number.
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
      className="mb-8 rounded-2xl border border-success/30 bg-success/5 p-6 text-center"
    >
      <motion.span
        aria-hidden
        data-reveal
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: duration.slow, ease: ease.enter }}
        className="mx-auto block w-fit"
      >
        <CheckCircle2 className="size-10 text-success" />
      </motion.span>

      <motion.h1
        data-reveal
        variants={fadeUp}
        className="heading-sub mt-3"
      >
        {heading}
      </motion.h1>

      <motion.div data-reveal variants={fadeUp} className="text-body mt-2">
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
