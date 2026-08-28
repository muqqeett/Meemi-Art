import "server-only";

import { prisma } from "@/lib/prisma";
import {
  sendEmail,
  purchaseReadyTemplate,
  adminNewOrderTemplate,
  orderRefundedTemplate,
  emailConfig,
  EMAIL_TEMPLATES,
  type OrderEmailData,
} from "@/lib/email";

/**
 * Order email dispatch.
 *
 * Every function here is fire-and-forget from the caller's point of view: an
 * email problem must never fail an order that has already been paid for. They
 * are always called *after* the database transaction commits.
 *
 * Duplicate suppression is by natural key on the order id, so a redelivered
 * webhook cannot mail the customer twice even if it somehow reaches this far.
 */

/** Loads the shape the templates need. Returns null if the order vanished. */
async function loadOrder(orderId: string): Promise<OrderEmailData | null> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      orderNumber: true,
      email: true,
      customerName: true,
      placedAt: true,
      subtotalCents: true,
      discountCents: true,
      couponCode: true,
      totalCents: true,
      currency: true,
      items: {
        select: {
          name: true,
          quantity: true,
          totalCents: true,
          imageUrl: true,
        },
      },
    },
  });

  if (!order) return null;

  return {
    orderNumber: order.orderNumber,
    email: order.email,
    customerName: order.customerName,
    placedAt: order.placedAt,
    lines: order.items,
    subtotalCents: order.subtotalCents,
    discountCents: order.discountCents,
    couponCode: order.couponCode,
    totalCents: order.totalCents,
    currency: order.currency,
  };
}

/**
 * Tell the customer their files are ready, and tell the shop it made a sale.
 *
 * Called from the webhook route only, after payment has been verified. There
 * is no path that sends this before money has arrived.
 */
export async function sendPurchaseReadyEmail(orderId: string): Promise<void> {
  try {
    const data = await loadOrder(orderId);
    if (!data) return;

    await sendEmail({
      ...purchaseReadyTemplate(data),
      template: EMAIL_TEMPLATES.purchaseReady,
      dedupeKey: `purchase-ready:${orderId}`,
    });

    // Only when the shop has somewhere to send it. With no ADMIN_EMAIL and no
    // reply-to configured, this is skipped rather than sent to an empty string.
    if (emailConfig.adminEmail) {
      await sendEmail({
        ...adminNewOrderTemplate(data),
        template: EMAIL_TEMPLATES.adminNewOrder,
        dedupeKey: `admin-new-order:${orderId}`,
      });
    }
  } catch (error) {
    // The order is already paid and access already granted; mail is best-effort.
    console.error("[email] purchase notifications failed", orderId, error);
  }
}

/** Sent when the provider confirms a refund. Access has already been revoked. */
export async function sendOrderRefundedEmail(orderId: string): Promise<void> {
  try {
    const data = await loadOrder(orderId);
    if (!data) return;

    await sendEmail({
      ...orderRefundedTemplate(data),
      template: EMAIL_TEMPLATES.orderRefunded,
      dedupeKey: `order-refunded:${orderId}`,
    });
  } catch (error) {
    console.error("[email] refund notification failed", orderId, error);
  }
}
