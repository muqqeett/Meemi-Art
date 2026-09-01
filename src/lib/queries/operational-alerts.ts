import "server-only";

import { prisma } from "@/lib/prisma";
import { FAILED_EMAIL } from "@/lib/queries/email-health";

/**
 * What needs an operator's attention right now.
 *
 * Every signal below is a real state the database can be asked about, and each
 * one has somewhere to go and something to do about it. Nothing here is
 * computed to fill a slot: if a count is zero the alert does not exist, and if
 * every count is zero the dashboard says so rather than showing an empty box.
 *
 * The order of `SEVERITY` is the order an operator should care about — money
 * that may be stuck first, then undelivered goods, then everything else.
 *
 * Read-only. This module never mutates; the actions it links to are the
 * existing ones, with their existing guards.
 */

export type AlertTone = "critical" | "warning" | "info";

export type OperationalAlert = {
  id: string;
  tone: AlertTone;
  /** Rendered as "{count} {label}" — label already agrees with the count. */
  count: number;
  label: string;
  /** One line on what it means and why it matters. */
  detail: string;
  href: string;
  action: string;
};

/**
 * Every count is a single indexed aggregate — six `count` queries in one
 * round trip, no row bodies fetched. This runs on the dashboard, so it stays
 * cheap by construction rather than by convention.
 */
export async function getOperationalAlerts(): Promise<OperationalAlert[]> {
  const [
    processingPayments,
    failedEmails,
    pendingReviews,
    unsellableProducts,
    undeliveredOrders,
    paidButIncomplete,
  ] = await Promise.all([
    // Checkout was created and the provider never told us how it ended. These
    // are the ones that can still settle, which is why they are first.
    prisma.payment.count({ where: { status: "PROCESSING" } }),

    // A failed send on a digital shop usually means a customer never received
    // their download link. The filter is shared with the Email Health page, so
    // the dashboard's count and that page's can never disagree.
    prisma.emailLog.count({ where: FAILED_EMAIL }),

    // Only counts reviews actually waiting on a decision. APPROVED is the
    // column default, so this is not "every review".
    prisma.review.count({ where: { status: "PENDING" } }),

    // Published, therefore purchasable, but with no file to deliver.
    prisma.product.count({ where: { isActive: true, asset: { is: null } } }),

    // Paid and completed, but nothing was granted — the customer has been
    // charged for a file they cannot download. The worst state in the system.
    prisma.order.count({
      where: {
        status: "COMPLETED",
        payment: { status: "PAID" },
        access: { none: {} },
      },
    }),

    // Money arrived but the order never reached its terminal state, so
    // fulfilment may not have run. Distinct from the row above, which did
    // complete and still granted nothing.
    prisma.order.count({
      where: { payment: { status: "PAID" }, status: { not: "COMPLETED" } },
    }),
  ]);

  const alerts: OperationalAlert[] = [];

  if (undeliveredOrders > 0) {
    alerts.push({
      id: "undelivered",
      tone: "critical",
      count: undeliveredOrders,
      label: undeliveredOrders === 1 ? "paid order not delivered" : "paid orders not delivered",
      detail:
        "Payment cleared and the order completed, but no download was granted. The customer has paid and cannot access their file.",
      href: "/admin/orders?status=COMPLETED",
      action: "Review orders",
    });
  }

  if (paidButIncomplete > 0) {
    alerts.push({
      id: "paid-incomplete",
      tone: "critical",
      count: paidButIncomplete,
      label: paidButIncomplete === 1 ? "paid order is incomplete" : "paid orders are incomplete",
      detail:
        "The payment is marked paid but the order never reached COMPLETED, so fulfilment may not have run.",
      href: "/admin/payments",
      action: "Inspect payments",
    });
  }

  if (processingPayments > 0) {
    alerts.push({
      id: "processing",
      tone: "warning",
      count: processingPayments,
      label: processingPayments === 1 ? "payment is processing" : "payments are processing",
      detail:
        "Checkout was created and the provider has not reported the outcome. Reconciling asks the provider directly.",
      href: "/admin/payments/reconcile",
      action: "Reconcile",
    });
  }

  if (failedEmails > 0) {
    alerts.push({
      id: "failed-emails",
      tone: "warning",
      count: failedEmails,
      label: failedEmails === 1 ? "email failed to send" : "emails failed to send",
      detail:
        "The provider rejected these. On a digital shop a failed send usually means a download link never arrived.",
      href: "/admin/emails?status=FAILED",
      action: "View failures",
    });
  }

  if (unsellableProducts > 0) {
    alerts.push({
      id: "unsellable",
      tone: "warning",
      count: unsellableProducts,
      label: unsellableProducts === 1 ? "product cannot be delivered" : "products cannot be delivered",
      detail:
        "Published and purchasable, but with no digital file attached. A sale would take money for nothing.",
      href: "/admin/products?fileState=unsellable",
      action: "Fix products",
    });
  }

  if (pendingReviews > 0) {
    alerts.push({
      id: "pending-reviews",
      tone: "info",
      count: pendingReviews,
      label: pendingReviews === 1 ? "review awaits moderation" : "reviews await moderation",
      detail: "Held back from the storefront until approved or hidden.",
      href: "/admin/reviews?status=PENDING",
      action: "Moderate",
    });
  }

  return alerts;
}
