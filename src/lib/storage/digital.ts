import "server-only";

import { createHash } from "node:crypto";
import { v2 as cloudinary } from "cloudinary";

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

/**
 * The accepted types and size cap live in `types.ts`, which the admin browser
 * can import too, so both sides of a direct upload check the same rules.
 */
export { ALLOWED_DIGITAL_TYPES, MAX_DIGITAL_BYTES } from "@/lib/storage/types";

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

/**
 * A short, one-way fingerprint of a storage key, for log lines.
 *
 * Twelve hex characters of SHA-256: enough that two log entries for the same
 * file can be matched to one another, far too little to invert, and it carries
 * none of the key's structure. Never used for anything but logging.
 */
function keyDigest(storageKey: string): string {
  return `key:${createHash("sha256").update(storageKey).digest("hex").slice(0, 12)}`;
}

/*
 * Uploads no longer pass through this server.
 *
 * A serverless function refuses request bodies above 4.5 MB, so relaying a
 * pattern PDF through it failed in production for any realistic file. The admin
 * browser now uploads straight to Cloudinary with parameters this server signs
 * — still `resource_type: "raw"` and `type: "private"`, in the same folder
 * (`CLOUDINARY_DIGITAL_FOLDER`, default `meemiart/digital-files`) — and the
 * stored file is verified before any product points at it. See
 * `lib/storage/admin-uploads.ts`.
 */

export const digitalStorage = {
  isConfigured: configured,

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
      // The storage key is the one value that would let someone construct
      // their own signed URL, so it must never reach a log line — the download
      // route says so explicitly and this call site used to contradict it.
      //
      // A short digest keeps the line useful: two failures for the same file
      // still correlate, and a support question can still be traced, but the
      // digest cannot be turned back into a key.
      //
      // `remove` receives only the key, so there is no asset or access id in
      // scope to log instead; changing the signature would mean touching every
      // caller, which is beyond a logging fix.
      console.warn("[storage/digital] delete failed", keyDigest(storageKey), error);
    }
  },
};
