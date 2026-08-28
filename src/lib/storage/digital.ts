import "server-only";

import { v2 as cloudinary } from "cloudinary";

import { buildObjectName } from "@/lib/storage/types";

/**
 * Private storage for purchased files.
 *
 * Kept separate from the product-image driver on purpose. Preview images are
 * public by design and served straight off the CDN; purchased files must not
 * be, so they are uploaded as `type: "private"` into their own folder and can
 * only be fetched through a signed URL that expires.
 *
 * Two folders, two access models:
 *
 *   meemiart/products      public images, permanent URLs, safe in a page
 *   meemiart/digital-files private originals, signed URLs only, never in a page
 *
 * A `storageKey` from this module must never be rendered into HTML or an
 * email. It is resolved to a URL by `signedDownloadUrl` inside the download
 * route, after the caller has been authorised.
 */

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const API_KEY = process.env.CLOUDINARY_API_KEY;
const API_SECRET = process.env.CLOUDINARY_API_SECRET;
const FOLDER = process.env.CLOUDINARY_DIGITAL_FOLDER ?? "meemiart/digital-files";

const configured = Boolean(CLOUD_NAME && API_KEY && API_SECRET);

if (configured) {
  cloudinary.config({
    cloud_name: CLOUD_NAME,
    api_key: API_KEY,
    api_secret: API_SECRET,
    secure: true,
  });
}

/** How long a download link stays valid. Long enough to click, short enough not to share. */
const SIGNED_URL_TTL_SECONDS = 5 * 60;

/** Formats a shop can reasonably sell. Executables are deliberately absent. */
export const ALLOWED_DIGITAL_TYPES = [
  "application/pdf",
  "application/zip",
  "application/x-zip-compressed",
  "image/png",
  "image/jpeg",
  "image/svg+xml",
  "video/mp4",
  "audio/mpeg",
  "text/plain",
] as const;

export const MAX_DIGITAL_BYTES = 200 * 1024 * 1024; // 200 MB

export type StoredDigitalFile = {
  storageKey: string;
  bytes: number;
  format: string | null;
};

export const digitalStorage = {
  isConfigured: configured,

  /**
   * Upload a purchasable file.
   *
   * `type: "private"` is what makes the object unreachable by its plain URL:
   * Cloudinary will only serve it to a request carrying a valid signature.
   * `resource_type: "raw"` keeps PDFs and archives byte-identical rather than
   * being treated as images.
   */
  async upload(input: {
    bytes: Buffer;
    filename: string;
  }): Promise<StoredDigitalFile> {
    if (!configured) {
      throw new Error(
        "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET.",
      );
    }

    const result = await new Promise<Record<string, unknown>>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: FOLDER,
          public_id: buildObjectName(input.filename),
          resource_type: "raw",
          type: "private",
          overwrite: false,
        },
        (error, uploaded) => {
          if (error) reject(new Error(error.message));
          else if (!uploaded) reject(new Error("Cloudinary returned no result."));
          else resolve(uploaded as unknown as Record<string, unknown>);
        },
      );

      stream.end(input.bytes);
    });

    return {
      storageKey: String(result.public_id),
      bytes: typeof result.bytes === "number" ? result.bytes : input.bytes.length,
      format: typeof result.format === "string" ? result.format : null,
    };
  },

  /**
   * A short-lived, signed URL for one download.
   *
   * Generated per request after authorisation, so a leaked link stops working
   * within minutes and cannot be handed around.
   */
  signedDownloadUrl(storageKey: string): string {
    if (!configured) {
      throw new Error("Cloudinary is not configured.");
    }

    // `attachment: true` sets Content-Disposition so the browser saves the
    // file rather than trying to render it. Cloudinary names the download
    // from the stored public_id, which is why `buildObjectName` keeps a
    // readable slug of the original filename.
    return cloudinary.utils.private_download_url(storageKey, "", {
      resource_type: "raw",
      type: "private",
      expires_at: Math.floor(Date.now() / 1000) + SIGNED_URL_TTL_SECONDS,
      attachment: true,
    });
  },

  /** Best-effort delete. A file already gone must not block removing its row. */
  async remove(storageKey: string): Promise<void> {
    if (!configured || !storageKey) return;
    try {
      await cloudinary.uploader.destroy(storageKey, {
        resource_type: "raw",
        type: "private",
      });
    } catch (error) {
      console.warn("[storage/digital] delete failed", storageKey, error);
    }
  },
};
