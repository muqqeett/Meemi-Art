/**
 * Human-readable labels for a stored file.
 *
 * A buyer deciding whether they can open a purchase should not have to read
 * `application/vnd.openxmlformats-officedocument.wordprocessingml.document`.
 * The MIME type is what the database holds, so it stays the source of truth —
 * this only changes how it is written down.
 *
 * Pure string work, no Prisma import, so it is safe in a client component.
 * Anything unrecognised falls back to the file extension and then to the raw
 * subtype, rather than to a guess: an unknown format is still shown honestly.
 */

const LABELS: Record<string, string> = {
  "application/pdf": "PDF",
  "application/zip": "ZIP archive",
  "application/x-zip-compressed": "ZIP archive",
  "image/png": "PNG image",
  "image/jpeg": "JPEG image",
  "image/svg+xml": "SVG vector",
  "video/mp4": "MP4 video",
  "audio/mpeg": "MP3 audio",
  "text/plain": "Text file",
};

/** e.g. "application/pdf" -> "PDF". */
export function formatLabel(contentType: string, filename?: string): string {
  const known = LABELS[contentType.toLowerCase()];
  if (known) return known;

  const extension = filename?.split(".").pop();
  if (extension && extension.length <= 5 && !extension.includes("/")) {
    return extension.toUpperCase();
  }

  const subtype = contentType.split("/").pop();
  return subtype ? subtype.toUpperCase() : "File";
}

/**
 * The extension alone, for a compact chip. Prefers the filename, because a
 * `.zip` uploaded as `application/x-zip-compressed` should still read "ZIP".
 */
export function formatExtension(contentType: string, filename?: string): string {
  const extension = filename?.split(".").pop();
  if (extension && extension.length <= 5 && !extension.includes("/")) {
    return extension.toUpperCase();
  }
  return formatLabel(contentType).split(" ")[0];
}
