import "server-only";

import { v2 as cloudinary } from "cloudinary";

import { buildObjectName } from "@/lib/storage/types";
import { formatExtension } from "@/lib/file-format";

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

/**
 * Above this, the route hands the buyer a signed Cloudinary URL instead of
 * streaming the bytes itself.
 *
 * Streaming is what lets us set the original filename and the real content
 * type, so it is the path every realistic pattern PDF takes. But a serverless
 * function is a poor pipe for a very large file — memory, execution time and
 * platform response limits all bite — so past this size the redirect is used
 * and the buyer gets `file.pdf` rather than the original name. Correct
 * extension either way; only the pretty name is lost, and only for files far
 * larger than anything this shop sells today.
 */
export const MAX_PROXY_BYTES = 25 * 1024 * 1024; // 25 MB

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
   * `format` matters and was the bug behind PDFs arriving as text. Cloudinary's
   * signature is `private_download_url(public_id, format, options)` — the
   * second argument is the *format*, not a filename. It used to be `""`, and
   * because `buildObjectName` strips the extension from the public_id there was
   * then nothing anywhere in the URL to say what kind of file this was.
   * Cloudinary served it as:
   *
   *     Content-Disposition: attachment; filename="file"
   *
   * — no extension at all, so the browser and OS fell back to guessing, which
   * is how a PDF ended up saved as text. Passing the real extension makes that
   * `filename="file.pdf"`.
   *
   * That is the safety net rather than the main path: the route streams the
   * file itself so the buyer gets the original filename. This URL is used when
   * a file is too large to sensibly proxy.
   */
  signedDownloadUrl(storageKey: string, filename?: string, contentType?: string): string {
    if (!configured) {
      throw new Error("Cloudinary is not configured.");
    }

    const format = filename || contentType ? formatExtension(contentType ?? "", filename) : "";

    return cloudinary.utils.private_download_url(storageKey, format.toLowerCase(), {
      resource_type: "raw",
      type: "private",
      expires_at: Math.floor(Date.now() / 1000) + SIGNED_URL_TTL_SECONDS,
      attachment: true,
    });
  },

  /**
   * Open the stored object for streaming back to an authorised buyer.
   *
   * Fetched server-side with a signed URL that is created, used and discarded
   * inside this call — it never reaches the browser, so there is no link to
   * leak or forward, and the storage key stays server-side as before.
   *
   * This exists because Cloudinary cannot be made to serve both the original
   * filename and the right extension at once: its download API names every
   * file `file.<ext>`, and its `fl_attachment:<name>` flag rejects a name
   * containing a dot. Streaming lets the route set `Content-Disposition` and
   * `Content-Type` itself, which is the only way to deliver
   * `Meemi-Art-Mini-Potted-Succulent-Letter.pdf` as a real PDF.
   */
  async openStream(storageKey: string): Promise<Response> {
    if (!configured) {
      throw new Error("Cloudinary is not configured.");
    }

    const url = cloudinary.utils.private_download_url(storageKey, "", {
      resource_type: "raw",
      type: "private",
      expires_at: Math.floor(Date.now() / 1000) + SIGNED_URL_TTL_SECONDS,
      attachment: true,
    });

    return fetch(url, { cache: "no-store" });
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
