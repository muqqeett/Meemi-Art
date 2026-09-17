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

// ---------------------------------------------------------------- video

/** Containers accepted for the optional product video. */
export const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm"] as const;

/** The same two, as Cloudinary names them in `format` and `allowed_formats`. */
export const ALLOWED_VIDEO_FORMATS = ["mp4", "webm"] as const;

/**
 * 50 MB, for product video only.
 *
 * `MAX_UPLOAD_BYTES` above stays exactly where it is: images and video have
 * separate constants so that raising one can never quietly raise the other.
 */
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

/**
 * Container signatures for MP4 and WebM.
 *
 * Takes a plain `Uint8Array` rather than a `Buffer`, so the same check runs in
 * the admin browser — before a single byte is uploaded — as well as on a
 * server. It is the first gate, not the last: a browser check can be bypassed,
 * so Cloudinary is also told to accept only these formats in the signed upload,
 * and the stored result is verified again server-side before any product is
 * allowed to point at it.
 *
 * Two families share these signatures and are excluded here:
 *
 *   ftyp  also carries AVIF/HEIC stills and QuickTime `.mov`. Their brands are
 *         refused, so an image renamed `.mp4` fails at the first gate.
 *   EBML  also opens Matroska `.mkv`. That cannot be told apart from WebM in
 *         the first bytes, which is exactly why the server re-check on
 *         Cloudinary's detected `format` exists.
 */
export function sniffVideoType(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;

  // WebM (Matroska EBML header): 1A 45 DF A3
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
    return "video/webm";
  }

  // MP4 (ISO base media file format): "ftyp" box at offset 4.
  const box = String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7]);
  if (box === "ftyp") {
    const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
    const notVideo = ["avif", "avis", "heic", "heix", "mif1", "msf1", "qt  "];
    return notVideo.includes(brand) ? null : "video/mp4";
  }

  return null;
}

/**
 * A still frame of a Cloudinary video, served as a JPEG.
 *
 * Cloudinary renders any frame of a stored video on request, so the gallery
 * poster and thumbnail come from the video itself — no second upload, and no
 * way for the poster to drift out of step with the file it represents.
 *
 *   so_0         the first frame
 *   w_1200       wide enough for the largest gallery stage, and no wider, so
 *   c_limit      the poster costs a fraction of the video it stands in for
 *   q_auto
 *
 * Returns null for anything that is not a Cloudinary video delivery URL,
 * rather than guessing at a URL that would 404.
 */
export function videoPosterUrl(videoUrl: string): string | null {
  const marker = "/video/upload/";
  const at = videoUrl.indexOf(marker);
  if (at === -1) return null;

  const head = videoUrl.slice(0, at + marker.length);
  const tail = videoUrl
    .slice(at + marker.length)
    .replace(/\.(mp4|webm)(\?.*)?$/i, ".jpg");
  if (!tail.endsWith(".jpg")) return null;

  return `${head}so_0,w_1200,c_limit,q_auto/${tail}`;
}

// ---------------------------------------------------------------- direct uploads

/** `ALLOWED_IMAGE_TYPES`, as Cloudinary names them in `format` and `allowed_formats`. */
export const ALLOWED_IMAGE_FORMATS = ["jpg", "png", "webp", "avif"] as const;

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

/**
 * 10 MB — the largest raw file the store's Cloudinary plan accepts.
 *
 * This used to say 200 MB, which Cloudinary would never have stored: its Free
 * plan refuses raw uploads above 10 MB (`media_limits.raw_max_size_bytes`).
 * Raise it only together with the plan.
 */
export const MAX_DIGITAL_BYTES = 10 * 1024 * 1024;

/** How many leading bytes the content checks below need. */
export const CONTENT_SNIFF_BYTES = 1024;

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) =>
  bytes.length >= offset + signature.length && signature.every((value, index) => bytes[offset + index] === value);

const ascii = (bytes: Uint8Array, from: number, to: number) =>
  String.fromCharCode(...bytes.subarray(from, Math.min(to, bytes.length)));

/**
 * Does a digital file's content agree with the type it claims to be?
 *
 * The declared type — a browser's `File.type`, or a request field — is only a
 * claim; the first bytes are evidence. An executable renamed `pattern.pdf`
 * declares `application/pdf` and fails here, because it does not begin with a
 * PDF header. Takes a plain `Uint8Array`, so the same check runs in the admin
 * browser before upload and on the server against what storage actually holds.
 */
export function digitalContentMatches(head: Uint8Array, declaredType: string): boolean {
  if (head.length === 0) return false;
  const hasNul = head.includes(0);

  switch (declaredType) {
    case "application/pdf":
      // PDF readers accept the header anywhere in the first 1024 bytes.
      return ascii(head, 0, CONTENT_SNIFF_BYTES).includes("%PDF-");
    case "application/zip":
    case "application/x-zip-compressed":
      return startsWith(head, [0x50, 0x4b, 0x03, 0x04]) || startsWith(head, [0x50, 0x4b, 0x05, 0x06]);
    case "image/png":
      return startsWith(head, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "image/jpeg":
      return startsWith(head, [0xff, 0xd8, 0xff]);
    case "video/mp4":
      return ascii(head, 4, 8) === "ftyp";
    case "audio/mpeg":
      return ascii(head, 0, 3) === "ID3" || (head.length > 1 && head[0] === 0xff && (head[1] & 0xe0) === 0xe0);
    case "image/svg+xml":
      return !hasNul && /<svg[\s>]/i.test(ascii(head, 0, CONTENT_SNIFF_BYTES));
    case "text/plain":
      return !hasNul;
    default:
      return false;
  }
}

/**
 * The name shown to the admin and used for the buyer's download: the last path
 * segment only, without control characters, at most 200 characters. It is
 * display text — storage ids never derive from it except through
 * `buildObjectName`, which reduces it to `[a-z0-9-]`.
 */
export function cleanDisplayFilename(value: string, fallback = "download"): string {
  const name = (value.split(/[\\/]/).pop() ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 200);
  return name && name !== "." && name !== ".." ? name : fallback;
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
