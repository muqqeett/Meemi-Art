"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Sticky header shell — Figma "Top Bar" (253:2) and "Frame 23" (253:28).
 *
 * The design is two stacked bands on the same warm ground: a 105px top bar
 * carrying the mark, menu, search and account controls, then a 56px category
 * rail. Both sit on `#faf8f5`, which is already in the palette as `paper` — no
 * new colour was needed for this redesign.
 *
 * The band still compacts as the page scrolls, which the previous header did
 * and the design does not contradict: over the first 64 pixels the top row
 * tightens from the drawn 96px to a 68px working toolbar and the hairline and
 * shadow come up, so it separates from whatever passes underneath.
 *
 * Driven by `useTransform` off scroll position rather than React state, so the
 * height tracks continuously instead of snapping at a threshold, a reload
 * part-way down a page is already correct without an effect reading
 * `window.scrollY`, and nothing re-renders React on scroll.
 *
 * It never hides. Auto-hiding headers save 20px and cost the shopper the bag
 * button at the exact moment they reach for it.
 *
 * `children` is a prop, so the header's contents stay server components.
 */

/** Scroll range over which the header transitions, in pixels. */
const RANGE = [0, 64];

export function HeaderShell({
  children,
  belowBar,
}: {
  children: ReactNode;
  /** The category rail, which collapses away as the header compacts. */
  belowBar?: ReactNode;
}) {
  const { scrollY } = useScroll();

  const height = useTransform(scrollY, RANGE, [96, 68], { clamp: true });
  const borderColor = useTransform(
    scrollY,
    RANGE,
    ["rgba(25, 25, 25, 0)", "rgba(25, 25, 25, 0.12)"],
    { clamp: true },
  );
  const boxShadow = useTransform(
    scrollY,
    RANGE,
    ["0 1px 2px rgba(21, 18, 26, 0)", "0 1px 3px rgba(21, 18, 26, 0.07)"],
    { clamp: true },
  );

  return (
    <motion.header
      style={{ borderBottomColor: borderColor, boxShadow }}
      className="sticky top-0 z-50 border-b border-b-transparent bg-paper/95 backdrop-blur supports-backdrop-filter:bg-paper/85"
    >
      <motion.div style={{ height }} className="container-page flex items-center gap-4">
        {children}
      </motion.div>

      {belowBar}
    </motion.header>
  );
}
