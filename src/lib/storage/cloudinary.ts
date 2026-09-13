import "server-only";

import { v2 as cloudinary } from "cloudinary";

import {
  ALLOWED_VIDEO_FORMATS,
  MAX_VIDEO_BYTES,
  buildObjectName,
  type StorageProvider,
  type StoredImage,
  type UploadInput,
} from "@/lib/storage/types";

/**
 * Cloudinary driver.
 *
 * Files are relayed through our own route handler rather than uploaded from the
 * browser, so `CLOUDINARY_API_SECRET` never reaches the client. Product photos
 * are a few megabytes at most, so the extra hop costs nothing meaningful.
 *
 * Cloudinary does the web optimisation: `quality: auto` and `fetch_format: auto`
 * mean a single stored original is served as AVIF/WebP at an appropriate
 * quality per browser, and an upload-time cap keeps absurd camera dimensions
 * out of the pipeline.
 */
const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const API_KEY = process.env.CLOUDINARY_API_KEY;
const API_SECRET = process.env.CLOUDINARY_API_SECRET;
const FOLDER = process.env.CLOUDINARY_FOLDER ?? "meemiart/products";

const configured = Boolean(CLOUD_NAME && API_KEY && API_SECRET);

if (configured) {
  cloudinary.config({
    cloud_name: CLOUD_NAME,
    api_key: API_KEY,
    api_secret: API_SECRET,
    secure: true,
  });
}

export const cloudinaryProvider: StorageProvider = {
  name: "Cloudinary",
  isConfigured: configured,

  async upload({ bytes, filename }: UploadInput): Promise<StoredImage> {
    if (!configured) {
      throw new Error(
        "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET.",
      );
    }

    const result = await new Promise<Record<string, unknown>>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: FOLDER,
          public_id: buildObjectName(filename),
          resource_type: "image",
          overwrite: false,
          // Normalise anything enormous; Cloudinary then derives per-browser
          // variants from this stored original.
          transformation: [
            { width: 2400, height: 2400, crop: "limit" },
            { quality: "auto:good" },
            { fetch_format: "auto" },
          ],
        },
        (error, uploaded) => {
          if (error) reject(new Error(error.message));
          else if (!uploaded) reject(new Error("Cloudinary returned no result."));
          else resolve(uploaded as unknown as Record<string, unknown>);
        },
      );

      stream.end(bytes);
    });

    return {
      url: String(result.secure_url),
      key: String(result.public_id),
      width: typeof result.width === "number" ? result.width : null,
      height: typeof result.height === "number" ? result.height : null,
      bytes: typeof result.bytes === "number" ? result.bytes : 0,
      format: typeof result.format === "string" ? result.format : null,
    };
  },

  async remove(key: string): Promise<void> {
    if (!configured || !key) return;
    try {
      await cloudinary.uploader.destroy(key, { resource_type: "image" });
    } catch (error) {
      // An image already gone from the CDN should never block the admin from
      // removing the row that points at it.
      console.warn("[storage/cloudinary] delete failed", key, error);
    }
  },
};

// ---------------------------------------------------------------- video

/**
 * Product video, on the same Cloudinary account as the photography.
 *
 * ── Why this is not the relay the images use ───────────────────────────────
 *
 * Photos come through our own route handler, which the comment above justifies
 * with "a few megabytes at most". A video is up to 50 MB, and serverless
 * functions refuse request bodies above 4.5 MB, so relaying one would fail in
 * production however the handler was written. The browser therefore uploads
 * the file to Cloudinary directly — but only with parameters this server has
 * signed. The secret still never leaves the server; the API key does, which is
 * what Cloudinary's signed-upload design expects (the key identifies the
 * account, the signature proves the parameters were ours).
 *
 * ── Three gates, in order ──────────────────────────────────────────────────
 *
 *   1. The browser checks the declared type, the size and the file's own
 *      first bytes before anything is sent. Convenient, and bypassable.
 *   2. The signature pins `public_id` inside the video folder and sets
 *      `allowed_formats`, which Cloudinary enforces against the file it
 *      actually receives. A tampered request fails the signature.
 *   3. `verify` asks Cloudinary what was stored — its detected format and
 *      size — and destroys the object if either is wrong, before any product
 *      can point at it.
 */
const VIDEO_FOLDER = `${FOLDER}/videos`;

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The only shape a product video id can take: the video folder, then one name
 * as `buildObjectName` produces it. Anchored and character-limited, so neither
 * a `..` segment nor a nested path can reach anything outside that folder.
 */
const VIDEO_ID = new RegExp(`^${escapeRegExp(VIDEO_FOLDER)}/[a-z0-9-]+$`);

export type SignedVideoUpload = {
  cloudName: string;
  /**
   * Every form field the browser must send besides the file, exactly as
   * signed. Returned as one map so the client cannot drift from the signature
   * by adding, omitting or retyping a parameter — any difference fails it.
   */
  fields: Record<string, string>;
};

export type VerifiedVideo =
  | { ok: true; url: string; key: string }
  | {
      ok: false;
      reason: "outside_folder" | "not_found" | "wrong_format" | "too_large" | "unavailable";
    };

async function removeVideo(
  key: string,
  resourceType: "video" | "image" | "raw" = "video",
): Promise<void> {
  if (!configured || !key) return;
  try {
    await cloudinary.uploader.destroy(key, { resource_type: resourceType, invalidate: true });
  } catch (error) {
    // Best-effort, like the image remover. The key is left out of the line: it
    // adds nothing an operator could act on that the timestamp does not.
    console.warn("[storage/cloudinary] video delete failed", error);
  }
}

export const productVideoStorage = {
  isConfigured: configured,

  /**
   * Parameters for one direct upload.
   *
   * `public_id` carries the folder in its own path rather than using the
   * `folder` parameter. Accounts on Cloudinary's newer "dynamic folders" mode
   * treat `folder` as display metadata and do not prefix the id with it, which
   * would make the stored id unpredictable and the folder check in `verify`
   * meaningless. A path in the id itself behaves the same in both modes.
   */
  sign(filename: string): SignedVideoUpload {
    if (!configured) throw new Error("Cloudinary is not configured.");

    const signed = {
      public_id: `${VIDEO_FOLDER}/${buildObjectName(filename || "product-video")}`,
      allowed_formats: ALLOWED_VIDEO_FORMATS.join(","),
      // Without this, the same signature could be replayed while it is still
      // fresh to upload a different file over an id that `verify` has already
      // accepted — swapping a checked video for an unchecked one. With it, a
      // second upload to that id leaves the stored file as it was.
      overwrite: "false",
      timestamp: String(Math.floor(Date.now() / 1000)),
    };

    const signature = cloudinary.utils.api_sign_request(signed, API_SECRET as string);

    return {
      cloudName: CLOUD_NAME as string,
      fields: { ...signed, signature, api_key: API_KEY as string },
    };
  },

  /**
   * May a product record claim this video as its own?
   *
   * The key must be a product-video id, and the URL must be that same object's
   * video delivery URL on this account. A key is what `updateProduct` and
   * `deleteProduct` later destroy, so a form cannot pair a real video with a
   * key naming something else, or claim a key from outside the video folder.
   */
  isOwnableKey(url: string, key: string): boolean {
    if (!configured || !VIDEO_ID.test(key)) return false;
    const delivery = new RegExp(
      `^https://res\\.cloudinary\\.com/${escapeRegExp(CLOUD_NAME as string)}/video/upload/(?:v\\d+/)?${escapeRegExp(key)}\\.(?:mp4|webm)$`,
    );
    return delivery.test(url);
  },

  /**
   * Confirm what Cloudinary actually stored, and discard it if it is wrong.
   *
   * Only ids inside the video folder are considered at all, so this cannot be
   * used to adopt some other object on the account as a product video.
   */
  async verify(publicId: string): Promise<VerifiedVideo> {
    if (!configured) return { ok: false, reason: "unavailable" };
    if (!VIDEO_ID.test(publicId)) return { ok: false, reason: "outside_folder" };

    let resource: Record<string, unknown>;
    try {
      resource = await cloudinary.api.resource(publicId, { resource_type: "video" });
    } catch (error) {
      const status = (error as { error?: { http_code?: number } })?.error?.http_code;
      if (status === 404) {
        // The resource type is chosen by the upload URL, which the signature
        // does not cover — so a signed request can be sent to the image or raw
        // endpoint instead. Nothing of the kind is accepted; this only makes
        // sure it is not left behind in the video folder either.
        await Promise.all([removeVideo(publicId, "image"), removeVideo(publicId, "raw")]);
        return { ok: false, reason: "not_found" };
      }
      return { ok: false, reason: "unavailable" };
    }

    const format = String(resource.format ?? "").toLowerCase();
    const bytes = typeof resource.bytes === "number" ? resource.bytes : 0;

    if (resource.resource_type !== "video" || !(ALLOWED_VIDEO_FORMATS as readonly string[]).includes(format)) {
      await removeVideo(publicId);
      return { ok: false, reason: "wrong_format" };
    }
    if (bytes <= 0 || bytes > MAX_VIDEO_BYTES) {
      await removeVideo(publicId);
      return { ok: false, reason: "too_large" };
    }

    return { ok: true, url: String(resource.secure_url), key: String(resource.public_id) };
  },

  remove: removeVideo,
};
