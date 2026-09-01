"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { recordActivity } from "@/lib/admin/activity";
import { adminOrDenied, type AdminResult } from "@/lib/actions/admin/guard";
import { orderDeletionBlockedReason } from "@/lib/actions/admin/order-deletion-policy";

/**
 * Destroying an order record.
 *
 * This exists for one job: clearing checkout attempts left behind by testing
 * the payment integration. It is not a way to tidy the books, and the rules
 * below are what stop it becoming one.
 *
 * Which orders qualify — and why a PROCESSING payment does not — lives in
 * `order-deletion-policy.ts`, so the pages and this action cannot disagree.
 * A PROCESSING payment must first be resolved: reconcile it to learn the truth
 * from the provider, or cancel it with `cancelUnpaidOrder` (which itself
 * refuses to touch a PAID payment). Either leaves a state this action can act
 * on, and both are recorded.
 *
 * ── Why PaymentEvent rows are left behind ───────────────────────────────────
 *
 * `PaymentEvent.orderId` is a plain nullable column with no foreign key and no
 * cascade — deliberately, because that table is the webhook ledger. Its
 * `@@unique([provider, eventId])` constraint is what makes webhook delivery
 * idempotent. Deleting those rows to make an order disappear completely would
 * mean a replayed event is treated as new, so they stay. They are keyed on the
 * provider's event id, not on the order, and remain valid without it.
 *
 * ── Why there is no explicit transaction ────────────────────────────────────
 *
 * `OrderItem`, `Payment` and `DigitalAccess` all carry a real
 * `ON DELETE CASCADE` foreign key to `Order` (verified in the init and
 * digital-products migrations). A single `order.delete()` is therefore one
 * atomic statement that takes the dependents with it — wrapping it in
 * `$transaction` would add a round trip and guarantee nothing further.
 */

/**
 * Permanently delete one unpaid order.
 *
 * Every rule is enforced here, on the server, against rows read inside this
 * call. A non-admin invoking this directly gets the same refusal as one who
 * never saw the button.
 */
export async function deleteAdminOrder(orderId: string): Promise<AdminResult> {
  const { admin, denied } = await adminOrDenied();
  if (denied) return denied;

  if (typeof orderId !== "string" || orderId.length === 0) {
    return { ok: false, error: "No order was specified." };
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      totalCents: true,
      email: true,
      payment: { select: { status: true, providerTransactionId: true } },
      _count: { select: { items: true, access: true } },
    },
  });

  if (!order) return { ok: false, error: "That order no longer exists." };

  const blocked = orderDeletionBlockedReason(order);
  if (blocked) return { ok: false, error: blocked };

  try {
    // Logged before the delete, while the row is still readable — afterwards
    // this entry is the only remaining record that the order existed.
    await recordActivity({
      actorId: admin.id,
      action: "order.deleted",
      entityType: "order",
      entityId: order.id,
      meta: {
        orderNumber: order.orderNumber,
        orderStatus: order.status,
        paymentStatus: order.payment?.status ?? "none",
        totalCents: order.totalCents,
        items: order._count.items,
        // Kept so a deleted record can still be matched against the provider's
        // dashboard if a question comes up later. It is an identifier, not a
        // credential — Paddle prints it in its own UI.
        providerTransactionId: order.payment?.providerTransactionId ?? null,
      },
    });

    // One statement. `OrderItem`, `Payment` and `DigitalAccess` follow via
    // their ON DELETE CASCADE constraints.
    await prisma.order.delete({ where: { id: order.id } });

    revalidatePath("/admin/orders");
    revalidatePath(`/admin/orders/${order.orderNumber}`);
    revalidatePath("/admin");
    revalidatePath("/account/orders");

    return { ok: true, message: "Test order deleted successfully." };
  } catch (error) {
    // The provider's own message and Prisma's internals both stay on the
    // server; the admin gets something they can act on.
    console.error("[admin] deleteAdminOrder", order.orderNumber, error);
    return {
      ok: false,
      error: "Unable to delete this order. Please try again.",
    };
  }
}
