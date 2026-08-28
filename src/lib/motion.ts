import type { Variants, Transition } from "framer-motion";

/**
 * Meemi Art motion tokens.
 *
 * One source of truth for how the storefront moves, in the same spirit as
 * `globals.css` being the one source of truth for how it looks. Components
 * import from here instead of inventing their own durations, so the whole site
 * can be re-timed from this file alone.
 *
 * The brief is editorial, not playful: everything decelerates, nothing
 * overshoots, and nothing loops. Animation is limited to `opacity` and
 * `transform` so it stays on the compositor and off the main thread.
 *
 * Reduced motion is handled globally by `MotionProvider`, not per component —
 * see `src/components/motion/motion-provider.tsx`.
 */

/** Cubic-bezier control points. Framer wants a fixed-length tuple. */
type Bezier = [number, number, number, number];

export const duration = {
  /** Hovers, presses, indicator moves — must feel instant. */
  fast: 0.2,
  /** The default: entrances, reveals, page changes. */
  normal: 0.35,
  /** Larger surfaces that would feel abrupt at `normal`. */
  slow: 0.5,
  /** Reserved for the hero image settle. Nothing else should be this long. */
  cinematic: 1.2,
} as const;

export const ease: Record<"standard" | "enter" | "exit", Bezier> = {
  /** Symmetrical ease for things that move both ways, e.g. an indicator. */
  standard: [0.4, 0, 0.2, 1],
  /** Fast out of the gate, long quiet settle. This is what reads as expensive. */
  enter: [0.16, 1, 0.3, 1],
  /** Leaves briskly — an exit the reader waits on feels broken. */
  exit: [0.4, 0, 1, 1],
};

/** Gap between siblings in a staggered reveal. */
export const staggerStep = {
  /** Grids and long lists, where a slower cascade would drag. */
  small: 0.05,
  /** Short sequences: hero copy, a product's detail column. */
  medium: 0.08,
} as const;

export const transition = {
  fast: { duration: duration.fast, ease: ease.standard },
  normal: { duration: duration.normal, ease: ease.enter },
  slow: { duration: duration.slow, ease: ease.enter },
  exit: { duration: duration.fast, ease: ease.exit },
} satisfies Record<string, Transition>;

/**
 * Shared viewport trigger. `once` is deliberate: a reveal that replays every
 * time the reader scrolls back up turns a page into a slideshow.
 *
 * The negative bottom margin holds the animation until the element is properly
 * on screen rather than firing on the first stray pixel.
 */
export const viewport = { once: true, amount: 0.15, margin: "0px 0px -80px 0px" };

// ---------------------------------------------------------------- variants

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: transition.normal },
};

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: transition.normal },
};

export const fadeDown: Variants = {
  hidden: { opacity: 0, y: -12 },
  visible: { opacity: 1, y: 0, transition: transition.normal },
};

/** For panels and cards that should arrive rather than slide. */
export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.98 },
  visible: { opacity: 1, scale: 1, transition: transition.normal },
};

/** Page entrance. Shorter travel than `fadeUp` — the whole viewport is moving. */
export const pageTransition: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: transition.normal },
};

export type RevealVariant = "up" | "down" | "in" | "scale";

export const revealVariants: Record<RevealVariant, Variants> = {
  up: fadeUp,
  down: fadeDown,
  in: fadeIn,
  scale: scaleIn,
};

/**
 * Parent of a staggered reveal.
 *
 * The container animates nothing itself — it exists to schedule its children,
 * which is cheaper than giving every child its own `whileInView` observer.
 */
export function staggerContainer(
  step: number = staggerStep.small,
  delayChildren = 0,
): Variants {
  return {
    hidden: {},
    visible: {
      transition: { staggerChildren: step, delayChildren },
    },
  };
}

/**
 * Overlay/panel pairs for surfaces Framer owns outright. Base UI dialogs and
 * sheets animate themselves through their own data-attribute transitions and
 * are deliberately left alone — see `components/ui/dialog.tsx`.
 */
export const overlayVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: transition.fast },
  exit: { opacity: 0, transition: transition.exit },
};

export const panelVariants: Variants = {
  hidden: { opacity: 0, y: -6 },
  visible: { opacity: 1, y: 0, transition: transition.fast },
  exit: { opacity: 0, y: -6, transition: transition.exit },
};
