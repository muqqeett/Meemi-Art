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

export function StatCard({
  label,
  value,
  delta,
  deltaLabel = "vs previous 30 days",
  hint,
  icon: Icon,
}: StatCardProps) {
  const positive = (delta ?? 0) >= 0;

  return (
    <article className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-muted-foreground">{label}</p>
        <span
          aria-hidden
          className="inline-flex size-9 items-center justify-center rounded-lg bg-brand-50"
        >
          <Icon className="size-4 text-brand-600" />
        </span>
      </div>

      <p className="mt-3 text-2xl font-semibold text-foreground tabular-nums">{value}</p>

      {delta !== null && delta !== undefined ? (
        <p className="mt-2 flex items-center gap-1 text-xs">
          <span
            className={cn(
              "inline-flex items-center gap-0.5 font-medium",
              positive ? "text-success" : "text-destructive",
            )}
          >
            {positive ? (
              <ArrowUpRight className="size-3.5" aria-hidden />
            ) : (
              <ArrowDownRight className="size-3.5" aria-hidden />
            )}
            {positive ? "+" : ""}
            {delta}%
          </span>
          <span className="text-muted-foreground">{deltaLabel}</span>
        </p>
      ) : hint ? (
        <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </article>
  );
}
