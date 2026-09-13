import { NextResponse } from "next/server";

import { getAdminOrNull } from "@/lib/auth-guards";
import { productVideoStorage } from "@/lib/storage";
import { ALLOWED_VIDEO_TYPES, MAX_VIDEO_BYTES } from "@/lib/storage/types";

/**
 * Product video upload — the two server halves of a direct browser upload.
 *
 *   step "sign"      checks the declared type and size, then returns
 *                    parameters signed for one upload into the video folder
 *   step "finalize"  asks Cloudinary what was actually stored and returns its
 *                    URL and key only if it passes; otherwise it is destroyed
 *
 * The file itself never passes through this function — see
 * `lib/storage/cloudinary.ts` for why, and for the three gates a video goes
 * through. Nothing here writes to the database: the returned URL and key are
 * saved with the product form, exactly as uploaded photos are.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REJECTIONS: Record<string, string> = {
  outside_folder: "That upload isn't a product video.",
  not_found: "The upload didn't reach storage. Please try again.",
  wrong_format: "Only MP4 and WebM videos are supported.",
  too_large: "Videos must be 50 MB or smaller.",
  unavailable: "Video storage is unavailable. Please try again.",
};

export async function POST(request: Request) {
  const admin = await getAdminOrNull();
  if (!admin) {
    // 404 rather than 403, consistent with the other admin upload routes.
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  if (!productVideoStorage.isConfigured) {
    return NextResponse.json(
      { error: "Product video needs Cloudinary. Set the Cloudinary variables." },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    step?: unknown;
    filename?: unknown;
    type?: unknown;
    size?: unknown;
    publicId?: unknown;
  } | null;

  if (body?.step === "sign") {
    const type = typeof body.type === "string" ? body.type : "";
    const size = typeof body.size === "number" ? body.size : 0;

    if (!(ALLOWED_VIDEO_TYPES as readonly string[]).includes(type)) {
      return NextResponse.json({ error: "Only MP4 and WebM videos are supported." }, { status: 415 });
    }
    if (size <= 0) {
      return NextResponse.json({ error: "That file is empty." }, { status: 400 });
    }
    if (size > MAX_VIDEO_BYTES) {
      return NextResponse.json({ error: "Videos must be 50 MB or smaller." }, { status: 413 });
    }

    const filename = typeof body.filename === "string" ? body.filename.slice(0, 200) : "";
    return NextResponse.json(productVideoStorage.sign(filename));
  }

  if (body?.step === "finalize") {
    const publicId = typeof body.publicId === "string" ? body.publicId : "";
    if (!publicId) {
      return NextResponse.json({ error: "No upload was specified." }, { status: 400 });
    }

    const result = await productVideoStorage.verify(publicId);
    if (!result.ok) {
      console.warn("[admin/video-upload] rejected", result.reason);
      const status = result.reason === "unavailable" ? 502 : 422;
      return NextResponse.json({ error: REJECTIONS[result.reason] }, { status });
    }

    return NextResponse.json({ url: result.url, key: result.key });
  }

  return NextResponse.json({ error: "Unknown request." }, { status: 400 });
}
