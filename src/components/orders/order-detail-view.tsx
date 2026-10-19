import Image from "next/image";
import Link from "next/link";
import { Package, CreditCard, Download } from "lucide-react";

import {
  OrderStatusBadge,
  PaymentStatusBadge,
  ORDER_TIMELINE,
  ORDER_STATUS_LABELS,
} from "@/components/orders/order-status-badge";
import { plumButtonClass } from "@/components/ui/plum-button";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { OrderItemReview } from "@/components/orders/order-item-review";
import type { OrderDetail } from "@/lib/queries/orders";

/**
 * The order view is shared by three pages: the customer's confirmation and
 * account pages, which take the Plum Studio style, and the admin order page,
 * which keeps the style it was built in. `variant` picks between two complete
 * sets of class names; neither page's markup differs otherwise.
 */
type Variant = "default" | "plum";

const STYLES = {
  default: {
    root: "space-y-6",
    card: "rounded-2xl border border-border bg-card p-5 shadow-card",
    cardFlush: "rounded-2xl border border-border bg-card shadow-card",
    panelTitle: "flex items-center gap-2 text-sm font-semibold text-foreground",
    panelIcon: "size-4 text-brand-600",
    panelBody: "mt-3 text-sm text-muted-foreground",
    muted: "text-sm text-muted-foreground",
    orderNumber: "font-mono text-lg font-semibold text-foreground",
    segmentOn: "bg-brand-600",
    segmentOff: "bg-border",
    stepCurrent: "text-brand-600",
    stepDone: "text-foreground",
    stepTodo: "text-muted-foreground",
    stepBase: "text-xs font-medium",
    itemsHead:
      "flex items-center gap-2 border-b border-border p-5 text-sm font-semibold text-foreground",
    itemsList: "divide-y divide-border",
    thumb: "relative size-20 shrink-0 overflow-hidden rounded-lg bg-surface-alt",
    thumbSizes: "80px",
    thumbImg: "object-contain",
    itemName: "font-medium text-foreground hover:text-brand-600",
    itemMeta: "mt-0.5 text-sm text-muted-foreground",
    sku: "mt-0.5 font-mono text-xs text-muted-foreground",
    price: "font-medium text-foreground tabular-nums",
    priceEach: "text-xs text-muted-foreground",
    totals: "space-y-2.5 border-t border-border p-5 text-sm",
    totalsMuted: "text-muted-foreground",
    totalRow: "flex justify-between border-t border-border pt-2.5 text-base font-semibold",
  },
  plum: {
    root: "font-figtree space-y-6 text-pl-text",
    card: "rounded-[20px] border border-pl-line bg-pl-surface p-5 shadow-pl-sm",
    cardFlush: "rounded-[20px] border border-pl-line bg-pl-surface shadow-pl-sm",
    panelTitle: "flex items-center gap-2 text-base leading-[22px] font-bold tracking-[-0.005em]",
    panelIcon: "size-4 text-plum-500",
    panelBody: "mt-3 text-sm leading-[22px] text-pl-muted",
    muted: "text-sm leading-[22px] text-pl-muted",
    orderNumber: "font-mono text-lg font-bold text-pl-text",
    segmentOn: "bg-plum-500",
    segmentOff: "bg-pl-line",
    stepCurrent: "text-plum-500",
    stepDone: "text-pl-text",
    stepTodo: "text-pl-muted",
    stepBase: "text-[13px] leading-[18px] font-bold",
    itemsHead:
      "flex items-center gap-2 border-b border-pl-line p-5 text-base leading-[22px] font-bold tracking-[-0.005em]",
    itemsList: "divide-y divide-pl-line",
    thumb: "pl-focus relative size-16 shrink-0 overflow-hidden rounded-[12px] bg-pl-tint-crochet",
    thumbSizes: "64px",
    thumbImg: "object-contain p-1.5",
    itemName: "text-base leading-[22px] font-bold tracking-[-0.005em] text-pl-text hover:underline",
    itemMeta: "mt-0.5 text-[13px] leading-[18px] font-medium text-pl-muted",
    sku: "mt-0.5 font-mono text-xs text-pl-muted",
    price: "pl-display pl-price tabular-nums",
    priceEach: "text-[13px] leading-[18px] font-medium text-pl-muted",
    totals: "space-y-2.5 border-t border-pl-line p-5 text-base leading-[26px]",
    totalsMuted: "text-pl-muted",
    totalRow:
      "flex items-center justify-between border-t border-pl-line pt-2.5 text-base font-bold",
  },
} as const;

function Panel({
  title,
  icon: Icon,
  children,
  variant,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  variant: Variant;
}) {
  const s = STYLES[variant];
  return (
    <section className={s.card}>
      <h2 className={s.panelTitle}>
        <Icon className={s.panelIcon} />
        {title}
      </h2>
      <div className={s.panelBody}>{children}</div>
    </section>
  );
}

/** Progress. Cancelled and refunded orders are terminal, not steps on a path. */
function Timeline({ order, variant }: { order: OrderDetail; variant: Variant }) {
  const s = STYLES[variant];

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
                done ? s.segmentOn : s.segmentOff,
              )}
            />
            <span
              className={cn(
                s.stepBase,
                current ? s.stepCurrent : done ? s.stepDone : s.stepTodo,
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
  variant = "default",
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
  /** `plum` is the customer-facing Plum Studio style; the admin keeps `default`. */
  variant?: Variant;
}) {
  const s = STYLES[variant];

  return (
    <div className={s.root}>
      <div className={s.card}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className={s.muted}>Order</p>
            <p className={s.orderNumber}>{order.orderNumber}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <OrderStatusBadge status={order.status} />
            {order.payment && <PaymentStatusBadge status={order.payment.status} />}
          </div>
        </div>

        <p className={cn("mt-1", s.muted)}>
          Placed on{" "}
          <time dateTime={order.placedAt.toISOString()}>
            {order.placedAt.toLocaleDateString("en-US", { dateStyle: "long" })}
          </time>
        </p>

        <div className="mt-6">
          <Timeline order={order} variant={variant} />
        </div>

        {/* The whole point of a completed digital order: a way to the files. */}
        {order.status === "COMPLETED" && (
          <Link
            href="/account/downloads"
            className={
              variant === "plum"
                ? plumButtonClass({ style: "primary", size: "md", className: "mt-5" })
                : "label-caps mt-5 inline-flex h-11 items-center gap-2 rounded-xs bg-brand-700 px-5 text-white transition-colors hover:bg-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-600"
            }
          >
            <Download className="size-4" aria-hidden />
            Go to your downloads
          </Link>
        )}
      </div>

      <section className={s.cardFlush}>
        <h2 className={s.itemsHead}>
          <Package className={s.panelIcon} aria-hidden />
          Items ({order.items.length})
        </h2>

        <ul className={s.itemsList}>
          {order.items.map((item) => (
            <li key={item.id} className="flex gap-4 p-5">
              <Link href={`/products/${item.slug}`} className={s.thumb}>
                {item.imageUrl && (
                  <Image
                    src={item.imageUrl}
                    alt={item.name}
                    fill
                    sizes={s.thumbSizes}
                    className={s.thumbImg}
                  />
                )}
              </Link>

              <div className="flex min-w-0 flex-1 flex-col justify-center">
                <Link href={`/products/${item.slug}`} className={s.itemName}>
                  {item.name}
                </Link>
                <p className={s.itemMeta}>Qty {item.quantity}</p>
                <p className={s.sku}>{item.sku}</p>

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
                <p className={s.price}>{formatMoney(item.totalCents)}</p>
                {item.quantity > 1 && (
                  <p className={s.priceEach}>{formatMoney(item.unitPriceCents)} each</p>
                )}
              </div>
            </li>
          ))}
        </ul>

        <dl className={s.totals}>
          <div className="flex justify-between">
            <dt className={s.totalsMuted}>Subtotal</dt>
            <dd className="tabular-nums">{formatMoney(order.subtotalCents)}</dd>
          </div>
          {order.discountCents > 0 && (
            <div className="flex justify-between text-success">
              <dt>Discount {order.couponCode && `(${order.couponCode})`}</dt>
              <dd className="tabular-nums">−{formatMoney(order.discountCents)}</dd>
            </div>
          )}
          <div className={s.totalRow}>
            <dt>Total ({order.currency})</dt>
            <dd className="tabular-nums">{formatMoney(order.totalCents)}</dd>
          </div>
        </dl>
      </section>

      <Panel title="Payment" icon={CreditCard} variant={variant}>
        {order.payment ? (
          <>
            <p
              className={
                variant === "plum" ? "font-bold text-pl-text" : "font-medium text-foreground"
              }
            >
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
                className={
                  variant === "plum"
                    ? plumButtonClass({ style: "secondary", size: "md", className: "mt-4" })
                    : "label-caps mt-4 inline-flex h-10 items-center rounded-xs border border-brand-700/35 px-4 text-brand-700 transition-colors hover:bg-brand-700 hover:text-white"
                }
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
        <Panel title="Order notes" icon={Package} variant={variant}>
          <p className="whitespace-pre-line">{order.notes}</p>
        </Panel>
      )}
    </div>
  );
}
