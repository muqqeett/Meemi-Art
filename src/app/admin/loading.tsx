import {
  AdminHeaderSkeleton,
  AdminTableSkeleton,
} from "@/components/admin/admin-primitives";

/**
 * Shared admin loading state.
 *
 * Sits below the layout, so the sidebar, breadcrumbs and search stay interactive
 * while a page's data resolves — only the content column is replaced. Its
 * geometry matches the header and table it stands in for, so the page does not
 * jump when the real rows arrive.
 */
export default function AdminLoading() {
  return (
    <div>
      <span className="sr-only" role="status">
        Loading
      </span>
      <AdminHeaderSkeleton />
      <AdminTableSkeleton rows={8} columns={5} />
    </div>
  );
}
