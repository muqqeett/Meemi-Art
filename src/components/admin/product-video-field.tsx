"use client";

import { useRef, useState } from "react";
import { Film, Loader2, AlertCircle, Replace, Trash2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  ALLOWED_VIDEO_TYPES,
  MAX_VIDEO_BYTES,
  sniffVideoType,
  videoPosterUrl,
} from "@/lib/storage/types";
import { cn } from "@/lib/utils";

export type ManagedVideo = { url: string; key: string | null };

type Signed = {
  cloudName: string;
  /** Sent verbatim: the server signed exactly these, and nothing else. */
  fields: Record<string, string>;
};

const ACCEPT = ALLOWED_VIDEO_TYPES.join(",");

/**
 * The product's single optional video.
 *
 * Deliberately separate from `ProductImageManager` rather than folded into it:
 * the photo manager's behaviour — upload, reorder, primary, alt text — stays
 * exactly as it was, and "one video at most" is enforced by this field having
 * one value instead of by a rule inside a list.
 *
 * Nothing is saved here. Like uploaded photos, the resulting URL and key travel
 * with the form and are written when the product is saved; a replaced or
 * removed video's stored object is reclaimed by `updateProduct` at that point.
 */
export function ProductVideoField({
  value,
  onChange,
}: {
  value: ManagedVideo | null;
  onChange: (next: ManagedVideo | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const busy = progress !== null || verifying;

  async function post<T>(body: Record<string, unknown>): Promise<T> {
    const response = await fetch("/api/admin/video-upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
    if (!response.ok) throw new Error(payload.error ?? `Upload failed (${response.status}).`);
    return payload;
  }

  function sendToCloudinary(file: File, signed: Signed): Promise<string> {
    return new Promise((resolve, reject) => {
      const body = new FormData();
      for (const [name, value] of Object.entries(signed.fields)) body.append(name, value);
      body.append("file", file);

      const xhr = new XMLHttpRequest();
      xhr.open("POST", `https://api.cloudinary.com/v1_1/${signed.cloudName}/video/upload`);

      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) setProgress(Math.round((event.loaded / event.total) * 100));
      });

      xhr.addEventListener("load", () => {
        let payload: { public_id?: string; error?: { message?: string } } = {};
        try {
          payload = JSON.parse(xhr.responseText);
        } catch {
          payload = {};
        }
        if (xhr.status >= 200 && xhr.status < 300 && payload.public_id) {
          resolve(payload.public_id);
        } else {
          reject(new Error(payload.error?.message ?? `Upload failed (${xhr.status}).`));
        }
      });
      xhr.addEventListener("error", () => reject(new Error("Network error during upload.")));

      xhr.send(body);
    });
  }

  async function handleFile(file: File | undefined) {
    if (!file || busy) return;
    setError(null);

    if (!(ALLOWED_VIDEO_TYPES as readonly string[]).includes(file.type)) {
      setError("Choose an MP4 or WebM video.");
      return;
    }
    if (file.size === 0) {
      setError("That file is empty.");
      return;
    }
    if (file.size > MAX_VIDEO_BYTES) {
      setError("Videos must be 50 MB or smaller.");
      return;
    }

    // The declared type is a claim; the first bytes are evidence. A renamed
    // image, or a file whose contents disagree with its type, stops here.
    const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    if (sniffVideoType(head) !== file.type) {
      setError("That file's contents don't match an MP4 or WebM video.");
      return;
    }

    try {
      setProgress(0);
      const signed = await post<Signed>({
        step: "sign",
        filename: file.name,
        type: file.type,
        size: file.size,
      });

      const publicId = await sendToCloudinary(file, signed);
      setProgress(null);
      setVerifying(true);

      const stored = await post<{ url: string; key: string }>({ step: "finalize", publicId });
      onChange({ url: stored.url, key: stored.key });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Upload failed.");
    } finally {
      setProgress(null);
      setVerifying(false);
    }
  }

  return (
    <div className="space-y-4">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          void handleFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />

      {value ? (
        <div className="flex flex-col gap-3 border border-border bg-card p-3 sm:flex-row">
          {/* A real player, so the editor can check the clip they uploaded.
              Native controls are keyboard-operable as they stand. */}
          <video
            src={value.url}
            poster={videoPosterUrl(value.url) ?? undefined}
            controls
            muted
            playsInline
            preload="metadata"
            aria-label="Product video preview"
            className="aspect-square w-full shrink-0 bg-[var(--admin-raised)] object-contain sm:w-40"
          />

          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <p className="text-sm font-medium text-foreground">Product video</p>
            <p className="text-xs text-muted-foreground">
              Shown second in the product gallery, after the primary photo. It never
              appears on cards, in search, at checkout or in link previews.
            </p>

            <div className="mt-auto flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => inputRef.current?.click()}
                disabled={busy}
              >
                <Replace aria-hidden />
                Replace
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onChange(null)}
                disabled={busy}
              >
                <Trash2 aria-hidden />
                Remove
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div
          onDragOver={(event) => {
            event.preventDefault();
            if (!busy) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            void handleFile(event.dataTransfer.files?.[0]);
          }}
          className={cn(
            "flex flex-col items-center justify-center gap-3 border border-dashed px-6 py-10 text-center transition-colors",
            dragging ? "border-brand-700 bg-brand-50" : "border-border bg-[var(--admin-raised)]",
          )}
        >
          <Film className="size-6 text-brand-700" aria-hidden />
          <div>
            <p className="text-sm font-medium text-foreground">
              Drag a video here, or choose a file
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              One MP4 or WebM, up to 50 MB. Optional.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
          >
            <Upload aria-hidden />
            Choose video
          </Button>
        </div>
      )}

      {busy && (
        <div className="space-y-2" role="status" aria-live="polite">
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
            {verifying ? "Checking the upload…" : `Uploading video… ${progress ?? 0}%`}
          </p>
          <div className="h-1 overflow-hidden bg-border">
            <div
              className="h-full bg-brand-700 transition-[width] duration-200"
              style={{ width: `${verifying ? 100 : (progress ?? 0)}%` }}
            />
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="flex items-center gap-2 text-xs text-destructive">
          <AlertCircle className="size-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      )}
    </div>
  );
}
