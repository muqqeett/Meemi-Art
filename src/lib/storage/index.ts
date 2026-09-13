import "server-only";

import { cloudinaryProvider } from "@/lib/storage/cloudinary";
import { localProvider } from "@/lib/storage/local";
import type { StorageProvider } from "@/lib/storage/types";

export type { StorageProvider, StoredImage } from "@/lib/storage/types";
export {
  ALLOWED_IMAGE_TYPES,
  MAX_UPLOAD_BYTES,
  sniffImageType,
} from "@/lib/storage/types";

/**
 * Product video has one driver only. The local-disk fallback exists so photos
 * can be managed before Cloudinary is configured; a 50 MB file written into
 * `public/` is not something to encourage, so video simply reports that it
 * needs Cloudinary.
 */
export { productVideoStorage } from "@/lib/storage/cloudinary";

/**
 * Resolve the active storage driver.
 *
 * Cloudinary wins whenever its credentials are present; otherwise uploads fall
 * back to the local filesystem so the admin still works during setup. Nothing
 * else in the app needs to know which one is in play — callers just get a
 * `StorageProvider`.
 */
export function getStorageProvider(): StorageProvider {
  if (cloudinaryProvider.isConfigured) return cloudinaryProvider;
  return localProvider;
}

/** Surfaced on the admin settings page so the driver in use is never a guess. */
export function describeStorage(): {
  name: string;
  isProduction: boolean;
  hint: string;
} {
  const provider = getStorageProvider();
  const isCloudinary = provider === cloudinaryProvider;

  return {
    name: provider.name,
    isProduction: isCloudinary,
    hint: isCloudinary
      ? "Images are stored on Cloudinary and served from its CDN."
      : "Images are written to public/uploads. Set the Cloudinary variables in .env to store them off-server before deploying.",
  };
}
