import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getAdminOrNull } from "@/lib/auth-guards";
import {
  digitalStorage,
  ALLOWED_DIGITAL_TYPES,
  MAX_DIGITAL_BYTES,
} from "@/lib/storage/digital";

/**
 * Upload or replace the purchasable file behind a product.
 *
 * Authorisation is re-checked here rather than inherited from the admin
 * layout: a route handler is an independent entry point that can be called
 * directly, so it must never assume a page guard ran first.
 *
 * The upload goes to private storage — see lib/storage/digital.ts — and only
 * the resulting handle is written to the database. The handle is not returned
 * to the browser either: the admin UI needs a filename and a size to render,
 * and nothing more. A `storageKey` in a JSON response would end up in a
 * browser's network log.
 *
 * Replacing a file deletes the previous object only after the new row is
 * committed, so a failed upload can never leave a product with no file.
 */

/** Bodies are large; this must run on the Node runtime, not the edge. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const admin = await getAdminOrNull();
  if (!admin) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  if (!digitalStorage.isConfigured) {
    return NextResponse.json(
      { error: "File storage is not configured. Set the Cloudinary variables." },
      { status: 503 },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data." }, { status: 400 });
  }

  const productId = formData.get("productId");
  if (typeof productId !== "string" || !productId) {
    return NextResponse.json({ error: "No product was specified." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file was received." }, { status: 400 });
  }

  if (file.size === 0) {
    return NextResponse.json({ error: "That file is empty." }, { status: 400 });
  }

  if (file.size > MAX_DIGITAL_BYTES) {
    const limit = Math.round(MAX_DIGITAL_BYTES / (1024 * 1024));
    return NextResponse.json(
      { error: `That file is larger than ${limit}MB.` },
      { status: 413 },
    );
  }

  const contentType = file.type || "application/octet-stream";
  if (!ALLOWED_DIGITAL_TYPES.includes(contentType as (typeof ALLOWED_DIGITAL_TYPES)[number])) {
    return NextResponse.json(
      { error: `${contentType} isn't an accepted file type.` },
      { status: 415 },
    );
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, asset: { select: { id: true, storageKey: true } } },
  });
  if (!product) {
    return NextResponse.json({ error: "That product no longer exists." }, { status: 404 });
  }

  const filename = file.name || "download";
  const previousKey = product.asset?.storageKey ?? null;

  let stored;
  try {
    stored = await digitalStorage.upload({
      bytes: Buffer.from(await file.arrayBuffer()),
      filename,
    });
  } catch (error) {
    console.error("[admin] digital upload failed", productId, error);
    return NextResponse.json({ error: "The upload failed. Try again." }, { status: 502 });
  }

  await prisma.digitalAsset.upsert({
    where: { productId },
    create: {
      productId,
      storageKey: stored.storageKey,
      filename,
      contentType,
      bytes: stored.bytes,
    },
    update: {
      storageKey: stored.storageKey,
      filename,
      contentType,
      bytes: stored.bytes,
    },
  });

  // Only now is the old object safe to remove. Best-effort: an orphan in
  // storage costs pennies, a product with no file costs a sale.
  if (previousKey && previousKey !== stored.storageKey) {
    await digitalStorage.remove(previousKey);
  }

  return NextResponse.json({
    filename,
    contentType,
    bytes: stored.bytes,
  });
}
