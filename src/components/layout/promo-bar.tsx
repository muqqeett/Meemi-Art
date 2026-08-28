"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { promoMessages } from "@/lib/config";

/**
 * Slim utility bar above the header.
 *
 * The messages rotate rather than competing for space side by side. It is
 * announced politely so a screen reader user hears each promise once as it
 * appears, and the rotation stops entirely under prefers-reduced-motion.
 */
export function PromoBar() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || promoMessages.length < 2) return;

    const timer = window.setInterval(() => {
      setIndex((value) => (value + 1) % promoMessages.length);
    }, 5000);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="bg-brand-700 text-white">
      <div className="container-page flex h-9 items-center justify-center overflow-hidden">
        <p aria-live="polite" className="label-caps relative text-white/85">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={index}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
              className="block"
            >
              {promoMessages[index]}
            </motion.span>
          </AnimatePresence>
        </p>
      </div>
    </div>
  );
}
