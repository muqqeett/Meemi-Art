import "server-only";

import { cache } from "react";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-guards";
import { getRememberedOrderIds } from "@/lib/orders/guest-access";
import type { OrderStatus } from "@/generated/prisma/enums";

const orderInclude = {
  items: { orderBy: { name: "asc" } },
  payment: true,
} as const;

/**
 * Fetch an order, but only if the caller is entitled to see it: either it
 * belongs to their account, or their browser holds the id from placing it.
 * Returns null rather than throwing so callers can render a 404.
 */
export const getOrderForViewer = cache(async (orderNumber: string) => {
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: orderInclude,
  });

  if (!order) return null;

  const user = await getCurrentUser();

  if (user) {
    if (order.userId === user.id) return order;
    // Admins can open any order from the storefront view too.
    if (user.role === "ADMIN") return order;
  }

  const remembered = await getRememberedOrderIds();
  if (remembered.includes(order.id)) return order;

  return null;
});

export type OrderDetail = NonNullable<Awaited<ReturnType<typeof getOrderForViewer>>>;

/** The signed-in customer's orders, newest first. */
export async function listUserOrders(
  userId: string,
  options: { status?: OrderStatus; page?: number; perPage?: number } = {},
) {
  const perPage = options.perPage ?? 10;
  const page = options.page ?? 1;

  const where = {
    userId,
    ...(options.status ? { status: options.status } : {}),
  };

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        items: { select: { id: true, name: true, imageUrl: true, quantity: true } },
        payment: { select: { status: true, provider: true } },
      },
      orderBy: { placedAt: "desc" },
      take: perPage,
      skip: (page - 1) * perPage,
    }),
    prisma.order.count({ where }),
  ]);

  return {
    orders,
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / perPage)),
  };
}

/** Headline figures for the account dashboard. */
export async function getCustomerSummary(userId: string) {
  const [orderCount, spend, wishlistCount, activeOrders] = await Promise.all([
    prisma.order.count({ where: { userId } }),
    prisma.order.aggregate({
      // Only completed orders count as money spent. A pending or cancelled
      // order was never charged, and a refunded one was given back.
      where: { userId, status: "COMPLETED" },
      _sum: { totalCents: true },
    }),
    prisma.wishlistItem.count({ where: { wishlist: { userId } } }),
    prisma.order.count({
      where: { userId, status: { in: ["PENDING", "PROCESSING"] } },
    }),
  ]);

  return {
    orderCount,
    totalSpentCents: spend._sum.totalCents ?? 0,
    wishlistCount,
    activeOrders,
  };
}
