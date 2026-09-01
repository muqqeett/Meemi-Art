import {
  AdminHeaderSkeleton,
  AdminStatSkeleton,
} from "@/components/admin/admin-primitives";

/**
 * The dashboard's own loading state.
 *
 * The shared admin skeleton stands in for a table, which the overview is not —
 * it opens with four KPI cards and then charts. This one matches that shape so
 * the numbers land where their placeholders were.
 */
export default function AdminOverviewLoading() {
  return (
    <div>
      <span className="sr-only" role="status">
        Loading
      </span>
      <AdminHeaderSkeleton />
      <AdminStatSkeleton count={4} />

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <div
            key={index}
            className="admin-card p-5"
          >
            <div className="h-4 w-32 admin-shimmer rounded-sm" />
            <div className="mt-5 h-56 animate-pulse rounded-lg bg-border/60" />
          </div>
        ))}
      </div>
    </div>
  );
}
