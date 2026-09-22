import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties } from "react";
import {
  ArrowRight,
  Bell,
  BellOff,
  Check,
  CheckCheck,
  CreditCard,
  Download,
  FileWarning,
  Heart,
  MessageSquare,
  ShoppingCart,
  TrendingDown,
  type LucideIcon,
} from "lucide-react";

import { AdminPageHeader, AdminTableCard } from "@/components/admin/admin-page-header";
import { EmptyState } from "@/components/brand/empty-state";
import { PaginationNav } from "@/components/shop/pagination-nav";
import { Button } from "@/components/ui/button";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
  openNotificationAction,
} from "@/lib/actions/admin/notifications";
import { listNotifications, parseFeedFilter, unreadCount } from "@/lib/notifications/feed";
import { NOTIFICATION_TYPE_LABELS, type NotificationTypeName } from "@/lib/notifications/rules";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Notifications" };

const TYPE_ICONS: Record<NotificationTypeName, LucideIcon> = {
  ORDER_COMPLETED: ShoppingCart,
  PAYMENT_FAILED: CreditCard,
  REVIEW_SUBMITTED: MessageSquare,
  PRODUCT_DOWNLOADED: Download,
  WISHLIST_ACTIVITY: Heart,
  PRODUCT_ATTENTION: TrendingDown,
  PRODUCT_CONFIGURATION: FileWarning,
};

/** The two kinds that mean something may be wrong, drawn in the warning tone. */
const NEEDS_ACTION: ReadonlySet<NotificationTypeName> = new Set(["PAYMENT_FAILED", "PRODUCT_CONFIGURATION"]);

/**
 * Notifications — what happened that an admin should know about.
 *
 * Every row is a real occurrence read from the table that is its authority
 * (see `lib/notifications/sync.ts`) and recorded once. Read state is this
 * admin's own: marking something read here does not clear it for anyone else.
 *
 * The "Needs attention" panel on the dashboard answers a different question —
 * what is wrong right now, as live counts. This page is the history: what
 * happened, when, and whether you have seen it.
 *
 * Plain server forms throughout: no client JavaScript is needed to read, open
 * or mark anything.
 */
export default async function AdminNotificationsPage({ searchParams }: PageProps<"/admin/notifications">) {
  const raw = await searchParams;
  const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  const filter = parseFeedFilter(one(raw.filter));

  const [feed, unread] = await Promise.all([listNotifications({ filter, page: one(raw.page) }), unreadCount()]);
  // The admin layout has already refused anyone else; this is belt and braces.
  if (!feed.ok || !unread.ok) return null;

  const { items, page, pages, total } = feed.data;
  const unreadLabel = unread.data.capped ? `${unread.data.count}+` : unread.data.count.toLocaleString("en-US");

  const tab = (value: "all" | "unread", label: string) => (
    <Link
      href={value === "all" ? "/admin/notifications" : "/admin/notifications?filter=unread"}
      aria-current={filter === value ? "page" : undefined}
      className={cn(
        "inline-flex h-8 items-center rounded-md border px-3 text-[0.8125rem] transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600",
        filter === value
          ? "border-brand-300 bg-brand-50 font-medium text-brand-700"
          : "border-border text-muted-foreground hover:border-brand-200 hover:bg-[var(--admin-hover)] hover:text-foreground",
      )}
    >
      {label}
    </Link>
  );

  return (
    <div>
      <AdminPageHeader
        title="Notifications"
        description={`${unreadLabel} unread. New orders, payment issues, reviews, downloads and product alerts — read from the shop's own records, each told once.`}
        action={
          <form action={markAllNotificationsReadAction}>
            <Button type="submit" variant="outline" size="sm" disabled={unread.data.count === 0}>
              <CheckCheck aria-hidden />
              Mark all as read
            </Button>
          </form>
        }
      />

      <nav aria-label="Filter notifications" className="mb-4 flex gap-1.5">
        {tab("all", "All")}
        {tab("unread", `Unread${unread.data.count > 0 ? ` (${unreadLabel})` : ""}`)}
      </nav>

      {items.length === 0 ? (
        <AdminTableCard>
          {filter === "unread" ? (
            <EmptyState
              variant="inline"
              icon={BellOff}
              title="You're all caught up"
              description="Nothing unread. New orders, reviews and alerts will appear here as they happen."
              action={
                <Link href="/admin/notifications" className="text-sm font-medium text-royal-600 hover:underline">
                  See all notifications
                </Link>
              }
            />
          ) : (
            <EmptyState
              variant="inline"
              icon={Bell}
              title="No notifications yet"
              description="Notifications are recorded from the shop's own activity — completed orders, payment failures, new reviews, downloads, wishlist activity and product alerts. When something happens, it will appear here."
            />
          )}
        </AdminTableCard>
      ) : (
        <>
          <AdminTableCard>
            <ul className="divide-y divide-border">
              {items.map((item, index) => {
                const Icon = TYPE_ICONS[item.type];
                const warn = NEEDS_ACTION.has(item.type);
                return (
                  <li
                    key={item.id}
                    className={cn(
                      "admin-rise flex items-start gap-3.5 px-5 py-4 transition-colors duration-150",
                      !item.read && "bg-brand-50/40",
                    )}
                    style={{ "--admin-i": Math.min(index, 8) } as CSSProperties}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border",
                        warn
                          ? "border-warning/25 bg-warning/8 text-warning"
                          : "border-border bg-[var(--admin-raised)] text-muted-foreground",
                      )}
                    >
                      <Icon className="size-4" />
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        {!item.read && (
                          <span className="inline-flex items-center gap-1 text-[0.6875rem] font-semibold text-brand-700">
                            <span aria-hidden className="size-1.5 rounded-full bg-brand-600" />
                            Unread
                          </span>
                        )}
                        <span className={cn("text-sm text-foreground", item.read ? "font-medium" : "font-semibold")}>
                          {item.title}
                        </span>
                        <span className="rounded-full border border-border px-2 py-px text-[0.6875rem] text-muted-foreground">
                          {NOTIFICATION_TYPE_LABELS[item.type]}
                        </span>
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.message}</p>
                      <time dateTime={item.occurredAt.toISOString()} className="mt-1 block text-xs text-muted-foreground/80 tabular-nums">
                        {item.occurredAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
                      </time>
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-1.5 sm:flex-row sm:items-center">
                      {item.href && (
                        <form action={openNotificationAction}>
                          <input type="hidden" name="id" value={item.id} />
                          <Button type="submit" variant="outline" size="sm">
                            Open
                            <ArrowRight aria-hidden />
                          </Button>
                        </form>
                      )}
                      {!item.read && (
                        <form action={markNotificationReadAction}>
                          <input type="hidden" name="id" value={item.id} />
                          <Button type="submit" variant="ghost" size="sm" aria-label={`Mark "${item.title}" as read`}>
                            <Check aria-hidden />
                            <span className="hidden sm:inline">Mark read</span>
                          </Button>
                        </form>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </AdminTableCard>

          <p className="mt-3 text-xs text-muted-foreground tabular-nums">
            {total.toLocaleString("en-US")} {filter === "unread" ? "unread" : ""} {total === 1 ? "notification" : "notifications"}
          </p>

          <PaginationNav
            page={page}
            pageCount={pages}
            baseQuery={filter === "unread" ? "filter=unread" : ""}
            basePath="/admin/notifications"
          />
        </>
      )}
    </div>
  );
}
