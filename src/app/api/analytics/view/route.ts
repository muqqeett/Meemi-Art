import { after } from "next/server";

import { recordProductView } from "@/lib/analytics/product-views";
import { isLikelyBot, isPrefetch } from "@/lib/analytics/traffic";
import { clientAddress } from "@/lib/payments/ip-allowlist";
import { isSameOriginRequest } from "@/lib/projects/mutations";

/**
 * Product page view beacon.
 *
 * The product page sends one small POST here once the page is actually visible
 * (see `ProductViewBeacon`). The response is always the same empty 204, sent
 * before any database work: whether the view was recorded, de-duplicated,
 * rate-limited or ignored is never revealed, and a slow database cannot slow
 * the page. The recording rules live in `lib/analytics/product-views.ts`.
 *
 * Cookieless. Nothing is set on the response, and only an anonymous key that
 * rotates daily is stored — never the address or user agent it was made from.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** `{"productId":"…"}` with room to spare; anything bigger is not a beacon. */
const MAX_BODY_BYTES = 256;
const PRODUCT_ID = /^[a-z0-9]{8,40}$/;

const done = () => new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  const headers = request.headers;
  if (!isSameOriginRequest(headers.get("origin"), headers.get("host"))) return done();
  if (isPrefetch(headers)) return done();

  const userAgent = headers.get("user-agent");
  if (isLikelyBot(userAgent)) return done();

  if (Number(headers.get("content-length") ?? "0") > MAX_BODY_BYTES) return done();
  const text = await request.text().catch(() => "");
  if (text.length > MAX_BODY_BYTES) return done();

  let productId: unknown;
  try {
    productId = (JSON.parse(text) as { productId?: unknown })?.productId;
  } catch {
    return done();
  }
  if (typeof productId !== "string" || !PRODUCT_ID.test(productId)) return done();

  // A missing forwarding header (local development) still yields a daily key,
  // shared by everyone without one — never a stored address.
  const address = clientAddress(headers) ?? "unknown";
  const id = productId;
  after(() => recordProductView({ productId: id, address, userAgent }));

  return done();
}
