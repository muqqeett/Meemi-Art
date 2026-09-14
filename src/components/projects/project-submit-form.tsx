"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { projectTextErrors } from "@/components/projects/project-text-rules";
import {
  PROJECT_CAPTION_MAX,
  PROJECT_DISPLAY_NAME_MAX,
  PROJECT_IMAGE_CONTENT_TYPES,
  PROJECT_IMAGE_MAX_BYTES,
} from "@/lib/validations/commerce";

/**
 * Share a finished project: choose the pattern, choose a photo, add words.
 *
 * ── How the photo travels ──────────────────────────────────────────────────
 *
 *   1. `POST /api/projects/upload` step "sign" — the server checks the session,
 *      the purchase, the cap and the rate limit, and answers with parameters
 *      signed for one private upload.
 *   2. The browser sends the file straight to Cloudinary with exactly those
 *      parameters. It never passes through this site's servers.
 *   3. Step "finalize" — the server verifies what Cloudinary stored and
 *      records a PENDING project.
 *
 * The signed parameters are held in memory for the one upload and never
 * shown. Nothing here decides anything: the type, size and dimension checks
 * below only save a customer a wasted upload, and the server repeats all of
 * them against the stored file.
 *
 * ── Retrying ──────────────────────────────────────────────────────────────
 *
 * If the photo reached storage but saving the project failed for a reason a
 * retry could fix — a dropped connection, a busy server, a rate limit — the
 * upload is kept and "Try again" only repeats step 3. Any other refusal clears
 * it, so the next attempt starts from a fresh signature.
 */

/** Mirrors the server's dimension rule, for early feedback only. */
const MIN_DIMENSION = 300;
const MAX_DIMENSION = 10_000;

const ACCEPTED = PROJECT_IMAGE_CONTENT_TYPES as readonly string[];
const GENERIC_ERROR = "Something went wrong. Please try again.";
const UPLOAD_ERROR =
  "Your photo couldn't be uploaded. Check your connection and that it's a JPEG, PNG or WebP under 10 MB, then try again.";

export type ShareableProductOption = { id: string; name: string; used: number; remaining: number };

type Phase = "idle" | "signing" | "uploading" | "saving";
type Uploaded = { productId: string; imageKey: string; file: File };
type RouteReply = { ok: true; data: Record<string, unknown> } | { ok: false; status: number; error: string };

async function callUploadRoute(body: Record<string, unknown>): Promise<RouteReply> {
  try {
    const response = await fetch("/api/projects/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    if (!response.ok) {
      return { ok: false, status: response.status, error: typeof json?.error === "string" ? json.error : GENERIC_ERROR };
    }
    return { ok: true, data: json ?? {} };
  } catch {
    return { ok: false, status: 0, error: "We couldn't reach the shop. Check your connection and try again." };
  }
}

/** The direct upload, with progress. `XMLHttpRequest` because `fetch` reports none. */
function sendToStorage(url: string, fields: Record<string, string>, file: File, onProgress: (percent: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", url);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onload = () => (request.status >= 200 && request.status < 300 ? resolve() : reject(new Error("rejected")));
    request.onerror = () => reject(new Error("network"));
    request.onabort = () => reject(new Error("aborted"));

    const body = new FormData();
    for (const [name, value] of Object.entries(fields)) body.append(name, value);
    body.append("file", file);
    request.send(body);
  });
}

function formatSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function ProjectSubmitForm({
  products,
  initialProductId,
}: {
  products: ShareableProductOption[];
  initialProductId?: string;
}) {
  const id = useId();
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const previewRef = useRef<string | null>(null);

  const [productId, setProductId] = useState(initialProductId ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [caption, setCaption] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState<Uploaded | null>(null);
  const [submitted, setSubmitted] = useState(false);

  // The preview is an object URL; release it when the component goes away.
  useEffect(
    () => () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    },
    [],
  );

  const busy = phase !== "idle";
  const textErrors = projectTextErrors({ caption, displayName });

  function replacePreview(next: string | null) {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = next;
    setPreviewUrl(next);
  }

  function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const chosen = event.target.files?.[0] ?? null;
    setError(null);
    setSubmitted(false);
    setDimensions(null);
    setFile(chosen);

    if (!chosen) {
      setFileError(null);
      replacePreview(null);
      return;
    }
    if (!ACCEPTED.includes(chosen.type)) {
      setFileError("Choose a JPEG, PNG or WebP photo. HEIC photos aren't supported yet.");
      replacePreview(null);
      return;
    }
    if (chosen.size <= 0 || chosen.size > PROJECT_IMAGE_MAX_BYTES) {
      setFileError("Photos must be 10 MB or smaller.");
      replacePreview(null);
      return;
    }
    setFileError(null);
    replacePreview(URL.createObjectURL(chosen));
  }

  function onPreviewLoad(event: React.SyntheticEvent<HTMLImageElement>) {
    const { naturalWidth: width, naturalHeight: height } = event.currentTarget;
    setDimensions({ width, height });
    if (Math.min(width, height) < MIN_DIMENSION || Math.max(width, height) > MAX_DIMENSION) {
      setFileError("Photos must be at least 300 pixels on each side.");
    }
  }

  function clearPhoto() {
    setFile(null);
    setDimensions(null);
    setFileError(null);
    replacePreview(null);
    if (fileInput.current) fileInput.current.value = "";
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError(null);
    setSubmitted(false);

    if (!productId) {
      setError("Choose the pattern you made this from.");
      return;
    }
    if (!file) {
      setError("Choose a photo of your finished project.");
      return;
    }
    if (fileError) {
      setError(fileError);
      return;
    }
    if (textErrors.caption || textErrors.displayName) {
      setError(textErrors.caption ?? textErrors.displayName ?? GENERIC_ERROR);
      return;
    }

    let upload = uploaded && uploaded.productId === productId && uploaded.file === file ? uploaded : null;

    try {
      if (!upload) {
        setPhase("signing");
        const signed = await callUploadRoute({ step: "sign", productId, contentType: file.type, bytes: file.size });
        if (!signed.ok) {
          setError(signed.error);
          return;
        }

        const uploadUrl = signed.data.uploadUrl;
        const fields = signed.data.fields as Record<string, string> | undefined;
        if (typeof uploadUrl !== "string" || !uploadUrl.startsWith("https://api.cloudinary.com/") || typeof fields?.public_id !== "string") {
          setError(GENERIC_ERROR);
          return;
        }

        setPhase("uploading");
        setProgress(0);
        try {
          await sendToStorage(uploadUrl, fields, file, setProgress);
        } catch {
          setError(UPLOAD_ERROR);
          return;
        }
        upload = { productId, imageKey: fields.public_id, file };
        setUploaded(upload);
      }

      setPhase("saving");
      const saved = await callUploadRoute({
        step: "finalize",
        productId,
        imageKey: upload.imageKey,
        ...(caption.trim() ? { caption } : {}),
        ...(displayName.trim() ? { displayName } : {}),
      });

      if (!saved.ok) {
        const retryable = saved.status === 0 || saved.status === 429 || saved.status >= 500;
        if (!retryable) setUploaded(null);
        setError(saved.error);
        return;
      }

      setUploaded(null);
      clearPhoto();
      setCaption("");
      setDisplayName("");
      setSubmitted(true);
      toast.success("Thanks — your project has been sent for review.");
      router.refresh();
    } finally {
      setPhase("idle");
    }
  }

  const statusText =
    phase === "signing"
      ? "Preparing your upload…"
      : phase === "uploading"
        ? `Uploading your photo… ${progress}%`
        : phase === "saving"
          ? "Saving your project…"
          : "";

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-product`}>
          Pattern <span className="text-destructive">*</span>
        </Label>
        <select
          id={`${id}-product`}
          value={productId}
          disabled={busy}
          onChange={(event) => {
            setProductId(event.target.value);
            setError(null);
            setSubmitted(false);
          }}
          className="h-11 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 md:text-sm"
        >
          <option value="">Choose a pattern you bought</option>
          {products.map((product) => (
            <option key={product.id} value={product.id} disabled={product.remaining === 0}>
              {product.remaining === 0 ? `${product.name} (3 of 3 shared)` : product.name}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          You can share up to 3 projects per pattern. Projects that aren&apos;t approved don&apos;t count.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${id}-photo`}>
          Photo <span className="text-destructive">*</span>
        </Label>
        <Input
          ref={fileInput}
          id={`${id}-photo`}
          type="file"
          accept={PROJECT_IMAGE_CONTENT_TYPES.join(",")}
          disabled={busy}
          onChange={onFileChange}
          aria-invalid={Boolean(fileError)}
          aria-describedby={`${id}-photo-help`}
          className="h-auto py-2 sm:h-auto"
        />
        <p id={`${id}-photo-help`} className="text-xs text-muted-foreground">
          JPEG, PNG or WebP, up to 10 MB and at least 300 pixels on each side. Your photo is stored privately and
          reviewed before it&apos;s approved.
        </p>

        {file && (
          <div className="mt-3 flex items-center gap-4 rounded-lg border border-border p-3">
            <div className="relative size-20 shrink-0 overflow-hidden rounded-md bg-surface-alt">
              {previewUrl && (
                // A local object URL for the file the customer just chose — it never
                // leaves this device, so next/image's optimiser has nothing to fetch.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrl}
                  alt="Preview of the photo you chose"
                  onLoad={onPreviewLoad}
                  onError={() => setFileError("This photo can't be read. Choose a JPEG, PNG or WebP.")}
                  className="size-full object-cover"
                />
              )}
            </div>
            <div className="min-w-0 flex-1 text-sm">
              <p className="truncate font-medium text-foreground">{file.name}</p>
              <p className="text-muted-foreground">
                {formatSize(file.size)}
                {dimensions && ` · ${dimensions.width} × ${dimensions.height}`}
              </p>
              {fileError && (
                <p role="alert" className="mt-1 text-xs text-destructive">
                  {fileError}
                </p>
              )}
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={clearPhoto} disabled={busy}>
              Remove
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${id}-name`}>Display name</Label>
        <Input
          id={`${id}-name`}
          value={displayName}
          maxLength={PROJECT_DISPLAY_NAME_MAX}
          disabled={busy}
          onChange={(event) => setDisplayName(event.target.value)}
          placeholder="e.g. Sam from Leeds"
          aria-invalid={Boolean(textErrors.displayName)}
          aria-describedby={`${id}-name-help`}
          autoComplete="off"
        />
        <div id={`${id}-name-help`} className="flex justify-between gap-3 text-xs">
          <span className={textErrors.displayName ? "text-destructive" : "text-muted-foreground"}>
            {textErrors.displayName ?? "Optional. Never your email address."}
          </span>
          <span className="text-muted-foreground tabular-nums">
            {displayName.length}/{PROJECT_DISPLAY_NAME_MAX}
          </span>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${id}-caption`}>Caption</Label>
        <Textarea
          id={`${id}-caption`}
          value={caption}
          maxLength={PROJECT_CAPTION_MAX}
          rows={3}
          disabled={busy}
          onChange={(event) => setCaption(event.target.value)}
          placeholder="Yarn, hook size, what you changed…"
          aria-invalid={Boolean(textErrors.caption)}
          aria-describedby={`${id}-caption-count`}
        />
        <div className="flex justify-between gap-3 text-xs">
          <span className="text-destructive">{textErrors.caption}</span>
          <span id={`${id}-caption-count`} className="text-muted-foreground tabular-nums">
            {caption.length}/{PROJECT_CAPTION_MAX}
          </span>
        </div>
      </div>

      {phase === "uploading" && (
        <div
          role="progressbar"
          aria-label="Upload progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
          className="h-2 w-full overflow-hidden rounded-full bg-surface-alt"
        >
          <div className="h-full bg-brand-700 transition-[width] duration-200" style={{ width: `${progress}%` }} />
        </div>
      )}

      <p aria-live="polite" className="sr-only">
        {statusText}
      </p>

      {error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </p>
      )}

      {submitted && (
        <p role="status" className="border-success/30 bg-success/5 flex items-start gap-2 rounded-lg border px-3 py-2 text-sm text-foreground">
          <Check className="text-success mt-0.5 size-4 shrink-0" aria-hidden />
          Thanks — your project is in review. You&apos;ll see its status below.
        </p>
      )}

      <Button type="submit" variant="brand" size="pill" disabled={busy} className="w-full sm:w-auto">
        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Upload className="size-4" aria-hidden />}
        {busy ? statusText : uploaded ? "Try again" : "Share project"}
      </Button>
    </form>
  );
}
