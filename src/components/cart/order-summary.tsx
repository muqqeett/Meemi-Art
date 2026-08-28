import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import type { AppliedCoupon, OrderTotals } from "@/lib/cart/totals";

type OrderSummaryProps = {
  totals: OrderTotals;
  coupon?: AppliedCoupon | null;
  /** Set on the checkout page, where the summary sits inside a bordered card. */
  bare?: boolean;
  className?: string;
  children?: React.ReactNode;
};

function Row({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "success" | "muted";
}) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "font-medium tabular-nums",
          tone === "success" && "text-success",
          tone === "muted" && "text-muted-foreground",
          tone === "default" && "text-foreground",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

/**
 * Shared totals block so the cart, checkout and order pages always agree.
 *
 * There is no shipping row and no tax row. Nothing is posted, and Paddle is
 * the merchant of record — it adds and collects any sales tax at its own
 * checkout, so the figure here is what we charge, and the customer may see a
 * larger amount at the provider. Saying so is more honest than printing a tax
 * line we cannot compute.
 */
export function OrderSummary({
  totals,
  coupon,
  bare = false,
  className,
  children,
}: OrderSummaryProps) {
  return (
    <div
      className={cn(
        !bare && "rounded-2xl border border-border bg-card p-5 shadow-card",
        className,
      )}
    >
      {!bare && <h2 className="text-base font-semibold text-foreground">Order summary</h2>}

      <dl className={cn("space-y-3", !bare && "mt-4")}>
        <Row label="Subtotal" value={formatMoney(totals.subtotalCents)} />

        {totals.discountCents > 0 && (
          <Row
            label={coupon ? `Discount (${coupon.code})` : "Discount"}
            value={`−${formatMoney(totals.discountCents)}`}
            tone="success"
          />
        )}

        <div className="flex items-center justify-between gap-4 border-t border-border pt-3">
          <dt className="font-semibold text-foreground">Total</dt>
          <dd className="text-xl font-semibold text-foreground tabular-nums">
            {formatMoney(totals.totalCents)}
          </dd>
        </div>
      </dl>

      <p className="text-body mt-3 text-xs">
        Any local sales tax is calculated and added at the payment step.
      </p>

      {children && <div className="mt-5 space-y-3">{children}</div>}
    </div>
  );
}
