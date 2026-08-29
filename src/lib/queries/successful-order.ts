import "server-only";

import type { Prisma } from "@/generated/prisma/client";

/**
 * What counts as a sale.
 *
 * One definition, used by every revenue and order-count metric, because the
 * dashboard was previously carrying three slightly different ones and they
 * disagreed with each other.
 *
 * Both halves are required:
 *
 *   `status: COMPLETED`      the order reached its terminal successful state
 *   `payment.status: PAID`   money actually arrived
 *
 * Neither is sufficient alone. An order can sit at COMPLETED with a payment
 * that never cleared (a missed webhook, a hand-edited row), and a payment can
 * read PAID while its order was never completed. Both shapes are excluded, and
 * both are covered by the test harness.
 *
 * This also handles refunds without any refund-specific code. A refund sets
 * `order.status` **and** `payment.status` to REFUNDED — see the
 * `payment_refunded` branch of `applyEvent` — so a refunded purchase stops
 * matching on both counts the moment the webhook lands. There is no partial
 * refund model in the schema (no refunded-amount column exists), so no partial
 * logic is inferred here.
 *
 * PENDING, PROCESSING, CANCELLED orders, FAILED payments, and checkout
 * attempts that never produced a paid payment all fail this filter.
 */
export const SUCCESSFUL_ORDER = {
  status: "COMPLETED",
  payment: { status: "PAID" },
} as const satisfies Prisma.OrderWhereInput;

/**
 * The same rule expressed for a query over `OrderItem`, for the metrics that
 * aggregate line items rather than orders (best sellers, revenue by category).
 */
export const SUCCESSFUL_ORDER_ITEM = {
  order: SUCCESSFUL_ORDER,
} as const satisfies Prisma.OrderItemWhereInput;

/**
 * The rule as a predicate, for the two places that already hold orders in
 * memory and filter them there rather than in SQL.
 */
export function isSuccessfulOrder(order: {
  status: string;
  payment: { status: string } | null;
}): boolean {
  return order.status === "COMPLETED" && order.payment?.status === "PAID";
}
