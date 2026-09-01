import "server-only";

import { prisma } from "@/lib/prisma";
import { SUCCESSFUL_ORDER } from "@/lib/queries/successful-order";

/**
 * Everything the admin order screen knows about one order beyond the order row
 * itself: the provider's webhook ledger, the digital grants, the admin audit
 * trail, and a small profile of the customer.
 *
 * Four aggregates in one `Promise.all` — one round trip, no N+1. Nothing here
 * is fetched per item.
 *
 * ── On truthfulness ────────────────────────────────────────────────────────
 *
 * Every event this feeds is a stored timestamp. The schema turns out to record
 * far more history than the old screen showed:
 *
 *   Order          placedAt, completedAt, cancelledAt, refundedAt
 *   Payment        createdAt, paidAt, failedAt, cancelledAt, refundedAt
 *   PaymentEvent   processedAt + type   (the provider's own delivered events)
 *   DigitalAccess  grantedAt, lastDownloadAt, revokedAt
 *   AdminActivity  createdAt + action   (which human did what)
 *
 * So the timeline needs no reconstruction and no inference. What the database
 * cannot say, the timeline does not claim — see the limitation noted on
 * `downloadCount` below.
 */

export type OrderIntelligence = Awaited<ReturnType<typeof getOrderIntelligence>>;

export async function getOrderIntelligence(input: {
  orderId: string;
  userId: string;
}) {
  const [events, activity, access, customer] = await Promise.all([
    /**
     * The provider's delivered webhooks for this order.
     *
     * `PaymentEvent.orderId` is a plain indexed column, not a relation — the
     * table is an append-only ledger keyed on `(provider, eventId)` — so it is
     * queried directly rather than included through the order.
     */
    prisma.paymentEvent.findMany({
      where: { orderId: input.orderId },
      orderBy: { processedAt: "asc" },
      select: { id: true, provider: true, type: true, processedAt: true },
    }),

    /** What an admin did to this order, and who. */
    prisma.adminActivity.findMany({
      where: { entityType: "order", entityId: input.orderId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        action: true,
        createdAt: true,
        meta: true,
        actor: { select: { name: true, email: true } },
      },
    }),

    /**
     * The delivery grants. One row per order item that was fulfilled, so a
     * missing row is itself the signal that an item was never delivered.
     */
    prisma.digitalAccess.findMany({
      where: { orderId: input.orderId },
      orderBy: { grantedAt: "asc" },
      select: {
        id: true,
        orderItemId: true,
        grantedAt: true,
        revokedAt: true,
        revokedReason: true,
        downloadCount: true,
        lastDownloadAt: true,
        product: { select: { id: true, name: true, slug: true } },
      },
    }),

    /**
     * A small profile of the buyer, for context on this screen only.
     *
     * Spend uses the canonical `SUCCESSFUL_ORDER` filter so the figure agrees
     * with the dashboard and analytics rather than being a fourth definition
     * of revenue. The order count is deliberately the same population.
     */
    prisma.user
      .findUnique({
        where: { id: input.userId },
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
          _count: { select: { orders: { where: SUCCESSFUL_ORDER } } },
        },
      })
      .then(async (user) => {
        if (!user) return null;
        const spend = await prisma.order.aggregate({
          where: { userId: input.userId, ...SUCCESSFUL_ORDER },
          _sum: { totalCents: true },
        });
        return { ...user, spentCents: spend._sum.totalCents ?? 0 };
      }),
  ]);

  return { events, activity, access, customer };
}
