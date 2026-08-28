import type { Metadata } from "next";
import Link from "next/link";
import { ShoppingCart } from "lucide-react";

import { AdminPageHeader, AdminTableCard } from "@/components/admin/admin-page-header";
import { AdminFilters } from "@/components/admin/admin-filters";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/orders/order-status-badge";
import { PaginationNav } from "@/components/shop/pagination-nav";
import { EmptyState } from "@/components/brand/empty-state";
import { ButtonLink } from "@/components/ui/button-link";
import { listAdminOrders } from "@/lib/queries/admin";
import { buildBaseQuery, hasAnyParam } from "@/lib/shop-params";
import { formatMoney } from "@/lib/money";
import type { OrderStatus } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "Orders" };

const STATUSES: OrderStatus[] = [
  "PENDING",
  "PROCESSING",
  "CANCELLED",
];

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminOrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  const raw = await searchParams;
  const statusParam = first(raw.status);
  const status = STATUSES.includes(statusParam as OrderStatus)
    ? (statusParam as OrderStatus)
    : undefined;

  const { orders, total, page, pageCount } = await listAdminOrders({
    q: first(raw.q),
    status,
    page: Number(first(raw.page)) || 1,
  });

  return (
    <div>
      <AdminPageHeader
        title="Orders"
        description={`${total} ${total === 1 ? "order" : "orders"}`}
      />

      <AdminFilters
        params={raw}
        searchPlaceholder="Search by order number, email or name…"
        selects={[
          {
            name: "status",
            label: "All statuses",
            options: STATUSES.map((value) => ({
              value,
              label: value.charAt(0) + value.slice(1).toLowerCase(),
            })),
          },
        ]}
      />

      {orders.length === 0 ? (
        <AdminTableCard>
          {hasAnyParam(raw, ["q", "status"]) ? (
            <EmptyState
              icon={ShoppingCart}
              title="No orders match"
              description="Try a different search term, or clear the filters to see every order."
              action={
                <ButtonLink href="/admin/orders" variant="brand" size="pill">
                  Clear filters
                </ButtonLink>
              }
            />
          ) : (
            <EmptyState
              icon={ShoppingCart}
              title="No orders yet"
              description="Orders placed on the storefront will appear here, with payment and fulfilment status."
            />
          )}
        </AdminTableCard>
      ) : (
        <>
          <AdminTableCard>
            <table className="w-full min-w-[820px] text-sm">
              <caption className="sr-only">All orders</caption>
              <thead className="bg-surface-alt text-left">
                <tr className="text-xs tracking-wide text-muted-foreground uppercase">
                  <th scope="col" className="px-4 py-3 font-medium">
                    Order
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Customer
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Placed
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Payment
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    Total
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-border">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-surface-alt/60">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/orders/${order.orderNumber}`}
                        className="font-mono font-medium text-foreground hover:text-brand-600"
                      >
                        {order.orderNumber}
                      </Link>
                      <span className="block text-xs text-muted-foreground">
                        {order._count.items} {order._count.items === 1 ? "item" : "items"}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      {order.user ? (
                        <Link
                          href={`/admin/customers/${order.user.id}`}
                          className="font-medium text-foreground hover:text-brand-600"
                        >
                          {order.user.name ?? order.customerName}
                        </Link>
                      ) : (
                        <span className="font-medium text-foreground">
                          {order.customerName}
                        </span>
                      )}
                      <span className="block truncate text-xs text-muted-foreground">
                        {order.email}
                        {!order.user && " · guest"}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-muted-foreground">
                      <time dateTime={order.placedAt.toISOString()}>
                        {order.placedAt.toLocaleDateString("en-US", { dateStyle: "medium" })}
                      </time>
                    </td>

                    <td className="px-4 py-3">
                      <OrderStatusBadge status={order.status} />
                    </td>

                    <td className="px-4 py-3">
                      {order.payment && <PaymentStatusBadge status={order.payment.status} />}
                    </td>

                    <td className="px-4 py-3 text-right font-medium tabular-nums">
                      {formatMoney(order.totalCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </AdminTableCard>

          <PaginationNav
            page={page}
            pageCount={pageCount}
            baseQuery={buildBaseQuery(raw)}
            basePath="/admin/orders"
          />
        </>
      )}
    </div>
  );
}
