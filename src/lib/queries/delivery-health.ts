import "server-only";

import { prisma } from "@/lib/prisma";
import { SUCCESSFUL_ORDER } from "@/lib/queries/successful-order";

/**
 * Can the customers who paid actually get their files?
 *
 * The invariant this module exists to police:
 *
 *     payment PAID → order COMPLETED → product has a file → access granted
 *                  → customer can download
 *
 * A break anywhere in that chain means somebody has been charged for something
 * they cannot download, and it is invisible on every other admin screen — the
 * order looks fine, the payment looks fine, and only the missing grant tells
 * the truth.
 *
 * ── What the database can and cannot say ───────────────────────────────────
 *
 * Available:  Payment.status · Order.status · Product.isActive
 *             Product.asset (nullable — "missing file" is real)
 *             DigitalAccess.grantedAt / revokedAt / revokedReason
 *             DigitalAccess.downloadCount / lastDownloadAt
 *
 * NOT available: individual download events. `DigitalAccess` keeps a running
 *             `downloadCount` and only `lastDownloadAt`, so this module reports
 *             "N downloads, last at T" and never a per-download history. There
 *             is no table to reconstruct one from.
 *
 * Read-only throughout. Every count below is a real query; nothing is
 * estimated, extrapolated or rounded into a nicer number.
 */

/** Refunded orders are excluded by `SUCCESSFUL_ORDER`, which requires PAID. */
const DELIVERABLE = SUCCESSFUL_ORDER;

export type DeliveryIssue = {
  orderId: string;
  orderNumber: string;
  email: string;
  customerName: string;
  placedAt: Date;
  items: number;
  granted: number;
  revoked: number;
  /** What is actually wrong, in words an operator can act on. */
  problem: string;
  tone: "critical" | "warning";
};

export type DeliveryHealth = Awaited<ReturnType<typeof getDeliveryHealth>>;

export async function getDeliveryHealth() {
  const [
    paidOrders,
    completedOrders,
    activeProducts,
    productsMissingFile,
    accessTotals,
    revokedOnLive,
    candidates,
  ] = await Promise.all([
    // Money arrived, whatever the order says.
    prisma.order.count({ where: { payment: { status: "PAID" } } }),

    // Paid *and* completed — the canonical successful order.
    prisma.order.count({ where: DELIVERABLE }),

    prisma.product.count({ where: { isActive: true } }),

    // Published, therefore purchasable, with nothing to deliver.
    prisma.product.count({ where: { isActive: true, asset: { is: null } } }),

    // One aggregate for both grant count and total downloads. `downloadCount`
    // is a running total per grant, so this sums real recorded downloads.
    prisma.digitalAccess.aggregate({
      _count: { _all: true },
      _sum: { downloadCount: true },
    }),

    // Revoked access on an order that is still a live sale. A revoke on a
    // refunded order is correct behaviour; on a paid, completed one it means
    // the customer lost something they still own.
    prisma.digitalAccess.count({
      where: { revokedAt: { not: null }, order: DELIVERABLE },
    }),

    /**
     * The delivery check itself.
     *
     * Prisma cannot express "grants fewer than items" in a `where`, so this
     * asks for a deliberately narrow projection — ids and two relation counts,
     * no item rows, no product rows — and compares them in memory. One query,
     * no N+1, and the payload is a handful of integers per order.
     *
     * If this store ever grows to a scale where even that is too much, the
     * replacement is a single grouped SQL statement rather than pagination;
     * the shape of the answer does not change.
     */
    prisma.order.findMany({
      where: DELIVERABLE,
      orderBy: { placedAt: "desc" },
      select: {
        id: true,
        orderNumber: true,
        email: true,
        customerName: true,
        placedAt: true,
        _count: { select: { items: true, access: true } },
      },
    }),
  ]);

  // Orders whose grants do not cover their items.
  const shortfall = candidates.filter((o) => o._count.access < o._count.items);

  /**
   * Only the failing orders are inspected in detail — usually none. Two
   * queries scoped to that set, not one per order.
   */
  const failingIds = shortfall.map((o) => o.id);
  const revokedByOrder = failingIds.length
    ? await prisma.digitalAccess.groupBy({
        by: ["orderId"],
        where: { orderId: { in: failingIds }, revokedAt: { not: null } },
        _count: { _all: true },
      })
    : [];
  const revokedMap = new Map(revokedByOrder.map((r) => [r.orderId, r._count._all]));

  const issues: DeliveryIssue[] = shortfall.map((order) => {
    const missing = order._count.items - order._count.access;
    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      email: order.email,
      customerName: order.customerName,
      placedAt: order.placedAt,
      items: order._count.items,
      granted: order._count.access,
      revoked: revokedMap.get(order.id) ?? 0,
      problem:
        order._count.access === 0
          ? "Paid and completed, but no digital access was granted."
          : `${missing} of ${order._count.items} items have no digital access.`,
      tone: "critical",
    };
  });

  const grantsTotal = accessTotals._count._all;
  const downloadsTotal = accessTotals._sum.downloadCount ?? 0;

  /**
   * The pipeline. Each stage is the population that reached it, so a drop
   * between two stages is a real loss and not a change of denominator.
   *
   * "File available" counts completed orders minus those whose grants are
   * short — a grant can only exist where a file existed at fulfilment, so a
   * shortfall is the observable proxy. It is labelled as delivered rather than
   * as file-presence for exactly that reason.
   */
  const deliveredOrders = completedOrders - issues.length;

  return {
    pipeline: [
      { key: "paid", label: "Paid", count: paidOrders },
      { key: "completed", label: "Completed", count: completedOrders },
      { key: "granted", label: "Access granted", count: deliveredOrders },
    ],
    metrics: {
      paidOrders,
      completedOrders,
      deliveredOrders,
      grantsTotal,
      downloadsTotal,
      activeProducts,
      productsMissingFile,
      revokedOnLive,
    },
    issues,
    /** Whole-store verdict, derived — never asserted. */
    healthy: issues.length === 0 && productsMissingFile === 0 && revokedOnLive === 0,
  };
}

export type ProductReadiness = Awaited<ReturnType<typeof getProductDeliveryReadiness>>;

/**
 * Which products could be delivered if someone bought them right now.
 *
 * `storageKey` is never selected — it is the value that would let someone sign
 * their own download URL. Only its existence is reported.
 */
export async function getProductDeliveryReadiness() {
  const products = await prisma.product.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      isActive: true,
      asset: { select: { filename: true, bytes: true, version: true } },
      _count: { select: { access: true } },
    },
  });

  // Downloads per product in one grouped query rather than one per row.
  const downloads = await prisma.digitalAccess.groupBy({
    by: ["productId"],
    _sum: { downloadCount: true },
  });
  const byProduct = new Map(downloads.map((d) => [d.productId, d._sum.downloadCount ?? 0]));

  return products.map((product) => ({
    id: product.id,
    name: product.name,
    slug: product.slug,
    isActive: product.isActive,
    hasFile: product.asset !== null,
    filename: product.asset?.filename ?? null,
    bytes: product.asset?.bytes ?? 0,
    version: product.asset?.version ?? null,
    grants: product._count.access,
    downloads: byProduct.get(product.id) ?? 0,
    /**
     * Only a *published* product with no file is an incident — an inactive
     * draft without a file is simply unfinished, and flagging it would bury
     * the real problems under work in progress.
     */
    state: !product.asset
      ? product.isActive
        ? ("missing-file" as const)
        : ("draft" as const)
      : product.isActive
        ? ("ready" as const)
        : ("inactive" as const),
  }));
}

/**
 * Recent delivery events, from the timestamps that exist.
 *
 * Grants and revocations have their own instants. Downloads do not — there is
 * only `lastDownloadAt` and a running total — so a download appears once, as
 * the most recent use of that grant, never as one row per download.
 */
export async function getRecentDeliveryActivity(limit = 8) {
  const [granted, downloaded] = await Promise.all([
    prisma.digitalAccess.findMany({
      orderBy: { grantedAt: "desc" },
      take: limit,
      select: {
        id: true,
        grantedAt: true,
        revokedAt: true,
        revokedReason: true,
        downloadCount: true,
        product: { select: { name: true } },
        order: { select: { orderNumber: true } },
      },
    }),
    prisma.digitalAccess.findMany({
      where: { lastDownloadAt: { not: null } },
      orderBy: { lastDownloadAt: "desc" },
      take: limit,
      select: {
        id: true,
        lastDownloadAt: true,
        downloadCount: true,
        product: { select: { name: true } },
        order: { select: { orderNumber: true } },
      },
    }),
  ]);

  type Entry = {
    id: string;
    at: Date;
    kind: "granted" | "revoked" | "downloaded";
    product: string;
    orderNumber: string;
    detail?: string;
  };

  const entries: Entry[] = [];

  for (const g of granted) {
    entries.push({
      id: `grant-${g.id}`,
      at: g.grantedAt,
      kind: "granted",
      product: g.product.name,
      orderNumber: g.order.orderNumber,
    });
    if (g.revokedAt) {
      entries.push({
        id: `revoke-${g.id}`,
        at: g.revokedAt,
        kind: "revoked",
        product: g.product.name,
        orderNumber: g.order.orderNumber,
        detail: g.revokedReason ?? undefined,
      });
    }
  }

  for (const d of downloaded) {
    if (!d.lastDownloadAt) continue;
    entries.push({
      id: `dl-${d.id}`,
      at: d.lastDownloadAt,
      kind: "downloaded",
      product: d.product.name,
      orderNumber: d.order.orderNumber,
      detail:
        d.downloadCount > 1
          ? `${d.downloadCount} downloads in total · earlier times are not recorded`
          : undefined,
    });
  }

  return entries.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, limit);
}
