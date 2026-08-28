import { NextResponse } from "next/server";

import { getAdminOrNull } from "@/lib/auth-guards";
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
 * The browser-declared MIME type is treated as a claim only — every file is
 * sniffed from its own magic bytes, and the sniffed type is what gets stored.
 * That stops a renamed `.exe` from being written with an image extension.
 */
export async function POST(request: Request) {
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
      { error: "Upload failed. Please try again." },
      { status: 500 },
    );
  }
}
