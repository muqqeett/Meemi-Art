import { NextResponse } from "next/server";

import { finalizeDigitalFileUpload, signDigitalFileUpload } from "@/lib/admin/product-uploads";
import { isSameOriginRequest } from "@/lib/projects/mutations";

/**
 * Upload or replace the purchasable file behind a product — the two server
 * halves of a direct browser upload.
 *
 *   step "sign"      checks the admin, the product, the declared type and size,
 *                    and returns parameters signed for one private raw upload
 *   step "finalize"  verifies what Cloudinary stored — private, raw, in the
 *                    digital folder, within the size cap, and content that
 *                    really is the declared type — then writes the product's
 *                    `DigitalAsset` row and removes the file it replaced
 *
 * The file itself never passes through this function. It used to, and on
 * Vercel any body above 4.5 MB was refused before this code ran — see
 * `lib/storage/admin-uploads.ts`. Every rule lives in
 * `lib/admin/product-uploads.ts`; this handler checks the origin, bounds the
 * body and translates results into responses.
 *
 * The storage key is still never returned: the admin UI needs a filename and a
 * size to render, and nothing more.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A product id, a storage key, a filename and a type, with room to spare. */
const MAX_BODY_BYTES = 4_000;

function reply(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request.headers.get("origin"), request.headers.get("host"))) {
    return reply({ error: "Not allowed." }, 403);
  }

  if (Number(request.headers.get("content-length") ?? "0") > MAX_BODY_BYTES) {
    return reply({ error: "That request is too large." }, 413);
  }
  const text = await request.text().catch(() => "");
  if (text.length > MAX_BODY_BYTES) return reply({ error: "That request is too large." }, 413);

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return reply({ error: "Please try again." }, 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return reply({ error: "Please try again." }, 400);
  }

  const { step, ...payload } = body as Record<string, unknown>;
  const result =
    step === "sign"
      ? await signDigitalFileUpload(payload)
      : step === "finalize"
        ? await finalizeDigitalFileUpload(payload)
        : null;

  if (!result) return reply({ error: "Unknown request." }, 400);
  if (!result.ok) return reply({ error: result.error }, result.status);
  return reply(result.data);
}
