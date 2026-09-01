import type { OrderStatus, PaymentStatus } from "@/generated/prisma/enums";

/**
 * Which orders may be destroyed, and why not when they may not.
 *
 * A plain module, not a `"use server"` one: those may only export async
 * functions, and this rule has to be callable synchronously from both the
 * server action that enforces it and the pages that decide whether to offer
 * the action at all.
 *
 * The pages calling it is a convenience. `deleteAdminOrder` re-derives the same
 * verdict from rows it reads itself, so hiding the button is never what stops a
 * deletion.
 *
 * ── Why PROCESSING is refused ───────────────────────────────────────────────
 *
 * `PROCESSING` is written the moment a provider checkout session is created —
 * see `placeOrder` in `lib/actions/checkout.ts`, which sets it alongside the
 * `providerTransactionId` *before* the customer has entered a card. It means
 * "we sent them to the provider and do not yet know what happened". Such a
 * payment can still settle: a webhook may be late or may have been missed,
 * which is exactly what `/admin/payments/reconcile` exists to resolve.
 *
 * Deleting one is not recoverable. `applyEvent` resolves an order by id, or by
 * `providerTransactionId` for refund events; with the row gone it returns
 * `"Unknown order."` and rejects the event. That fails safely — no access
 * granted, nothing crashes — but a customer who did pay would have paid for
 * nothing and there would be no record left to reconcile against.
 */

/** Order states that can never be deleted, with the reason shown to the admin. */
const PROTECTED_ORDER_STATUS: Partial<Record<OrderStatus, string>> = {
  COMPLETED: "This is a completed sale and cannot be deleted.",
  PROCESSING: "This order is mid-payment. Reconcile or cancel it first.",
  REFUNDED: "Refunded orders are financial history and cannot be deleted.",
};

/** Payment states that can never be deleted, with the reason shown. */
const PROTECTED_PAYMENT_STATUS: Partial<Record<PaymentStatus, string>> = {
  PAID: "This order has been paid for and cannot be deleted.",
  REFUNDED: "Refunded payments are financial history and cannot be deleted.",
  PROCESSING:
    "This payment may still settle. Reconcile it under Payments → Reconcile, or cancel the order first.",
};

export type DeletableOrder = {
  status: OrderStatus;
  payment: { status: PaymentStatus } | null;
};

/** `null` when the order may be deleted; otherwise the reason it may not. */
export function orderDeletionBlockedReason(order: DeletableOrder): string | null {
  const byOrder = PROTECTED_ORDER_STATUS[order.status];
  if (byOrder) return byOrder;

  if (order.payment) {
    const byPayment = PROTECTED_PAYMENT_STATUS[order.payment.status];
    if (byPayment) return byPayment;
  }

  // A whitelist, not a blacklist: a status added to the enum later is
  // protected by default rather than silently becoming deletable.
  if (order.status !== "PENDING" && order.status !== "CANCELLED") {
    return "Only unpaid pending or cancelled orders can be deleted.";
  }

  return null;
}

/** Convenience for call sites that only need the yes/no. */
export function canDeleteOrder(order: DeletableOrder): boolean {
  return orderDeletionBlockedReason(order) === null;
}
