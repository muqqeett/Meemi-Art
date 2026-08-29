import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Package, ChevronRight } from "lucide-react";

import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { PaginationNav } from "@/components/shop/pagination-nav";
import { EmptyState } from "@/components/brand/empty-state";
import { ButtonLink } from "@/components/ui/button-link";
import { requireUser } from "@/lib/auth-guards";
import { listUserOrders } from "@/lib/queries/orders";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = {
  title: "Your orders",
  robots: { index: false, follow: false },
};

export default async function AccountOrdersPage({
  searchParams,
}: PageProps<"/account/orders">) {
  const user = await requireUser("/account/orders");
  const raw = await searchParams;

  const pageParam = Array.isArray(raw.page) ? raw.page[0] : raw.page;
  const page = Math.max(1, Number(pageParam) || 1);

  const { orders, total, pageCount } = await listUserOrders(user.id, { page });

  if (total === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card shadow-card">
        <EmptyState
          icon={Package}
          title="No orders yet"
          description="Once you've placed an order you'll be able to track it here from confirmation through to delivery."
          action={
            <ButtonLink href="/shop" variant="brand" size="pill">
              Browse the shop
            </ButtonLink>
          }
        />
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold text-foreground">Your orders</h2>
      <p className="text-body mb-6">
        {total} {total === 1 ? "order" : "orders"}
      </p>

      <ul className="space-y-4">
        {orders.map((order) => (
          <li key={order.id}>
            <article className="rounded-2xl border border-border bg-card shadow-card">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
                <div>
                  <p className="font-mono font-medium text-foreground">
                    {order.orderNumber}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Placed{" "}
                    <time dateTime={order.placedAt.toISOString()}>
                      {order.placedAt.toLocaleDateString("en-US", { dateStyle: "long" })}
                    </time>
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <OrderStatusBadge status={order.status} />
                  <span className="font-semibold text-foreground tabular-nums">
                    {formatMoney(order.totalCents)}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 p-4">
                <ul className="flex flex-wrap gap-2">
                  {order.items.slice(0, 4).map((item) => (
                    <li
                      key={item.id}
                      className="relative size-14 overflow-hidden rounded-lg bg-surface-alt"
                    >
                      {item.imageUrl && (
                        <Image
                          src={item.imageUrl}
                          alt={item.name}
                          fill
                          sizes="56px"
                          className="object-contain"
                        />
                      )}
                      {item.quantity > 1 && (
                        <span className="absolute right-0.5 bottom-0.5 rounded bg-ink/80 px-1 text-[0.625rem] font-medium text-white">
                          ×{item.quantity}
                        </span>
                      )}
                    </li>
                  ))}
                  {order.items.length > 4 && (
                    <li className="flex size-14 items-center justify-center rounded-lg bg-surface-alt text-xs font-medium text-muted-foreground">
                      +{order.items.length - 4}
                    </li>
                  )}
                </ul>

                <Link
                  href={`/account/orders/${order.orderNumber}`}
                  className="ml-auto inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                >
                  View details
                  <ChevronRight className="size-4" aria-hidden />
                </Link>
              </div>
            </article>
          </li>
        ))}
      </ul>

      <PaginationNav
        page={page}
        pageCount={pageCount}
        baseQuery=""
        basePath="/account/orders"
      />
    </div>
  );
}
