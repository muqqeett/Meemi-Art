import "server-only";

import { prisma } from "@/lib/prisma";
import { paymentConfig } from "@/lib/payments/config";
import { paddleProvider } from "@/lib/payments/providers/paddle";
import { sandboxProvider } from "@/lib/payments/providers/sandbox";
import type { PaymentProvider, VerifiedEvent } from "@/lib/payments/types";

/**
 * The only place an order is allowed to become paid.
 *
 * Everything here exists to make one guarantee hold: a customer never receives
 * a file that has not been paid for. That is enforced in three layers —
 *
 *   1. Only `applyEvent` grants access, and it is only reachable from the
 *      webhook route, after a signature check. Reaching the success URL does
 *      nothing; the page merely reads whatever state the webhook has written.
 *   2. The amount and currency on the event are compared against the order as
 *      stored in the database. A mismatch is refused outright.
 *   3. Grant, payment update and event record all happen in one transaction,
 *      with `PaymentEvent(provider, eventId)` unique. A replayed delivery
 *      violates that constraint, the transaction rolls back, and nothing is
 *      granted or emailed twice.
 */

export function getPaymentProvider(): PaymentProvider {
  return paymentConfig.driver === "paddle" ? paddleProvider : sandboxProvider;
}

export type ApplyResult =
  | { status: "applied"; kind: VerifiedEvent["kind"]; orderId: string }
  | { status: "duplicate" }
  | { status: "ignored"; reason: string }
  | { status: "rejected"; reason: string };

/**
 * Act on a verified webhook event.
 *
 * The caller must already have checked the signature — this function trusts
 * the event's authenticity but nothing about its contents.
 */
export async function applyEvent(event: VerifiedEvent): Promise<ApplyResult> {
  const provider = getPaymentProvider();

  if (event.kind === "ignored") {
    // Still recorded, so a replay of an uninteresting event stays cheap and
    // the audit trail shows it arrived.
    await recordIgnored(provider.name, event);
    return { status: "ignored", reason: `Unhandled event type: ${event.type}` };
  }

  const select = {
    id: true,
    userId: true,
    status: true,
    totalCents: true,
    currency: true,
    items: { select: { id: true, productId: true } },
    payment: { select: { id: true, status: true } },
  } as const;

  // Transaction events echo our order id in `custom_data`. Adjustment events —
  // refunds and chargebacks — are separate objects that carry no custom data at
  // all, so the order is recovered from the transaction id we stored when the
  // checkout was created. Without this fallback no refund could ever be
  // matched to an order, and access would stay granted after a refund.
  const order = event.orderId
    ? await prisma.order.findUnique({ where: { id: event.orderId }, select })
    : event.providerTransactionId
      ? await prisma.order.findFirst({
          where: { payment: { providerTransactionId: event.providerTransactionId } },
          select,
        })
      : null;

  if (!order) {
    return {
      status: "rejected",
      reason: event.orderId
        ? "Unknown order."
        : "Event carries neither an order id nor a known transaction id.",
    };
  }
  if (!order.payment) return { status: "rejected", reason: "Order has no payment row." };

  // Amount and currency are only meaningful for a success. A refund reports
  // the refunded amount, which may legitimately be partial.
  if (event.kind === "payment_succeeded") {
    // Paddle sends both `transaction.paid` and `transaction.completed` for a
    // one-time purchase, with different event ids, so the `PaymentEvent`
    // constraint below does not catch the pair. Whichever arrives first does
    // the work; this turns the other into a no-op rather than a second grant
    // and a second confirmation email. Order is not assumed either way.
    if (order.payment.status === "PAID" && order.status === "COMPLETED") {
      await recordIgnored(provider.name, event);
      return { status: "duplicate" };
    }

    if (event.amountCents === null) {
      return { status: "rejected", reason: "Success event carries no amount." };
    }
    if (event.amountCents !== order.totalCents) {
      return {
        status: "rejected",
        reason: `Amount mismatch: provider charged ${event.amountCents}, order is ${order.totalCents}.`,
      };
    }
    if (event.currency && event.currency !== order.currency) {
      return {
        status: "rejected",
        reason: `Currency mismatch: provider used ${event.currency}, order is ${order.currency}.`,
      };
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Written first. If this event has been seen, the unique constraint
      // throws here and nothing below runs.
      await tx.paymentEvent.create({
        data: {
          provider: provider.name,
          eventId: event.eventId,
          type: event.type,
          orderId: order.id,
        },
      });

      const now = new Date();

      // Paddle's id for the buyer, kept beside the account it belongs to. It
      // is a provider reference and nothing more: the order already decides
      // whose purchase this is, so this is never read to authorise anything.
      // Written with `updateMany` on a null guard so a customer id already
      // claimed by another row cannot collide on the unique index.
      if (event.providerCustomerId) {
        await tx.user.updateMany({
          where: { id: order.userId, paddleCustomerId: null },
          data: { paddleCustomerId: event.providerCustomerId },
        });
      }

      switch (event.kind) {
        case "payment_succeeded": {
          await tx.payment.update({
            where: { id: order.payment!.id },
            data: {
              status: "PAID",
              paidAt: now,
              providerTransactionId: event.providerTransactionId ?? undefined,
              cardBrand: event.cardBrand,
              cardLast4: event.cardLast4,
              failureReason: null,
            },
          });

          await tx.order.update({
            where: { id: order.id },
            data: { status: "COMPLETED", completedAt: now },
          });

          // One access row per purchased line. `orderItemId` is unique, so a
          // second grant for the same line cannot exist even under a race.
          for (const item of order.items) {
            if (!item.productId) continue;
            await tx.digitalAccess.create({
              data: {
                userId: order.userId,
                orderId: order.id,
                orderItemId: item.id,
                productId: item.productId,
              },
            });
          }
          break;
        }

        case "payment_failed": {
          await tx.payment.update({
            where: { id: order.payment!.id },
            data: {
              status: "FAILED",
              failedAt: now,
              failureReason: event.failureReason,
              providerTransactionId: event.providerTransactionId ?? undefined,
            },
          });
          // The order stays PENDING on purpose: the customer can retry against
          // the same order rather than accumulating abandoned ones.
          break;
        }

        case "payment_cancelled": {
          await tx.payment.update({
            where: { id: order.payment!.id },
            data: { status: "CANCELLED", cancelledAt: now },
          });
          await tx.order.update({
            where: { id: order.id },
            data: { status: "CANCELLED", cancelledAt: now },
          });
          break;
        }

        case "payment_refunded": {
          await tx.payment.update({
            where: { id: order.payment!.id },
            data: { status: "REFUNDED", refundedAt: now },
          });
          await tx.order.update({
            where: { id: order.id },
            data: { status: "REFUNDED", refundedAt: now },
          });
          // Access is suspended rather than deleted, so the purchase history
          // still shows what happened.
          await tx.digitalAccess.updateMany({
            where: { orderId: order.id, revokedAt: null },
            data: { revokedAt: now, revokedReason: "Payment refunded" },
          });
          break;
        }
      }
    });
  } catch (error) {
    if (isUniqueViolation(error)) return { status: "duplicate" };
    throw error;
  }

  return { status: "applied", kind: event.kind, orderId: order.id };
}

/**
 * Note that an event arrived without acting on it.
 *
 * `createMany` with `skipDuplicates` rather than a `create` in a try/catch: a
 * replay is the expected case here, not an exception, and letting it throw
 * writes a Prisma error into the log on every ordinary redelivery.
 */
async function recordIgnored(provider: string, event: VerifiedEvent): Promise<void> {
  await prisma.paymentEvent.createMany({
    data: [
      {
        provider,
        eventId: event.eventId,
        type: event.type,
        orderId: event.orderId,
      },
    ],
    skipDuplicates: true,
  });
}

/** Prisma's unique-constraint code, without importing the error class. */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}
