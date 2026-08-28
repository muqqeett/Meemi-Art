import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { paymentConfig, paymentUrl, productionDeployment } from "@/lib/payments/config";
import type {
  CheckoutSession,
  CreateCheckoutInput,
  PaymentProvider,
  VerifiedEvent,
  WebhookResult,
} from "@/lib/payments/types";

/**
 * A local provider that exercises the real pipeline without a merchant account.
 *
 * This is not a mock in the usual sense — it does not shortcut anything. It
 * issues a transaction id, sends the customer to a hosted page (ours, at
 * /checkout/sandbox), and the order is only completed when a *signed webhook*
 * arrives and passes the same verification, amount check and idempotency
 * guard that Paddle's deliveries pass through. The one thing it fakes is the
 * money.
 *
 * That makes every branch in section 27 testable today: success, failure,
 * cancellation, replayed delivery, bad signature, wrong amount, wrong
 * currency, and refund.
 *
 * The signing secret is generated per process when unset, so a deployment that
 * forgets to configure a real provider cannot have its webhook forged by
 * someone who read this file.
 */

const SECRET =
  process.env.SANDBOX_WEBHOOK_SECRET || randomBytes(32).toString("hex");

/** Exposed so the sandbox checkout page can sign its own callbacks. */
export function signSandboxPayload(rawBody: string, timestamp: string): string {
  return createHmac("sha256", SECRET).update(`${timestamp}:${rawBody}`).digest("hex");
}

export const SANDBOX_SIGNATURE_HEADER = "x-sandbox-signature";

type SandboxEventBody = {
  eventId?: unknown;
  type?: unknown;
  orderId?: unknown;
  transactionId?: unknown;
  amountCents?: unknown;
  currency?: unknown;
  reason?: unknown;
};

const KIND_BY_TYPE: Record<string, VerifiedEvent["kind"]> = {
  "payment.succeeded": "payment_succeeded",
  "payment.failed": "payment_failed",
  "payment.cancelled": "payment_cancelled",
  "payment.refunded": "payment_refunded",
};

class SandboxProvider implements PaymentProvider {
  readonly name = "sandbox";
  readonly label = "Sandbox (no real money)";
  readonly isTestMode = true;

  /**
   * Usable everywhere except a production deployment.
   *
   * This driver completes orders and grants downloads without taking a penny.
   * That is exactly what it is for locally, and exactly what must never happen
   * on meemiart.com — so on a production deployment it reports itself
   * unconfigured and checkout refuses, rather than quietly giving files away
   * while every dashboard looks healthy.
   */
  get isConfigured(): boolean {
    return !productionDeployment;
  }

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession> {
    const providerTransactionId = `sbx_${randomBytes(12).toString("hex")}`;

    // The amount rides in the URL only so the test page can display it. It is
    // never trusted: the webhook's amount is what gets compared against the
    // order, and the order total is re-read from the database there.
    const url = new URL(paymentUrl("/checkout/sandbox"));
    url.searchParams.set("txn", providerTransactionId);
    url.searchParams.set("order", input.orderId);

    return { providerTransactionId, checkoutUrl: url.toString() };
  }

  async verifyWebhook(rawBody: string, headers: Headers): Promise<WebhookResult> {
    const header = headers.get(SANDBOX_SIGNATURE_HEADER);
    if (!header) return { ok: false, error: "Missing signature header." };

    const [timestamp, signature] = header.split(":");
    if (!timestamp || !signature) {
      return { ok: false, error: "Malformed signature header." };
    }

    const expected = signSandboxPayload(rawBody, timestamp);
    const given = Buffer.from(signature, "utf8");
    const want = Buffer.from(expected, "utf8");

    // Length check first: timingSafeEqual throws on a mismatch rather than
    // returning false, and the length itself is not a secret.
    if (given.length !== want.length || !timingSafeEqual(given, want)) {
      return { ok: false, error: "Signature does not match." };
    }

    let body: SandboxEventBody;
    try {
      body = JSON.parse(rawBody) as SandboxEventBody;
    } catch {
      return { ok: false, error: "Body is not valid JSON." };
    }

    const type = typeof body.type === "string" ? body.type : "";
    const eventId = typeof body.eventId === "string" ? body.eventId : "";
    if (!eventId) return { ok: false, error: "Event has no id." };

    return {
      ok: true,
      event: {
        eventId,
        type,
        kind: KIND_BY_TYPE[type] ?? "ignored",
        orderId: typeof body.orderId === "string" ? body.orderId : null,
        // The sandbox has no customer directory, so there is no provider id to
        // record. Left null rather than invented — a fake `ctm_...` would sit
        // on a real user row and outlive the test.
        providerCustomerId: null,
        providerTransactionId:
          typeof body.transactionId === "string" ? body.transactionId : null,
        amountCents:
          typeof body.amountCents === "number" && Number.isInteger(body.amountCents)
            ? body.amountCents
            : null,
        currency:
          typeof body.currency === "string"
            ? body.currency.toUpperCase()
            : paymentConfig.currency,
        cardBrand: "sandbox",
        cardLast4: "4242",
        failureReason: typeof body.reason === "string" ? body.reason : null,
      },
    };
  }
}

export const sandboxProvider = new SandboxProvider();
