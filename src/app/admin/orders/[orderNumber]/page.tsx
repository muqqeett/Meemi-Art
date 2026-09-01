import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, User, Mail, Calendar } from "lucide-react";

import { AdminPageHeader, AdminSection } from "@/components/admin/admin-page-header";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/orders/order-status-badge";
import { AdminTimeline } from "@/components/admin/order-timeline";
import { buildOrderTimeline } from "@/lib/admin/order-timeline-events";
import { OrderDelivery } from "@/components/admin/order-delivery";
import { OrderDetailView } from "@/components/orders/order-detail-view";
import { OrderStatusForm } from "@/components/admin/order-status-form";
import { OrderDeleteButton } from "@/components/admin/order-delete-button";
import { orderDeletionBlockedReason } from "@/lib/actions/admin/order-deletion-policy";
import { getAdminOrder } from "@/lib/queries/admin";
import { getOrderIntelligence } from "@/lib/queries/order-intelligence";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = { title: "Order details" };

export default async function AdminOrderPage({
  params,
}: PageProps<"/admin/orders/[orderNumber]">) {
  const { orderNumber } = await params;
  const order = await getAdminOrder(orderNumber);

  if (!order) notFound();

  // Derived here so the panel below and the server action agree on the verdict
  // — the action re-checks it against its own read regardless.
  const deletionBlocked = orderDeletionBlockedReason(order);

  // One round trip for the webhook ledger, the audit trail, the delivery
  // grants and the customer profile. Fetched after the order because it needs
  // the ids; nothing in it is per-item, so there is no N+1.
  const intel = await getOrderIntelligence({ orderId: order.id, userId: order.userId });
  const timeline = buildOrderTimeline(order, intel);

  return (
    <div>
      <Link
        href="/admin/orders"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-brand-600"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to orders
      </Link>

      <AdminPageHeader
        title={order.orderNumber}
        description={`Placed ${order.placedAt.toLocaleDateString("en-US", { dateStyle: "long" })} · ${formatMoney(order.totalCents)}`}
      />

      {/* Current state, above the fold and before anything else — an operator
          opening this page is asking "what is happening with this order". */}
      <div className="admin-card mb-6 flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <OrderStatusBadge status={order.status} />
          {order.payment && <PaymentStatusBadge status={order.payment.status} />}
        </div>
        <div className="ml-auto text-right">
          <p className="admin-eyebrow">Total</p>
          <p className="text-lg font-semibold text-foreground tabular-nums">
            {formatMoney(order.totalCents)}
            <span className="ml-1.5 text-xs font-normal text-muted-foreground">
              {order.currency}
            </span>
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-6">
          {/* Delivery before the line items: on a shop that sells files, "did
              they get it" outranks "what did they buy". */}
          <AdminSection
            title="Digital delivery"
            description="Payment, fulfilment and access must all hold."
          >
            <OrderDelivery
              paid={order.payment?.status === "PAID"}
              completed={order.status === "COMPLETED"}
              items={order.items.map((item) => ({
                id: item.id,
                name: item.name,
                slug: item.slug,
              }))}
              access={intel.access}
            />
          </AdminSection>

          {/* The centrepiece. Every entry is a stored timestamp. */}
          <AdminSection
            title="Timeline"
            description={`${timeline.length} recorded ${timeline.length === 1 ? "event" : "events"}`}
            bodyClassName="p-0"
          >
            <AdminTimeline events={timeline} />
          </AdminSection>

          <OrderDetailView order={order} />
        </div>

        <aside className="space-y-6">
          <section className="admin-card p-5">
            <h2 className="mb-4 text-sm font-semibold text-foreground">Manage order</h2>
            <OrderStatusForm
              orderId={order.id}
              currentStatus={order.status}
            />

            <div className="mt-4 border-t border-border pt-4">
              {deletionBlocked ? (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  <span className="font-medium text-foreground">Protected order.</span>{" "}
                  {deletionBlocked}
                </p>
              ) : (
                <>
                  <OrderDeleteButton
                    orderId={order.id}
                    orderNumber={order.orderNumber}
                    variant="detail"
                    redirectTo="/admin/orders"
                  />
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    Permanently removes this unpaid order and its line items.
                    Cannot be undone.
                  </p>
                </>
              )}
            </div>
          </section>

          {order.payment && (
            <section className="admin-card p-5">
              <h2 className="mb-4 text-sm font-semibold text-foreground">Payment</h2>
              <dl className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Status</dt>
                  <dd><PaymentStatusBadge status={order.payment.status} /></dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Provider</dt>
                  <dd className="text-foreground capitalize">{order.payment.provider}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Amount</dt>
                  <dd className="font-medium text-foreground tabular-nums">
                    {formatMoney(order.payment.amountCents)} {order.payment.currency}
                  </dd>
                </div>
                {order.payment.cardLast4 && (
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted-foreground">Card</dt>
                    <dd className="text-foreground">
                      {order.payment.cardBrand} ···· {order.payment.cardLast4}
                    </dd>
                  </div>
                )}
                {order.payment.providerTransactionId && (
                  <div>
                    <dt className="text-muted-foreground">Transaction ID</dt>
                    {/* An identifier, not a credential — the provider prints it
                        in its own dashboard. Wraps rather than widening the
                        card on a phone. */}
                    <dd className="admin-mono mt-1 break-all text-foreground">
                      {order.payment.providerTransactionId}
                    </dd>
                  </div>
                )}
                {order.payment.failureReason && (
                  <div>
                    <dt className="text-muted-foreground">Failure reason</dt>
                    <dd className="mt-1 text-xs leading-relaxed break-words text-destructive">
                      {order.payment.failureReason}
                    </dd>
                  </div>
                )}
              </dl>
            </section>
          )}

          <section className="admin-card p-5">
            <h2 className="mb-4 text-sm font-semibold text-foreground">Customer</h2>

            <dl className="space-y-3 text-sm">
              <div className="flex items-start gap-2.5">
                <User className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden />
                <div>
                  <dt className="sr-only">Name</dt>
                  <dd>
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
                    {!order.user && (
                      <span className="block text-xs text-muted-foreground">
                        Guest checkout
                      </span>
                    )}
                  </dd>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <Mail className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden />
                <div className="min-w-0">
                  <dt className="sr-only">Email</dt>
                  <dd className="truncate">
                    <a
                      href={`mailto:${order.email}`}
                      className="text-muted-foreground hover:text-brand-600"
                    >
                      {order.email}
                    </a>
                  </dd>
                </div>
              </div>

              {order.user && (
                <div className="flex items-start gap-2.5">
                  <Calendar className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden />
                  <div>
                    <dt className="sr-only">Customer since</dt>
                    <dd className="text-muted-foreground">
                      Customer since{" "}
                      {order.user.createdAt.toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                      })}
                    </dd>
                  </div>
                </div>
              )}
            </dl>

            {/* Lifetime figures use the canonical SUCCESSFUL_ORDER filter, so
                they agree with the dashboard rather than being a fourth
                definition of what counts as a sale. */}
            {intel.customer && (
              <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4">
                <div>
                  <dt className="admin-eyebrow">Orders</dt>
                  <dd className="mt-1 text-base font-semibold text-foreground tabular-nums">
                    {intel.customer._count.orders}
                  </dd>
                </div>
                <div>
                  <dt className="admin-eyebrow">Lifetime spend</dt>
                  <dd className="mt-1 text-base font-semibold text-foreground tabular-nums">
                    {formatMoney(intel.customer.spentCents)}
                  </dd>
                </div>
              </dl>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
