/**
 * Browser half of the admin editor's direct uploads (photos and digital files).
 *
 * Two requests per file: JSON steps to our own route (sign, finalize), and the
 * file itself straight to Cloudinary with the signed fields. Every failure is
 * turned into a message an admin can act on — a route that answers with plain
 * text (a platform 413, an HTML error page) never surfaces as a parse error or
 * a bare status code.
 */

export type UploadMessages = {
  /** Generic failure, e.g. "Image upload failed. Please try again." */
  failed: string;
  tooLarge: string;
  wrongType: string;
};

export class UploadError extends Error {}

/** POST one JSON step to an admin upload route and return its payload, or throw an `UploadError`. */
export async function postUploadStep<T>(
  endpoint: string,
  body: Record<string, unknown>,
  messages: UploadMessages,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new UploadError("Network error. Check your connection and try again.");
  }

  const payload = (await response.json().catch(() => null)) as (T & { error?: unknown }) | null;
  if (response.ok && payload) return payload;

  const error = payload && typeof payload.error === "string" ? payload.error : null;
  if (error) throw new UploadError(error);
  if (response.status === 413) throw new UploadError(messages.tooLarge);
  if (response.status === 404 || response.status === 401 || response.status === 403) {
    throw new UploadError("Your admin session has ended. Sign in again, then retry the upload.");
  }
  throw new UploadError(messages.failed);
}

/**
 * Upload a file to Cloudinary with fields this server signed. Resolves with the
 * stored `public_id`; progress is reported as a whole percentage.
 */
export function sendToCloudinary(
  uploadUrl: string,
  fields: Record<string, string>,
  file: File,
  messages: UploadMessages,
  onProgress: (percent: number) => void,
  /**
   * The name Cloudinary receives for the file. For raw uploads it appends that
   * name's extension to the stored id, so digital files pass a name without
   * one — keeping ids in the extension-less form every stored file already has.
   */
  uploadName: string = file.name,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const body = new FormData();
    // Sent verbatim: the server signed exactly these, and nothing else.
    for (const [name, value] of Object.entries(fields)) body.append(name, value);
    body.append("file", file, uploadName);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", uploadUrl);

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    });

    xhr.addEventListener("load", () => {
      let payload: { public_id?: unknown; error?: { message?: unknown } } = {};
      try {
        payload = JSON.parse(xhr.responseText);
      } catch {
        payload = {};
      }
      if (xhr.status >= 200 && xhr.status < 300 && typeof payload.public_id === "string") {
        resolve(payload.public_id);
        return;
      }

      // Cloudinary's own wording is logged to the console for diagnosis only;
      // the admin sees a message they can act on.
      const detail = typeof payload.error?.message === "string" ? payload.error.message : "";
      if (detail) console.warn("[upload] storage refused the file:", detail);
      if (/file size too large|too large/i.test(detail) || xhr.status === 413) {
        reject(new UploadError(messages.tooLarge));
      } else if (/format|invalid image|unsupported|not allowed/i.test(detail)) {
        reject(new UploadError(messages.wrongType));
      } else {
        reject(new UploadError(messages.failed));
      }
    });
    xhr.addEventListener("error", () =>
      reject(new UploadError("Network error during upload. Check your connection and try again.")),
    );

    xhr.send(body);
  });
}
