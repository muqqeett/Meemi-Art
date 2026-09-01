import { AdminTableCard } from "@/components/admin/admin-page-header";
import { cn } from "@/lib/utils";

/**
 * The two pieces of admin furniture that did not already exist: a status pill
 * and the loading skeletons.
 *
 * Everything else the new pages need is already in the codebase and is used as
 * it stands — `AdminPageHeader` and `AdminTableCard` for the shell,
 * `EmptyState` for empty tables, `PaginationNav` for paging. A second card and
 * a second empty state would have made the eight original admin screens and
 * the five new ones look like two different products.
 */

/**
 * Status pill.
 *
 * `tone` is chosen by the caller from what the value means, not derived from
 * the string — the same word means different things across resources (a
 * REFUNDED payment is a problem, a SKIPPED email usually is not), and a lookup
 * table hidden in here would be a second place for that judgement to live.
 */
export function StatusBadge({
  tone,
  children,
}: {
  tone: "positive" | "pending" | "critical" | "neutral";
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap capitalize",
        tone === "positive" && "bg-success/10 text-success",
        tone === "pending" && "bg-warning/10 text-warning",
        tone === "critical" && "bg-destructive/10 text-destructive",
        tone === "neutral" && "bg-surface-alt text-muted-foreground",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          tone === "positive" && "bg-success",
          tone === "pending" && "bg-warning",
          tone === "critical" && "bg-destructive",
          tone === "neutral" && "bg-muted-foreground/50",
        )}
      />
      {children}
    </span>
  );
}

/**
 * Table skeleton matching real row geometry.
 *
 * Sized to the rows it replaces so the page does not reflow when the data
 * lands — a skeleton that is the wrong height is a layout shift with extra
 * steps.
 */
export function AdminTableSkeleton({
  rows = 8,
  columns = 5,
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <AdminTableCard>
      <div className="border-b border-border bg-surface-alt px-4 py-3.5">
        <div className="h-4 w-28 animate-pulse rounded bg-border" />
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: rows }).map((_, row) => (
          <div key={row} className="flex items-center gap-4 px-4 py-4">
            {Array.from({ length: columns }).map((_, col) => (
              <div
                key={col}
                className={cn(
                  "h-4 animate-pulse rounded bg-border",
                  col === 0 ? "w-40" : "w-20",
                  col === columns - 1 && "ml-auto",
                )}
              />
            ))}
          </div>
        ))}
      </div>
    </AdminTableCard>
  );
}

/** KPI skeleton, for the overview and analytics. */
export function AdminStatSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="rounded-2xl border border-border bg-card p-5 shadow-card"
        >
          <div className="h-3 w-20 animate-pulse rounded bg-border" />
          <div className="mt-3 h-7 w-28 animate-pulse rounded bg-border" />
          <div className="mt-3 h-3 w-24 animate-pulse rounded bg-border" />
        </div>
      ))}
    </div>
  );
}

/** The page title row while it loads, so the header does not pop in. */
export function AdminHeaderSkeleton() {
  return (
    <div className="mb-6">
      <div className="h-8 w-48 animate-pulse rounded bg-border" />
      <div className="mt-2 h-4 w-72 max-w-full animate-pulse rounded bg-border" />
    </div>
  );
}
