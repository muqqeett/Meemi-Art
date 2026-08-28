import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-guards";
import { digitalStorage } from "@/lib/storage/digital";
import { findDownloadableAsset } from "@/lib/queries/download-access";

/**
 * The only way a purchased file can be reached.
 *
 * Authorisation is a single database question, and the answer is a row that
 * only the webhook can create: is there an unrevoked `DigitalAccess` joining
 * *this* user to *this* product through an order that is COMPLETED and a
 * payment that is PAID?
 *
 * Because the user id comes from the session and never from the request,
 * changing `productId` in the URL cannot reach another customer's purchase —
 * it simply fails to match a row belonging to the caller. There is no order id
 * or user id in the URL to tamper with in the first place.
 *
 * Everything that fails answers 404 rather than 403. Telling an unauthorised
 * caller that a product exists but is not theirs is information they have not
 * earned, and it turns this endpoint into a catalogue oracle.
 */

export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/download/[productId]">,
) {
  const { productId } = await params;

  const user = await getCurrentUser();
  if (!user) return notFound();

  // The whole authorisation decision, in `lib/queries/download-access.ts`.
  // Shared with the test harness so the rule that is verified is literally the
  // rule that runs here.
  const access = await findDownloadableAsset(user.id, productId);
  if (!access) return notFound();

  if (!digitalStorage.isConfigured) {
    return NextResponse.json(
      { error: "Downloads are temporarily unavailable." },
      { status: 503 },
    );
  }

  let url: string;
  try {
    url = digitalStorage.signedDownloadUrl(access.storageKey);
  } catch (error) {
    // The storage key must never appear in a log line — it is the one value
    // that would let someone construct their own signed URL.
    console.error("[download] could not sign URL for access", access.accessId, error);
    return NextResponse.json(
      { error: "Downloads are temporarily unavailable." },
      { status: 503 },
    );
  }

  // Recorded after the URL is successfully signed, so a failed attempt does
  // not inflate the count. Failure to record must not deny a paid download.
  try {
    await prisma.digitalAccess.update({
      where: { id: access.accessId },
      data: { downloadCount: { increment: 1 }, lastDownloadAt: new Date() },
    });
  } catch (error) {
    console.warn("[download] could not record download", access.accessId, error);
  }

  // 302, and never cached: the target expires in minutes, so a stored redirect
  // would send the next click at a dead URL.
  return NextResponse.redirect(url, {
    status: 302,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

function notFound() {
  return NextResponse.json({ error: "Not found." }, { status: 404 });
}
