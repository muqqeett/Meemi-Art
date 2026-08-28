import "server-only";

import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";

import {
  buildObjectName,
  EXTENSION_BY_TYPE,
  type StorageProvider,
  type StoredImage,
  type UploadInput,
} from "@/lib/storage/types";

/**
 * Local filesystem driver.
 *
 * Exists so the admin is usable before any cloud credentials are in place —
 * upload a photo and it is served from `public/uploads` immediately.
 *
 * It is deliberately *not* a production target: on a serverless or
 * container-per-deploy host the filesystem is ephemeral, so images written here
 * vanish on the next deploy. `getStorageProvider()` prefers Cloudinary whenever
 * it is configured, and the admin settings page states which driver is live.
 */
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

export const localProvider: StorageProvider = {
  name: "Local filesystem (development)",
  isConfigured: true,

  async upload({ bytes, filename, contentType }: UploadInput): Promise<StoredImage> {
    await mkdir(UPLOAD_DIR, { recursive: true });

    const extension = EXTENSION_BY_TYPE[contentType] ?? "bin";
    const objectName = `${buildObjectName(filename)}.${extension}`;

    await writeFile(path.join(UPLOAD_DIR, objectName), bytes);

    return {
      url: `/uploads/${objectName}`,
      key: objectName,
      width: null,
      height: null,
      bytes: bytes.length,
      format: extension,
    };
  },

  async remove(key: string): Promise<void> {
    if (!key) return;

    // Reject anything that would escape the upload directory.
    const safe = path.basename(key);
    try {
      await unlink(path.join(UPLOAD_DIR, safe));
    } catch {
      // Already gone — deleting the database row is what actually matters.
    }
  },
};
