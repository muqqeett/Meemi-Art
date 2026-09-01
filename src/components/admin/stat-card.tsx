import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import type { ComponentType } from "react";

import { cn } from "@/lib/utils";

type StatCardProps = {
  label: string;
  value: string;
  /** Percentage change vs the previous period; null hides the indicator. */
  delta?: number | null;
  deltaLabel?: string;
  hint?: string;
  icon: ComponentType<{ className?: string }>;
};

/**
 * A single headline figure.
 *
 * The number is the card. Everything else — label, icon, trend — is sized and
 * coloured to stay behind it, because an operator scanning four of these is
 * reading the values and nothing else.
 *
 * The icon used to sit in a filled brand-tinted square at the top right, which
 * made four cards read as four coloured blocks. It is now a hairline glyph in
 * the corner at muted weight: still a landmark for finding the right card,
 * no longer competing with the figure.
 *
 * `delta` and `hint` are rendered only when the caller passes real values.
 * Nothing here invents a trend — a card with no comparison shows no trend.
 */
export function StatCard({
  label,
  value,
  delta,
  deltaLabel = "vs previous 30 days",
  hint,
  icon: Icon,
}: StatCardProps) {
  const hasDelta = delta !== null && delta !== undefined;
  const positive = (delta ?? 0) >= 0;

  return (
    <article className="admin-card group relative p-5 transition-colors duration-150 hover:border-brand-200">
      <div className="flex items-start justify-between gap-3">
        <p className="admin-eyebrow">{label}</p>
        <Icon
          className="size-4 shrink-0 text-muted-foreground/50 transition-colors duration-150 group-hover:text-muted-foreground"
          aria-hidden
        />
      </div>

      <p className="admin-figure mt-3">{value}</p>

      {hasDelta ? (
        <p className="mt-2.5 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-xs">
          <span
            className={cn(
              "inline-flex items-center gap-0.5 font-medium tabular-nums",
              positive ? "text-success" : "text-destructive",
            )}
          >
            {positive ? (
              <ArrowUpRight className="size-3 shrink-0" aria-hidden />
            ) : (
              <ArrowDownRight className="size-3 shrink-0" aria-hidden />
            )}
            {positive ? "+" : ""}
            {delta}%
          </span>
          <span className="text-muted-foreground">{deltaLabel}</span>
        </p>
      ) : hint ? (
        <p className="mt-2.5 text-xs text-muted-foreground">{hint}</p>
      ) : (
        // Keeps a four-card row on one baseline whether or not each card has a
        // comparison to show. Without it, cards with no trend sit shorter and
        // the row's bottom edge zig-zags.
        <p aria-hidden className="mt-2.5 text-xs">
          &nbsp;
        </p>
      )}
    </article>
  );
}
