import { cn } from "@/lib/utils";
import { formatMoney, discountPercent } from "@/lib/money";

type PriceProps = {
  priceCents: number;
  compareAtCents?: number | null;
  size?: "sm" | "md" | "lg";
  /** Render the "-25%" chip next to the struck-through price. */
  showBadge?: boolean;
  className?: string;
};

const SIZES = {
  sm: "text-base",
  md: "text-lg",
  /** Product page. Heavier and larger — this is the number being decided on. */
  lg: "text-2xl font-semibold sm:text-[1.75rem]",
} as const;

/**
 * The price, with any compare-at price struck through beside it.
 *
 * Set in brand purple with tabular figures so a column of prices lines up on
 * the decimal, and so switching variant does not shift the layout under the
 * pointer.
 */
export function Price({
  priceCents,
  compareAtCents,
  size = "md",
  showBadge = false,
  className,
}: PriceProps) {
  const off = discountPercent(priceCents, compareAtCents);

  return (
    <span className={cn("inline-flex flex-wrap items-baseline gap-x-2 gap-y-1", className)}>
      <span className={cn("price leading-none", SIZES[size])}>
        {formatMoney(priceCents)}
      </span>

      {off !== null && compareAtCents ? (
        <>
          <span className="price-was">{formatMoney(compareAtCents)}</span>
          <span className="sr-only">, reduced from {formatMoney(compareAtCents)}</span>
          {showBadge && (
            <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">
              −{off}%
            </span>
          )}
        </>
      ) : null}
    </span>
  );
}
