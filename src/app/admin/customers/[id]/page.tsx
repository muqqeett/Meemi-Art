import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ShoppingCart,
  Wallet,
  Package,
  Download,
  FileKey,
  ShieldX,
  Check,
} from "lucide-react";

import {
  AdminPageHeader,
  AdminTableCard,
  AdminSection,
} from "@/components/admin/admin-page-header";
import { StatCard } from "@/components/admin/stat-card";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { StarRating } from "@/components/brand/star-rating";
import { EmptyState } from "@/components/brand/empty-state";
import { getAdminCustomer } from "@/lib/queries/admin";
import {
  getCustomerCommerce,
  getCustomerTimelineData,
  buildCustomerTimeline,
} from "@/lib/queries/customer-360";
import { AdminTimeline } from "@/components/admin/order-timeline";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Customer" };

export default async function AdminCustomerPage({
  params,
}: PageProps<"/admin/customers/[id]">) {
  const { id } = await params;
  const customer = await getAdminCustomer(id);

  if (!customer) notFound();

  // Purchases, digital access and download insight. Four queries, none
  // per-item — see `customer-360.ts`.
  const [commerce, timelineData] = await Promise.all([
    getCustomerCommerce(id),
    getCustomerTimelineData(id, customer.email),
  ]);

  // Access is reused from `commerce` rather than re-queried, so the page never
  // reads DigitalAccess twice.
  const timeline = buildCustomerTimeline({
    createdAt: customer.createdAt,
    orders: timelineData.orders,
    access: commerce.access,
    reviews: timelineData.reviews,
    emails: timelineData.emails,
    formatAmount: formatMoney,
  });

  const STATE_LABEL = {
    "no-purchases": "No completed purchases",
    new: "New customer",
    returning: "Returning customer",
  } as const;

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
        eyebrow={STATE_LABEL[commerce.state]}
        title={customer.name ?? "Unnamed customer"}
        description={`${customer.email}${customer.phone ? ` · ${customer.phone}` : ""} · joined ${customer.createdAt.toLocaleDateString("en-US", { dateStyle: "long" })}`}
        action={
          <a
            href={`mailto:${customer.email}`}
            className="inline-flex h-9 items-center rounded-md border border-border px-3 text-[0.8125rem] text-muted-foreground transition-colors duration-150 hover:border-brand-200 hover:bg-[var(--admin-hover)] hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            Email customer
          </a>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Successful orders"
          value={String(commerce.successfulOrders)}
          delta={null}
          hint={
            customer.orders.length !== commerce.successfulOrders
              ? `${customer.orders.length} total incl. unpaid`
              : undefined
          }
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
          label="Downloads"
          value={String(commerce.downloads.total)}
          delta={null}
          hint={`${commerce.access.length} ${commerce.access.length === 1 ? "grant" : "grants"} · all time`}
          icon={Download}
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_320px]">
        <section className="min-w-0 space-y-6">
          {/* Digital access first: on a shop that sells files, what the
              customer can actually download outranks their order list. */}
          <AdminSection
            title="Digital access"
            description={
              commerce.downloads.mostDownloaded
                ? `Most downloaded: ${commerce.downloads.mostDownloaded.name} (${commerce.downloads.mostDownloaded.count})`
                : "What this customer can download."
            }
            bodyClassName="p-0"
          >
            {commerce.access.length === 0 ? (
              <EmptyState
                variant="inline"
                icon={FileKey}
                title="No digital access"
                description="Access is granted automatically when an order is paid and completed."
              />
            ) : (
              <ul className="divide-y divide-border">
                {commerce.access.map((grant) => {
                  const revoked = Boolean(grant.revokedAt);
                  return (
                    <li
                      key={grant.id}
                      className="flex flex-wrap items-start gap-x-4 gap-y-2 px-5 py-3.5"
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border",
                          revoked
                            ? "border-destructive/25 bg-destructive/8 text-destructive"
                            : "border-success/25 bg-success/8 text-success",
                        )}
                      >
                        {revoked ? (
                          <ShieldX className="size-3.5" />
                        ) : (
                          <Check className="size-3.5" />
                        )}
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground">
                          {grant.product.name}
                        </span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          Granted{" "}
                          {grant.grantedAt.toLocaleDateString("en-US", {
                            dateStyle: "medium",
                          })}
                          {grant.product.asset?.version &&
                            ` · file v${grant.product.asset.version}`}
                        </span>
                        {revoked && grant.revokedReason && (
                          <span className="mt-1 block text-xs break-words text-destructive">
                            {grant.revokedReason}
                          </span>
                        )}
                        <Link
                          href={`/admin/orders/${grant.order.orderNumber}`}
                          className="admin-mono mt-1 block break-all hover:text-brand-700"
                        >
                          {grant.order.orderNumber}
                        </Link>
                      </span>

                      <span className="shrink-0 text-right">
                        <span className="block text-sm font-medium text-foreground tabular-nums">
                          {grant.downloadCount}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {/* A running count, not an event log — the schema
                              stores no per-download history. */}
                          {grant.downloadCount === 1 ? "download" : "downloads"}
                        </span>
                        {grant.lastDownloadAt && (
                          <span className="mt-0.5 block text-xs text-muted-foreground/80">
                            last{" "}
                            {grant.lastDownloadAt.toLocaleDateString("en-US", {
                              dateStyle: "medium",
                            })}
                          </span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </AdminSection>

          {/* Products bought, aggregated across every successful order. */}
          {commerce.products.length > 0 && (
            <AdminSection
              title="Products purchased"
              description={`${commerce.unitsPurchased} ${commerce.unitsPurchased === 1 ? "unit" : "units"} across ${commerce.successfulOrders} ${commerce.successfulOrders === 1 ? "order" : "orders"}`}
              bodyClassName="p-0"
            >
              <div className="w-full overflow-x-auto">
                <table className="admin-table admin-table-stack sm:min-w-[640px]">
                  <caption className="sr-only">Products purchased</caption>
                  <thead>
                    <tr>
                      <th scope="col">Product</th>
                      <th scope="col" className="text-right">Units</th>
                      <th scope="col" className="text-right">Spent</th>
                      <th scope="col" className="text-right">Downloads</th>
                      <th scope="col">Access</th>
                    </tr>
                  </thead>
                  <tbody>
                    {commerce.products.map((product) => (
                      <tr key={product.productId ?? product.slug}>
                        <td data-label="Product">
                          <span className="block truncate font-medium text-foreground">
                            {product.name}
                          </span>
                        </td>
                        <td data-label="Units" className="text-right tabular-nums text-muted-foreground">
                          {product.units}
                        </td>
                        <td data-label="Spent" className="text-right font-medium tabular-nums text-foreground">
                          {formatMoney(product.spentCents)}
                        </td>
                        <td data-label="Downloads" className="text-right tabular-nums text-muted-foreground">
                          {product.downloads}
                        </td>
                        <td data-label="Access">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
                              product.accessState === "downloaded" &&
                                "border-success/20 bg-success/8 text-success",
                              product.accessState === "available" &&
                                "border-border bg-[var(--admin-raised)] text-muted-foreground",
                              product.accessState === "revoked" &&
                                "border-destructive/20 bg-destructive/8 text-destructive",
                              product.accessState === "none" &&
                                "border-warning/20 bg-warning/8 text-warning",
                            )}
                          >
                            {/* "Not downloaded" is a fact, not a fault. */}
                            {product.accessState === "downloaded"
                              ? "Downloaded"
                              : product.accessState === "available"
                                ? "Not downloaded"
                                : product.accessState === "revoked"
                                  ? "Revoked"
                                  : "No access"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </AdminSection>
          )}

          <AdminSection
            title="Activity"
            description={`${timeline.length} recorded ${timeline.length === 1 ? "event" : "events"} · newest first`}
            bodyClassName="p-0"
          >
            <AdminTimeline
              events={timeline}
              emptyMessage="No customer activity yet."
            />
          </AdminSection>

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
              <table className="admin-table admin-table-stack sm:min-w-[560px]">
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
                      <td data-label="Order">
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
                      <td data-label="Date" className="text-muted-foreground">
                        {order.placedAt.toLocaleDateString("en-US", { dateStyle: "medium" })}
                      </td>
                      <td data-label="Status">
                        <OrderStatusBadge status={order.status} />
                      </td>
                      <td data-label="Total" className="text-right font-medium tabular-nums">
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
