"use client";

import { useEffect, useRef } from "react";
import { ShoppingBag } from "lucide-react";
import { AnimatePresence, motion, useAnimationControls } from "framer-motion";

import { useCartUI } from "@/lib/stores/cart-ui";
import { duration, ease } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * Header cart trigger. The count is seeded from the server on every render and
 * kept in a store so an "add to cart" elsewhere on the page updates the badge
 * immediately rather than waiting for revalidation.
 *
 * The bag gives a single small nudge when the count goes up — the only
 * confirmation a shopper gets that a quick-add on a card actually landed,
 * since that path does not open the drawer. It fires on increase only: a
 * removal should not be celebrated, and the first render should not animate.
 */
export function CartButton({ serverCount }: { serverCount: number }) {
  const { count, setCount, open } = useCartUI();
  const controls = useAnimationControls();
  const previous = useRef<number | null>(null);

  useEffect(() => {
    setCount(serverCount);
  }, [serverCount, setCount]);

  const displayed = count || serverCount;

  useEffect(() => {
    const before = previous.current;
    previous.current = displayed;

    if (before === null || displayed <= before) return;

    void controls.start({
      scale: [1, 1.14, 1],
      transition: { duration: duration.normal, ease: ease.standard },
    });
  }, [displayed, controls]);

  return (
    <button
      type="button"
      onClick={open}
      className={cn(
        "relative inline-flex size-11 items-center justify-center rounded-full text-brand-700 transition-colors",
        "hover:bg-surface-alt hover:text-royal-600",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-600",
      )}
      aria-label={
        displayed > 0
          ? `Open bag, ${displayed} ${displayed === 1 ? "item" : "items"}`
          : "Open bag, empty"
      }
    >
      <motion.span animate={controls} className="inline-flex">
        <ShoppingBag className="size-5" aria-hidden />
      </motion.span>

      <AnimatePresence>
        {displayed > 0 && (
          <motion.span
            aria-hidden
            data-reveal
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ duration: duration.fast, ease: ease.standard }}
            className="absolute -top-0.5 -right-0.5 inline-flex min-w-5 items-center justify-center rounded-full bg-royal-600 px-1.5 text-[0.6875rem] font-semibold text-white tabular-nums"
          >
            {displayed > 99 ? "99+" : displayed}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}
