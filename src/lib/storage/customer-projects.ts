import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { v2 as cloudinary } from "cloudinary";

import { PROJECT_IMAGE_MAX_BYTES } from "@/lib/validations/commerce";

/**
 * Storage for customers' finished-project photos.
 *
 * ── Why this is its own module and its own folder ───────────────────────────
 *
 * Product photography is public by design and lives under `meemiart/products`,
 * which `scripts/cloudinary-orphans.ts` treats as product-owned: anything there
 * that no `ProductImage` points at is listed as an orphan. A customer's photo
 * under that prefix would be offered up for deletion. So these live in a
 * separate top-level folder, and the folder is a constant rather than an
 * environment variable, so no configuration can point it back inside the
 * product folder.
 *
 * ── Private until approved — and, for now, private after approval too ──────
 *
 * Uploads are signed with `type: "authenticated"`. Cloudinary documents that
 * an authenticated original *and every derived version* are reachable only
 * through a signed URL, and that on-the-fly transformations are not allowed
 * for them — only versions generated ahead of time with eager transformations.
 *
 * Making an approved photo public is deliberately not implemented. The
 * documented ways to change an authenticated asset are `rename` with
 * `to_type`, which makes the *original* publicly deliverable (and nothing in
 * the documentation says an untransformed original has its Exif/GPS stripped),
 * and `access_mode`, which the Upload API reference marks as no longer
 * supported. An eager, metadata-stripped derived version delivered by signed
 * URL is the likely safe route, but whether `explicit` accepts authenticated
 * assets and how its output is delivered is not stated in the documentation,
 * so it is not guessed at here. Approval therefore records the decision and
 * leaves `imageUrl` null.
 *
 * ── Three gates, as for product video ──────────────────────────────────────
 *
 *   1. The server signs one upload: `public_id` fixed inside this folder and
 *      the owner's prefix, `type`, `allowed_formats` and `overwrite:false`.
 *      Changing any of them breaks the signature. The browser chooses nothing.
 *   2. Cloudinary enforces the signed parameters against the file it receives.
 *   3. `verify` asks Cloudinary what was actually stored — resource type,
 *      delivery type, format, bytes, dimensions, creation time — and destroys
 *      the object if any of it is wrong, before a project can claim it.
 *
 * ── Keys ──────────────────────────────────────────────────────────────────
 *
 *   meemiart/customer-projects/<owner>/<issued>-<nonce>
 *
 *   owner   32 hex chars of SHA-256 over the user id. Deterministic, so the
 *           server can recompute "this user's prefix" from the session; one
 *           way, so the key does not carry the id.
 *   issued  signing time, base-36 seconds. The upload must land within
 *           PROJECT_UPLOAD_WINDOW_SECONDS of it and be submitted within
 *           PROJECT_FINALIZE_WINDOW_SECONDS, which is what keeps an unclaimed
 *           upload from being claimed after the orphan sweep may remove it.
 *   nonce   24 random hex chars, so every signature names a new object.
 *
 * Nothing here accepts a key it did not shape. Every method that reaches
 * Cloudinary refuses a key outside the pattern first, so none of them can be
 * used to reach another object on the account.
 */

export const CUSTOMER_PROJECT_FOLDER = "meemiart/customer-projects";

/** Formats as Cloudinary names them. `jpg` covers JPEG; HEIC is not accepted. */
export const PROJECT_IMAGE_FORMATS = ["jpg", "png", "webp"] as const;

/** Small enough to be a mistake, not a photograph of a finished piece. */
export const MIN_PROJECT_IMAGE_DIMENSION = 300;
/** Larger than any phone camera; beyond this is not a photo upload. */
export const MAX_PROJECT_IMAGE_DIMENSION = 10_000;

/** How long after signing the upload must have landed. */
export const PROJECT_UPLOAD_WINDOW_SECONDS = 15 * 60;
/** How long after signing the upload may still be submitted as a project. */
export const PROJECT_FINALIZE_WINDOW_SECONDS = 2 * 60 * 60;
/**
 * How old an unclaimed upload must be before the orphan sweep may remove it.
 * Far longer than the finalize window, so nothing the sweep removes could
 * still become a project.
 */
export const PROJECT_ORPHAN_GRACE_SECONDS = 24 * 60 * 60;
/** Tolerated disagreement between this server's clock and Cloudinary's. */
const CLOCK_SKEW_SECONDS = 60;

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const KEY_PATTERN = new RegExp(
  `^${escapeRegExp(CUSTOMER_PROJECT_FOLDER)}/([a-f0-9]{32})/([a-z0-9]{1,10})-([a-f0-9]{24})$`,
);

export type ProjectStorageConfig = {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
};

type DestroyOptions = { resource_type: "image" | "raw" | "video"; type: "authenticated"; invalidate: true };

export type ProjectListOptions = {
  type: "authenticated";
  resource_type: "image";
  prefix: string;
  max_results: number;
  next_cursor?: string;
};

/**
 * The few Cloudinary operations this module uses, as a seam. The application
 * passes the real SDK; the test harness passes a stand-in, so the rules are
 * exercised without a single request to Cloudinary.
 */
export type ProjectStorageClient = {
  resource(publicId: string, options: { resource_type: "image"; type: "authenticated" }): Promise<Record<string, unknown>>;
  destroy(publicId: string, options: DestroyOptions): Promise<unknown>;
  signRequest(params: Record<string, string>, apiSecret: string): string;
  signedUrl(
    publicId: string,
    options: { resource_type: "image"; type: "authenticated"; sign_url: true; secure: true; format: string },
  ): string;
  list(options: ProjectListOptions): Promise<Record<string, unknown>>;
};

export type SignedProjectUpload = {
  /** The image upload endpoint for this account. */
  uploadUrl: string;
  /**
   * Every form field the browser must send besides the file, exactly as
   * signed. One map, so the client cannot drift from the signature.
   */
  fields: Record<string, string>;
};

export type VerifiedProjectImage =
  | { ok: true; key: string; width: number; height: number; bytes: number; format: string }
  | {
      ok: false;
      reason:
        | "invalid_key"
        | "not_owner"
        | "not_found"
        | "wrong_type"
        | "wrong_format"
        | "too_large"
        | "bad_dimensions"
        | "expired"
        | "unavailable";
    };

export type InspectedProjectImage =
  | { ok: true }
  | { ok: false; reason: "invalid_key" | "not_owner" | "not_found" | "wrong_type" | "wrong_format" | "unavailable" };

export type RemovedProjectImage =
  | { ok: true }
  | { ok: false; reason: "invalid_key" | "not_owner" | "still_present" | "unavailable" };

export type StoredProjectAsset = { key: string; createdAt: string; bytes: number };

export type ProjectAssetPage =
  | { ok: true; assets: StoredProjectAsset[]; nextCursor: string | null }
  | { ok: false };

/** The owner segment of a key: a one-way digest of the user id. */
function ownerSegment(userId: string): string {
  return createHash("sha256").update(`customer-project-owner:${userId}`).digest("hex").slice(0, 32);
}

/** The owner segment and signing time of a customer-project key, or null for anything else. */
export function parseProjectKey(key: unknown): { owner: string; issuedAt: number } | null {
  if (typeof key !== "string") return null;
  const match = KEY_PATTERN.exec(key);
  if (!match) return null;
  const issuedAt = parseInt(match[2], 36);
  return Number.isSafeInteger(issuedAt) ? { owner: match[1], issuedAt } : null;
}

function httpStatus(error: unknown): number | undefined {
  return (error as { error?: { http_code?: number } })?.error?.http_code;
}

function formatOf(resource: Record<string, unknown>): string {
  return String(resource.format ?? "").toLowerCase();
}

export function createCustomerProjectStorage({
  config,
  client,
  now = () => Date.now(),
}: {
  config: ProjectStorageConfig | null;
  client: ProjectStorageClient;
  now?: () => number;
}) {
  /** Best-effort destroy of a pattern-checked key. Never throws. */
  async function destroy(key: string, resourceType: DestroyOptions["resource_type"] = "image") {
    if (!config || !parseProjectKey(key)) return;
    try {
      await client.destroy(key, { resource_type: resourceType, type: "authenticated", invalidate: true });
    } catch {
      // Best-effort, like the product image and video removers. Nothing about
      // the error or the key is logged: neither helps an operator act.
    }
  }

  /**
   * Destroy, then confirm the object is gone.
   *
   * The confirmation is a lookup that must answer 404 — the same signal the
   * product video verifier relies on — rather than an interpretation of the
   * destroy call's own response. A destroy that errors but left nothing behind
   * (already deleted) is a success; a destroy that reports anything while the
   * object is still there is a failure the caller must surface.
   */
  async function removeConfirmed(key: string): Promise<RemovedProjectImage> {
    if (!parseProjectKey(key)) return { ok: false, reason: "invalid_key" };
    if (!config) return { ok: false, reason: "unavailable" };

    try {
      await client.destroy(key, { resource_type: "image", type: "authenticated", invalidate: true });
    } catch {
      // Judged by the lookup below.
    }

    try {
      await client.resource(key, { resource_type: "image", type: "authenticated" });
      return { ok: false, reason: "still_present" };
    } catch (error) {
      return httpStatus(error) === 404 ? { ok: true } : { ok: false, reason: "unavailable" };
    }
  }

  return {
    isConfigured: config !== null,

    /** A new key inside this user's prefix. Never derived from browser input. */
    buildKey(userId: string): string {
      const issued = Math.floor(now() / 1000).toString(36);
      return `${CUSTOMER_PROJECT_FOLDER}/${ownerSegment(userId)}/${issued}-${randomBytes(12).toString("hex")}`;
    },

    /** Is this a customer-project key, and does it sit under this user's prefix? */
    isOwnedKey(key: string, userId: string): boolean {
      const parsed = parseProjectKey(key);
      return parsed !== null && parsed.owner === ownerSegment(userId);
    },

    /**
     * Parameters for one direct browser upload, for this user.
     *
     * `public_id` carries the folder in its own path rather than using the
     * `folder` parameter, for the reason given in `productVideoStorage.sign`:
     * on accounts using dynamic folders `folder` is display metadata and would
     * not prefix the id, which would make the ownership check meaningless.
     */
    sign(userId: string): SignedProjectUpload {
      if (!config) throw new Error("Customer project storage is not configured.");

      const signed = {
        public_id: this.buildKey(userId),
        type: "authenticated",
        allowed_formats: PROJECT_IMAGE_FORMATS.join(","),
        // A replay of this signature cannot replace an object already stored
        // under the id, so a checked photo cannot be swapped for an unchecked one.
        overwrite: "false",
        timestamp: String(Math.floor(now() / 1000)),
      };

      return {
        uploadUrl: `https://api.cloudinary.com/v1_1/${encodeURIComponent(config.cloudName)}/image/upload`,
        fields: { ...signed, signature: client.signRequest(signed, config.apiSecret), api_key: config.apiKey },
      };
    },

    /**
     * Confirm what Cloudinary actually stored for this user's key.
     *
     * A key outside the pattern or under someone else's prefix is refused
     * without contacting Cloudinary and without destroying anything — that
     * object is not this caller's to judge. Everything else that fails is this
     * caller's own unclaimed upload, and is destroyed. The caller must check
     * that the key is not already claimed by a project *before* calling this.
     */
    async verify(key: string, userId: string): Promise<VerifiedProjectImage> {
      const parsed = parseProjectKey(key);
      if (!parsed) return { ok: false, reason: "invalid_key" };
      if (parsed.owner !== ownerSegment(userId)) return { ok: false, reason: "not_owner" };
      if (!config) return { ok: false, reason: "unavailable" };

      // Too late to submit: past this point the orphan sweep's grace period is
      // what protects the object, not a claim.
      if (Math.floor(now() / 1000) > parsed.issuedAt + PROJECT_FINALIZE_WINDOW_SECONDS) {
        await destroy(key);
        return { ok: false, reason: "expired" };
      }

      let resource: Record<string, unknown>;
      try {
        resource = await client.resource(key, { resource_type: "image", type: "authenticated" });
      } catch (error) {
        if (httpStatus(error) === 404) {
          // The resource type is chosen by the upload URL, which the signature
          // does not cover, so the same signed fields can be sent to the raw or
          // video endpoint. Nothing of the kind is accepted; this only makes
          // sure it is not left behind in the folder.
          await Promise.all([destroy(key, "raw"), destroy(key, "video")]);
          return { ok: false, reason: "not_found" };
        }
        return { ok: false, reason: "unavailable" };
      }

      const reject = async (reason: Exclude<VerifiedProjectImage, { ok: true }>["reason"]) => {
        await destroy(key);
        return { ok: false, reason } as const;
      };

      if (resource.public_id !== key || resource.resource_type !== "image" || resource.type !== "authenticated") {
        return reject("wrong_type");
      }

      const format = formatOf(resource);
      if (!(PROJECT_IMAGE_FORMATS as readonly string[]).includes(format)) return reject("wrong_format");

      const bytes = typeof resource.bytes === "number" ? resource.bytes : 0;
      if (!Number.isInteger(bytes) || bytes <= 0 || bytes > PROJECT_IMAGE_MAX_BYTES) return reject("too_large");

      const { width, height } = resource;
      if (
        typeof width !== "number" ||
        typeof height !== "number" ||
        !Number.isInteger(width) ||
        !Number.isInteger(height) ||
        Math.min(width, height) < MIN_PROJECT_IMAGE_DIMENSION ||
        Math.max(width, height) > MAX_PROJECT_IMAGE_DIMENSION
      ) {
        return reject("bad_dimensions");
      }

      const createdAt = Date.parse(String(resource.created_at ?? ""));
      const createdSeconds = Math.floor(createdAt / 1000);
      if (
        !Number.isFinite(createdAt) ||
        createdSeconds < parsed.issuedAt - CLOCK_SKEW_SECONDS ||
        createdSeconds > parsed.issuedAt + PROJECT_UPLOAD_WINDOW_SECONDS
      ) {
        return reject("expired");
      }

      return { ok: true, key, width, height, bytes, format };
    },

    /**
     * Re-check an already-claimed photo before a moderation decision.
     *
     * The key must still be a customer-project key under the owner's prefix,
     * and Cloudinary must still hold it as an authenticated image in an allowed
     * format. Never destroys anything: a claimed photo is not this check's to
     * remove, whatever the answer.
     */
    async inspect(key: string, ownerUserId: string): Promise<InspectedProjectImage> {
      const parsed = parseProjectKey(key);
      if (!parsed) return { ok: false, reason: "invalid_key" };
      if (parsed.owner !== ownerSegment(ownerUserId)) return { ok: false, reason: "not_owner" };
      if (!config) return { ok: false, reason: "unavailable" };

      let resource: Record<string, unknown>;
      try {
        resource = await client.resource(key, { resource_type: "image", type: "authenticated" });
      } catch (error) {
        return httpStatus(error) === 404 ? { ok: false, reason: "not_found" } : { ok: false, reason: "unavailable" };
      }

      if (resource.public_id !== key || resource.resource_type !== "image" || resource.type !== "authenticated") {
        return { ok: false, reason: "wrong_type" };
      }
      if (!(PROJECT_IMAGE_FORMATS as readonly string[]).includes(formatOf(resource))) {
        return { ok: false, reason: "wrong_format" };
      }
      return { ok: true };
    },

    /**
     * A signed delivery URL for a still-private photo, for the future admin
     * moderation screen only. Signed authenticated URLs do not expire, and this
     * one is for the original, so it must never be rendered on a public page.
     * Refuses keys it did not shape.
     */
    privatePreviewUrl(key: string, format: string): string | null {
      if (!config || !parseProjectKey(key) || !(PROJECT_IMAGE_FORMATS as readonly string[]).includes(format)) {
        return null;
      }
      return client.signedUrl(key, {
        resource_type: "image",
        type: "authenticated",
        sign_url: true,
        secure: true,
        format,
      });
    },

    /** Best-effort delete of a customer-project image. Any other key is ignored. */
    remove(key: string): Promise<void> {
      return destroy(key);
    },

    /**
     * Delete a photo on behalf of its owner, and confirm it is gone.
     *
     * A key under anyone else's prefix is refused before Cloudinary is called.
     */
    async removeOwned(key: string, userId: string): Promise<RemovedProjectImage> {
      const parsed = parseProjectKey(key);
      if (!parsed) return { ok: false, reason: "invalid_key" };
      if (parsed.owner !== ownerSegment(userId)) return { ok: false, reason: "not_owner" };
      return removeConfirmed(key);
    },

    /**
     * Delete an unclaimed customer-project photo, and confirm it is gone. For
     * the orphan sweep, which has already established that no project claims
     * the key; the key pattern is still enforced here.
     */
    removeProjectAsset(key: string): Promise<RemovedProjectImage> {
      return removeConfirmed(key);
    },

    /**
     * One page of the customer-projects folder. Authenticated images only, and
     * only under this folder's prefix — the listing cannot be pointed anywhere
     * else. A failure is reported, never thrown.
     */
    async listPage(cursor?: string): Promise<ProjectAssetPage> {
      if (!config) return { ok: false };
      try {
        const page = await client.list({
          type: "authenticated",
          resource_type: "image",
          prefix: `${CUSTOMER_PROJECT_FOLDER}/`,
          max_results: 500,
          ...(cursor ? { next_cursor: cursor } : {}),
        });
        const resources = Array.isArray(page.resources) ? (page.resources as Record<string, unknown>[]) : [];
        return {
          ok: true,
          assets: resources.map((resource) => ({
            key: String(resource?.public_id ?? ""),
            createdAt: String(resource?.created_at ?? ""),
            bytes: typeof resource?.bytes === "number" ? resource.bytes : 0,
          })),
          nextCursor: typeof page.next_cursor === "string" && page.next_cursor ? page.next_cursor : null,
        };
      } catch {
        return { ok: false };
      }
    },
  };
}

export type CustomerProjectStorage = ReturnType<typeof createCustomerProjectStorage>;

// ------------------------------------------------------------ the real client

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const API_KEY = process.env.CLOUDINARY_API_KEY;
const API_SECRET = process.env.CLOUDINARY_API_SECRET;

const configured = Boolean(CLOUD_NAME && API_KEY && API_SECRET);

if (configured) {
  // The same SDK singleton and the same three variables as the product image,
  // video and digital-file drivers — one account, one configuration.
  cloudinary.config({ cloud_name: CLOUD_NAME, api_key: API_KEY, api_secret: API_SECRET, secure: true });
}

/**
 * The application's instance. Cloudinary only: there is deliberately no local
 * filesystem fallback, because `public/uploads` is served to everyone and a
 * photo awaiting moderation must not be.
 */
export const customerProjectStorage = createCustomerProjectStorage({
  config: configured
    ? { cloudName: CLOUD_NAME as string, apiKey: API_KEY as string, apiSecret: API_SECRET as string }
    : null,
  client: {
    resource: (publicId, options) => cloudinary.api.resource(publicId, options),
    destroy: (publicId, options) => cloudinary.uploader.destroy(publicId, options),
    signRequest: (params, apiSecret) => cloudinary.utils.api_sign_request(params, apiSecret),
    signedUrl: (publicId, options) => cloudinary.url(publicId, options),
    list: (options) => cloudinary.api.resources(options),
  },
});
