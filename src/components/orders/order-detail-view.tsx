import Image from "next/image";
import Link from "next/link";
import { Package, CreditCard, Download } from "lucide-react";

import {
  OrderStatusBadge,
  PaymentStatusBadge,
  ORDER_TIMELINE,
  ORDER_STATUS_LABELS,
} from "@/components/orders/order-status-badge";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { OrderItemReview } from "@/components/orders/order-item-review";
import type { OrderDetail } from "@/lib/queries/orders";

function Panel({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Icon className="size-4 text-brand-600" />
        {title}
      </h2>
      <div className="mt-3 text-sm text-muted-foreground">{children}</div>
    </section>
  );
}

/** Progress. Cancelled and refunded orders are terminal, not steps on a path. */
function Timeline({ order }: { order: OrderDetail }) {
  if (order.status === "CANCELLED" || order.status === "REFUNDED") {
    const refunded = order.status === "REFUNDED";
    const when = refunded ? order.refundedAt : order.cancelledAt;

    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
        This order was {refunded ? "refunded" : "cancelled"}
        {when
          ? ` on ${when.toLocaleDateString("en-US", { dateStyle: "long" })}`
          : ""}
        .{refunded && " Access to its downloads has been withdrawn."}
      </div>
    );
  }

  const currentIndex = ORDER_TIMELINE.indexOf(order.status);

  return (
    <ol className="grid grid-cols-3 gap-2">
      {ORDER_TIMELINE.map((step, index) => {
        const done = index <= currentIndex;
        const current = index === currentIndex;

        return (
          <li key={step} className="flex flex-col gap-2">
            <span
              aria-hidden
              className={cn(
                "h-1.5 rounded-full transition-colors",
                done ? "bg-brand-600" : "bg-border",
              )}
            />
            <span
              className={cn(
                "text-xs font-medium",
                current
                  ? "text-brand-600"
                  : done
                    ? "text-foreground"
                    : "text-muted-foreground",
              )}
            >
              {ORDER_STATUS_LABELS[step]}
              {current && <span className="sr-only"> (current status)</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function OrderDetailView({
  order,
  reviewable,
}: {
  order: OrderDetail;
  /**
   * Lines this viewer may review, keyed by productId, with their existing
   * review when they have one. Computed server-side from the order's own
   * status and payment — this component never decides eligibility.
   */
  reviewable?: Record<
    string,
    { rating: number; title: string; body: string } | null
  >;
}) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Order</p>
            <p className="font-mono text-lg font-semibold text-foreground">
              {order.orderNumber}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <OrderStatusBadge status={order.status} />
            {order.payment && <PaymentStatusBadge status={order.payment.status} />}
          </div>
        </div>

        <p className="mt-1 text-sm text-muted-foreground">
          Placed on{" "}
          <time dateTime={order.placedAt.toISOString()}>
            {order.placedAt.toLocaleDateString("en-US", { dateStyle: "long" })}
          </time>
        </p>

        <div className="mt-6">
          <Timeline order={order} />
        </div>

        {/* The whole point of a completed digital order: a way to the files. */}
        {order.status === "COMPLETED" && (
          <Link
            href="/account/downloads"
            className="label-caps mt-5 inline-flex h-11 items-center gap-2 rounded-xs bg-brand-700 px-5 text-white transition-colors hover:bg-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-600"
          >
            <Download className="size-4" aria-hidden />
            Go to your downloads
          </Link>
        )}
      </div>

      <section className="rounded-2xl border border-border bg-card shadow-card">
        <h2 className="flex items-center gap-2 border-b border-border p-5 text-sm font-semibold text-foreground">
          <Package className="size-4 text-brand-600" aria-hidden />
          Items ({order.items.length})
        </h2>

        <ul className="divide-y divide-border">
          {order.items.map((item) => (
            <li key={item.id} className="flex gap-4 p-5">
              <Link
                href={`/products/${item.slug}`}
                className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-surface-alt"
              >
                {item.imageUrl && (
                  <Image
                    src={item.imageUrl}
                    alt={item.name}
                    fill
                    sizes="80px"
                    className="object-contain"
                  />
                )}
              </Link>

              <div className="flex min-w-0 flex-1 flex-col justify-center">
                <Link
                  href={`/products/${item.slug}`}
                  className="font-medium text-foreground hover:text-brand-600"
                >
                  {item.name}
                </Link>
                <p className="mt-0.5 text-sm text-muted-foreground">Qty {item.quantity}</p>
                <p className="mt-0.5 font-mono text-xs text-muted-foreground">{item.sku}</p>

                {/* Only for lines the server marked reviewable. A product that
                    was refunded, or an order that never completed, never
                    reaches this branch. */}
                {item.productId && reviewable && item.productId in reviewable && (
                  <OrderItemReview
                    productId={item.productId}
                    productName={item.name}
                    existing={reviewable[item.productId]}
                  />
                )}
              </div>

              <div className="text-right">
                <p className="font-medium text-foreground tabular-nums">
                  {formatMoney(item.totalCents)}
                </p>
                {item.quantity > 1 && (
                  <p className="text-xs text-muted-foreground">
                    {formatMoney(item.unitPriceCents)} each
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>

        <dl className="space-y-2.5 border-t border-border p-5 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Subtotal</dt>
            <dd className="tabular-nums">{formatMoney(order.subtotalCents)}</dd>
          </div>
          {order.discountCents > 0 && (
            <div className="flex justify-between text-success">
              <dt>Discount {order.couponCode && `(${order.couponCode})`}</dt>
              <dd className="tabular-nums">−{formatMoney(order.discountCents)}</dd>
            </div>
          )}
          <div className="flex justify-between border-t border-border pt-2.5 text-base font-semibold">
            <dt>Total ({order.currency})</dt>
            <dd className="tabular-nums">{formatMoney(order.totalCents)}</dd>
          </div>
        </dl>
      </section>

      <Panel title="Payment" icon={CreditCard}>
        {order.payment ? (
          <>
            <p className="font-medium text-foreground">
              {order.payment.cardLast4
                ? `Card ending ${order.payment.cardLast4}`
                : "Online payment"}
            </p>
            <p className="mt-1">
              {order.payment.status === "PAID" && order.payment.paidAt
                ? `Paid on ${order.payment.paidAt.toLocaleDateString("en-US", { dateStyle: "long" })}`
                : order.payment.status === "REFUNDED"
                  ? "Refunded"
                  : order.payment.status === "FAILED"
                    ? "Payment could not be completed"
                    : "Awaiting payment"}
            </p>

            {/* Enough to quote in a support email, and nothing that could be
                used to impersonate the charge. */}
            {order.payment.providerTransactionId && (
              <p className="mt-3 font-mono text-xs">
                Ref {order.payment.providerTransactionId}
              </p>
            )}

            {/* Retry lives here rather than on a new order: a failed payment
                leaves the order PENDING so the customer can pay the same one. */}
            {order.payment.status === "FAILED" && order.payment.checkoutUrl && (
              <a
                href={order.payment.checkoutUrl}
                className="label-caps mt-4 inline-flex h-10 items-center rounded-xs border border-brand-700/35 px-4 text-brand-700 transition-colors hover:bg-brand-700 hover:text-white"
              >
                Try payment again
              </a>
            )}
          </>
        ) : (
          <p>No payment recorded.</p>
        )}
      </Panel>

      {order.notes && (
        <Panel title="Order notes" icon={Package}>
          <p className="whitespace-pre-line">{order.notes}</p>
        </Panel>
      )}
    </div>
  );
}
