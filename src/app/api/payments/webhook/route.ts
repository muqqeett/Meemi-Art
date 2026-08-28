import { NextResponse } from "next/server";

import { applyEvent, getPaymentProvider } from "@/lib/payments";
import { checkWebhookSource } from "@/lib/payments/ip-allowlist";
import { sendPurchaseReadyEmail } from "@/lib/email/order-mailer";

/**
 * Payment provider callback. The only authority on whether money arrived.
 *
 * Order of operations matters here:
 *
 *   1. Read the body as raw text. Parsing and re-serialising would change the
 *      bytes and break the signature — this is the most common way webhook
 *      verification is silently defeated.
 *   2. Verify the signature. Anything unverified is rejected before a single
 *      field of the payload is read as meaningful.
 *   3. Hand to the payment service, which re-reads the order from the
 *      database, compares the amount and currency, and grants access inside a
 *      transaction guarded by a unique event id.
 *
 * The response is 200 for every outcome the provider should not retry —
 * including duplicates and events we deliberately ignore. Providers treat
 * non-2xx as "deliver again", so returning an error for an event that was
 * handled correctly causes an infinite redelivery loop.
 *
 * An invalid signature answers 401 and says nothing further. A verification
 * failure is either a misconfiguration or an attack, and neither deserves a
 * diagnostic.
 */

/** Never prerendered, never cached — this route must run per delivery. */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const provider = getPaymentProvider();

  // Cheap rejection before any crypto runs. Defence in depth only — the
  // signature below is the actual proof of origin, and this check fails open
  // if Paddle's IP list cannot be reached. See lib/payments/ip-allowlist.ts.
  const source = await checkWebhookSource(request.headers);
  if (!source.allowed) {
    console.warn("[webhook] rejected delivery from", source.address);
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const rawBody = await request.text();

  const verified = await provider.verifyWebhook(rawBody, request.headers);
  if (!verified.ok) {
    console.warn("[webhook] rejected delivery:", verified.error);
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  const event = verified.event;

  let result;
  try {
    result = await applyEvent(event);
  } catch (error) {
    // A genuine server fault: ask the provider to try again.
    console.error("[webhook] failed to apply event", event.eventId, error);
    return NextResponse.json({ error: "Processing failed." }, { status: 500 });
  }

  switch (result.status) {
    case "applied":
      // Email is sent outside the transaction and after it commits: the
      // purchase is already valid, and a mail failure must not roll back a
      // paid order. It is keyed on the order so a redelivery cannot send it
      // twice even if this line runs again.
      if (result.kind === "payment_succeeded") {
        await sendPurchaseReadyEmail(result.orderId);
      }
      return NextResponse.json({ received: true, status: result.kind });

    case "duplicate":
      // Already processed. 200, or the provider keeps redelivering forever.
      return NextResponse.json({ received: true, status: "duplicate" });

    case "ignored":
      return NextResponse.json({ received: true, status: "ignored" });

    case "rejected":
      // Signed, but it does not describe an order we can act on — a mismatched
      // amount, an unknown order. Logged loudly because a legitimate provider
      // should never send one.
      console.error("[webhook] refused event", event.eventId, result.reason);
      return NextResponse.json({ received: true, status: "rejected" });
  }
}
