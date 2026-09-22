import { addDays, ANALYTICS_TIME_ZONE, dateKeyInZone } from "@/lib/analytics/date-range";

/**
 * The rules behind admin notifications: what counts as worth telling an admin,
 * how each occurrence is keyed so it is told once, and where it links.
 *
 * Pure — no database, no server imports — so the detector, the page and the
 * test harness all read the same definitions.
 */

/**
 * Every threshold in one place.
 *
 * The attention checks are informational: they say that something measurable
 * happened (traffic, saves, a drop in sales), never why. They are deliberately
 * conservative so a quiet shop is not told about noise.
 */
export const NOTIFICATION_RULES = {
  /** How far back each sweep looks for events it has not yet recorded. */
  lookbackDays: 14,

  /** A product saved to at least this many wishlists in one day is worth a line. */
  wishlistDailyThreshold: 3,

  /** "Traffic but no sales": views in the last seven days, with no purchase. */
  attentionMinViews: 40,
  /** "Saved but not bought": wishlist saves in the last seven days, with no purchase. */
  attentionMinWishlistAdds: 5,
  /** "Sales dropped": needs at least this many sales the week before… */
  attentionMinPreviousPurchases: 3,
  /** …and this week at or below this share of them. */
  attentionDropRatio: 0.5,

  /** Event-derived notifications: re-checked at most this often per server. */
  eventSweepMs: 60_000,
  /** Attention checks read seven-day aggregates, so they run far less often. */
  analyticsSweepMs: 60 * 60_000,

  /** Most rows any one detector writes in a sweep — a bound, not a target. */
  maxPerKind: 200,
} as const;

export type NotificationRules = typeof NOTIFICATION_RULES;

export const NOTIFICATION_TYPES = [
  "ORDER_COMPLETED",
  "PAYMENT_FAILED",
  "REVIEW_SUBMITTED",
  "PRODUCT_DOWNLOADED",
  "WISHLIST_ACTIVITY",
  "PRODUCT_ATTENTION",
  "PRODUCT_CONFIGURATION",
] as const;

export type NotificationTypeName = (typeof NOTIFICATION_TYPES)[number];

/** Short labels for the type chip on each row. */
export const NOTIFICATION_TYPE_LABELS: Record<NotificationTypeName, string> = {
  ORDER_COMPLETED: "Order",
  PAYMENT_FAILED: "Payment",
  REVIEW_SUBMITTED: "Review",
  PRODUCT_DOWNLOADED: "Download",
  WISHLIST_ACTIVITY: "Wishlist",
  PRODUCT_ATTENTION: "Performance",
  PRODUCT_CONFIGURATION: "Product setup",
};

// -------------------------------------------------------------- dedupe keys
//
// One key per real-world occurrence. The unique constraint on `dedupeKey` turns
// a second detection — the next sweep, a second server, a replayed request —
// into a no-op.

export const dedupeKeys = {
  /** One per completed order, ever. */
  orderCompleted: (orderId: string) => `order.completed:${orderId}`,
  /** One per failure: a payment that fails, is retried and fails again is two. */
  paymentFailed: (paymentId: string, failedAt: Date) => `payment.failed:${paymentId}:${failedAt.getTime()}`,
  /** One per review. An edit to an existing review is not a new one. */
  reviewSubmitted: (reviewId: string) => `review.submitted:${reviewId}`,
  /** One per product per shop day, however many downloads that day holds. */
  productDownloaded: (productId: string, day: string) => `product.downloaded:${productId}:${day}`,
  /** One per product per shop day, and only once the day crosses the threshold. */
  wishlistActivity: (productId: string, day: string) => `wishlist.activity:${productId}:${day}`,
  /** At most one attention line per product per calendar week. */
  productAttention: (productId: string, weekStart: string) => `product.attention:${productId}:${weekStart}`,
  /**
   * One per product per edit that leaves it published without a file. Fixing
   * it and breaking it again is an edit, so it is raised again; reloading the
   * dashboard is not, so it is not.
   */
  productUnsellable: (productId: string, updatedAt: Date) =>
    `product.unsellable:${productId}:${updatedAt.getTime()}`,
};

/**
 * The Monday that starts the shop week containing `instant`, as `YYYY-MM-DD`
 * in the shop's time zone. Weekly alerts key on this, so a condition that
 * lasts all week is raised once rather than every day the window slides.
 */
export function weekStartKey(instant: Date, timeZone = ANALYTICS_TIME_ZONE): string {
  const day = dateKeyInZone(instant, timeZone);
  const [y, m, d] = day.split("-").map(Number);
  // Day of week of a calendar date, independent of any time zone.
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  const sinceMonday = (weekday + 6) % 7;
  return addDays(day, -sinceMonday);
}

/**
 * An internal admin path, or nothing.
 *
 * Every link a notification carries was built here, from ids — but it is
 * stored, and a stored value is checked again before it is rendered or
 * followed, so no row can send an admin anywhere but the admin.
 */
export function safeAdminHref(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 500) return null;
  if (value !== "/admin" && !value.startsWith("/admin/") && !value.startsWith("/admin?")) return null;
  if (value.startsWith("//") || /[\s\\]/.test(value) || value.includes("://")) return null;
  return value;
}

/** "1 time" / "3 times", "1 wishlist" / "4 wishlists". */
export function plural(count: number, one: string, many: string): string {
  return `${count.toLocaleString("en-US")} ${count === 1 ? one : many}`;
}
