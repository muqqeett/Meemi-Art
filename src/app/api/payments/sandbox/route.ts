import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-guards";
import { paymentConfig, paymentUrl } from "@/lib/payments";
import {
  signSandboxPayload,
  SANDBOX_SIGNATURE_HEADER,
} from "@/lib/payments/providers/sandbox";

/**
 * Stands in for the payment provider while the sandbox driver is active.
 *
 * The test page posts here to say "pretend the customer paid". This does not
 * complete the order — it constructs a signed webhook delivery and posts it to
 * the real webhook endpoint, which verifies the signature, checks the amount
 * against the database and grants access. Exactly the path Paddle's delivery
 * takes.
 *
 * Doing it this way rather than calling `applyEvent` directly is the point:
 * the flow being exercised in development is the flow that runs in production,
 * including the parts that could be got wrong.
 *
 * Refuses outright unless the sandbox driver is selected, so this cannot be
 * used to conjure a paid order on a deployment wired to a real provider.
 */

export const dynamic = "force-dynamic";

type Outcome = "succeeded" | "failed" | "cancelled";

export async function POST(request: Request) {
  if (paymentConfig.driver !== "sandbox") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const body = (await request.json().catch(() => null)) as {
    orderId?: unknown;
    outcome?: unknown;
    amountCents?: unknown;
  } | null;

  const orderId = typeof body?.orderId === "string" ? body.orderId : "";
  const outcome = (typeof body?.outcome === "string" ? body.outcome : "succeeded") as Outcome;
  if (!orderId) return NextResponse.json({ error: "No order." }, { status: 400 });

  // Scoped to the caller: one signed-in tester cannot complete someone else's
  // order by posting their id.
  const order = await prisma.order.findFirst({
    where: { id: orderId, userId: user.id },
    select: {
      id: true,
      totalCents: true,
      currency: true,
      payment: { select: { providerTransactionId: true } },
    },
  });
  if (!order) return NextResponse.json({ error: "Not found." }, { status: 404 });

  // An override is allowed so the "wrong amount" case can be exercised; it
  // defaults to the true total, and the webhook rejects any mismatch.
  const amountCents =
    typeof body?.amountCents === "number" && Number.isInteger(body.amountCents)
      ? body.amountCents
      : order.totalCents;

  const payload = JSON.stringify({
    eventId: `sbx_evt_${crypto.randomUUID()}`,
    type: `payment.${outcome}`,
    orderId: order.id,
    transactionId: order.payment?.providerTransactionId ?? null,
    amountCents,
    currency: order.currency,
    reason: outcome === "failed" ? "sandbox_declined" : null,
  });

  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = signSandboxPayload(payload, timestamp);

  const response = await fetch(paymentUrl("/api/payments/webhook"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      [SANDBOX_SIGNATURE_HEADER]: `${timestamp}:${signature}`,
    },
    body: payload,
  });

  return NextResponse.json({ delivered: response.ok, status: response.status });
}
