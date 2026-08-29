import "server-only";

import { prisma } from "@/lib/prisma";
import { paymentConfig } from "@/lib/payments/config";
import { paddleApi, PaddleApiError } from "@/lib/payments/paddle-api";
import { applyEvent } from "@/lib/payments/payment-service";
import type { VerifiedEvent } from "@/lib/payments/types";

/**
 * Reconcile a Paddle transaction that was paid but never delivered a webhook.
 *
 * This exists because a webhook can be missed — a destination pointed at the
 * wrong host, an outage, a deploy mid-delivery — and the customer is then left
 * looking at "Awaiting payment" for money Paddle has already captured.
 *
 * It is **not** a "mark as paid" button, and the distinction is the whole
 * design. Nothing here trusts the operator, the browser, or a typed-in amount.
 * The only input is a transaction id; every fact used to decide the outcome is
 * read back from Paddle's API over an authenticated server-side call. That is
 * strictly stronger evidence than a webhook signature: a signature proves a
 * payload came from Paddle, whereas this asks Paddle directly, right now, what
 * the state of the transaction is.
 *
 * Fulfilment itself is delegated to `applyEvent` — the same function the
 * webhook calls. Nothing about granting access is reimplemented here, so the
 * amount check, the currency check, the single-grant-per-order-item rule and
 * the idempotency guard are all the ones already proven by the test harness.
 * This module's job is only to establish, safely, that a success event is
 * warranted.
 *
 * Idempotent twice over: the synthesised event id is derived from the
 * transaction id, so a second run collides on `PaymentEvent(provider, eventId)`;
 * and `applyEvent` independently short-circuits an order that is already
 * COMPLETED with a PAID payment. A webhook arriving later is absorbed the same
 * way.
 */

/** Transaction states in which money has actually been taken. */
const PAID_STATUSES = new Set(["completed", "paid"]);

/** States that must never be reconciled. */
const REFUSED_STATUSES = new Set(["canceled", "cancelled", "past_due", "draft", "ready", "billed"]);

export type ReconcileCheck = { label: string; ok: boolean; detail: string };

export type ReconcileReport = {
  ok: boolean;
  /** What happened to the order, once every check passed. */
  outcome: "fulfilled" | "already-fulfilled" | "refused" | "error";
  message: string;
  checks: ReconcileCheck[];
  transaction?: {
    id: string;
    status: string;
    paymentStatus: string;
    amountCents: number | null;
    currency: string | null;
    orderId: string | null;
  };
  order?: {
    orderNumber: string;
    status: string;
    paymentStatus: string;
    totalCents: number;
    currency: string;
  };
};

type PaddleTransaction = {
  id?: string;
  status?: string;
  currency_code?: string;
  customer_id?: string;
  custom_data?: Record<string, unknown> | null;
  details?: { totals?: Record<string, unknown> };
  items?: { quantity?: number; price?: { id?: string; product_id?: string } }[];
  payments?: {
    status?: string;
    amount?: string;
    error_code?: string | null;
    method_details?: { type?: string; card?: { type?: string; last4?: string } };
  }[];
};

function asMinorUnits(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value !== "string" || !/^-?\d+$/.test(value)) return null;
  return Number.parseInt(value, 10);
}

/** Pre-tax, post-discount — the figure the order records. */
function netOf(totals: Record<string, unknown> | undefined): number | null {
  if (!totals) return null;
  const subtotal = asMinorUnits(totals.subtotal);
  if (subtotal === null) return null;
  return subtotal - (asMinorUnits(totals.discount) ?? 0);
}

export async function reconcilePaddleTransaction(
  rawTransactionId: string,
): Promise<ReconcileReport> {
  const checks: ReconcileCheck[] = [];
  const add = (label: string, ok: boolean, detail: string) => {
    checks.push({ label, ok, detail });
    return ok;
  };

  const transactionId = rawTransactionId.trim();

  if (!/^txn_[a-z0-9]+$/i.test(transactionId)) {
    return {
      ok: false,
      outcome: "refused",
      message: "That does not look like a Paddle transaction id (txn_…).",
      checks,
    };
  }

  if (paymentConfig.driver !== "paddle" || !paddleApi.isConfigured) {
    return {
      ok: false,
      outcome: "error",
      message: "Paddle is not configured on this deployment.",
      checks,
    };
  }

  // ---- 1. Ask Paddle -------------------------------------------------------
  let txn: PaddleTransaction;
  try {
    txn = await paddleApi.get<PaddleTransaction>(`/transactions/${transactionId}`);
  } catch (error) {
    const detail =
      error instanceof PaddleApiError && error.status === 404
        ? "Paddle does not know this transaction."
        : "Paddle could not be reached, or refused the request.";
    add("Transaction fetched from Paddle", false, detail);
    return { ok: false, outcome: "error", message: detail, checks };
  }

  const status = (txn.status ?? "").toLowerCase();
  add("Transaction fetched from Paddle", true, `status "${status}"`);

  // ---- 2. Status and capture ----------------------------------------------
  if (REFUSED_STATUSES.has(status) || !PAID_STATUSES.has(status)) {
    add("Transaction is completed", false, `status is "${status}"`);
    return {
      ok: false,
      outcome: "refused",
      message: `Refusing: the transaction is "${status}", not a completed payment.`,
      checks,
    };
  }
  add("Transaction is completed", true, status);

  // Several attempts can sit on one transaction — this one carries a captured
  // payment alongside two card errors. A captured payment must be found, not
  // assumed from the first entry.
  const captured = (txn.payments ?? []).find(
    (p) => (p.status ?? "").toLowerCase() === "captured",
  );
  if (!captured) {
    add("A payment was captured", false, "no captured payment on this transaction");
    return {
      ok: false,
      outcome: "refused",
      message: "Refusing: Paddle shows no captured payment on this transaction.",
      checks,
    };
  }
  add(
    "A payment was captured",
    true,
    `${(txn.payments ?? []).length} attempt(s), one captured`,
  );

  // ---- 3. Not reversed -----------------------------------------------------
  // A refunded transaction can still read "completed"; the reversal lives on
  // an adjustment. Reconciling one would hand back a file that has been
  // refunded, so this is checked explicitly rather than inferred.
  try {
    const adjustments = await paddleApi.get<
      { action?: string; status?: string }[]
    >(`/adjustments?transaction_id=${transactionId}`);
    const reversing = (adjustments ?? []).filter(
      (a) =>
        ["refund", "chargeback", "chargeback_warning"].includes((a.action ?? "").toLowerCase()) &&
        (a.status ?? "approved").toLowerCase() === "approved",
    );
    if (reversing.length > 0) {
      add("Not refunded or charged back", false, `${reversing.length} reversal(s) found`);
      return {
        ok: false,
        outcome: "refused",
        message: "Refusing: this transaction has been refunded or charged back.",
        checks,
      };
    }
    add("Not refunded or charged back", true, "no reversing adjustments");
  } catch {
    // Availability of this endpoint must not silently weaken the check.
    add("Not refunded or charged back", false, "could not check adjustments");
    return {
      ok: false,
      outcome: "error",
      message: "Could not confirm the transaction has not been refunded. Not reconciling.",
      checks,
    };
  }

  // ---- 4. Our order id -----------------------------------------------------
  const custom = (txn.custom_data ?? {}) as Record<string, unknown>;
  const orderId = typeof custom.order_id === "string" ? custom.order_id : null;
  if (!orderId) {
    add("Carries a Meemi Art order id", false, "custom_data.order_id is missing");
    return {
      ok: false,
      outcome: "refused",
      message: "Refusing: the transaction carries no Meemi Art order id.",
      checks,
    };
  }
  add("Carries a Meemi Art order id", true, orderId);

  // ---- 5. The local order --------------------------------------------------
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true, orderNumber: true, status: true, totalCents: true, currency: true,
      payment: { select: { status: true, providerTransactionId: true } },
      items: { select: { productId: true, quantity: true } },
    },
  });

  if (!order || !order.payment) {
    add("Local order found", false, "no order with that id");
    return {
      ok: false,
      outcome: "refused",
      message: "Refusing: no Meemi Art order matches that transaction.",
      checks,
    };
  }
  add("Local order found", true, `${order.orderNumber} (${order.status})`);

  const amountCents = netOf(txn.details?.totals);
  const currency = (txn.currency_code ?? "").toUpperCase() || null;

  const snapshot = {
    transaction: {
      id: transactionId,
      status,
      paymentStatus: "captured",
      amountCents,
      currency,
      orderId,
    },
    order: {
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.payment.status,
      totalCents: order.totalCents,
      currency: order.currency,
    },
  };

  // ---- 6/7. Money ----------------------------------------------------------
  if (amountCents === null || amountCents !== order.totalCents) {
    add("Amount matches the order", false, `Paddle ${amountCents ?? "?"} vs order ${order.totalCents}`);
    return {
      ok: false,
      outcome: "refused",
      message: "Refusing: the amount Paddle captured does not match this order.",
      checks,
      ...snapshot,
    };
  }
  add("Amount matches the order", true, `${amountCents} minor units`);

  if (currency !== order.currency) {
    add("Currency matches the order", false, `Paddle ${currency} vs order ${order.currency}`);
    return {
      ok: false,
      outcome: "refused",
      message: "Refusing: the currency does not match this order.",
      checks,
      ...snapshot,
    };
  }
  add("Currency matches the order", true, currency ?? "—");

  // ---- 8. The right product ------------------------------------------------
  // Every price charged must be the synced catalogue price of a product that is
  // actually on this order. Without this, a transaction for a different product
  // could be reconciled against a cheaper order of the same value.
  const chargedPriceIds = (txn.items ?? [])
    .map((item) => item.price?.id)
    .filter((id): id is string => Boolean(id));

  const orderProductIds = order.items
    .map((item) => item.productId)
    .filter((id): id is string => Boolean(id));

  const orderProducts = await prisma.product.findMany({
    where: { id: { in: orderProductIds } },
    select: { id: true, paddlePriceId: true, paddleProductId: true },
  });
  const expectedPriceIds = new Set(
    orderProducts.map((p) => p.paddlePriceId).filter((id): id is string => Boolean(id)),
  );

  const unexpected = chargedPriceIds.filter((id) => !expectedPriceIds.has(id));
  if (chargedPriceIds.length === 0 || unexpected.length > 0) {
    add(
      "Charged prices belong to this order",
      false,
      unexpected.length > 0 ? `unexpected price(s): ${unexpected.join(", ")}` : "no priced items",
    );
    return {
      ok: false,
      outcome: "refused",
      message: "Refusing: the prices charged do not correspond to this order's products.",
      checks,
      ...snapshot,
    };
  }
  add("Charged prices belong to this order", true, chargedPriceIds.join(", "));

  // ---- 9. The right payment row -------------------------------------------
  const stored = order.payment.providerTransactionId;
  if (stored && stored !== transactionId) {
    add("Payment record matches", false, `order is linked to ${stored}`);
    return {
      ok: false,
      outcome: "refused",
      message: "Refusing: this order is already linked to a different Paddle transaction.",
      checks,
      ...snapshot,
    };
  }
  add("Payment record matches", true, stored ? "linked" : "will be linked");

  // ---- 10. Fulfil, through the same path the webhook uses ------------------
  const card = captured.method_details?.card;
  const event: VerifiedEvent = {
    // Deterministic, and namespaced so the audit trail shows how this order was
    // completed. A second run collides on the unique constraint.
    eventId: `reconcile:${transactionId}`,
    type: "admin.reconcile",
    kind: "payment_succeeded",
    orderId,
    providerTransactionId: transactionId,
    providerCustomerId: typeof txn.customer_id === "string" ? txn.customer_id : null,
    amountCents,
    currency,
    cardBrand: card?.type ?? captured.method_details?.type ?? null,
    cardLast4: card?.last4 ?? null,
    failureReason: null,
  };

  const result = await applyEvent(event);

  if (result.status === "duplicate") {
    add("Fulfilment", true, "already fulfilled — nothing changed");
    return {
      ok: true,
      outcome: "already-fulfilled",
      message: `Order ${order.orderNumber} was already fulfilled. Nothing was changed.`,
      checks,
      ...snapshot,
    };
  }

  if (result.status !== "applied") {
    const reason = result.status === "rejected" ? result.reason : "event was ignored";
    add("Fulfilment", false, reason);
    return {
      ok: false,
      outcome: "refused",
      message: `Refusing: ${reason}`,
      checks,
      ...snapshot,
    };
  }

  add("Fulfilment", true, "payment PAID, order COMPLETED, access granted");

  return {
    ok: true,
    outcome: "fulfilled",
    message: `Order ${order.orderNumber} is now complete and the download is available.`,
    checks,
    ...snapshot,
  };
}
