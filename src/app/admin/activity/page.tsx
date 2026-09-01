import type { Metadata } from "next";
import {
  History,
  Package,
  FolderTree,
  Receipt,
  MessageSquare,
  Ticket,
  CreditCard,
  Mail,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { AdminPageHeader, AdminTableCard } from "@/components/admin/admin-page-header";
import { EmptyState } from "@/components/brand/empty-state";
import { PaginationNav } from "@/components/shop/pagination-nav";
import { listAdminActivity } from "@/lib/queries/admin-resources";
import { buildBaseQuery } from "@/lib/shop-params";

export const metadata: Metadata = { title: "Activity" };

const ENTITY_ICONS: Record<string, LucideIcon> = {
  product: Package,
  category: FolderTree,
  order: Receipt,
  review: MessageSquare,
  coupon: Ticket,
  payment: CreditCard,
  email: Mail,
};

/**
 * `product.updated` → "Product updated". Presentation only — the stored verb
 * stays machine-readable so the log can be filtered without matching prose.
 */
function describeAction(action: string): string {
  const words = action.replace(/[._]/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * The `meta` blob as a short, readable line.
 *
 * Only primitives are rendered. Nested objects and arrays are summarised by
 * their key rather than stringified, so a log entry can never turn into a wall
 * of JSON in a table cell.
 */
function describeMeta(meta: unknown): string | null {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return null;

  const parts = Object.entries(meta as Record<string, unknown>)
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .map(([key, value]) => {
      const label = key.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
      if (typeof value === "object") return label;
      return `${label}: ${String(value)}`;
    });

  return parts.length > 0 ? parts.join(" · ") : null;
}

/**
 * The audit trail.
 *
 * Every row is a real action recorded by `recordActivity` at the moment it
 * happened. Nothing is backfilled, so the table starts empty on a database that
 * existed before this feature — that emptiness is accurate, and the empty state
 * says so rather than implying the log is broken.
 */
export default async function AdminActivityPage({
  searchParams,
}: PageProps<"/admin/activity">) {
  const raw = await searchParams;
  const { entries, total, page, pageCount } = await listAdminActivity({
    page: Number(raw.page) || 1,
  });

  return (
    <div>
      <AdminPageHeader
        title="Activity"
        description={`${total.toLocaleString("en-US")} recorded ${total === 1 ? "action" : "actions"}. Written as admins work; entries are never edited or removed.`}
      />

      {entries.length === 0 ? (
        <AdminTableCard>
          <EmptyState
            variant="inline"
            icon={History}
            title="Nothing recorded yet"
            description="The audit log starts from the moment it was switched on — earlier changes are not shown, because they were never recorded. New admin actions will appear here as they happen."
          />
        </AdminTableCard>
      ) : (
        <>
          <AdminTableCard>
            <ol className="divide-y divide-border">
              {entries.map((entry) => {
                const Icon = ENTITY_ICONS[entry.entityType] ?? History;
                const meta = describeMeta(entry.meta);

                return (
                  <li key={entry.id} className="flex items-start gap-4 px-4 py-4">
                    <span
                      aria-hidden
                      className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600"
                    >
                      <Icon className="size-4" />
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">
                        {describeAction(entry.action)}
                      </p>
                      {meta && (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {meta}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {entry.actor.name ?? entry.actor.email}
                        <span aria-hidden> · </span>
                        <time dateTime={entry.createdAt.toISOString()}>
                          {entry.createdAt.toLocaleString("en-US", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </time>
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </AdminTableCard>

          <PaginationNav
            page={page}
            pageCount={pageCount}
            baseQuery={buildBaseQuery(raw)}
            basePath="/admin/activity"
          />
        </>
      )}
    </div>
  );
}
