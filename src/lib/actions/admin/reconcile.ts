"use server";

import { revalidatePath } from "next/cache";

import { getAdminOrNull } from "@/lib/auth-guards";
import { reconcilePaddleTransaction, type ReconcileReport } from "@/lib/payments/reconcile";
import { sendPurchaseReadyEmail } from "@/lib/email/order-mailer";

/**
 * Admin-only reconciliation of a Paddle transaction.
 *
 * The role is re-checked here rather than relied upon from the admin layout: a
 * server action is its own entry point and can be invoked directly by anyone
 * who can read the page source.
 *
 * The action itself decides nothing about whether the money arrived — that is
 * established inside `reconcilePaddleTransaction` by asking Paddle. This
 * wrapper exists to gate it on the admin role, send the purchase email through
 * the same function the webhook uses, and write an audit line.
 */
export async function reconcileTransaction(
  transactionId: string,
): Promise<ReconcileReport> {
  const admin = await getAdminOrNull();
  if (!admin) {
    return {
      ok: false,
      outcome: "refused",
      message: "You don't have permission to do that.",
      checks: [],
    };
  }

  const report = await reconcilePaddleTransaction(transactionId);

  // Audit trail. `PaymentEvent` already records the fulfilment itself with a
  // `reconcile:` event id; this line names who asked for it, which that table
  // has no column for. No credential and no customer detail is logged.
  console.info(
    `[reconcile] admin=${admin.email} txn=${transactionId.trim()} outcome=${report.outcome}`,
  );

  // Sent outside and after fulfilment, exactly as the webhook does: the
  // purchase is already valid and a mail failure must not undo it. Only on a
  // fresh fulfilment — "already-fulfilled" means the email went out the first
  // time, so this cannot double-send.
  if (report.ok && report.outcome === "fulfilled" && report.transaction?.orderId) {
    try {
      await sendPurchaseReadyEmail(report.transaction.orderId);
    } catch (error) {
      console.error("[reconcile] fulfilled but the email failed", error);
    }
  }

  if (report.ok) {
    revalidatePath("/admin/orders");
    revalidatePath("/account/downloads");
    revalidatePath("/admin/settings");
  }

  return report;
}
