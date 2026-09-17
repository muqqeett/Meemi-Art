import { NextResponse } from "next/server";

import { finalizeProductImageUpload, signProductImageUpload } from "@/lib/admin/product-uploads";
import { getAdminOrNull } from "@/lib/auth-guards";
import { isSameOriginRequest } from "@/lib/projects/mutations";
import {
  getStorageProvider,
  ALLOWED_IMAGE_TYPES,
  MAX_UPLOAD_BYTES,
  sniffImageType,
} from "@/lib/storage";

/**
 * Product image upload.
 *
 * Authorization is re-checked here rather than inherited from the admin layout:
 * a route handler is an independent entry point and can be called directly, so
 * it must never assume a page guard ran first.
 *
 * ── Two modes ──────────────────────────────────────────────────────────────
 *
 * JSON (`step: "sign"` / `step: "finalize"`) is the normal path: the browser
 * uploads the photo straight to Cloudinary with parameters signed here, and
 * finalize verifies what was stored. Photos used to be relayed through this
 * function, and on Vercel any body above 4.5 MB was refused before the handler
 * ran — see `lib/storage/admin-uploads.ts`.
 *
 * Multipart is the original relay, kept for the local-disk driver used when
 * Cloudinary is not configured (sign answers `mode: "relay"` then). There the
 * browser-declared MIME type is treated as a claim only — every file is
 * sniffed from its own magic bytes, and the sniffed type is what gets stored.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A filename, a type, a size or a storage key, with room to spare. */
const MAX_JSON_BYTES = 4_000;

function reply(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

async function handleDirectUploadStep(request: Request) {
  if (!isSameOriginRequest(request.headers.get("origin"), request.headers.get("host"))) {
    return reply({ error: "Not allowed." }, 403);
  }
  if (Number(request.headers.get("content-length") ?? "0") > MAX_JSON_BYTES) {
    return reply({ error: "That request is too large." }, 413);
  }
  const text = await request.text().catch(() => "");
  if (text.length > MAX_JSON_BYTES) return reply({ error: "That request is too large." }, 413);

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
      ? await signProductImageUpload(payload)
      : step === "finalize"
        ? await finalizeProductImageUpload(payload)
        : null;

  if (!result) return reply({ error: "Unknown request." }, 400);
  if (!result.ok) return reply({ error: result.error }, result.status);
  return reply(result.data);
}

export async function POST(request: Request) {
  if ((request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) {
    return handleDirectUploadStep(request);
  }

  const admin = await getAdminOrNull();
  if (!admin) {
    // 404 rather than 403: consistent with the admin pages, which do not
    // confirm the area exists to non-admins.
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file was received." }, { status: 400 });
  }

  if (file.size === 0) {
    return NextResponse.json({ error: "That file is empty." }, { status: 400 });
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    const limit = Math.round(MAX_UPLOAD_BYTES / (1024 * 1024));
    return NextResponse.json(
      { error: `That image is larger than ${limit}MB. Try exporting it smaller.` },
      { status: 413 },
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  const sniffed = sniffImageType(bytes);
  if (!sniffed) {
    return NextResponse.json(
      { error: "That file isn't a JPEG, PNG, WebP or AVIF image." },
      { status: 415 },
    );
  }

  if (!ALLOWED_IMAGE_TYPES.includes(sniffed as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    return NextResponse.json(
      { error: `${sniffed} images aren't supported.` },
      { status: 415 },
    );
  }

  try {
    const provider = getStorageProvider();
    const stored = await provider.upload({
      bytes,
      filename: file.name || "product-image",
      contentType: sniffed,
    });

    return NextResponse.json({
      url: stored.url,
      key: stored.key,
      width: stored.width,
      height: stored.height,
      bytes: stored.bytes,
      format: stored.format,
    });
  } catch (error) {
    console.error("[admin/upload]", error);
    return NextResponse.json(
      { error: "Image upload failed. Please try again." },
      { status: 500 },
    );
  }
}
