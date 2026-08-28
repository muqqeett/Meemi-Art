import "server-only";

/**
 * Payment provider contract.
 *
 * Deliberately small, and deliberately shaped around *hosted* checkout: the
 * customer is sent to the provider, pays there, and the truth comes back over
 * a signed webhook. Nothing in this interface lets a caller mark money as
 * received — that authority belongs to `verifyWebhook` alone.
 *
 * Card numbers never enter this application. There is no field for one here,
 * and there is nowhere for one to be stored.
 *
 * Everything is server-only. `server-only` turns an accidental client import
 * into a build error rather than a leaked key.
 */

/** ISO 4217, upper case. Money is always minor units of this. */
export type Currency = string;

export type CheckoutLine = {
  /** Our product id, echoed back by the provider in custom data. */
  productId: string;
  name: string;
  /** Minor units, server-calculated. Never taken from the browser. */
  unitAmountCents: number;
  quantity: number;
  /**
   * The provider's catalogue price for this product, when it has one. Paddle
   * charges this id rather than an amount, so the figure the customer pays is
   * the one in the synced catalogue — not a number that travelled through a
   * request.
   */
  providerPriceId?: string | null;
};

export type CreateCheckoutInput = {
  orderId: string;
  orderNumber: string;
  /**
   * Minor units, after discount. What the customer must end up being charged
   * before the provider adds its own tax. Every driver has to reconcile the
   * charge it creates against this figure and refuse on a mismatch.
   */
  amountCents: number;
  /** Minor units, before discount. Sum of the lines. */
  subtotalCents: number;
  /** Minor units taken off the subtotal by a coupon. Zero when none applies. */
  discountCents: number;
  currency: Currency;
  customerEmail: string;
  customerName: string;
  lines: CheckoutLine[];
  /** Where the provider returns the customer after a completed payment. */
  successUrl: string;
  /** Where the provider returns the customer if they abandon. */
  cancelUrl: string;
};

export type CheckoutSession = {
  /** Provider's id for the attempt. Stored on Payment.providerTransactionId. */
  providerTransactionId: string;
  /** Hosted page to send the customer to. */
  checkoutUrl: string;
};

/**
 * The normalised meaning of a webhook, after signature verification.
 *
 * A provider's own vocabulary stops here: the rest of the application only
 * ever sees these five outcomes.
 */
export type PaymentEventKind =
  | "payment_succeeded"
  | "payment_failed"
  | "payment_cancelled"
  | "payment_refunded"
  /** Recognised, signed, and deliberately not acted on. */
  | "ignored";

export type VerifiedEvent = {
  /** Provider's unique id for this delivery. The idempotency key. */
  eventId: string;
  kind: PaymentEventKind;
  /** Raw provider event name, kept for the audit trail. */
  type: string;
  /** Our order id, recovered from the provider's custom data. */
  orderId: string | null;
  providerTransactionId: string | null;
  /**
   * What the provider says was actually charged, in minor units. Compared
   * against the order total before anything is granted — a mismatch is a
   * refusal, not a warning.
   */
  amountCents: number | null;
  currency: Currency | null;
  cardBrand: string | null;
  cardLast4: string | null;
  /** Provider's failure text. Never a credential. */
  failureReason: string | null;
  /**
   * The provider's own id for the buyer (Paddle `ctm_...`). Stored against the
   * user so later events can be traced, and never treated as an identity: the
   * order decides who the customer is, not this field.
   */
  providerCustomerId: string | null;
};

export type WebhookResult =
  | { ok: true; event: VerifiedEvent }
  | { ok: false; error: string };

export interface PaymentProvider {
  /** Stored on Payment.provider. Lower case, stable across deploys. */
  readonly name: string;
  /** Human-readable, for admin settings. */
  readonly label: string;
  /** False when credentials are absent, so checkout can refuse cleanly. */
  readonly isConfigured: boolean;
  /** True when pointed at the provider's sandbox rather than production. */
  readonly isTestMode: boolean;

  createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession>;

  /**
   * Verify a webhook delivery and normalise it.
   *
   * Takes the *raw* body: a re-serialised object will not match the signature.
   * Must return `{ ok: false }` for anything it cannot cryptographically
   * verify — never a best guess.
   */
  verifyWebhook(rawBody: string, headers: Headers): Promise<WebhookResult>;
}
