import "server-only";

import { prisma } from "@/lib/prisma";
import {
  SUCCESSFUL_ORDER,
  SUCCESSFUL_ORDER_ITEM,
  isSuccessfulOrder,
} from "@/lib/queries/successful-order";
import type { TimelineEvent } from "@/lib/admin/order-timeline-events";

/**
 * What a customer has bought, and what they can actually download.
 *
 * Complements `getAdminCustomer`, which already returns identity, the full
 * order history and recent reviews. This adds the two things it has never
 * had — digital access and per-product purchase history — plus the aggregates
 * the list page needs.
 *
 * ── Canonical definitions, reused ──────────────────────────────────────────
 *
 * Lifetime value is the sum of `totalCents` over orders matching
 * `SUCCESSFUL_ORDER` — COMPLETED **and** payment PAID. That is the same filter
 * the dashboard, analytics and product performance use, so a customer's total
 * always reconciles with the store's. Refunded orders set both statuses to
 * REFUNDED and therefore drop out, which is the project's existing revenue
 * rule and is not re-litigated here.
 *
 * Purchased units come from `OrderItem` rows under `SUCCESSFUL_ORDER_ITEM`,
 * the same filter product performance uses.
 *
 * ── What the schema cannot say ─────────────────────────────────────────────
 *
 * `DigitalAccess` keeps a running `downloadCount` and only `lastDownloadAt`.
 * There are no individual download events, so this module reports "6
 * downloads, last at T" and never a per-download history. Nothing records
 * sessions, devices, location or product views, so there is no engagement,
 * conversion or churn figure anywhere here.
 *
 * Read-only throughout.
 */

export type CustomerState = "no-purchases" | "new" | "returning";

/**
 * Transparent, and deliberately only three values.
 *
 *   no-purchases  zero successful orders
 *   new           exactly one
 *   returning     more than one
 *
 * No score, no tier, no "VIP" or "likely to churn" — nothing in this database
 * supports those, and a label the data cannot justify is worse than none.
 */
export function customerState(successfulOrders: number): CustomerState {
  if (successfulOrders === 0) return "no-purchases";
  return successfulOrders === 1 ? "new" : "returning";
}

export type CustomerCommerce = Awaited<ReturnType<typeof getCustomerCommerce>>;

/**
 * Purchases and digital access for one customer.
 *
 * Four queries, none per-item. `access` and `items` are each a single query
 * covering every product the customer owns.
 */
export async function getCustomerCommerce(userId: string) {
  const [successfulAgg, items, access, firstLast] = await Promise.all([
    // Lifetime value and successful order count, from the canonical filter.
    prisma.order.aggregate({
      where: { userId, ...SUCCESSFUL_ORDER },
      _sum: { totalCents: true },
      _count: { _all: true },
    }),

    /**
     * Per-product purchase history. Grouped in SQL rather than by walking the
     * customer's orders in JavaScript.
     */
    prisma.orderItem.groupBy({
      by: ["productId", "name", "slug"],
      where: { ...SUCCESSFUL_ORDER_ITEM, order: { userId, ...SUCCESSFUL_ORDER } },
      _sum: { quantity: true, totalCents: true },
    }),

    // Everything the customer can (or could) download.
    prisma.digitalAccess.findMany({
      where: { userId },
      orderBy: { grantedAt: "desc" },
      select: {
        id: true,
        grantedAt: true,
        revokedAt: true,
        revokedReason: true,
        downloadCount: true,
        lastDownloadAt: true,
        // `storageKey` is never selected. Only whether a file still exists.
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            asset: { select: { version: true } },
            images: { select: { url: true }, orderBy: { sortOrder: "asc" }, take: 1 },
          },
        },
        order: { select: { orderNumber: true } },
      },
    }),

    // First and last successful purchase, in one query rather than two.
    prisma.order.findMany({
      where: { userId, ...SUCCESSFUL_ORDER },
      orderBy: { placedAt: "asc" },
      select: { orderNumber: true, placedAt: true, totalCents: true },
    }),
  ]);

  const successfulOrders = successfulAgg._count._all;
  const lifetimeValueCents = successfulAgg._sum.totalCents ?? 0;

  const downloadsTotal = access.reduce((sum, a) => sum + a.downloadCount, 0);
  const neverDownloaded = access.filter((a) => a.downloadCount === 0).length;

  const mostDownloaded =
    access.length > 0
      ? [...access].sort((a, b) => b.downloadCount - a.downloadCount)[0]
      : null;

  const lastDownloadAt = access.reduce<Date | null>((latest, a) => {
    if (!a.lastDownloadAt) return latest;
    return !latest || a.lastDownloadAt > latest ? a.lastDownloadAt : latest;
  }, null);

  // Access is keyed by product, so a product's purchase row can be matched to
  // its grant without a second query.
  const accessByProduct = new Map(access.map((a) => [a.product.id, a]));

  const products = items.map((row) => {
    const grant = row.productId ? accessByProduct.get(row.productId) : undefined;
    return {
      productId: row.productId,
      name: row.name,
      slug: row.slug,
      imageUrl: grant?.product.images[0]?.url ?? null,
      units: row._sum.quantity ?? 0,
      spentCents: row._sum.totalCents ?? 0,
      downloads: grant?.downloadCount ?? 0,
      /**
       * Only states the data can justify. "Not downloaded" is a fact, not a
       * fault — a customer may simply not have opened it yet.
       */
      accessState: !grant
        ? ("none" as const)
        : grant.revokedAt
          ? ("revoked" as const)
          : grant.downloadCount > 0
            ? ("downloaded" as const)
            : ("available" as const),
    };
  });

  return {
    successfulOrders,
    lifetimeValueCents,
    state: customerState(successfulOrders),
    /** Averaged over successful orders only — both halves the same population. */
    averageOrderCents:
      successfulOrders > 0 ? Math.round(lifetimeValueCents / successfulOrders) : 0,
    unitsPurchased: items.reduce((sum, r) => sum + (r._sum.quantity ?? 0), 0),
    products,
    access,
    downloads: {
      total: downloadsTotal,
      neverDownloaded,
      lastDownloadAt,
      mostDownloaded:
        mostDownloaded && mostDownloaded.downloadCount > 0
          ? { name: mostDownloaded.product.name, count: mostDownloaded.downloadCount }
          : null,
    },
    firstOrder: firstLast[0] ?? null,
    lastOrder: firstLast[firstLast.length - 1] ?? null,
  };
}

/**
 * Per-customer aggregates for the list page.
 *
 * Two grouped queries for the whole page rather than one pair per row — the
 * list passes the ids it has already fetched, so this never grows into an
 * N+1 as the customer count grows.
 */
export async function getCustomerListAggregates(userIds: string[]) {
  if (userIds.length === 0) {
    return { byUser: new Map<string, { downloads: number; grants: number; lastOrderAt: Date | null; units: number }>() };
  }

  const [access, lastOrders, units] = await Promise.all([
    prisma.digitalAccess.groupBy({
      by: ["userId"],
      where: { userId: { in: userIds } },
      _sum: { downloadCount: true },
      _count: { _all: true },
    }),
    prisma.order.groupBy({
      by: ["userId"],
      where: { userId: { in: userIds }, ...SUCCESSFUL_ORDER },
      _max: { placedAt: true },
    }),
    prisma.orderItem.groupBy({
      by: ["orderId"],
      where: { ...SUCCESSFUL_ORDER_ITEM, order: { userId: { in: userIds }, ...SUCCESSFUL_ORDER } },
      _sum: { quantity: true },
    }).then(async (rows) => {
      // Map order → user in one query so units can be attributed per customer.
      const orders = await prisma.order.findMany({
        where: { id: { in: rows.map((r) => r.orderId) } },
        select: { id: true, userId: true },
      });
      const userByOrder = new Map(orders.map((o) => [o.id, o.userId]));
      const perUser = new Map<string, number>();
      for (const row of rows) {
        const user = userByOrder.get(row.orderId);
        if (!user) continue;
        perUser.set(user, (perUser.get(user) ?? 0) + (row._sum.quantity ?? 0));
      }
      return perUser;
    }),
  ]);

  const downloadsByUser = new Map(
    access.map((a) => [a.userId, { downloads: a._sum.downloadCount ?? 0, grants: a._count._all }]),
  );
  const lastByUser = new Map(lastOrders.map((o) => [o.userId, o._max.placedAt]));

  const byUser = new Map(
    userIds.map((id) => [
      id,
      {
        downloads: downloadsByUser.get(id)?.downloads ?? 0,
        grants: downloadsByUser.get(id)?.grants ?? 0,
        lastOrderAt: lastByUser.get(id) ?? null,
        units: units.get(id) ?? 0,
      },
    ]),
  );

  return { byUser };
}

/* ────────────────────────────── activity timeline ────────────────────────── */

/**
 * One customer's history across every order they have placed.
 *
 * Emits the same `TimelineEvent` shape as the Order 360 builder and is rendered
 * by the same `AdminTimeline` component, so there is one event contract, one
 * icon mapping and one set of tone styles in the codebase. This builder differs
 * only in scope: it spans orders and adds the two events that exist at customer
 * level rather than order level — account creation and reviews.
 *
 * Deliberately coarser than the order timeline. Checkout sessions and provider
 * webhooks belong to a single order and are shown there; repeating them here
 * would bury the customer's actual story in protocol noise.
 *
 * ── Truthfulness ───────────────────────────────────────────────────────────
 *
 * Every event is a stored timestamp, and an event whose column is null is not
 * emitted. In particular:
 *
 *   · "Payment received" comes from `Payment.paidAt`, never inferred from an
 *     order existing.
 *   · "Order completed" is emitted only for orders passing the canonical
 *     `isSuccessfulOrder` (COMPLETED **and** PAID), so the count of those
 *     events equals the customer's successful order count by construction.
 *   · Downloads are a running `downloadCount` with only `lastDownloadAt`, so
 *     one entry reports the most recent use and the total. There is no
 *     per-download history in the schema and none is invented here.
 */
/** `purchase-ready` -> "Purchase ready"; `verify-email` -> "Verify email". */
function humaniseTemplate(template: string): string {
  const words = template.replace(/[-._]/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function buildCustomerTimeline(input: {
  createdAt: Date;
  orders: {
    id: string;
    orderNumber: string;
    totalCents: number;
    status: string;
    placedAt: Date;
    completedAt: Date | null;
    cancelledAt: Date | null;
    refundedAt: Date | null;
    payment: { status: string; paidAt: Date | null } | null;
  }[];
  access: {
    id: string;
    grantedAt: Date;
    revokedAt: Date | null;
    revokedReason: string | null;
    downloadCount: number;
    lastDownloadAt: Date | null;
    product: { name: string; slug: string };
    order: { orderNumber: string };
  }[];
  reviews: {
    id: string;
    rating: number;
    title: string;
    status: string;
    createdAt: Date;
    product: { name: string; slug: string };
  }[];
  emails: {
    id: string;
    to: string;
    template: string;
    subject: string;
    status: string;
    error: string | null;
    createdAt: Date;
  }[];
  formatAmount: (cents: number) => string;
}): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  events.push({
    id: `account-${input.createdAt.getTime()}`,
    at: input.createdAt,
    title: "Account created",
    icon: "user",
    tone: "info",
  });

  for (const order of input.orders) {
    const href = `/admin/orders/${order.orderNumber}`;
    const amount = input.formatAmount(order.totalCents);

    events.push({
      id: `placed-${order.id}`,
      at: order.placedAt,
      title: "Order placed",
      detail: `${amount} · ${order.orderNumber}`,
      icon: "receipt",
      tone: "info",
      href,
    });

    // From the payment's own timestamp — never inferred from the order.
    if (order.payment?.paidAt) {
      events.push({
        id: `paid-${order.id}`,
        at: order.payment.paidAt,
        title: "Payment received",
        detail: `${amount} · ${order.orderNumber}`,
        icon: "check",
        tone: "done",
        href,
      });
    }

    // Canonical success only, so these events reconcile 1:1 with the
    // customer's successful order count.
    if (order.completedAt && isSuccessfulOrder(order)) {
      events.push({
        id: `completed-${order.id}`,
        at: order.completedAt,
        title: "Order completed",
        detail: `${amount} · ${order.orderNumber}`,
        icon: "check",
        tone: "done",
        href,
      });
    }

    if (order.cancelledAt) {
      events.push({
        id: `cancelled-${order.id}`,
        at: order.cancelledAt,
        title: "Order cancelled",
        detail: order.orderNumber,
        icon: "revoke",
        tone: "failed",
        href,
      });
    }

    if (order.refundedAt) {
      events.push({
        id: `refunded-${order.id}`,
        at: order.refundedAt,
        title: "Order refunded",
        detail: `${amount} · ${order.orderNumber}`,
        icon: "refund",
        tone: "warning",
        href,
      });
    }
  }

  for (const grant of input.access) {
    events.push({
      id: `grant-${grant.id}`,
      at: grant.grantedAt,
      title: "Digital access granted",
      detail: `${grant.product.name} · ${grant.order.orderNumber}`,
      icon: "key",
      tone: "done",
      href: `/admin/orders/${grant.order.orderNumber}`,
    });

    if (grant.lastDownloadAt) {
      events.push({
        id: `download-${grant.id}`,
        at: grant.lastDownloadAt,
        title: grant.downloadCount === 1 ? "Downloaded" : "Last downloaded",
        detail:
          grant.downloadCount > 1
            ? `${grant.product.name} · ${grant.downloadCount} downloads in total · earlier times are not recorded`
            : grant.product.name,
        icon: "download",
        tone: "info",
      });
    }

    if (grant.revokedAt) {
      events.push({
        id: `revoked-${grant.id}`,
        at: grant.revokedAt,
        title: "Access revoked",
        detail: grant.revokedReason
          ? `${grant.product.name} · ${grant.revokedReason}`
          : grant.product.name,
        icon: "revoke",
        tone: "failed",
      });
    }
  }

  for (const review of input.reviews) {
    events.push({
      id: `review-${review.id}`,
      at: review.createdAt,
      title: `Review submitted · ${review.rating}★`,
      detail: `${review.product.name} · ${review.status.toLowerCase()}`,
      icon: "review",
      tone: "info",
      href: "/admin/reviews",
    });
  }

  /**
   * Mail sent to this customer's address.
   *
   * ── The caveat, stated where it lives ────────────────────────────────────
   *
   * `EmailLog` has no `userId`. These rows are matched on the recipient
   * address, which is an inference, not a stored relationship. It is sound in
   * one direction — `User.email` is unique, so an address maps to at most one
   * account and mail is never attributed to the wrong customer — but it can
   * under-report: a message sent before the customer changed their address
   * carries the old one and will not match. The caller widens the match to
   * include the addresses on the customer's own orders, which covers the
   * common case of an address changed after buying.
   *
   * Mail *about* this customer but addressed elsewhere is correctly excluded.
   * The `admin-new-order` notification goes to the operator, not the buyer,
   * so it does not appear on the buyer's timeline.
   */
  for (const email of input.emails) {
    const failed = email.status === "FAILED";
    const skipped = email.status === "SKIPPED";

    events.push({
      id: `email-${email.id}`,
      at: email.createdAt,
      title: failed
        ? `Email failed · ${humaniseTemplate(email.template)}`
        : skipped
          ? `Email skipped · ${humaniseTemplate(email.template)}`
          : `Email sent · ${humaniseTemplate(email.template)}`,
      // The provider's own error text. It describes the request, never a
      // credential — the same string the Email Center already shows.
      detail: failed && email.error ? `${email.subject} · ${email.error}` : email.subject,
      icon: "mail",
      // A failed send on a digital shop usually means a download link never
      // arrived, so it is not filed as routine information.
      tone: failed ? "failed" : skipped ? "warning" : "info",
      href: "/admin/emails",
    });
  }

  // Chronological, newest first — a customer screen is read as "what happened
  // lately", unlike an order screen which is read as a story from the start.
  // Ties break on `id`, so the order is deterministic rather than relying on
  // sort stability.
  return events.sort(
    (a, b) => b.at.getTime() - a.at.getTime() || a.id.localeCompare(b.id),
  );
}

/**
 * The rows the timeline needs that `getCustomerCommerce` does not already
 * return: orders with their lifecycle timestamps, and every review.
 *
 * Two queries, run concurrently. Access is passed in by the caller rather than
 * re-fetched, so the page never queries the same table twice.
 */
export async function getCustomerTimelineData(userId: string, email: string) {
  const [orders, reviews] = await Promise.all([
    prisma.order.findMany({
      where: { userId },
      orderBy: { placedAt: "desc" },
      select: {
        id: true,
        orderNumber: true,
        totalCents: true,
        status: true,
        // Snapshot address — feeds the email match below.
        email: true,
        placedAt: true,
        completedAt: true,
        cancelledAt: true,
        refundedAt: true,
        payment: { select: { status: true, paidAt: true } },
      },
    }),
    prisma.review.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        rating: true,
        title: true,
        status: true,
        createdAt: true,
        product: { select: { name: true, slug: true } },
      },
    }),
  ]);

  /**
   * Mail is matched on address because `EmailLog` carries no `userId`.
   *
   * The match covers the account's current address *and* every distinct
   * address on the customer's own orders — `Order.email` is a snapshot, so a
   * customer who changed their address after buying still gets their older
   * confirmations attributed. Indexed by `@@index([to, template, createdAt])`.
   *
   * Runs after the orders query because it needs those addresses; it is the
   * only sequential step, and it is one query rather than one per address.
   */
  const addresses = [...new Set([email, ...orders.map((o) => o.email)])];

  const emails = await prisma.emailLog.findMany({
    where: { to: { in: addresses } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      to: true,
      template: true,
      subject: true,
      status: true,
      // Provider error text only. The model's own comment records that it
      // never contains tokens.
      error: true,
      createdAt: true,
    },
  });

  return { orders, reviews, emails, addresses };
}
