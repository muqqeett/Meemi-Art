/**
 * Exercises the payment pipeline against the real database and the real
 * verification code — every branch listed in section 27.
 *
 * Nothing here is mocked except the money. Events go through the sandbox
 * provider's HMAC verification and then through `applyEvent`, which is the
 * same function the webhook route calls, so a pass here means the guarantee
 * ("no file before payment") is enforced by the code that ships, not by a
 * test double.
 *
 * Creates its own throwaway user, product and orders, and removes them all.
 */
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import { applyEvent } from "../src/lib/payments/payment-service";
import {
  sandboxProvider,
  signSandboxPayload,
  SANDBOX_SIGNATURE_HEADER,
} from "../src/lib/payments/providers/sandbox";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const EMAIL = "payments-harness@meemiart.invalid";
const OTHER_EMAIL = "payments-other@meemiart.invalid";
const PRICE = 4500;

let failures = 0;
function check(label: string, pass: boolean, detail?: unknown) {
  if (!pass) failures++;
  console.log(
    `  ${pass ? "PASS" : "FAIL"}  ${label}${detail === undefined ? "" : `  → ${JSON.stringify(detail)}`}`,
  );
}

/** Builds a correctly signed delivery, exactly as the sandbox page would. */
function signed(body: Record<string, unknown>) {
  const raw = JSON.stringify(body);
  const ts = String(Math.floor(Date.now() / 1000));
  const headers = new Headers({
    [SANDBOX_SIGNATURE_HEADER]: `${ts}:${signSandboxPayload(raw, ts)}`,
  });
  return { raw, headers };
}

async function deliver(body: Record<string, unknown>) {
  const { raw, headers } = signed(body);
  const verified = await sandboxProvider.verifyWebhook(raw, headers);
  if (!verified.ok) return { verified: false as const, error: verified.error };
  const result = await applyEvent(verified.event);
  return { verified: true as const, result };
}

async function cleanup() {
  await prisma.user.deleteMany({ where: { email: { in: [EMAIL, OTHER_EMAIL] } } });
  await prisma.product.deleteMany({ where: { sku: { startsWith: "HARNESS-" } } });
  await prisma.paymentEvent.deleteMany({ where: { eventId: { startsWith: "evt_harness" } } });
}

async function makeOrder(userId: string, productId: string, totalCents = PRICE) {
  const order = await prisma.order.create({
    data: {
      orderNumber: `MA-TEST-${randomBytes(4).toString("hex")}`,
      userId,
      email: EMAIL,
      customerName: "Payments Harness",
      status: "PENDING",
      subtotalCents: totalCents,
      discountCents: 0,
      totalCents,
      currency: "USD",
      items: {
        create: {
          productId,
          name: "Harness Product",
          slug: "harness-product",
          sku: "HARNESS-1",
          unitPriceCents: totalCents,
          quantity: 1,
          totalCents,
        },
      },
      payment: {
        create: { provider: "sandbox", status: "PENDING", amountCents: totalCents, currency: "USD" },
      },
    },
    select: { id: true },
  });
  return order.id;
}

async function accessCount(orderId: string) {
  return prisma.digitalAccess.count({ where: { orderId } });
}

async function main() {
  await cleanup();

  const category = await prisma.category.findFirst({ select: { id: true } });
  if (!category) throw new Error("Seed the categories first: npm run db:seed");

  const user = await prisma.user.create({
    data: { email: EMAIL, name: "Payments Harness", role: "CUSTOMER" },
    select: { id: true },
  });
  const other = await prisma.user.create({
    data: { email: OTHER_EMAIL, name: "Someone Else", role: "CUSTOMER" },
    select: { id: true },
  });

  const product = await prisma.product.create({
    data: {
      name: "Harness Product",
      slug: `harness-${randomBytes(3).toString("hex")}`,
      brand: "Meemi Art",
      sku: "HARNESS-1",
      description: "A product used only by the payment test harness.",
      categoryId: category.id,
      priceCents: PRICE,
      isActive: true,
      asset: {
        create: {
          storageKey: "harness/never-signed",
          filename: "harness.pdf",
          contentType: "application/pdf",
          bytes: 1024,
        },
      },
    },
    select: { id: true },
  });

  console.log("\n=== signature verification ===");

  const goodBody = { eventId: "evt_harness_sig", type: "payment.succeeded", orderId: "x" };
  const raw = JSON.stringify(goodBody);
  const ts = String(Math.floor(Date.now() / 1000));

  const noHeader = await sandboxProvider.verifyWebhook(raw, new Headers());
  check("delivery with no signature is rejected", !noHeader.ok);

  const wrongSig = await sandboxProvider.verifyWebhook(
    raw,
    new Headers({ [SANDBOX_SIGNATURE_HEADER]: `${ts}:${"0".repeat(64)}` }),
  );
  check("delivery with a wrong signature is rejected", !wrongSig.ok);

  const tampered = await sandboxProvider.verifyWebhook(
    JSON.stringify({ ...goodBody, amountCents: 1 }),
    new Headers({ [SANDBOX_SIGNATURE_HEADER]: `${ts}:${signSandboxPayload(raw, ts)}` }),
  );
  check("a body edited after signing is rejected", !tampered.ok);

  console.log("\n=== successful payment ===");

  const paidOrder = await makeOrder(user.id, product.id);
  check("no access exists before payment", (await accessCount(paidOrder)) === 0);

  const success = await deliver({
    eventId: "evt_harness_ok",
    type: "payment.succeeded",
    orderId: paidOrder,
    transactionId: "sbx_ok",
    amountCents: PRICE,
    currency: "USD",
  });
  check(
    "verified success is applied",
    success.verified && success.result.status === "applied",
    success.verified ? success.result : success.error,
  );

  const afterPaid = await prisma.order.findUnique({
    where: { id: paidOrder },
    select: { status: true, completedAt: true, payment: { select: { status: true, paidAt: true } } },
  });
  check("order is COMPLETED", afterPaid?.status === "COMPLETED");
  check("payment is PAID", afterPaid?.payment?.status === "PAID");
  check("paidAt was recorded", afterPaid?.payment?.paidAt !== null);
  check("exactly one access grant exists", (await accessCount(paidOrder)) === 1);

  console.log("\n=== duplicate delivery ===");

  const replay = await deliver({
    eventId: "evt_harness_ok",
    type: "payment.succeeded",
    orderId: paidOrder,
    transactionId: "sbx_ok",
    amountCents: PRICE,
    currency: "USD",
  });
  check(
    "a replayed event is reported as duplicate",
    replay.verified && replay.result.status === "duplicate",
    replay.verified ? replay.result : replay.error,
  );
  check("and grants no second access", (await accessCount(paidOrder)) === 1);

  console.log("\n=== wrong amount and currency ===");

  const shortOrder = await makeOrder(user.id, product.id);
  const short = await deliver({
    eventId: "evt_harness_short",
    type: "payment.succeeded",
    orderId: shortOrder,
    transactionId: "sbx_short",
    amountCents: 1,
    currency: "USD",
  });
  check(
    "an underpaid event is refused",
    short.verified && short.result.status === "rejected",
    short.verified ? short.result : short.error,
  );
  check("and grants no access", (await accessCount(shortOrder)) === 0);

  const currencyOrder = await makeOrder(user.id, product.id);
  const wrongCurrency = await deliver({
    eventId: "evt_harness_currency",
    type: "payment.succeeded",
    orderId: currencyOrder,
    transactionId: "sbx_cur",
    amountCents: PRICE,
    currency: "PKR",
  });
  check(
    "a mismatched currency is refused",
    wrongCurrency.verified && wrongCurrency.result.status === "rejected",
    wrongCurrency.verified ? wrongCurrency.result : wrongCurrency.error,
  );
  check("and grants no access", (await accessCount(currencyOrder)) === 0);

  console.log("\n=== failure and cancellation ===");

  const failOrder = await makeOrder(user.id, product.id);
  await deliver({
    eventId: "evt_harness_fail",
    type: "payment.failed",
    orderId: failOrder,
    transactionId: "sbx_fail",
    reason: "card_declined",
  });
  const afterFail = await prisma.order.findUnique({
    where: { id: failOrder },
    select: { status: true, payment: { select: { status: true, failureReason: true } } },
  });
  check("failed payment marks the payment FAILED", afterFail?.payment?.status === "FAILED");
  check("order stays PENDING so it can be retried", afterFail?.status === "PENDING");
  check("no access granted on failure", (await accessCount(failOrder)) === 0);

  const cancelOrder = await makeOrder(user.id, product.id);
  await deliver({
    eventId: "evt_harness_cancel",
    type: "payment.cancelled",
    orderId: cancelOrder,
    transactionId: "sbx_cancel",
  });
  const afterCancel = await prisma.order.findUnique({
    where: { id: cancelOrder },
    select: { status: true },
  });
  check("cancelled payment cancels the order", afterCancel?.status === "CANCELLED");
  check("no access granted on cancellation", (await accessCount(cancelOrder)) === 0);

  console.log("\n=== refund ===");

  await deliver({
    eventId: "evt_harness_refund",
    type: "payment.refunded",
    orderId: paidOrder,
    transactionId: "sbx_ok",
    amountCents: PRICE,
    currency: "USD",
  });
  const afterRefund = await prisma.order.findUnique({
    where: { id: paidOrder },
    select: { status: true, payment: { select: { status: true } } },
  });
  check("refund marks the order REFUNDED", afterRefund?.status === "REFUNDED");
  check("refund marks the payment REFUNDED", afterRefund?.payment?.status === "REFUNDED");

  const revoked = await prisma.digitalAccess.findFirst({
    where: { orderId: paidOrder },
    select: { revokedAt: true, revokedReason: true },
  });
  check("access is revoked, not deleted", revoked !== null && revoked.revokedAt !== null, revoked?.revokedReason);

  console.log("\n=== download authorisation ===");

  // The query the download route runs, verbatim.
  const authorise = (userId: string, productId: string) =>
    prisma.digitalAccess.findFirst({
      where: {
        userId,
        productId,
        revokedAt: null,
        order: { status: "COMPLETED" },
        orderItem: { order: { payment: { status: "PAID" } } },
      },
      select: { id: true },
    });

  check("a refunded purchase no longer authorises a download", (await authorise(user.id, product.id)) === null);

  const freshOrder = await makeOrder(user.id, product.id);
  await deliver({
    eventId: "evt_harness_ok2",
    type: "payment.succeeded",
    orderId: freshOrder,
    transactionId: "sbx_ok2",
    amountCents: PRICE,
    currency: "USD",
  });
  check("a paid purchase authorises a download", (await authorise(user.id, product.id)) !== null);
  check(
    "another customer is not authorised for the same product",
    (await authorise(other.id, product.id)) === null,
  );

  const unpaid = await makeOrder(other.id, product.id);
  check(
    "an unpaid order authorises nothing",
    (await authorise(other.id, product.id)) === null,
    { unpaid },
  );

  console.log("\n=== unknown order ===");
  const unknown = await deliver({
    eventId: "evt_harness_unknown",
    type: "payment.succeeded",
    orderId: "does-not-exist",
    amountCents: PRICE,
    currency: "USD",
  });
  check(
    "an event for an unknown order is refused",
    unknown.verified && unknown.result.status === "rejected",
    unknown.verified ? unknown.result : unknown.error,
  );

  await cleanup();

  console.log(
    failures === 0 ? "\nAll payment checks passed.\n" : `\n${failures} CHECK(S) FAILED.\n`,
  );
  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
