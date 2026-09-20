import "server-only";

import { v2 as cloudinary } from "cloudinary";

import {
  ALLOWED_DIGITAL_TYPES,
  ALLOWED_IMAGE_FORMATS,
  CONTENT_SNIFF_BYTES,
  MAX_DIGITAL_BYTES,
  MAX_UPLOAD_BYTES,
  buildObjectName,
  digitalContentMatches,
} from "@/lib/storage/types";

/**
 * Direct browser uploads for the admin product editor: product photos and the
 * purchasable digital file.
 *
 * ── Why the files no longer pass through this server ──────────────────────
 *
 * Both used to be relayed through a route handler. On Vercel a serverless
 * function refuses any request body above 4.5 MB — the platform answers
 * `413 FUNCTION_PAYLOAD_TOO_LARGE` before the handler runs — so every photo or
 * pattern PDF above that size failed in production, whatever the handler did.
 * The same design product video and customer project photos already use is
 * applied here:
 *
 *   1. the admin browser asks this server to sign one upload
 *   2. the browser sends the file straight to Cloudinary with those parameters
 *   3. this server asks Cloudinary what was actually stored, checks it, and
 *      discards it if it is wrong, before any product may point at it
 *
 * The API secret never leaves the server. The API key does, which is what
 * Cloudinary's signed-upload design expects: the key names the account, the
 * signature proves the parameters were ours. Cloudinary itself refuses a
 * signature more than an hour old.
 *
 * ── The two kinds of object ────────────────────────────────────────────────
 *
 *   photos         image, `upload` delivery (public CDN URLs), product folder,
 *                  `allowed_formats` jpg/png/webp/avif, the same incoming
 *                  transformation the relay applied
 *   digital files  raw, `private` delivery (signed URLs only), digital-files
 *                  folder, and a content check on the stored bytes, since raw
 *                  uploads have no format detection of their own
 *
 * `public_id` carries the folder in its own path rather than using `folder`,
 * for the reason given in `productVideoStorage.sign`: on accounts with dynamic
 * folders `folder` would not prefix the id, and the folder checks below would
 * mean nothing.
 */

/** The relay's incoming transformation, unchanged: cap huge originals, good automatic quality. */
export const PRODUCT_IMAGE_TRANSFORMATION = "c_limit,h_2400,w_2400/q_auto:good/f_auto";

export type AdminUploadConfig = {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  imageFolder: string;
  digitalFolder: string;
};

type ResourceType = "image" | "raw" | "video";
type DeliveryType = "upload" | "private";

/**
 * The few Cloudinary operations used here, as a seam: the application passes
 * the real SDK, the test harness a stand-in.
 */
export type AdminUploadClient = {
  resource(publicId: string, options: { resource_type: ResourceType; type: DeliveryType }): Promise<Record<string, unknown>>;
  destroy(publicId: string, options: { resource_type: ResourceType; type: DeliveryType; invalidate: true }): Promise<unknown>;
  signRequest(params: Record<string, string>, apiSecret: string): string;
  /** The first bytes of a private raw object, read server-side through a short-lived signed URL. */
  readHead(publicId: string, maxBytes: number): Promise<Uint8Array>;
};

export type SignedDirectUpload = {
  /** The Cloudinary endpoint for this account and resource type. */
  uploadUrl: string;
  /** Every field the browser must send besides the file, exactly as signed. */
  fields: Record<string, string>;
};

export type VerifiedProductImage =
  | { ok: true; url: string; key: string; width: number | null; height: number | null; bytes: number; format: string }
  | { ok: false; reason: "invalid_key" | "not_found" | "wrong_type" | "wrong_format" | "too_large" | "unavailable" };

export type VerifiedDigitalFile =
  | { ok: true; key: string; bytes: number }
  | { ok: false; reason: "invalid_key" | "not_found" | "wrong_type" | "wrong_content" | "too_large" | "unavailable" };

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function httpStatus(error: unknown): number | undefined {
  return (error as { error?: { http_code?: number } })?.error?.http_code;
}

export function createAdminUploadStorage({
  config,
  client,
  now = () => Date.now(),
}: {
  config: AdminUploadConfig | null;
  client: AdminUploadClient;
  now?: () => number;
}) {
  // One name as `buildObjectName` makes it, directly inside the folder. No
  // `..`, no nested path, no other folder.
  const imageKey = config ? new RegExp(`^${escapeRegExp(config.imageFolder)}/[a-z0-9-]+$`) : null;
  const digitalKey = config ? new RegExp(`^${escapeRegExp(config.digitalFolder)}/[a-z0-9-]+$`) : null;

  const timestamp = () => String(Math.floor(now() / 1000));

  /** Best-effort. Nothing about the key or the error is logged. */
  async function destroy(key: string, resourceType: ResourceType, type: DeliveryType) {
    if (!config) return;
    try {
      await client.destroy(key, { resource_type: resourceType, type, invalidate: true });
    } catch {
      // An object that cannot be removed now is an orphan, not a failure.
    }
  }

  return {
    isConfigured: config !== null,

    isProductImageKey: (key: string) => imageKey?.test(key) ?? false,
    isDigitalFileKey: (key: string) => digitalKey?.test(key) ?? false,

    signProductImage(filename: string): SignedDirectUpload {
      if (!config) throw new Error("Cloudinary is not configured.");
      const signed = {
        public_id: `${config.imageFolder}/${buildObjectName(filename || "product-image")}`,
        allowed_formats: ALLOWED_IMAGE_FORMATS.join(","),
        // A replay of this signature cannot replace an object already verified.
        overwrite: "false",
        transformation: PRODUCT_IMAGE_TRANSFORMATION,
        timestamp: timestamp(),
      };
      return {
        uploadUrl: `https://api.cloudinary.com/v1_1/${encodeURIComponent(config.cloudName)}/image/upload`,
        fields: { ...signed, signature: client.signRequest(signed, config.apiSecret), api_key: config.apiKey },
      };
    },

    /** Confirm a product photo is what the editor may save, or discard it. */
    async verifyProductImage(key: string): Promise<VerifiedProductImage> {
      if (!config || !imageKey) return { ok: false, reason: "unavailable" };
      if (!imageKey.test(key)) return { ok: false, reason: "invalid_key" };

      let resource: Record<string, unknown>;
      try {
        resource = await client.resource(key, { resource_type: "image", type: "upload" });
      } catch (error) {
        if (httpStatus(error) === 404) {
          // The resource type comes from the upload URL, which the signature
          // does not cover. Nothing sent elsewhere is accepted; this only makes
          // sure it is not left behind in the folder.
          await Promise.all([destroy(key, "raw", "upload"), destroy(key, "video", "upload")]);
          return { ok: false, reason: "not_found" };
        }
        return { ok: false, reason: "unavailable" };
      }

      const reject = async (reason: Exclude<VerifiedProductImage, { ok: true }>["reason"]) => {
        await destroy(key, "image", "upload");
        return { ok: false, reason } as const;
      };

      if (resource.public_id !== key || resource.resource_type !== "image" || resource.type !== "upload") {
        return reject("wrong_type");
      }
      const format = String(resource.format ?? "").toLowerCase();
      if (!(ALLOWED_IMAGE_FORMATS as readonly string[]).includes(format)) return reject("wrong_format");

      const bytes = typeof resource.bytes === "number" ? resource.bytes : 0;
      if (!Number.isInteger(bytes) || bytes <= 0 || bytes > MAX_UPLOAD_BYTES) return reject("too_large");

      const url = String(resource.secure_url ?? "");
      const delivery = new RegExp(
        `^https://res\\.cloudinary\\.com/${escapeRegExp(config.cloudName)}/image/upload/(?:v\\d+/)?${escapeRegExp(key)}\\.[a-z0-9]+$`,
      );
      if (!delivery.test(url)) return reject("wrong_type");

      return {
        ok: true,
        url,
        key,
        width: typeof resource.width === "number" ? resource.width : null,
        height: typeof resource.height === "number" ? resource.height : null,
        bytes,
        format,
      };
    },

    signDigitalFile(filename: string): SignedDirectUpload {
      if (!config) throw new Error("Cloudinary is not configured.");
      const signed = {
        public_id: `${config.digitalFolder}/${buildObjectName(filename || "download")}`,
        // Unreachable by its plain URL: only a signed request can fetch it.
        type: "private",
        overwrite: "false",
        timestamp: timestamp(),
      };
      return {
        uploadUrl: `https://api.cloudinary.com/v1_1/${encodeURIComponent(config.cloudName)}/raw/upload`,
        fields: { ...signed, signature: client.signRequest(signed, config.apiSecret), api_key: config.apiKey },
      };
    },

    /**
     * Confirm a digital file is private, raw, within the size cap and really
     * the type it claims to be — or discard it.
     */
    async verifyDigitalFile(key: string, declaredType: string): Promise<VerifiedDigitalFile> {
      if (!config || !digitalKey) return { ok: false, reason: "unavailable" };
      if (!digitalKey.test(key)) return { ok: false, reason: "invalid_key" };

      let resource: Record<string, unknown>;
      try {
        resource = await client.resource(key, { resource_type: "raw", type: "private" });
      } catch (error) {
        if (httpStatus(error) === 404) {
          // Sent to another endpoint, or without `type: "private"` (which the
          // signature would reject, but costs nothing to clear).
          await Promise.all([
            destroy(key, "raw", "upload"),
            destroy(key, "image", "private"),
            destroy(key, "image", "upload"),
            destroy(key, "video", "private"),
            destroy(key, "video", "upload"),
          ]);
          return { ok: false, reason: "not_found" };
        }
        return { ok: false, reason: "unavailable" };
      }

      const reject = async (reason: Exclude<VerifiedDigitalFile, { ok: true }>["reason"]) => {
        await destroy(key, "raw", "private");
        return { ok: false, reason } as const;
      };

      if (resource.public_id !== key || resource.resource_type !== "raw" || resource.type !== "private") {
        return reject("wrong_type");
      }
      if (!(ALLOWED_DIGITAL_TYPES as readonly string[]).includes(declaredType)) return reject("wrong_content");

      const bytes = typeof resource.bytes === "number" ? resource.bytes : 0;
      if (!Number.isInteger(bytes) || bytes <= 0 || bytes > MAX_DIGITAL_BYTES) return reject("too_large");

      let head: Uint8Array;
      try {
        head = await client.readHead(key, CONTENT_SNIFF_BYTES);
      } catch {
        return reject("unavailable");
      }
      if (!digitalContentMatches(head, declaredType)) return reject("wrong_content");

      return { ok: true, key, bytes };
    },

    /** Discard an uploaded digital file that will not be used. */
    discardDigitalFile: (key: string) => (digitalKey?.test(key) ? destroy(key, "raw", "private") : Promise.resolve()),
  };
}

export type AdminUploadStorage = ReturnType<typeof createAdminUploadStorage>;

// ------------------------------------------------------------ the real client

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const API_KEY = process.env.CLOUDINARY_API_KEY;
const API_SECRET = process.env.CLOUDINARY_API_SECRET;
const configured = Boolean(CLOUD_NAME && API_KEY && API_SECRET);

if (configured) {
  // The same SDK singleton and variables as every other Cloudinary driver.
  cloudinary.config({ cloud_name: CLOUD_NAME, api_key: API_KEY, api_secret: API_SECRET, secure: true });
}

/**
 * A storage read that cannot answer in this long is treated as unavailable.
 *
 * Deliberately short. Reading a kilobyte takes well under a second, and the
 * rest of finalizing an upload — the admin check, two queries, the resource
 * lookup, the row write — has to fit inside the platform's function budget
 * alongside it. Five seconds is generous for the read and still leaves the
 * whole request comfortably inside a ten-second limit, so a slow storage
 * produces a real error message rather than a gateway timeout.
 */
export const STORAGE_READ_TIMEOUT_MS = 5_000;

/**
 * Read the first `maxBytes` of a stored object, for the content check.
 *
 * Asks for exactly that many bytes with a `Range` header and reads the whole
 * (tiny) reply. It does NOT open the body as a stream and cancel it partway:
 * that is what this used to do, and cancelling the response of a private
 * Cloudinary download left the connection undrained — the cancel itself took
 * over two minutes, and the next request to the same host then failed in the
 * poisoned pool. Finalizing an upload ran past the platform's function timeout,
 * so the browser got a gateway error instead of JSON and every upload of a
 * perfectly good PDF ended in "PDF upload failed. Please try again.", with the
 * file sitting in storage and no `DigitalAsset` row pointing at it.
 *
 * A server that ignores `Range` answers 200 with the whole object; that is
 * still bounded, because the size was checked before this is ever called, and
 * the result is sliced either way. The timeout means an unreachable or slow
 * storage fails in seconds with a message the admin can act on, rather than
 * hanging until something else kills it.
 */
async function fetchHead(
  url: string,
  maxBytes: number,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = STORAGE_READ_TIMEOUT_MS,
): Promise<Uint8Array> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      cache: "no-store",
      signal: controller.signal,
      headers: { Range: `bytes=0-${maxBytes - 1}` },
    });
    if (!response.ok) throw new Error(`storage read failed (${response.status})`);
    const body = new Uint8Array(await response.arrayBuffer());
    return body.length > maxBytes ? body.subarray(0, maxBytes) : body;
  } finally {
    clearTimeout(timer);
  }
}

/** Exposed for the upload harness, which drives it with a stand-in `fetch`. */
export const readStorageHead = fetchHead;

export const adminUploadStorage = createAdminUploadStorage({
  config: configured
    ? {
        cloudName: CLOUD_NAME as string,
        apiKey: API_KEY as string,
        apiSecret: API_SECRET as string,
        // The same folders the image relay and the digital driver always used.
        imageFolder: process.env.CLOUDINARY_FOLDER ?? "meemiart/products",
        digitalFolder: process.env.CLOUDINARY_DIGITAL_FOLDER ?? "meemiart/digital-files",
      }
    : null,
  client: {
    resource: (publicId, options) => cloudinary.api.resource(publicId, options),
    destroy: (publicId, options) => cloudinary.uploader.destroy(publicId, options),
    signRequest: (params, apiSecret) => cloudinary.utils.api_sign_request(params, apiSecret),
    async readHead(publicId, maxBytes) {
      // Built from a verified key and this account only — never from input —
      // and used and discarded here, so the URL cannot leak.
      const url = cloudinary.utils.private_download_url(publicId, "", {
        resource_type: "raw",
        type: "private",
        expires_at: Math.floor(Date.now() / 1000) + 60,
      });
      return fetchHead(url, maxBytes);
    },
  },
});
