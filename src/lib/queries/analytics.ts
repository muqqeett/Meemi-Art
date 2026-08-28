import "server-only";

import { prisma } from "@/lib/prisma";

const CANCELLED = "CANCELLED" as const;

/** Headline KPIs for the admin dashboard, with period-over-period change. */
export async function getDashboardStats() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 86_400_000);

  const [
    revenueAll,
    revenueCurrent,
    revenuePrevious,
    ordersTotal,
    ordersCurrent,
    ordersPrevious,
    customersTotal,
    customersCurrent,
    productsActive,
    unsellable,
  ] = await Promise.all([
    prisma.order.aggregate({
      where: { status: { not: CANCELLED } },
      _sum: { totalCents: true },
    }),
    prisma.order.aggregate({
      where: { status: { not: CANCELLED }, placedAt: { gte: thirtyDaysAgo } },
      _sum: { totalCents: true },
    }),
    prisma.order.aggregate({
      where: {
        status: { not: CANCELLED },
        placedAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo },
      },
      _sum: { totalCents: true },
    }),
    prisma.order.count(),
    prisma.order.count({ where: { placedAt: { gte: thirtyDaysAgo } } }),
    prisma.order.count({ where: { placedAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } } }),
    prisma.user.count({ where: { role: "CUSTOMER" } }),
    prisma.user.count({ where: { role: "CUSTOMER", createdAt: { gte: thirtyDaysAgo } } }),
    prisma.product.count({ where: { isActive: true } }),
    // Products that cannot be delivered: published but with no file attached.
    prisma.product.count({ where: { isActive: true, asset: { is: null } } }),
  ]);

  const currentRevenue = revenueCurrent._sum.totalCents ?? 0;
  const previousRevenue = revenuePrevious._sum.totalCents ?? 0;

  function delta(current: number, previous: number): number | null {
    if (previous === 0) return current > 0 ? 100 : null;
    return Math.round(((current - previous) / previous) * 100);
  }

  return {
    revenueTotalCents: revenueAll._sum.totalCents ?? 0,
    revenue30Cents: currentRevenue,
    revenueDelta: delta(currentRevenue, previousRevenue),
    ordersTotal,
    orders30: ordersCurrent,
    ordersDelta: delta(ordersCurrent, ordersPrevious),
    customersTotal,
    customers30: customersCurrent,
    productsActive,
    unsellable,
    averageOrderCents:
      ordersTotal > 0 ? Math.round((revenueAll._sum.totalCents ?? 0) / ordersTotal) : 0,
  };
}

/** Monthly revenue and order counts for the last 12 months. */
export async function getRevenueSeries() {
  const start = new Date();
  start.setMonth(start.getMonth() - 11);
  start.setDate(1);
  start.setHours(0, 0, 0, 0);

  const orders = await prisma.order.findMany({
    where: { placedAt: { gte: start }, status: { not: CANCELLED } },
    select: { placedAt: true, totalCents: true },
  });

  // Pre-seed every month so a quiet month renders as zero rather than a gap.
  const buckets = new Map<string, { month: string; revenue: number; orders: number }>();
  for (let index = 0; index < 12; index++) {
    const date = new Date(start);
    date.setMonth(start.getMonth() + index);
    buckets.set(`${date.getFullYear()}-${date.getMonth()}`, {
      month: date.toLocaleDateString("en-US", { month: "short" }),
      revenue: 0,
      orders: 0,
    });
  }

  for (const order of orders) {
    const key = `${order.placedAt.getFullYear()}-${order.placedAt.getMonth()}`;
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.revenue += order.totalCents / 100;
    bucket.orders += 1;
  }

  return [...buckets.values()];
}

/** Order counts by status, for the dashboard breakdown. */
export async function getOrderStatusBreakdown() {
  const groups = await prisma.order.groupBy({
    by: ["status"],
    _count: { status: true },
  });

  return groups.map((group) => ({
    status: group.status,
    count: group._count.status,
  }));
}

/** Best sellers by units sold, excluding cancelled orders. */
export async function getBestSellers(limit = 5) {
  const grouped = await prisma.orderItem.groupBy({
    by: ["productId", "name", "slug"],
    where: { order: { status: { not: CANCELLED } }, productId: { not: null } },
    _sum: { quantity: true, totalCents: true },
    orderBy: { _sum: { quantity: "desc" } },
    take: limit,
  });

  return grouped.map((row) => ({
    productId: row.productId,
    name: row.name,
    slug: row.slug,
    unitsSold: row._sum.quantity ?? 0,
    revenueCents: row._sum.totalCents ?? 0,
  }));
}

/**
 * Revenue split by product category.
 *
 * Order lines snapshot the product name but not its category, so this joins
 * back through `productId`. Lines whose product has since been deleted keep
 * their revenue under "Uncategorised" rather than vanishing from the total.
 */
export async function getSalesByCategory() {
  const lines = await prisma.orderItem.findMany({
    where: { order: { status: { not: CANCELLED } } },
    select: {
      totalCents: true,
      quantity: true,
      product: { select: { category: { select: { name: true } } } },
    },
  });

  const totals = new Map<string, { revenueCents: number; units: number }>();

  for (const line of lines) {
    const name = line.product?.category.name ?? "Uncategorised";
    const bucket = totals.get(name) ?? { revenueCents: 0, units: 0 };
    bucket.revenueCents += line.totalCents;
    bucket.units += line.quantity;
    totals.set(name, bucket);
  }

  return [...totals.entries()]
    .map(([category, value]) => ({ category, ...value }))
    .sort((a, b) => b.revenueCents - a.revenueCents);
}

export async function getRecentOrders(limit = 6) {
  return prisma.order.findMany({
    orderBy: { placedAt: "desc" },
    take: limit,
    select: {
      id: true,
      orderNumber: true,
      status: true,
      totalCents: true,
      placedAt: true,
      email: true,
      user: { select: { name: true } },
      _count: { select: { items: true } },
    },
  });
}

/** New customers per month for the last 6 months. */
export async function getCustomerGrowth() {
  const start = new Date();
  start.setMonth(start.getMonth() - 5);
  start.setDate(1);
  start.setHours(0, 0, 0, 0);

  const users = await prisma.user.findMany({
    where: { role: "CUSTOMER", createdAt: { gte: start } },
    select: { createdAt: true },
  });

  const buckets = new Map<string, { month: string; customers: number }>();
  for (let index = 0; index < 6; index++) {
    const date = new Date(start);
    date.setMonth(start.getMonth() + index);
    buckets.set(`${date.getFullYear()}-${date.getMonth()}`, {
      month: date.toLocaleDateString("en-US", { month: "short" }),
      customers: 0,
    });
  }

  for (const user of users) {
    const key = `${user.createdAt.getFullYear()}-${user.createdAt.getMonth()}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.customers += 1;
  }

  return [...buckets.values()];
}
