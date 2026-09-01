import "server-only";

import { prisma } from "@/lib/prisma";
import { SUCCESSFUL_ORDER } from "@/lib/queries/successful-order";

/**
 * Global admin search across products, orders and customers.
 *
 * Three narrow, indexed, hard-limited queries rather than one broad scan. Each
 * takes at most five rows, so a two-letter term cannot pull the catalogue into
 * the browser — the palette shows the best few and the resource pages remain
 * the place to browse properly.
 *
 * Every field returned is one the admin may already see on the corresponding
 * list page. Nothing here widens what an administrator can read.
 */
export type AdminSearchResults = {
  products: { id: string; name: string; slug: string; priceCents: number; isActive: boolean }[];
  orders: { id: string; orderNumber: string; customerName: string; totalCents: number; status: string }[];
  customers: { id: string; name: string | null; email: string; orders: number; spentCents: number }[];
};

const EMPTY: AdminSearchResults = { products: [], orders: [], customers: [] };
const TAKE = 5;

export async function searchAdmin(term: string): Promise<AdminSearchResults> {
  const q = term.trim();
  // Below two characters the result set is meaningless and the query is a
  // near-full scan. The palette shows its navigation list instead.
  if (q.length < 2) return EMPTY;

  const [products, orders, customers] = await Promise.all([
    prisma.product.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { sku: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true, name: true, slug: true, priceCents: true, isActive: true },
      take: TAKE,
      orderBy: { updatedAt: "desc" },
    }),

    prisma.order.findMany({
      where: {
        OR: [
          { orderNumber: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { customerName: { contains: q, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        orderNumber: true,
        customerName: true,
        totalCents: true,
        status: true,
      },
      take: TAKE,
      orderBy: { placedAt: "desc" },
    }),

    prisma.user.findMany({
      where: {
        role: "CUSTOMER",
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        name: true,
        email: true,
        _count: { select: { orders: true } },
        // Lifetime spend on the same definition the dashboard uses, so the
        // palette cannot quote a different number from the customer page.
        orders: { where: SUCCESSFUL_ORDER, select: { totalCents: true } },
      },
      take: TAKE,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return {
    products,
    orders,
    customers: customers.map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      orders: c._count.orders,
      spentCents: c.orders.reduce((sum, o) => sum + o.totalCents, 0),
    })),
  };
}
