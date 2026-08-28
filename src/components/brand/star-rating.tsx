import { Star } from "lucide-react";

import { cn } from "@/lib/utils";

type StarRatingProps = {
  value: number;
  /** Number of reviews, rendered after the stars when provided. */
  count?: number;
  size?: "sm" | "md" | "lg";
  /** Show the numeric score instead of a full row of stars (as on product cards). */
  compact?: boolean;
  className?: string;
};

const SIZES = {
  sm: "size-3.5",
  md: "size-4",
  lg: "size-5",
} as const;

/**
 * Amber stars matching the reference. Always exposes the score to assistive
 * tech as text — the icons themselves are decorative.
 */
export function StarRating({
  value,
  count,
  size = "md",
  compact = false,
  className,
}: StarRatingProps) {
  const rounded = Math.round(value * 10) / 10;
  const label =
    count === undefined
      ? `Rated ${rounded} out of 5`
      : `Rated ${rounded} out of 5 from ${count} ${count === 1 ? "review" : "reviews"}`;

  if (compact) {
    return (
      <span className={cn("inline-flex items-center gap-1", className)}>
        <Star aria-hidden className={cn(SIZES[size], "fill-star text-star")} />
        <span className="text-sm font-medium text-foreground">{rounded}</span>
        <span className="sr-only">{label}</span>
      </span>
    );
  }

  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <span aria-hidden className="inline-flex items-center gap-0.5">
        {Array.from({ length: 5 }, (_, index) => (
          <Star
            key={index}
            className={cn(
              SIZES[size],
              index < Math.round(value)
                ? "fill-star text-star"
                : "fill-transparent text-muted-foreground/40",
            )}
          />
        ))}
      </span>
      {count !== undefined && (
        <span aria-hidden className="ml-1 text-sm text-muted-foreground">
          ({count})
        </span>
      )}
      <span className="sr-only">{label}</span>
    </span>
  );
}
