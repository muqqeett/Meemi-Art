import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Package, Heart, Wallet, Clock, ArrowRight } from "lucide-react";

import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { EmptyState } from "@/components/brand/empty-state";
import { ButtonLink } from "@/components/ui/button-link";
import { requireUser } from "@/lib/auth-guards";
import { listUserOrders, getCustomerSummary } from "@/lib/queries/orders";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = {
  title: "Account overview",
  robots: { index: false, follow: false },
};

export default async function AccountPage() {
  const user = await requireUser("/account");

  const [summary, { orders }] = await Promise.all([
    getCustomerSummary(user.id),
    listUserOrders(user.id, { perPage: 3 }),
  ]);

  const stats = [
    { label: "Orders placed", value: String(summary.orderCount), Icon: Package },
    { label: "In progress", value: String(summary.activeOrders), Icon: Clock },
    { label: "Total spent", value: formatMoney(summary.totalSpentCents), Icon: Wallet },
    { label: "Saved items", value: String(summary.wishlistCount), Icon: Heart },
  ];

  return (
    <div className="space-y-10">
      <section aria-labelledby="summary-heading">
        <h2 id="summary-heading" className="sr-only">
          Account summary
        </h2>

        <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {stats.map(({ label, value, Icon }) => (
            <div
              key={label}
              className="rounded-2xl border border-border bg-card p-4 shadow-card"
            >
              <dt className="flex items-center gap-2 text-xs text-muted-foreground">
                <Icon className="size-4 text-brand-600" aria-hidden />
                {label}
              </dt>
              <dd className="mt-2 text-2xl font-semibold text-foreground tabular-nums">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="recent-heading">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 id="recent-heading" className="text-lg font-semibold text-foreground">
            Recent orders
          </h2>
          {orders.length > 0 && (
            <Link
              href="/account/orders"
              className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:underline"
            >
              View all
              <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          )}
        </div>

        {orders.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card shadow-card">
            <EmptyState
              variant="inline"
              icon={Package}
              title="No orders yet"
              description="When you place your first order it'll appear here, with tracking."
              action={
                <ButtonLink href="/shop" variant="brand" size="pill">
                  Start shopping
                </ButtonLink>
              }
            />
          </div>
        ) : (
          <ul className="space-y-3">
            {orders.map((order) => (
              <li key={order.id}>
                <Link
                  href={`/account/orders/${order.orderNumber}`}
                  className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-card transition-colors hover:border-brand-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                >
                  <ul className="flex -space-x-3">
                    {order.items.slice(0, 3).map((item) => (
                      <li
                        key={item.id}
                        className="relative size-12 overflow-hidden rounded-lg bg-surface-alt ring-2 ring-card"
                      >
                        {item.imageUrl && (
                          <Image
                            src={item.imageUrl}
                            alt=""
                            fill
                            sizes="48px"
                            className="object-cover"
                          />
                        )}
                      </li>
                    ))}
                  </ul>

                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-sm font-medium text-foreground">
                      {order.orderNumber}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {order.placedAt.toLocaleDateString("en-US", { dateStyle: "medium" })}{" "}
                      · {order.items.length} {order.items.length === 1 ? "item" : "items"}
                    </p>
                  </div>

                  <OrderStatusBadge status={order.status} />

                  <span className="font-semibold text-foreground tabular-nums">
                    {formatMoney(order.totalCents)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
