"use client";

import { Minus, Plus } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import { duration, ease } from "@/lib/motion";
import { cn } from "@/lib/utils";

type QuantityStepperProps = {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max: number;
  disabled?: boolean;
  size?: "sm" | "md";
  /** Describes what is being counted, for assistive tech. */
  label: string;
  className?: string;
};

/**
 * Accessible quantity control. The value is exposed as a live region so screen
 * reader users hear the new count after pressing plus or minus.
 */
export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max,
  disabled = false,
  size = "md",
  label,
  className,
}: QuantityStepperProps) {
  const buttonSize = size === "sm" ? "size-8" : "size-10";

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border border-border bg-background",
        disabled && "opacity-60",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={disabled || value <= min}
        aria-label={`Decrease ${label} quantity`}
        className={cn(
          buttonSize,
          "inline-flex items-center justify-center rounded-full text-foreground transition-colors",
          "hover:bg-surface-alt disabled:pointer-events-none disabled:opacity-40",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600",
        )}
      >
        <Minus className="size-4" aria-hidden />
      </button>

      {/* Only the digit animates. The live region and its label stay put so
          screen readers announce one clean value change, and the fixed
          min-width means the row never reflows as the number swaps. */}
      <span
        aria-live="polite"
        aria-atomic="true"
        className={cn(
          "relative grid min-w-8 place-items-center overflow-hidden font-medium tabular-nums",
          size === "sm" ? "h-5 text-sm" : "h-6 text-[0.9375rem]",
        )}
      >
        {/* The announced value lives here, not on the animated digit: during a
            change `AnimatePresence` holds both the old and new number in the
            DOM, and an atomic live region would read them as one string. */}
        <span className="sr-only">
          {label} quantity: {value}
        </span>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={value}
            aria-hidden
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: duration.fast, ease: ease.standard }}
            className="col-start-1 row-start-1"
          >
            {value}
          </motion.span>
        </AnimatePresence>
      </span>

      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={disabled || value >= max}
        aria-label={`Increase ${label} quantity`}
        className={cn(
          buttonSize,
          "inline-flex items-center justify-center rounded-full text-foreground transition-colors",
          "hover:bg-surface-alt disabled:pointer-events-none disabled:opacity-40",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600",
        )}
      >
        <Plus className="size-4" aria-hidden />
      </button>
    </div>
  );
}
