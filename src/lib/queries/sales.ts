import "server-only";

import { prisma } from "@/lib/prisma";

/**
 * How many of each product have actually been sold.
 *
 * The design shows a "1,238 Sold" figure beside the rating. That number is
 * real here or it is not shown: it counts quantities on order lines belonging
 * to orders that reached COMPLETED, which is the only state that means money
 * arrived. Pending, failed, cancelled and refunded orders are all excluded —
 * a refunded sale is not a sale.
 *
 * Returned as a map so a rail of products costs one query rather than one per
 * card. Products with no sales are simply absent, and the caller renders
 * nothing rather than "0 Sold".
 */
export async function getSoldCounts(productIds: string[]): Promise<Map<string, number>> {
  if (productIds.length === 0) return new Map();

  const rows = await prisma.orderItem.groupBy({
    by: ["productId"],
    where: {
      productId: { in: productIds },
      order: { status: "COMPLETED" },
    },
    _sum: { quantity: true },
  });

  const counts = new Map<string, number>();
  for (const row of rows) {
    if (!row.productId) continue;
    const sold = row._sum.quantity ?? 0;
    if (sold > 0) counts.set(row.productId, sold);
  }
  return counts;
}

/** Convenience for a single product. */
export async function getSoldCount(productId: string): Promise<number> {
  const counts = await getSoldCounts([productId]);
  return counts.get(productId) ?? 0;
}
