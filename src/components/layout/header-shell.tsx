"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Sticky header shell that compacts as the page scrolls.
 *
 * At the top of a page the header is tall and airy, which is where the brand
 * gets to breathe. Over the first 64 pixels of scroll it tightens into a
 * working toolbar and its hairline and shadow come up, so it separates from
 * whatever is passing underneath.
 *
 * Driven by `useTransform` off the scroll position rather than by React state,
 * for three reasons: the height tracks the scroll continuously instead of
 * snapping at a threshold (so there is no boundary for a trackpad to flicker
 * across), a reload part-way down a page is already correct without an effect
 * reading `window.scrollY`, and nothing here re-renders React on scroll — the
 * values are written straight to the DOM by the compositor.
 *
 * It never hides. Auto-hiding headers save 20px and cost the shopper the bag
 * button at the exact moment they reach for it.
 *
 * `children` is a prop, so the header's contents stay server components.
 */

/** Scroll range over which the header transitions, in pixels. */
const RANGE = [0, 64];

export function HeaderShell({ children }: { children: ReactNode }) {
  const { scrollY } = useScroll();

  const height = useTransform(scrollY, RANGE, [80, 60], { clamp: true });
  const borderColor = useTransform(
    scrollY,
    RANGE,
    ["rgba(216, 211, 226, 0)", "rgba(216, 211, 226, 1)"],
    { clamp: true },
  );
  const boxShadow = useTransform(
    scrollY,
    RANGE,
    ["0 1px 2px rgba(21, 18, 26, 0)", "0 1px 2px rgba(21, 18, 26, 0.06)"],
    { clamp: true },
  );

  return (
    <motion.header
      style={{ height, borderBottomColor: borderColor, boxShadow }}
      className="sticky top-0 z-50 border-b border-b-transparent bg-surface/95 backdrop-blur supports-backdrop-filter:bg-surface/85"
    >
      <div className="container-page relative flex h-full items-center gap-3">
        {children}
      </div>
    </motion.header>
  );
}
