import "server-only";

import { prisma } from "@/lib/prisma";
import { SUCCESSFUL_ORDER, SUCCESSFUL_ORDER_ITEM } from "@/lib/queries/successful-order";

/**
 * Which products actually sell.
 *
 * Revenue and units come from `OrderItem` rows on orders that pass the
 * canonical `SUCCESSFUL_ORDER_ITEM` filter — the same definition the dashboard
 * and analytics use. There is deliberately no second notion of a sale here:
 * if this page and the dashboard ever disagreed, one of them would be lying.
 *
 * ── What the schema can and cannot measure ─────────────────────────────────
 *
 * Measurable:  units sold, revenue, distinct orders per product, grants,
 *              download totals, file presence, published state.
 *
 * NOT measurable:
 *   · Product views. Nothing records them, so there is no conversion rate.
 *     A "conversion" here would be units divided by an unknown, which is why
 *     this module does not report one.
 *   · Downloads over time. `DigitalAccess` keeps a running `downloadCount`
 *     and only `lastDownloadAt`, so downloads are ALWAYS all-time and cannot
 *     honour the period filter. The page labels them as such rather than
 *     quietly showing an all-time number under a "last 7 days" heading.
 *
 * Read-only throughout.
 */

export const PERIODS = {
  "7d": { label: "7 days", days: 7 },
  "30d": { label: "30 days", days: 30 },
  "90d": { label: "90 days", days: 90 },
  all: { label: "All time", days: null },
} as const;

export type PeriodKey = keyof typeof PERIODS;

/** Narrows an untrusted URL value so a hand-edited `?period=` cannot reach Prisma. */
export function parsePeriod(value: string | undefined): PeriodKey {
  return value && value in PERIODS ? (value as PeriodKey) : "30d";
}

export type ProductPerformance = Awaited<ReturnType<typeof getProductPerformance>>;

/**
 * Commercial and delivery state for every product, in one pass.
 *
 * Five queries total regardless of how many products exist — four aggregates
 * and one narrow projection. Nothing runs per product.
 */
export async function getProductPerformance(period: PeriodKey = "30d") {
  const days = PERIODS[period].days;
  const since = days === null ? null : new Date(Date.now() - days * 86_400_000);

  // The period applies to when the order was placed, which is the only date an
  // order line has. `SUCCESSFUL_ORDER_ITEM` already scopes to paid + completed.
  const soldWhere = {
    ...SUCCESSFUL_ORDER_ITEM,
    productId: { not: null },
    ...(since ? { order: { ...SUCCESSFUL_ORDER, placedAt: { gte: since } } } : {}),
  };

  const [sales, orderLines, products, access, downloadTotal] = await Promise.all([
    // Revenue and units per product.
    prisma.orderItem.groupBy({
      by: ["productId"],
      where: soldWhere,
      _sum: { quantity: true, totalCents: true },
    }),

    /**
     * Distinct orders per product.
     *
     * `groupBy._count` counts order *lines*, not orders, and Prisma cannot
     * count distinct inside a groupBy. This asks for two id columns and
     * nothing else, then counts distinct pairs in memory — one query, a
     * two-integer payload per line, no N+1.
     */
    prisma.orderItem.findMany({
      where: soldWhere,
      select: { productId: true, orderId: true },
    }),

    // The catalogue, with the first image and whether a file exists.
    prisma.product.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        isActive: true,
        priceCents: true,
        images: { select: { url: true }, orderBy: { sortOrder: "asc" }, take: 1 },
        // `storageKey` is never selected — only whether a file exists and its
        // human-facing version label.
        asset: { select: { version: true } },
      },
    }),

    // Grants and downloads per product. All-time by necessity; see the header.
    prisma.digitalAccess.groupBy({
      by: ["productId"],
      _sum: { downloadCount: true },
      _count: { _all: true },
    }),

    prisma.digitalAccess.aggregate({ _sum: { downloadCount: true } }),
  ]);

  const salesByProduct = new Map(
    sales.map((row) => [
      row.productId as string,
      { units: row._sum.quantity ?? 0, revenueCents: row._sum.totalCents ?? 0 },
    ]),
  );

  const ordersByProduct = new Map<string, Set<string>>();
  for (const line of orderLines) {
    if (!line.productId) continue;
    const set = ordersByProduct.get(line.productId) ?? new Set<string>();
    set.add(line.orderId);
    ordersByProduct.set(line.productId, set);
  }

  const accessByProduct = new Map(
    access.map((row) => [
      row.productId,
      { grants: row._count._all, downloads: row._sum.downloadCount ?? 0 },
    ]),
  );

  const rows = products.map((product) => {
    const sold = salesByProduct.get(product.id);
    const grants = accessByProduct.get(product.id);

    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      imageUrl: product.images[0]?.url ?? null,
      isActive: product.isActive,
      priceCents: product.priceCents,
      hasFile: product.asset !== null,
      version: product.asset?.version ?? null,
      unitsSold: sold?.units ?? 0,
      revenueCents: sold?.revenueCents ?? 0,
      orders: ordersByProduct.get(product.id)?.size ?? 0,
      grants: grants?.grants ?? 0,
      downloads: grants?.downloads ?? 0,
    };
  });

  // Ranked by revenue, which is what "performance" means on a shop. Ties fall
  // back to units so two products at the same money are not ordered at random.
  const ranked = [...rows].sort(
    (a, b) => b.revenueCents - a.revenueCents || b.unitsSold - a.unitsSold,
  );

  const revenueCents = rows.reduce((sum, r) => sum + r.revenueCents, 0);
  const unitsSold = rows.reduce((sum, r) => sum + r.unitsSold, 0);
  const sellingCount = rows.filter((r) => r.unitsSold > 0).length;

  // Distinct orders across the whole period, not the sum of per-product counts
  // — one order containing two products must not count twice.
  const distinctOrders = new Set(orderLines.map((l) => l.orderId)).size;

  return {
    period,
    since,
    products: ranked,
    totals: {
      revenueCents,
      unitsSold,
      orders: distinctOrders,
      /** All-time by necessity — see the module header. */
      downloadsAllTime: downloadTotal._sum.downloadCount ?? 0,
      productCount: rows.length,
      sellingCount,
      publishedMissingFile: rows.filter((r) => r.isActive && !r.hasFile).length,
      /**
       * Averaged over products that actually sold, not over the whole
       * catalogue — dividing by every draft would understate it and answer a
       * question nobody asked.
       */
      averageRevenuePerSellingProduct:
        sellingCount > 0 ? Math.round(revenueCents / sellingCount) : 0,
    },
    top: ranked.find((r) => r.revenueCents > 0) ?? null,
  };
}

export type PerformanceState =
  | "top"
  | "selling"
  | "no-sales"
  | "missing-file"
  | "draft";

/**
 * A product's state, derived from facts rather than from a score.
 *
 * There is deliberately no weighted index here. A number like "73" would need
 * a formula nobody could check, and every input to it is already on the row —
 * revenue, units, file presence, published flag. Ranking is by revenue and the
 * label just names where a row sits.
 *
 * Order matters: a published product with no file is a delivery incident even
 * if it is selling well, so that check comes before the commercial ones.
 */
export function performanceState(
  row: { isActive: boolean; hasFile: boolean; revenueCents: number },
  topRevenueCents: number,
): PerformanceState {
  if (row.isActive && !row.hasFile) return "missing-file";
  if (!row.isActive) return "draft";
  if (row.revenueCents === 0) return "no-sales";
  if (topRevenueCents > 0 && row.revenueCents === topRevenueCents) return "top";
  return "selling";
}
