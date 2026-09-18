/**
 * What every analytics figure means. One place, so no two screens can quietly
 * disagree about a definition.
 *
 * ── Counts ────────────────────────────────────────────────────────────────
 *
 *   Views             PRODUCT_VIEW events: a product page shown to a visitor,
 *                     de-duplicated per visitor per product per 30 minutes;
 *                     bots and prefetches are not counted.
 *   Visitor-days      distinct daily visitor keys. The key rotates every day,
 *                     so one person on three days counts three times — this is
 *                     "unique visitors per day, summed", never a person count.
 *   Add to cart       ADD_TO_CART events: successful add-to-cart actions.
 *   Checkout starts   order lines on orders of ANY status placed in the range —
 *                     every checkout creates its order before payment, so the
 *                     order table is the authoritative record of attempts.
 *   Purchases         units on successful orders (`SUCCESSFUL_ORDER`: order
 *                     COMPLETED and payment PAID) placed in the range.
 *   Revenue           order-line totals on those same successful orders, in
 *                     the store currency. Attributed to the order's `placedAt`,
 *                     the date the existing analytics already use.
 *   Orders            successful orders placed in the range.
 *   Customers         distinct customers with a successful order in the range.
 *   Wishlist adds     WISHLIST_ADD events: successful saves to a wishlist.
 *                     Current saved counts come from WishlistItem instead.
 *   Downloads         DOWNLOAD events: authorised download requests, recorded
 *                     at the same moment as the existing download counter.
 *   Reviews / rating  approved reviews, from the Review table.
 *
 * Events exist only from the day this feature was deployed; earlier periods
 * show zero for them, not an estimate.
 *
 * ── Rates ─────────────────────────────────────────────────────────────────
 *
 *   View → Cart          add to cart ÷ views
 *   Cart → Checkout      checkout starts ÷ add to cart
 *   Checkout → Purchase  purchases ÷ checkout starts
 *   Product conversion   purchases ÷ views
 *   Average order value  revenue ÷ orders
 *
 * A rate with a zero denominator is `null` and shown as "—": it is undefined,
 * not zero. Stages are counted independently rather than by following one
 * person through them — a customer whose payment fails and who tries again
 * creates two checkout attempts from one add to cart — so a stage rate can
 * exceed 100%. It is shown as measured rather than clipped.
 */

export const CONVERSION_DEFINITIONS = {
  viewToCart: "Add to cart ÷ views",
  cartToCheckout: "Checkout starts ÷ add to cart",
  checkoutToPurchase: "Purchases ÷ checkout starts",
  conversion: "Purchases ÷ views",
} as const;

/** `part / whole`, or null when the whole is zero. */
export function ratio(part: number, whole: number): number | null {
  if (!Number.isFinite(part) || !Number.isFinite(whole) || whole === 0) return null;
  return part / whole;
}

/** A ratio as a percentage with one decimal ("4.2%"), or "—" when undefined. */
export function formatRate(value: number | null): string {
  if (value === null) return "—";
  return `${(Math.round(value * 1000) / 10).toFixed(1)}%`;
}

/**
 * Percentage change from the previous period, one decimal place.
 *
 * Null when the previous value is zero: growth from nothing has no percentage,
 * and printing "+100%" for it (as a round number would suggest) is a claim the
 * data does not support.
 */
export function percentChange(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export type FunnelCounts = {
  views: number;
  addToCart: number;
  checkoutStarts: number;
  purchases: number;
};

export function funnelRates(counts: FunnelCounts) {
  return {
    viewToCart: ratio(counts.addToCart, counts.views),
    cartToCheckout: ratio(counts.checkoutStarts, counts.addToCart),
    checkoutToPurchase: ratio(counts.purchases, counts.checkoutStarts),
    conversion: ratio(counts.purchases, counts.views),
  };
}

/** Average order value in cents, or null with no orders. */
export function averageOrderCents(revenueCents: number, orders: number): number | null {
  const value = ratio(revenueCents, orders);
  return value === null ? null : Math.round(value);
}
