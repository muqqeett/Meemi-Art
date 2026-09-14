import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { prisma } from "@/lib/prisma";
import { SUCCESSFUL_ORDER_ITEM } from "@/lib/queries/successful-order";

/**
 * The purchase rule behind customer projects.
 *
 * An order item for this product, on an order belonging to this user, that is
 * COMPLETED with a PAID payment — `SUCCESSFUL_ORDER_ITEM`, the same definition
 * every sales metric uses, narrowed to one user and product. A refund moves the
 * order and the payment to REFUNDED, so a refunded purchase stops matching.
 *
 * This is a read, not a mutation, and it is not reachable from a browser. The
 * user id it receives always comes from the session (submission) or from the
 * project row itself (moderation) — never from a request.
 */

export function successfulPurchaseWhere(userId: string, productId: string): Prisma.OrderItemWhereInput {
  return { AND: [SUCCESSFUL_ORDER_ITEM, { productId, order: { userId } }] };
}

export async function hasSuccessfulProjectPurchase(
  db: Pick<typeof prisma, "orderItem">,
  userId: string,
  productId: string,
): Promise<boolean> {
  const purchase = await db.orderItem.findFirst({
    where: successfulPurchaseWhere(userId, productId),
    select: { id: true },
  });
  return purchase !== null;
}
