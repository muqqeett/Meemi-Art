import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { paymentConfig } from "@/lib/payments/config";
import { paddleApi } from "@/lib/payments/paddle-api";
import type {
  CheckoutSession,
  CreateCheckoutInput,
  PaymentProvider,
  VerifiedEvent,
  WebhookResult,
} from "@/lib/payments/types";

/**
 * Paddle Billing driver.
 *
 * Paddle is the merchant of record: it sells to the customer, calculates and
 * remits sales tax, and owns the chargeback. Three consequences shape this
 * file.
 *
 * **Tax sits outside our figures.** The amount we ask for is our pre-tax
 * price; Paddle adds tax at its checkout, so what the customer pays is usually
 * more. Verification therefore works on `subtotal - discount`, never `total` —
 * comparing totals would reject every taxed order.
 *
 * **The catalogue is the price.** Transactions reference synced `pri_...` ids
 * rather than inline amounts, so the charge is whatever the catalogue says.
 * Nothing about the price travels through the browser, and a product that has
 * not been synced cannot be sold at all.
 *
 * **The transaction is created server-side, then handed to Paddle.js.** The
 * browser receives a transaction id, not a basket. It cannot change what is
 * being bought or what it costs; the worst it can do is decline to pay.
 *
 * Our order id travels in `custom_data.order_id` and comes back on transaction
 * events, which is how a delivery is matched to an order. Adjustment events do
 * **not** carry it — see `verifyWebhook`.
 */

/** Paddle signs as `ts=<unix>;h1=<hex hmac of "ts:body">`. */
const SIGNATURE_HEADER = "paddle-signature";

/** Deliveries older than this are refused, so a captured body cannot be replayed. */
const MAX_SIGNATURE_AGE_SECONDS = 5 * 60;

/**
 * Transaction events that mean money arrived.
 *
 * Paddle sends both `transaction.paid` and `transaction.completed` for a
 * one-time purchase, in an order that is not guaranteed. Both map to success
 * and the payment service treats the second as a duplicate, so whichever
 * lands first grants access and the other is absorbed.
 */
const KIND_BY_TYPE: Record<string, VerifiedEvent["kind"]> = {
  "transaction.completed": "payment_succeeded",
  "transaction.paid": "payment_succeeded",
  "transaction.payment_failed": "payment_failed",
  "transaction.canceled": "payment_cancelled",
};

/** Adjustment actions that take money back and must revoke access. */
const REVERSING_ACTIONS = new Set(["refund", "chargeback", "chargeback_warning"]);

type PaddleEnvelope = {
  event_id?: unknown;
  event_type?: unknown;
  data?: Record<string, unknown>;
};

type PaddleTransaction = {
  id?: string;
  customer_id?: string;
  checkout?: { url?: string };
  details?: { totals?: Record<string, unknown> };
};

function asString(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

/** Paddle sends money as a decimal string in minor units, e.g. "1999". */
function asMinorUnits(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value !== "string" || !/^-?\d+$/.test(value)) return null;
  return Number.parseInt(value, 10);
}

/**
 * What Paddle will actually take from the customer, excluding its tax.
 *
 * `subtotal` is before any discount, so a discounted transaction has to have
 * the discount subtracted before it can be compared with our order total.
 */
function netOf(totals: Record<string, unknown> | undefined): number | null {
  if (!totals) return null;
  const subtotal = asMinorUnits(totals.subtotal);
  if (subtotal === null) return null;
  const discount = asMinorUnits(totals.discount) ?? 0;
  return subtotal - discount;
}

class PaddleProvider implements PaymentProvider {
  readonly name = "paddle";
  readonly label = "Paddle";

  /**
   * Every credential present, and pointing at the same Paddle account.
   *
   * The client token is required too: without it the browser cannot open the
   * overlay, and taking an order whose checkout cannot render is worse than
   * refusing. `envMismatch` is included for the same reason — a live server
   * with a sandbox token produces a transaction the overlay will never find.
   */
  get isConfigured(): boolean {
    return Boolean(
      paymentConfig.paddle.apiKey &&
        paymentConfig.paddle.webhookSecret &&
        paymentConfig.paddle.clientToken &&
        !paymentConfig.paddle.envMismatch,
    );
  }

  get isTestMode(): boolean {
    return paymentConfig.paddle.env !== "production";
  }

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession> {
    if (!this.isConfigured) {
      throw new Error(
        "Paddle is not configured. Set PADDLE_API_KEY and PADDLE_WEBHOOK_SECRET.",
      );
    }

    // A line without a catalogue price cannot be charged the catalogue amount,
    // and inventing an inline price here would reintroduce a second source of
    // truth for what a product costs. Refuse instead.
    const unsynced = input.lines.filter((line) => !line.providerPriceId);
    if (unsynced.length > 0) {
      throw new Error(
        `Not synced to Paddle: ${unsynced.map((line) => line.name).join(", ")}.`,
      );
    }

    // A coupon has to reach Paddle as a Paddle discount, because the line
    // amounts are fixed by the catalogue and cannot be reduced in the request.
    const discountId =
      input.discountCents > 0
        ? await this.createOrderDiscount(input)
        : null;

    const transaction = await paddleApi.post<PaddleTransaction>("/transactions", {
      items: input.lines.map((line) => ({
        price_id: line.providerPriceId,
        quantity: line.quantity,
      })),
      ...(discountId ? { discount_id: discountId } : {}),
      customer: { email: input.customerEmail },
      currency_code: input.currency,
      collection_mode: "automatic",
      // Echoed back on every transaction event. The only link between Paddle's
      // world and ours.
      custom_data: {
        order_id: input.orderId,
        order_number: input.orderNumber,
      },
      checkout: { url: input.successUrl },
    });

    const id = transaction.id;
    if (!id) throw new Error("Paddle returned no transaction id.");

    // The charge Paddle actually assembled, read back from Paddle rather than
    // assumed. This is the guard that makes the discount path safe: if the
    // catalogue, the coupon or the currency produced anything other than the
    // total this server calculated, the sale is abandoned before the customer
    // ever sees a payment form. Overcharging by a silent mismatch is the one
    // failure mode worth an extra round trip to rule out.
    const charged = netOf(transaction.details?.totals);
    if (charged === null) {
      throw new Error("Paddle returned a transaction with no totals to verify.");
    }
    if (charged !== input.amountCents) {
      console.error(
        "[paddle] refusing transaction",
        id,
        `— Paddle would charge ${charged}, order is ${input.amountCents}`,
      );
      throw new Error("Paddle priced this order differently. Nothing has been charged.");
    }

    return {
      providerTransactionId: id,
      // Paddle.js opens the overlay from the transaction id; this hosted URL is
      // the fallback for a browser where the script cannot load.
      checkoutUrl: transaction.checkout?.url ?? "",
    };
  }

  /**
   * A single-use, checkout-hidden Paddle discount worth exactly our coupon.
   *
   * `enabled_for_checkout: false` keeps it out of the promo-code box — it can
   * only be applied by the transaction that names it, so it cannot leak into
   * an unrelated order.
   */
  private async createOrderDiscount(input: CreateCheckoutInput): Promise<string> {
    const discount = await paddleApi.post<{ id?: string }>("/discounts", {
      amount: String(input.discountCents),
      description: `Order ${input.orderNumber}`.slice(0, 200),
      type: "flat",
      currency_code: input.currency,
      enabled_for_checkout: false,
      recur: false,
      usage_limit: 1,
      custom_data: { order_id: input.orderId },
    });

    if (!discount.id) throw new Error("Paddle returned no discount id.");
    return discount.id;
  }

  async verifyWebhook(rawBody: string, headers: Headers): Promise<WebhookResult> {
    const secret = paymentConfig.paddle.webhookSecret;
    if (!secret) return { ok: false, error: "No webhook secret configured." };

    const header = headers.get(SIGNATURE_HEADER);
    if (!header) return { ok: false, error: "Missing Paddle-Signature header." };

    // ts=1700000000;h1=abc123...
    const parts = new Map(
      header.split(";").map((pair) => {
        const index = pair.indexOf("=");
        return [pair.slice(0, index).trim(), pair.slice(index + 1).trim()] as const;
      }),
    );

    const timestamp = parts.get("ts");
    const signature = parts.get("h1");
    if (!timestamp || !signature) {
      return { ok: false, error: "Malformed Paddle-Signature header." };
    }

    const age = Math.abs(Date.now() / 1000 - Number(timestamp));
    if (!Number.isFinite(age) || age > MAX_SIGNATURE_AGE_SECONDS) {
      return { ok: false, error: "Signature timestamp is outside the accepted window." };
    }

    const expected = createHmac("sha256", secret)
      .update(`${timestamp}:${rawBody}`)
      .digest("hex");

    const given = Buffer.from(signature, "utf8");
    const want = Buffer.from(expected, "utf8");
    if (given.length !== want.length || !timingSafeEqual(given, want)) {
      return { ok: false, error: "Signature does not match." };
    }

    let envelope: PaddleEnvelope;
    try {
      envelope = JSON.parse(rawBody) as PaddleEnvelope;
    } catch {
      return { ok: false, error: "Body is not valid JSON." };
    }

    const eventId = asString(envelope.event_id);
    const type = asString(envelope.event_type) ?? "";
    if (!eventId) return { ok: false, error: "Event has no id." };

    const data = envelope.data ?? {};
    const custom = (data.custom_data ?? {}) as Record<string, unknown>;
    const details = (data.details ?? {}) as Record<string, unknown>;

    const payments = Array.isArray(data.payments) ? data.payments : [];
    const firstPayment = (payments[0] ?? {}) as Record<string, unknown>;
    const methodDetails = (firstPayment.method_details ?? {}) as Record<string, unknown>;
    const card = (methodDetails.card ?? {}) as Record<string, unknown>;

    const base = {
      eventId,
      type,
      cardBrand: asString(card.type),
      cardLast4: asString(card.last4),
      failureReason: asString(firstPayment.error_code),
      providerCustomerId: asString(data.customer_id),
      currency: asString(data.currency_code)?.toUpperCase() ?? null,
    };

    // --- Adjustments: refunds, credits and chargebacks -----------------------
    //
    // An adjustment is its own object. It does NOT echo the transaction's
    // `custom_data`, so there is no order id to read — `data.id` is the
    // adjustment, and `data.transaction_id` is the charge being reversed. The
    // payment service resolves the order from that transaction id, which we
    // stored when the checkout was created.
    if (type.startsWith("adjustment.")) {
      const action = asString(data.action);
      const status = asString(data.status);

      // Only an approved reversal takes access away. A `pending_approval`
      // refund has not moved any money yet, and a `credit` against a manually
      // collected invoice is not a refund of a card payment.
      const reverses =
        action !== null &&
        REVERSING_ACTIONS.has(action) &&
        (status === null || status === "approved");

      return {
        ok: true,
        event: {
          ...base,
          kind: reverses ? "payment_refunded" : "ignored",
          orderId: asString(custom.order_id),
          providerTransactionId: asString(data.transaction_id),
          amountCents: netOf((data.totals ?? undefined) as Record<string, unknown> | undefined),
        },
      };
    }

    // --- Transactions --------------------------------------------------------
    return {
      ok: true,
      event: {
        ...base,
        kind: KIND_BY_TYPE[type] ?? "ignored",
        orderId: asString(custom.order_id),
        providerTransactionId: asString(data.id),
        amountCents: netOf(details.totals as Record<string, unknown> | undefined),
      },
    };
  }
}

export const paddleProvider = new PaddleProvider();
