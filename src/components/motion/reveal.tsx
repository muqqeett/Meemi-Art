"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

import {
  revealVariants,
  staggerContainer,
  staggerStep,
  viewport,
  type RevealVariant,
} from "@/lib/motion";

/**
 * Scroll and mount reveals.
 *
 * These are thin client wrappers that take `children` as a prop, so anything
 * passed through them stays a server component. `<RevealGroup>` around a grid
 * of server-rendered product cards animates the grid without pulling a single
 * card into the browser bundle.
 *
 * Every reveal carries `data-reveal`, which `globals.css` uses to force the
 * finished state when scripting is unavailable — content must never be left
 * invisible because JavaScript did not run.
 */

/** DOM elements a reveal may render as. Covers every call site in the app. */
type RevealTag = "div" | "section" | "article" | "ul" | "li" | "dl" | "p" | "span";

/**
 * The union of `motion.div | motion.ul | …` is unusable in JSX because each
 * member wants different element props. Every tag here takes the same handful
 * of props we actually pass, so one representative type stands in for all.
 */
const tag = motion as unknown as Record<RevealTag, typeof motion.div>;

type RevealProps = {
  children: ReactNode;
  /** Which entrance to use. `up` (fade + rise) is the house default. */
  variant?: RevealVariant;
  /** Seconds to hold before starting. Use sparingly — this delays content. */
  delay?: number;
  as?: RevealTag;
  className?: string;
  /**
   * Animate as soon as it mounts instead of waiting for the viewport. For
   * content that is always above the fold, where an observer is wasted work.
   */
  onMount?: boolean;
};

/** One element that fades in when it reaches the viewport. */
export function Reveal({
  children,
  variant = "up",
  delay = 0,
  as = "div",
  className,
  onMount = false,
}: RevealProps) {
  const Component = tag[as];

  return (
    <Component
      data-reveal
      className={className}
      variants={revealVariants[variant]}
      initial="hidden"
      {...(onMount
        ? { animate: "visible" }
        : { whileInView: "visible", viewport })}
      transition={{ delay }}
    >
      {children}
    </Component>
  );
}

type RevealGroupProps = {
  children: ReactNode;
  /** Gap between children. Keep grids on `small`. */
  step?: number;
  delayChildren?: number;
  as?: RevealTag;
  className?: string;
  onMount?: boolean;
};

/**
 * Schedules a run of `<RevealItem>` children.
 *
 * The observer lives here, on the container, rather than on every child — one
 * `IntersectionObserver` for a 24-card grid instead of twenty-four.
 */
export function RevealGroup({
  children,
  step = staggerStep.small,
  delayChildren = 0,
  as = "div",
  className,
  onMount = false,
}: RevealGroupProps) {
  const Component = tag[as];

  return (
    <Component
      className={className}
      variants={staggerContainer(step, delayChildren)}
      initial="hidden"
      {...(onMount
        ? { animate: "visible" }
        : { whileInView: "visible", viewport })}
    >
      {children}
    </Component>
  );
}

/** A child of `<RevealGroup>`. Timing comes from the parent, not from here. */
export function RevealItem({
  children,
  variant = "up",
  as = "div",
  className,
}: {
  children: ReactNode;
  variant?: RevealVariant;
  as?: RevealTag;
  className?: string;
}) {
  const Component = tag[as];

  return (
    <Component data-reveal className={className} variants={revealVariants[variant]}>
      {children}
    </Component>
  );
}
