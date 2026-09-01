import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ShoppingCart, Wallet, Star, Package } from "lucide-react";

import { AdminPageHeader, AdminTableCard } from "@/components/admin/admin-page-header";
import { StatCard } from "@/components/admin/stat-card";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { StarRating } from "@/components/brand/star-rating";
import { EmptyState } from "@/components/brand/empty-state";
import { getAdminCustomer } from "@/lib/queries/admin";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = { title: "Customer" };

export default async function AdminCustomerPage({
  params,
}: PageProps<"/admin/customers/[id]">) {
  const { id } = await params;
  const customer = await getAdminCustomer(id);

  if (!customer) notFound();

  return (
    <div>
      <Link
        href="/admin/customers"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-brand-600"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to customers
      </Link>

      <AdminPageHeader
        title={customer.name ?? "Unnamed customer"}
        description={`${customer.email}${customer.phone ? ` · ${customer.phone}` : ""} · joined ${customer.createdAt.toLocaleDateString("en-US", { dateStyle: "long" })}`}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Orders"
          value={String(customer.orders.length)}
          delta={null}
          icon={ShoppingCart}
        />
        <StatCard
          label="Lifetime value"
          value={formatMoney(customer.totalSpentCents)}
          delta={null}
          icon={Wallet}
        />
        <StatCard
          label="Average order"
          value={formatMoney(customer.averageOrderCents)}
          delta={null}
          icon={Package}
        />
        <StatCard
          label="Reviews written"
          value={String(customer.reviews.length)}
          delta={null}
          icon={Star}
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_320px]">
        <section className="min-w-0">
          <h2 className="mb-3 text-base font-semibold text-foreground">Order history</h2>

          {customer.orders.length === 0 ? (
            <AdminTableCard>
              <EmptyState
                variant="inline"
                icon={ShoppingCart}
                title="No orders yet"
                description="This customer has registered but hasn't placed an order."
              />
            </AdminTableCard>
          ) : (
            <AdminTableCard>
              <table className="admin-table min-w-[560px]">
                <caption className="sr-only">
                  Orders placed by {customer.name ?? customer.email}
                </caption>
                <thead>
                  <tr>
                    <th scope="col">
                      Order
                    </th>
                    <th scope="col">
                      Date
                    </th>
                    <th scope="col">
                      Status
                    </th>
                    <th scope="col" className="text-right">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {customer.orders.map((order) => (
                    <tr key={order.id}>
                      <td>
                        <Link
                          href={`/admin/orders/${order.orderNumber}`}
                          className="font-mono font-medium text-foreground hover:text-brand-600"
                        >
                          {order.orderNumber}
                        </Link>
                        <span className="block text-xs text-muted-foreground">
                          {order._count.items}{" "}
                          {order._count.items === 1 ? "item" : "items"}
                        </span>
                      </td>
                      <td className="text-muted-foreground">
                        {order.placedAt.toLocaleDateString("en-US", { dateStyle: "medium" })}
                      </td>
                      <td>
                        <OrderStatusBadge status={order.status} />
                      </td>
                      <td className="text-right font-medium tabular-nums">
                        {formatMoney(order.totalCents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </AdminTableCard>
          )}
        </section>

        <aside className="space-y-6">
          <section className="admin-card p-5">
            <h2 className="mb-3 text-sm font-semibold text-foreground">Recent reviews</h2>
            {customer.reviews.length === 0 ? (
              <p className="text-sm text-muted-foreground">No reviews written.</p>
            ) : (
              <ul className="space-y-4">
                {customer.reviews.map((review) => (
                  <li key={review.id} className="text-sm">
                    <StarRating value={review.rating} size="sm" />
                    <p className="mt-1 font-medium text-foreground">{review.title}</p>
                    <Link
                      href={`/products/${review.product.slug}`}
                      className="text-xs text-muted-foreground hover:text-brand-600"
                    >
                      {review.product.name}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
