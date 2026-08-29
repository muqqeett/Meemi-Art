import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-guards";
import { digitalStorage, MAX_PROXY_BYTES } from "@/lib/storage/digital";
import { findDownloadableAsset } from "@/lib/queries/download-access";

/**
 * The only way a purchased file can be reached.
 *
 * Authorisation is a single database question, answered by
 * `findDownloadableAsset`: is there an unrevoked `DigitalAccess` joining *this*
 * user to *this* product through an order that is COMPLETED and a payment that
 * is PAID? The user id comes from the session and never from the request, so
 * changing `productId` in the URL cannot reach another customer's purchase.
 *
 * Everything that fails answers 404 rather than 403. Telling an unauthorised
 * caller that a product exists but is not theirs is information they have not
 * earned, and it turns this endpoint into a catalogue oracle.
 *
 * ── Why the bytes are streamed rather than redirected ───────────────────────
 *
 * Buyers were receiving PDFs that saved as text. Two causes compounded:
 * `buildObjectName` strips the extension when it builds the Cloudinary
 * public_id, and the signed URL was generated with an empty `format`, so
 * Cloudinary served `Content-Disposition: attachment; filename="file"` — no
 * extension anywhere for the browser to go on.
 *
 * Cloudinary cannot be made to fix both halves: its download API names every
 * file `file.<ext>`, and the `fl_attachment:<name>` flag rejects a name
 * containing a dot. So the file is fetched server-side and streamed back with
 * headers this route controls, which is what makes the buyer's original
 * filename and a real `application/pdf` possible at once.
 *
 * The signed URL is created, used and discarded inside `openStream`. It never
 * reaches the browser at all — strictly better than the previous redirect,
 * which handed it over.
 */

export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/download/[productId]">,
) {
  const { productId } = await params;

  const user = await getCurrentUser();
  if (!user) return notFound();

  const access = await findDownloadableAsset(user.id, productId);
  if (!access) return notFound();

  if (!digitalStorage.isConfigured) {
    return unavailable();
  }

  // Recorded before the transfer: a stream the customer cancels half way
  // through is still an attempt they made. Failure to record must never deny a
  // paid download.
  try {
    await prisma.digitalAccess.update({
      where: { id: access.accessId },
      data: { downloadCount: { increment: 1 }, lastDownloadAt: new Date() },
    });
  } catch (error) {
    console.warn("[download] could not record download", access.accessId, error);
  }

  // Very large files go back to a redirect: a serverless function is a poor
  // pipe for them. The extension is still correct there; only the original
  // filename is lost.
  if (access.bytes > MAX_PROXY_BYTES) {
    let url: string;
    try {
      url = digitalStorage.signedDownloadUrl(
        access.storageKey,
        access.filename,
        access.contentType,
      );
    } catch (error) {
      // The storage key must never appear in a log line — it is the one value
      // that would let someone construct their own signed URL.
      console.error("[download] could not sign URL for", access.accessId, error);
      return unavailable();
    }
    return NextResponse.redirect(url, {
      status: 302,
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  }

  let upstream: Response;
  try {
    upstream = await digitalStorage.openStream(access.storageKey);
  } catch (error) {
    console.error("[download] could not open stream for", access.accessId, error);
    return unavailable();
  }

  if (!upstream.ok || !upstream.body) {
    console.error("[download] storage returned", upstream.status, "for", access.accessId);
    return unavailable();
  }

  const length = upstream.headers.get("content-length");

  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": access.contentType || "application/octet-stream",
      "Content-Disposition": contentDisposition(access.filename),
      ...(length ? { "Content-Length": length } : {}),
      // Nothing about a purchased file belongs in a shared cache.
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

/**
 * RFC 6266 / RFC 5987 `Content-Disposition`.
 *
 * Two forms on purpose. `filename=` carries an ASCII-only fallback with quotes
 * and backslashes removed, because an unescaped quote there would end the value
 * early and truncate the name — or let a crafted filename inject a header
 * parameter. `filename*=` carries the real name percent-encoded as UTF-8, which
 * is what current browsers actually read, so accents and non-Latin scripts
 * survive intact. CR and LF are stripped first: they are the characters that
 * would allow header injection outright.
 */
function contentDisposition(filename: string): string {
  const safe = filename.replace(/[\r\n]/g, "").trim() || "download";

  const ascii = safe.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "");
  const encoded = encodeURIComponent(safe);

  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

function unavailable() {
  return NextResponse.json(
    { error: "Downloads are temporarily unavailable." },
    { status: 503 },
  );
}

function notFound() {
  return NextResponse.json({ error: "Not found." }, { status: 404 });
}
