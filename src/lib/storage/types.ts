/**
 * Storage provider contract.
 *
 * The database only ever holds the resulting URL (see `ProductImage.url`) —
 * binaries live in object storage. Swapping providers is therefore a matter of
 * implementing this interface and changing an environment variable; nothing in
 * the admin UI or the schema needs to know which driver is active.
 */

export type StoredImage = {
  /** Public URL written to `ProductImage.url`. */
  url: string;
  /**
   * Provider-specific handle used to delete the object later. Cloudinary calls
   * this a public_id; the local driver uses the on-disk filename.
   */
  key: string;
  width: number | null;
  height: number | null;
  bytes: number;
  format: string | null;
};

export type UploadInput = {
  bytes: Buffer;
  /** Original filename, used only to derive a readable slug. */
  filename: string;
  contentType: string;
};

export interface StorageProvider {
  /** Human-readable driver name, surfaced in admin settings. */
  readonly name: string;
  /** False when required credentials are absent, so the UI can explain why. */
  readonly isConfigured: boolean;
  upload(input: UploadInput): Promise<StoredImage>;
  /** Best-effort delete. Never throws — a missing object is not an error. */
  remove(key: string): Promise<void>;
}

/** Formats accepted for product photography. */
export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
] as const;

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8 MB

export const EXTENSION_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

/**
 * Magic-number signatures. The browser-supplied MIME type is a claim, not a
 * fact, so uploads are additionally sniffed from the file's own bytes.
 */
export function sniffImageType(bytes: Buffer): string | null {
  if (bytes.length < 12) return null;

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }

  // RIFF....WEBP
  if (
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }

  // ISO-BMFF box with an AVIF brand.
  if (bytes.toString("ascii", 4, 8) === "ftyp") {
    const brand = bytes.toString("ascii", 8, 12);
    if (brand === "avif" || brand === "avis") return "image/avif";
  }

  return null;
}

/** Readable, collision-free object name derived from the original filename. */
export function buildObjectName(filename: string): string {
  const base = filename
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  const unique = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  return base ? `${base}-${unique}` : `image-${unique}`;
}
