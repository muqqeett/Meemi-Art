import Link from "next/link";
import { ArrowRight, ShieldCheck, TriangleAlert, Info, CircleAlert } from "lucide-react";
import type { CSSProperties } from "react";

import type { OperationalAlert, AlertTone } from "@/lib/queries/operational-alerts";
import { cn } from "@/lib/utils";

/**
 * "What needs my attention?" — the second question the dashboard answers.
 *
 * Every row is a real count from `getOperationalAlerts`, every row goes
 * somewhere, and a signal with a count of zero is not rendered at all. There
 * are no placeholder alerts and no severity that was assigned to make the
 * section look busy.
 *
 * When nothing is wrong this does not disappear. An operator who sees an empty
 * space cannot tell "nothing is wrong" from "the check is broken", so the
 * healthy state is stated explicitly and is the reassuring thing the section
 * was built to be able to say.
 *
 * Server component: it renders props and links. No client JavaScript is
 * shipped for it.
 */

const TONE_ICON: Record<AlertTone, typeof TriangleAlert> = {
  critical: CircleAlert,
  warning: TriangleAlert,
  info: Info,
};

function AlertRow({ alert, index }: { alert: OperationalAlert; index: number }) {
  const Icon = TONE_ICON[alert.tone];

  return (
    <Link
      href={alert.href}
      className={cn(
        "admin-rise group flex items-start gap-3.5 px-5 py-4 transition-colors duration-150",
        "focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-600",
        "hover:bg-[var(--admin-hover)]",
      )}
      style={{ "--admin-i": index } as CSSProperties}
    >
      <span
        aria-hidden
        className={cn(
          "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border",
          alert.tone === "critical" && "border-destructive/25 bg-destructive/8 text-destructive",
          alert.tone === "warning" && "border-warning/25 bg-warning/8 text-warning",
          alert.tone === "info" && "border-border bg-[var(--admin-raised)] text-muted-foreground",
        )}
      >
        {/* Only genuinely urgent states pulse, and only one class of them —
            a section where everything pulses communicates nothing. */}
        <Icon className={cn("size-4", alert.tone === "critical" && "admin-pulse")} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-foreground">
          {/* The count carries the weight; the label is the sentence around it.
              Not colour alone — the number, the wording and the icon all say
              the same thing, so the row survives being read in greyscale. */}
          <span className="tabular-nums">{alert.count}</span> {alert.label}
        </span>
        <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
          {alert.detail}
        </span>
      </span>

      <span className="mt-0.5 hidden shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground transition-colors duration-150 group-hover:text-brand-700 sm:flex">
        {alert.action}
        <ArrowRight
          className="size-3 transition-transform duration-150 group-hover:translate-x-0.5"
          aria-hidden
        />
      </span>
    </Link>
  );
}

export function ActionCenter({
  alerts,
  style,
}: {
  alerts: OperationalAlert[];
  style?: CSSProperties;
}) {
  const critical = alerts.filter((a) => a.tone === "critical").length;

  return (
    <section className="admin-card overflow-hidden" style={style} aria-labelledby="needs-attention">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border px-5 py-3.5">
        <h2 id="needs-attention" className="admin-rubric">
          Needs attention
        </h2>
        {alerts.length > 0 && (
          <span className="text-xs text-muted-foreground tabular-nums">
            {critical > 0 && (
              <span className="font-medium text-destructive">{critical} urgent · </span>
            )}
            {alerts.length} {alerts.length === 1 ? "item" : "items"}
          </span>
        )}
      </div>

      {alerts.length === 0 ? (
        <div className="flex items-center gap-3.5 px-5 py-6">
          <span
            aria-hidden
            className="flex size-9 shrink-0 items-center justify-center rounded-full border border-success/25 bg-success/8 text-success"
          >
            <ShieldCheck className="size-4" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-medium text-foreground">
              Everything looks healthy
            </span>
            <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
              No stuck payments, undelivered orders, failed emails or unsellable
              products. Checked live against the database.
            </span>
          </span>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {alerts.map((alert, index) => (
            <AlertRow key={alert.id} alert={alert} index={index} />
          ))}
        </div>
      )}
    </section>
  );
}
