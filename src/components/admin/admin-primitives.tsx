import { AdminTableCard } from "@/components/admin/admin-page-header";
import { cn } from "@/lib/utils";

/**
 * The two pieces of admin furniture that did not already exist: a status pill
 * and the loading skeletons.
 *
 * Everything else the admin needs already exists and is used as it stands —
 * `AdminPageHeader`, `AdminTableCard` and `AdminSection` for structure,
 * `EmptyState` for empty tables, `PaginationNav` for paging.
 */

/**
 * Status.
 *
 * A dot carries the colour and the text stays near-foreground, rather than the
 * whole pill being a saturated block. At the density of an admin table a column
 * of filled pills becomes a stripe of colour that outshouts the data beside it;
 * a column of dots reads instantly and disappears when you are not looking for
 * it. The dot is the only saturated element, which is why it can be small.
 *
 * `tone` is chosen by the caller from what the value means, not derived from
 * the string — the same word means different things across resources (a
 * REFUNDED payment is a problem, a SKIPPED email usually is not), and a lookup
 * table hidden in here would be a second place for that judgement to live.
 */
export function StatusBadge({
  tone,
  children,
  className,
}: {
  tone: "positive" | "pending" | "critical" | "neutral";
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border py-0.5 pr-2.5 pl-2 text-xs font-medium whitespace-nowrap capitalize",
        tone === "positive" && "border-success/15 bg-success/8 text-success",
        tone === "pending" && "border-warning/15 bg-warning/8 text-warning",
        tone === "critical" && "border-destructive/15 bg-destructive/8 text-destructive",
        tone === "neutral" && "border-border bg-[var(--admin-raised)] text-muted-foreground",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          tone === "positive" && "bg-success",
          tone === "pending" && "bg-warning",
          tone === "critical" && "bg-destructive",
          tone === "neutral" && "bg-muted-foreground/45",
        )}
      />
      {children}
    </span>
  );
}

/**
 * Table skeleton matching real row geometry.
 *
 * Sized to the rows it replaces — same header height, same 3.5 row padding —
 * so the page does not reflow when the data lands. A skeleton of the wrong
 * height is a layout shift with extra steps.
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
      <div className="border-b border-[var(--admin-rule)] bg-[var(--admin-raised)] px-4 py-2.5">
        <div className="h-3 w-24 animate-pulse rounded-sm bg-border" />
      </div>
      <div>
        {Array.from({ length: rows }).map((_, row) => (
          <div
            key={row}
            className={cn(
              "flex items-center gap-4 px-4 py-3.5",
              row > 0 && "border-t border-border",
            )}
          >
            {Array.from({ length: columns }).map((_, col) => (
              <div
                key={col}
                className={cn(
                  "h-3.5 animate-pulse rounded-sm bg-border",
                  col === 0 ? "w-40" : "w-20",
                  col === columns - 1 && "ml-auto",
                )}
                // A uniform pulse across a whole table reads as one flashing
                // block. Offsetting each row keeps it as texture.
                style={{ animationDelay: `${row * 60}ms` }}
              />
            ))}
          </div>
        ))}
      </div>
    </AdminTableCard>
  );
}

/** KPI skeleton, matching `StatCard`'s geometry exactly. */
export function AdminStatSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="admin-card p-5">
          <div className="flex items-start justify-between">
            <div className="h-3 w-20 animate-pulse rounded-sm bg-border" />
            <div className="size-4 animate-pulse rounded-sm bg-border" />
          </div>
          <div className="mt-3 h-7 w-28 animate-pulse rounded-sm bg-border" />
          <div className="mt-2.5 h-3 w-24 animate-pulse rounded-sm bg-border" />
        </div>
      ))}
    </div>
  );
}

/** The page title row while it loads, so the header does not pop in. */
export function AdminHeaderSkeleton() {
  return (
    <div className="mb-6">
      <div className="h-7 w-44 animate-pulse rounded-sm bg-border" />
      <div className="mt-2 h-3.5 w-72 max-w-full animate-pulse rounded-sm bg-border" />
    </div>
  );
}
