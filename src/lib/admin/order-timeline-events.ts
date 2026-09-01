/**
 * Building an order's history from stored timestamps.
 *
 * Pure: no React, no icons, no database. It takes rows and returns a sorted
 * list of events, which means it can be exercised directly against the real
 * database from a script — and it was, before the UI was trusted.
 *
 * The component that renders this maps `icon` to a glyph. Keeping the mapping
 * there rather than here is what lets this module stay importable from a
 * server-only context.
 *
 * ── The rule ───────────────────────────────────────────────────────────────
 *
 * Every event is a stored timestamp. Nothing is inferred from a status,
 * nothing is interpolated between two known points, and an event whose column
 * is null does not appear — a cancelled order has no "payment received" row
 * because there is no `paidAt` to show. A timeline that guesses is worse than
 * no timeline, because it is what an operator reads when they need to know
 * what actually happened.
 */

export type TimelineTone = "done" | "failed" | "warning" | "info";

export type TimelineIcon =
  | "receipt"
  | "card"
  | "check"
  | "alert"
  | "revoke"
  | "refund"
  | "webhook"
  | "key"
  | "download"
  | "admin"
  // Customer-scope events. The order timeline never emits these; the shared
  // renderer maps every key, so adding them here costs nothing there.
  | "user"
  | "review"
  | "mail";

export type TimelineEvent = {
  id: string;
  at: Date;
  title: string;
  detail?: string;
  icon: TimelineIcon;
  tone: TimelineTone;
  /**
   * Optional navigation target. An order timeline is already on the order, so
   * it sets none; a customer timeline spans many orders and links to each.
   */
  href?: string;
};

/** `payment_succeeded` → "Payment succeeded"; `admin.reconcile` → "Admin reconcile". */
export function humaniseEvent(type: string): string {
  const words = type.replace(/[._]/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export type TimelineOrder = {
  placedAt: Date;
  completedAt: Date | null;
  cancelledAt: Date | null;
  refundedAt: Date | null;
  payment: {
    createdAt: Date;
    paidAt: Date | null;
    failedAt: Date | null;
    cancelledAt: Date | null;
    refundedAt: Date | null;
    failureReason: string | null;
    provider: string;
  } | null;
};

export type TimelineInput = {
  events: { id: string; provider: string; type: string; processedAt: Date }[];
  activity: {
    id: string;
    action: string;
    createdAt: Date;
    actor: { name: string | null; email: string };
  }[];
  access: {
    id: string;
    grantedAt: Date;
    revokedAt: Date | null;
    revokedReason: string | null;
    downloadCount: number;
    lastDownloadAt: Date | null;
    product: { name: string };
  }[];
};

export function buildOrderTimeline(
  order: TimelineOrder,
  intel: TimelineInput,
): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  events.push({
    id: "placed",
    at: order.placedAt,
    title: "Order created",
    icon: "receipt",
    tone: "done",
  });

  const p = order.payment;
  if (p) {
    // The checkout session. Written at the same instant as the order on a
    // normal flow, which is why it names the provider — otherwise the two rows
    // would read as a duplicate rather than as two separate facts.
    events.push({
      id: "checkout",
      at: p.createdAt,
      title: "Checkout created",
      detail: `Sent to ${p.provider}`,
      icon: "card",
      tone: "done",
    });

    if (p.paidAt)
      events.push({ id: "paid", at: p.paidAt, title: "Payment received", icon: "check", tone: "done" });

    if (p.failedAt)
      events.push({
        id: "failed",
        at: p.failedAt,
        title: "Payment failed",
        // The provider's own wording. It describes the request, never a
        // credential — the same string the payments screen already shows.
        detail: p.failureReason ?? undefined,
        icon: "alert",
        tone: "failed",
      });

    if (p.cancelledAt)
      events.push({ id: "pcancel", at: p.cancelledAt, title: "Payment cancelled", icon: "revoke", tone: "failed" });

    if (p.refundedAt)
      events.push({ id: "prefund", at: p.refundedAt, title: "Payment refunded", icon: "refund", tone: "warning" });
  }

  // The provider's delivered webhooks — the only record of what it actually
  // told us, and when.
  for (const event of intel.events) {
    events.push({
      id: `evt-${event.id}`,
      at: event.processedAt,
      title: humaniseEvent(event.type),
      detail: `${event.provider} event`,
      icon: "webhook",
      tone: "info",
    });
  }

  if (order.completedAt)
    events.push({ id: "completed", at: order.completedAt, title: "Order completed", icon: "check", tone: "done" });

  if (order.cancelledAt)
    events.push({ id: "ocancel", at: order.cancelledAt, title: "Order cancelled", icon: "revoke", tone: "failed" });

  if (order.refundedAt)
    events.push({ id: "orefund", at: order.refundedAt, title: "Order refunded", icon: "refund", tone: "warning" });

  for (const grant of intel.access) {
    events.push({
      id: `grant-${grant.id}`,
      at: grant.grantedAt,
      title: "Digital access granted",
      detail: grant.product.name,
      icon: "key",
      tone: "done",
    });

    /**
     * Downloads are a running count with only the most recent timestamp
     * stored, so this is one entry saying when it was last used and how many
     * times in total — never one entry per download. The earlier downloads
     * genuinely have no recorded time, and inventing rows for them is exactly
     * the fabrication this module exists to avoid.
     */
    if (grant.lastDownloadAt)
      events.push({
        id: `dl-${grant.id}`,
        at: grant.lastDownloadAt,
        title: grant.downloadCount === 1 ? "Downloaded" : "Last downloaded",
        detail:
          grant.downloadCount > 1
            ? `${grant.downloadCount} downloads in total · earlier times are not recorded`
            : grant.product.name,
        icon: "download",
        tone: "info",
      });

    if (grant.revokedAt)
      events.push({
        id: `revoke-${grant.id}`,
        at: grant.revokedAt,
        title: "Access revoked",
        detail: grant.revokedReason ?? undefined,
        icon: "revoke",
        tone: "failed",
      });
  }

  // Who did what, by hand.
  for (const entry of intel.activity) {
    events.push({
      id: `act-${entry.id}`,
      at: entry.createdAt,
      title: humaniseEvent(entry.action),
      detail: `by ${entry.actor.name ?? entry.actor.email}`,
      icon: "admin",
      tone: "info",
    });
  }

  // Sorted by the timestamp itself rather than by a hand-written order, so a
  // reconciliation that landed an hour late appears where it really happened
  // instead of where the happy path would have put it.
  return events.sort((a, b) => a.at.getTime() - b.at.getTime());
}
