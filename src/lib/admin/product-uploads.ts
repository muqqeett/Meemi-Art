import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  adminUploadStorage,
  type AdminUploadStorage,
  type SignedDirectUpload,
} from "@/lib/storage/admin-uploads";
import { digitalStorage } from "@/lib/storage/digital";
import {
  ALLOWED_DIGITAL_TYPES,
  ALLOWED_IMAGE_TYPES,
  MAX_DIGITAL_BYTES,
  MAX_UPLOAD_BYTES,
  cleanDisplayFilename,
} from "@/lib/storage/types";

/**
 * The rules behind the admin product editor's uploads, independent of HTTP.
 *
 *   photo         sign → browser uploads to Cloudinary → finalize verifies and
 *                 returns the URL and key; the product form saves them, exactly
 *                 as before
 *   digital file  sign → browser uploads to Cloudinary → finalize verifies,
 *                 then writes the product's `DigitalAsset` row and removes the
 *                 file it replaced
 *
 * Every step re-checks the admin (with the database role check in
 * `getAdminOrNull`). Dependencies are injectable so the harness can run each
 * rule with no session, no Cloudinary and, where it wants, a failing database.
 *
 * Errors carry customer-safe wording only. Log lines name the step and the
 * error class — never a storage key, a signature, or an error message that
 * could echo a connection string.
 */

export type UploadResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

export type ProductUploadDeps = {
  currentAdmin: () => Promise<{ id: string } | null>;
  db: Pick<PrismaClient, "product" | "digitalAsset">;
  storage: AdminUploadStorage;
  /** Best-effort removal of the file a product no longer uses. */
  removePreviousFile: (storageKey: string) => Promise<void>;
};

function resolveDeps(overrides?: Partial<ProductUploadDeps>): ProductUploadDeps {
  return {
    // Loaded on use: the guard pulls in Next's navigation runtime, which the
    // harness (running these rules outside Next) cannot load and never needs.
    currentAdmin: async () => (await import("@/lib/auth-guards")).getAdminOrNull(),
    db: prisma,
    storage: adminUploadStorage,
    removePreviousFile: (key) => digitalStorage.remove(key),
    ...overrides,
  };
}

const MB = 1024 * 1024;

export const UPLOAD_MESSAGES = {
  notFound: "Not found.",
  empty: "That file is empty.",
  imageType: "Only JPEG, PNG, WebP and AVIF images are supported.",
  imageTooLarge: `Images must be ${MAX_UPLOAD_BYTES / MB} MB or smaller.`,
  imageMissing: "The image didn't reach storage. Please try again.",
  imageInvalid: "That upload isn't a product photo. Please upload it again.",
  imageUnavailable: "Image storage is unavailable. Please try again.",
  digitalType: "Only PDF, ZIP, PNG, JPEG, SVG, MP4, MP3 and TXT files are supported for digital products.",
  digitalTooLarge: `PDF upload failed because the file is too large. Files must be ${MAX_DIGITAL_BYTES / MB} MB or smaller.`,
  notPdf: "That file isn't a valid PDF. Only real PDF files can be uploaded as PDFs.",
  contentMismatch: "That file's contents don't match its file type.",
  digitalMissing: "The file didn't reach storage. Please try again.",
  digitalInvalid: "That upload isn't a digital product file. Please upload it again.",
  digitalUnavailable: "File storage is unavailable. Please try again.",
  notConfigured: "File storage is not configured. Set the Cloudinary variables.",
  productGone: "That product no longer exists.",
  claimed: "That file already belongs to another product. Please upload it again.",
  saveFailed: "The file uploaded, but it couldn't be saved to the product. Please try again.",
  invalid: "Please try again.",
} as const;

const fail = (status: number, error: string) => ({ ok: false, status, error }) as const;

function logFailure(step: string, error: unknown): void {
  const kind = error instanceof Error ? error.constructor.name : "unknown";
  console.error(`[admin/uploads] ${step} failed:`, kind);
}

type FileClaim = { filename: string; type: string; size: number };

function readFileClaim(input: Record<string, unknown>): FileClaim {
  return {
    filename: typeof input.filename === "string" ? cleanDisplayFilename(input.filename, "") : "",
    type: typeof input.type === "string" ? input.type : "",
    size: typeof input.size === "number" && Number.isFinite(input.size) ? input.size : 0,
  };
}

// ---------------------------------------------------------------- photos

export type SignedProductImage = ({ mode: "direct" } & SignedDirectUpload) | { mode: "relay" };

export async function signProductImageUpload(
  input: Record<string, unknown>,
  overrides?: Partial<ProductUploadDeps>,
): Promise<UploadResult<SignedProductImage>> {
  const { currentAdmin, storage } = resolveDeps(overrides);
  if (!(await currentAdmin())) return fail(404, UPLOAD_MESSAGES.notFound);

  const file = readFileClaim(input);
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) return fail(415, UPLOAD_MESSAGES.imageType);
  if (file.size <= 0) return fail(400, UPLOAD_MESSAGES.empty);
  if (file.size > MAX_UPLOAD_BYTES) return fail(413, UPLOAD_MESSAGES.imageTooLarge);

  // Without Cloudinary the local-disk driver is in use, which only the relay
  // can write to. That is a development setup; production has Cloudinary.
  if (!storage.isConfigured) return { ok: true, data: { mode: "relay" } };

  return { ok: true, data: { mode: "direct", ...storage.signProductImage(file.filename) } };
}

export async function finalizeProductImageUpload(
  input: Record<string, unknown>,
  overrides?: Partial<ProductUploadDeps>,
): Promise<UploadResult<{ url: string; key: string; width: number | null; height: number | null }>> {
  const { currentAdmin, storage } = resolveDeps(overrides);
  if (!(await currentAdmin())) return fail(404, UPLOAD_MESSAGES.notFound);
  if (!storage.isConfigured) return fail(503, UPLOAD_MESSAGES.notConfigured);

  const key = typeof input.key === "string" && input.key.length <= 300 ? input.key : "";
  if (!key) return fail(400, UPLOAD_MESSAGES.imageInvalid);

  const result = await storage.verifyProductImage(key);
  if (!result.ok) {
    console.warn("[admin/uploads] photo rejected:", result.reason);
    switch (result.reason) {
      case "invalid_key":
        return fail(400, UPLOAD_MESSAGES.imageInvalid);
      case "not_found":
        return fail(422, UPLOAD_MESSAGES.imageMissing);
      case "wrong_type":
      case "wrong_format":
        return fail(415, UPLOAD_MESSAGES.imageType);
      case "too_large":
        return fail(413, UPLOAD_MESSAGES.imageTooLarge);
      case "unavailable":
        return fail(502, UPLOAD_MESSAGES.imageUnavailable);
    }
  }

  return { ok: true, data: { url: result.url, key: result.key, width: result.width, height: result.height } };
}

// ---------------------------------------------------------------- digital files

function digitalTypeOf(value: unknown): string | null {
  return typeof value === "string" && (ALLOWED_DIGITAL_TYPES as readonly string[]).includes(value) ? value : null;
}

export async function signDigitalFileUpload(
  input: Record<string, unknown>,
  overrides?: Partial<ProductUploadDeps>,
): Promise<UploadResult<SignedDirectUpload>> {
  const { currentAdmin, db, storage } = resolveDeps(overrides);
  if (!(await currentAdmin())) return fail(404, UPLOAD_MESSAGES.notFound);
  if (!storage.isConfigured) return fail(503, UPLOAD_MESSAGES.notConfigured);

  const productId = typeof input.productId === "string" && input.productId.length <= 64 ? input.productId : "";
  if (!productId) return fail(400, UPLOAD_MESSAGES.invalid);

  const file = readFileClaim(input);
  if (!digitalTypeOf(file.type)) return fail(415, UPLOAD_MESSAGES.digitalType);
  if (file.size <= 0) return fail(400, UPLOAD_MESSAGES.empty);
  if (file.size > MAX_DIGITAL_BYTES) return fail(413, UPLOAD_MESSAGES.digitalTooLarge);

  try {
    const product = await db.product.findUnique({ where: { id: productId }, select: { id: true } });
    if (!product) return fail(404, UPLOAD_MESSAGES.productGone);
  } catch (error) {
    logFailure("digital sign lookup", error);
    return fail(500, UPLOAD_MESSAGES.invalid);
  }

  return { ok: true, data: storage.signDigitalFile(file.filename) };
}

export async function finalizeDigitalFileUpload(
  input: Record<string, unknown>,
  overrides?: Partial<ProductUploadDeps>,
): Promise<UploadResult<{ filename: string; contentType: string; bytes: number }>> {
  const { currentAdmin, db, storage, removePreviousFile } = resolveDeps(overrides);
  if (!(await currentAdmin())) return fail(404, UPLOAD_MESSAGES.notFound);
  if (!storage.isConfigured) return fail(503, UPLOAD_MESSAGES.notConfigured);

  const productId = typeof input.productId === "string" && input.productId.length <= 64 ? input.productId : "";
  const key = typeof input.key === "string" && input.key.length <= 300 ? input.key : "";
  if (!productId || !key || !storage.isDigitalFileKey(key)) return fail(400, UPLOAD_MESSAGES.digitalInvalid);

  const contentType = digitalTypeOf(input.type);
  const filename = cleanDisplayFilename(typeof input.filename === "string" ? input.filename : "");

  let previousKey: string | null;
  try {
    // A key another product already uses is not this upload's to judge or
    // destroy: refuse it before anything is verified or discarded.
    const claimed = await db.digitalAsset.findFirst({
      where: { storageKey: key, productId: { not: productId } },
      select: { id: true },
    });
    if (claimed) return fail(409, UPLOAD_MESSAGES.claimed);

    const product = await db.product.findUnique({
      where: { id: productId },
      select: { id: true, asset: { select: { storageKey: true } } },
    });
    if (!product) {
      await storage.discardDigitalFile(key);
      return fail(404, UPLOAD_MESSAGES.productGone);
    }
    previousKey = product.asset?.storageKey ?? null;
  } catch (error) {
    logFailure("digital finalize lookup", error);
    return fail(500, UPLOAD_MESSAGES.saveFailed);
  }

  if (previousKey === key) return fail(409, UPLOAD_MESSAGES.claimed);

  if (!contentType) {
    await storage.discardDigitalFile(key);
    return fail(415, UPLOAD_MESSAGES.digitalType);
  }

  const verified = await storage.verifyDigitalFile(key, contentType);
  if (!verified.ok) {
    console.warn("[admin/uploads] digital file rejected:", verified.reason);
    switch (verified.reason) {
      case "invalid_key":
        return fail(400, UPLOAD_MESSAGES.digitalInvalid);
      case "not_found":
      case "wrong_type":
        return fail(422, UPLOAD_MESSAGES.digitalMissing);
      case "wrong_content":
        return fail(415, contentType === "application/pdf" ? UPLOAD_MESSAGES.notPdf : UPLOAD_MESSAGES.contentMismatch);
      case "too_large":
        return fail(413, UPLOAD_MESSAGES.digitalTooLarge);
      case "unavailable":
        return fail(502, UPLOAD_MESSAGES.digitalUnavailable);
    }
  }

  try {
    await db.digitalAsset.upsert({
      where: { productId },
      create: { productId, storageKey: key, filename, contentType, bytes: verified.bytes },
      update: { storageKey: key, filename, contentType, bytes: verified.bytes },
    });
  } catch (error) {
    // The product keeps the file it had. The new object is discarded rather
    // than left as an unreferenced private file.
    logFailure("digital save", error);
    await storage.discardDigitalFile(key);
    return fail(500, UPLOAD_MESSAGES.saveFailed);
  }

  // Only now is the old object safe to remove. Best-effort: an orphan in
  // storage costs pennies, a product with no file costs a sale.
  if (previousKey) await removePreviousFile(previousKey);

  return { ok: true, data: { filename, contentType, bytes: verified.bytes } };
}
