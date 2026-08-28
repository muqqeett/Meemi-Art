import type { DiscountType } from "@/generated/prisma/enums";

export type CartLine = {
  quantity: number;
  unitPriceCents: number;
};

export type AppliedCoupon = {
  id: string;
  code: string;
  type: DiscountType;
  value: number;
  minOrderCents: number;
};

export type OrderTotals = {
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
};

/**
 * The single implementation of order arithmetic.
 *
 * Both the cart page and checkout call this on the server; the client never
 * computes a total that is trusted.
 *
 * There is no shipping and no tax line. Files are not posted, and Paddle is
 * the merchant of record: it calculates, collects and remits sales tax on top
 * of this figure at its own checkout. That money is never ours, so recording
 * a tax component here would misstate both the order and the takings.
 * `totalCents` is therefore what we charge, and the customer may be shown more
 * at the provider once their local tax is added.
 */
export function calculateTotals({
  lines,
  coupon,
}: {
  lines: CartLine[];
  coupon?: AppliedCoupon | null;
}): OrderTotals {
  const subtotalCents = lines.reduce(
    (sum, line) => sum + line.unitPriceCents * line.quantity,
    0,
  );

  let discountCents = 0;
  if (coupon && subtotalCents >= coupon.minOrderCents) {
    discountCents =
      coupon.type === "PERCENTAGE"
        ? Math.round((subtotalCents * coupon.value) / 100)
        : coupon.value;
    // Never discount below zero.
    discountCents = Math.min(discountCents, subtotalCents);
  }

  return {
    subtotalCents,
    discountCents,
    totalCents: subtotalCents - discountCents,
  };
}
