import { ArrowDown } from "lucide-react";

import { CONVERSION_DEFINITIONS, formatRate, funnelRates, type FunnelCounts } from "@/lib/analytics/metrics";

/**
 * The view → cart → checkout → purchase funnel for a period.
 *
 * A list, not a chart: four counts and three step rates read better as text,
 * and a screen reader gets the same thing a sighted operator does. The bars
 * are proportional to the largest stage and purely decorative. Each rate names
 * its own denominator, and an undefined rate (nothing to divide by) is "—".
 */
export function AnalyticsFunnel({ counts }: { counts: FunnelCounts }) {
  const rates = funnelRates(counts);
  const stages = [
    { label: "Product views", value: counts.views },
    { label: "Add to cart", value: counts.addToCart, rate: rates.viewToCart, definition: CONVERSION_DEFINITIONS.viewToCart },
    { label: "Checkout starts", value: counts.checkoutStarts, rate: rates.cartToCheckout, definition: CONVERSION_DEFINITIONS.cartToCheckout },
    { label: "Purchases", value: counts.purchases, rate: rates.checkoutToPurchase, definition: CONVERSION_DEFINITIONS.checkoutToPurchase },
  ];
  const widest = Math.max(1, ...stages.map((stage) => stage.value));

  return (
    <div>
      <ol className="space-y-1">
        {stages.map((stage, index) => (
          <li key={stage.label}>
            {index > 0 && (
              <p className="flex items-center gap-1.5 py-1 pl-1 text-xs text-muted-foreground">
                <ArrowDown className="size-3 shrink-0" aria-hidden />
                <span className="font-medium text-foreground tabular-nums">{formatRate(stage.rate ?? null)}</span>
                <span>· {stage.definition}</span>
              </p>
            )}
            <div className="flex items-center gap-3">
              <span className="w-32 shrink-0 text-sm text-foreground">{stage.label}</span>
              <span aria-hidden className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--admin-raised)]">
                <span
                  className="block h-full rounded-full bg-brand-600"
                  style={{ width: `${Math.min(100, (stage.value / widest) * 100)}%` }}
                />
              </span>
              <span className="w-16 shrink-0 text-right text-sm font-semibold text-foreground tabular-nums">
                {stage.value.toLocaleString("en-US")}
              </span>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-4 border-t border-border pt-3 text-sm text-foreground">
        Overall conversion{" "}
        <span className="font-semibold tabular-nums">{formatRate(rates.conversion)}</span>{" "}
        <span className="text-xs text-muted-foreground">· {CONVERSION_DEFINITIONS.conversion}</span>
      </p>
    </div>
  );
}
