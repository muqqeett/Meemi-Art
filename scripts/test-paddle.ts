/**
 * Exercises the Paddle driver itself — signature verification, event parsing
 * and the arithmetic that decides whether a payment is accepted.
 *
 * Runs entirely offline. No Paddle credentials, no network, no money: the
 * webhook secret is set to a known test value in this process and the payloads
 * are signed with it exactly as Paddle would, so `paddleProvider.verifyWebhook`
 * runs its real HMAC path against real bodies.
 *
 * This is the half of the pipeline that cannot be checked by a sandbox
 * transaction alone — a live test proves the happy path, while the cases that
 * matter most for security are the ones a real Paddle account will never send
 * you: a forged signature, a replayed body, a mismatched amount.
 *
 * The database half (`applyEvent`) is covered by scripts/test-payments.ts.
 * Nothing here writes to the database.
 *
 *   npx tsx scripts/test-paddle.ts
 */
import "dotenv/config";
import { createHmac } from "node:crypto";

// Set before importing the driver: lib/payments/config.ts reads the
// environment once at module load, so this has to happen first. A dynamic
// import below is what keeps the ordering honest under ESM hoisting.
const SECRET = "pdl_ntfset_test_harness_secret_value";

// Assigned, never defaulted with `||=`. This harness must be hermetic: if it
// inherited the developer's real `.env` it would both depend on ambient
// credentials and — once those are live — contradict the `PADDLE_ENV=sandbox`
// forced below, tripping the environment-mismatch guard and failing for a
// reason that has nothing to do with the code under test. It also means a real
// live API key is never loaded into this process at all.
process.env.PADDLE_WEBHOOK_SECRET = SECRET;
process.env.PADDLE_API_KEY = "test_harness_key_not_used_offline";
process.env.PADDLE_ENV = "sandbox";
process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN = "test_harness_client_token_offline";

/**
 * Imported inside `main()`, not at the top: the driver's config module reads
 * `PADDLE_WEBHOOK_SECRET` once when it loads, and a static import would be
 * hoisted above the assignments above it.
 */
type PaddleProvider = (typeof import("../src/lib/payments/providers/paddle"))["paddleProvider"];
let paddleProvider: PaddleProvider;

let failures = 0;
function check(label: string, pass: boolean, detail?: unknown) {
  if (!pass) failures++;
  console.log(
    `  ${pass ? "PASS" : "FAIL"}  ${label}${detail === undefined ? "" : `  → ${JSON.stringify(detail)}`}`,
  );
}

/** Signs a body the way Paddle does: HMAC-SHA256 over "<ts>:<raw body>". */
function sign(raw: string, ts = Math.floor(Date.now() / 1000)): Headers {
  const h1 = createHmac("sha256", SECRET).update(`${ts}:${raw}`).digest("hex");
  return new Headers({ "paddle-signature": `ts=${ts};h1=${h1}` });
}

function transactionEvent(over: {
  type?: string;
  eventId?: string;
  orderId?: string | null;
  subtotal?: string;
  discount?: string;
  currency?: string;
  customerId?: string;
}) {
  return {
    event_id: over.eventId ?? "evt_test_0001",
    event_type: over.type ?? "transaction.paid",
    data: {
      id: "txn_test_0001",
      customer_id: over.customerId ?? "ctm_test_0001",
      currency_code: over.currency ?? "USD",
      custom_data:
        over.orderId === null ? {} : { order_id: over.orderId ?? "order_abc", order_number: "MA-2026-000001" },
      details: {
        totals: {
          subtotal: over.subtotal ?? "4500",
          discount: over.discount ?? "0",
          tax: "900",
          total: "5400",
        },
      },
      payments: [
        { method_details: { card: { type: "visa", last4: "4242" } }, error_code: null },
      ],
    },
  };
}

async function verify(body: unknown, headers?: Headers) {
  const raw = JSON.stringify(body);
  return paddleProvider.verifyWebhook(raw, headers ?? sign(raw));
}

async function main() {
  ({ paddleProvider } = await import("../src/lib/payments/providers/paddle"));

  console.log("\n=== signature verification ===");

  const good = await verify(transactionEvent({}));
  check("a correctly signed delivery is accepted", good.ok);

  const noHeader = await verify(transactionEvent({}), new Headers());
  check("a delivery with no signature is rejected", !noHeader.ok);

  const malformed = await verify(transactionEvent({}), new Headers({ "paddle-signature": "garbage" }));
  check("a malformed signature header is rejected", !malformed.ok);

  const rawBody = JSON.stringify(transactionEvent({}));
  const wrongSig = await paddleProvider.verifyWebhook(
    rawBody,
    new Headers({ "paddle-signature": `ts=${Math.floor(Date.now() / 1000)};h1=${"0".repeat(64)}` }),
  );
  check("a forged signature is rejected", !wrongSig.ok);

  // Sign one body, deliver another — the classic parse-and-reserialise bug.
  const tampered = await paddleProvider.verifyWebhook(
    JSON.stringify(transactionEvent({ subtotal: "1" })),
    sign(rawBody),
  );
  check("a body edited after signing is rejected", !tampered.ok);

  const stale = await paddleProvider.verifyWebhook(
    rawBody,
    sign(rawBody, Math.floor(Date.now() / 1000) - 60 * 60),
  );
  check("a replayed old delivery is rejected", !stale.ok);

  console.log("\n=== checkout guards (no network reached) ===");

  // Both of these refuse before a single request is made, which is why they can
  // be exercised without credentials. A product with no catalogue price has no
  // price Paddle would honour, and inventing an inline one here would put a
  // second source of truth on the charge.
  const baseCheckout = {
    orderId: "order_abc",
    orderNumber: "MA-2026-000001",
    amountCents: 4500,
    subtotalCents: 4500,
    discountCents: 0,
    currency: "USD",
    customerEmail: "buyer@example.invalid",
    customerName: "Test Buyer",
    successUrl: "https://example.invalid/ok",
    cancelUrl: "https://example.invalid/cancel",
  };

  let refusedUnsynced = false;
  try {
    await paddleProvider.createCheckout({
      ...baseCheckout,
      lines: [
        { productId: "p1", name: "Unsynced piece", unitAmountCents: 4500, quantity: 1, providerPriceId: null },
      ],
    });
  } catch (error) {
    refusedUnsynced = error instanceof Error && /not synced/i.test(error.message);
  }
  check("a product with no catalogue price cannot be sold", refusedUnsynced);

  console.log("\n=== event parsing ===");

  const paid = await verify(transactionEvent({ type: "transaction.paid" }));
  check(
    "transaction.paid is a success",
    paid.ok && paid.event.kind === "payment_succeeded",
    paid.ok ? paid.event.kind : paid.error,
  );

  const completed = await verify(
    transactionEvent({ type: "transaction.completed", eventId: "evt_test_0002" }),
  );
  check(
    "transaction.completed is also a success",
    completed.ok && completed.event.kind === "payment_succeeded",
  );

  const failed = await verify(transactionEvent({ type: "transaction.payment_failed" }));
  check("transaction.payment_failed is a failure", failed.ok && failed.event.kind === "payment_failed");

  const unknown = await verify(transactionEvent({ type: "subscription.created" }));
  check("an unrelated event type is ignored, not guessed", unknown.ok && unknown.event.kind === "ignored");

  console.log("\n=== the amount Paddle is charging ===");

  // Paddle is merchant of record: `total` includes the tax it collects and
  // remits, which our order never records. Comparing totals would reject every
  // taxed order, so the driver must report subtotal - discount.
  const taxed = await verify(transactionEvent({ subtotal: "4500", discount: "0" }));
  check(
    "tax is excluded from the verified amount",
    taxed.ok && taxed.event.amountCents === 4500,
    taxed.ok ? taxed.event.amountCents : taxed.error,
  );

  const discounted = await verify(transactionEvent({ subtotal: "4500", discount: "500" }));
  check(
    "a coupon discount is subtracted from the verified amount",
    discounted.ok && discounted.event.amountCents === 4000,
    discounted.ok ? discounted.event.amountCents : discounted.error,
  );

  const currency = await verify(transactionEvent({ currency: "eur" }));
  check(
    "currency is normalised to upper case for comparison",
    currency.ok && currency.event.currency === "EUR",
  );

  console.log("\n=== customer and order identity ===");

  const identified = await verify(transactionEvent({}));
  check(
    "the Paddle customer id is captured separately from our order",
    identified.ok &&
      identified.event.providerCustomerId === "ctm_test_0001" &&
      identified.event.orderId === "order_abc",
  );

  console.log("\n=== refunds ===");

  // An adjustment is its own object. It does NOT echo the transaction's
  // custom_data, so there is no order id on it — the order has to be recovered
  // from transaction_id. This is the case that silently broke refunds before.
  const refund = {
    event_id: "evt_test_refund",
    event_type: "adjustment.created",
    data: {
      id: "adj_test_0001",
      action: "refund",
      status: "approved",
      transaction_id: "txn_test_0001",
      customer_id: "ctm_test_0001",
      currency_code: "USD",
      totals: { subtotal: "4500", discount: "0", tax: "900", total: "5400" },
    },
  };

  const refunded = await verify(refund);
  check(
    "an approved refund is a refund",
    refunded.ok && refunded.event.kind === "payment_refunded",
    refunded.ok ? refunded.event.kind : refunded.error,
  );
  check(
    "a refund carries no order id, so the transaction id must be present",
    refunded.ok && refunded.event.orderId === null && refunded.event.providerTransactionId === "txn_test_0001",
    refunded.ok
      ? { orderId: refunded.event.orderId, txn: refunded.event.providerTransactionId }
      : refunded.error,
  );

  const pending = await verify({
    ...refund,
    event_id: "evt_test_refund_pending",
    data: { ...refund.data, status: "pending_approval" },
  });
  check(
    "a refund still awaiting approval does not revoke access",
    pending.ok && pending.event.kind === "ignored",
    pending.ok ? pending.event.kind : pending.error,
  );

  const credit = await verify({
    ...refund,
    event_id: "evt_test_credit",
    data: { ...refund.data, action: "credit" },
  });
  check(
    "a credit adjustment is not treated as a card refund",
    credit.ok && credit.event.kind === "ignored",
  );

  const chargeback = await verify({
    ...refund,
    event_id: "evt_test_chargeback",
    data: { ...refund.data, action: "chargeback" },
  });
  check("a chargeback revokes access like a refund", chargeback.ok && chargeback.event.kind === "payment_refunded");

  console.log(
    failures === 0
      ? "\nAll Paddle driver checks passed.\n"
      : `\n${failures} check(s) FAILED.\n`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
