"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, FileCheck2, Loader2, AlertCircle } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/format-bytes";
import { duration, ease } from "@/lib/motion";

export type DigitalAssetSummary = {
  filename: string;
  contentType: string;
  bytes: number;
  version: string;
  updatedAt: Date;
} | null;

/**
 * Upload or replace a product's purchasable file.
 *
 * Separate from the product form's submit for a practical reason: a 200MB
 * file has no business being re-posted every time someone fixes a typo in the
 * description. It uploads on its own, against a product that already exists.
 *
 * Which is why it is disabled until the product has been created — there is no
 * id to attach a file to before then, and offering the control anyway would
 * only produce a confusing failure.
 *
 * The response carries a filename and a size and nothing else. The storage
 * handle stays server-side, where it cannot end up in a browser's network log.
 */
export function DigitalFileField({
  productId,
  asset,
}: {
  productId: string | null;
  asset: DigitalAssetSummary;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState(asset);

  async function upload(file: File) {
    if (!productId) return;

    setState("uploading");
    setError(null);

    const body = new FormData();
    body.set("productId", productId);
    body.set("file", file);

    try {
      const response = await fetch("/api/admin/digital-upload", { method: "POST", body });
      const payload = (await response.json()) as {
        filename?: string;
        contentType?: string;
        bytes?: number;
        error?: string;
      };

      if (!response.ok) {
        setError(payload.error ?? "The upload failed.");
        setState("error");
        return;
      }

      setCurrent({
        filename: payload.filename ?? file.name,
        contentType: payload.contentType ?? file.type,
        bytes: payload.bytes ?? file.size,
        version: current?.version ?? "1",
        updatedAt: new Date(),
      });
      setState("done");
      // The publish guard reads the asset server-side, so the form needs the
      // fresh server state before "Published" can be ticked.
      router.refresh();
    } catch {
      setError("The upload failed. Check your connection and try again.");
      setState("error");
    }
  }

  if (!productId) {
    return (
      <p className="text-body rounded-xs border border-border bg-surface-alt px-4 py-3 text-sm">
        Save the product first, then upload its file here. A product cannot be
        published until it has one.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <AnimatePresence mode="wait" initial={false}>
        {current && (
          <motion.div
            key={current.filename}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: duration.fast, ease: ease.enter }}
            className="flex items-start gap-3 rounded-xs border border-border bg-surface-alt px-4 py-3"
          >
            <FileCheck2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {current.filename}
              </p>
              <p className="text-body mt-0.5 text-xs">
                {current.contentType} · {formatBytes(current.bytes)}
                {current.version && <> · v{current.version}</>}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
          // Cleared so re-picking the same file fires change again.
          event.target.value = "";
        }}
      />

      <Button
        type="button"
        variant="outline"
        disabled={state === "uploading"}
        onClick={() => inputRef.current?.click()}
      >
        {state === "uploading" ? (
          <Loader2 className="animate-spin" aria-hidden />
        ) : (
          <UploadCloud aria-hidden />
        )}
        {state === "uploading"
          ? "Uploading…"
          : current
            ? "Replace file"
            : "Upload file"}
      </Button>

      {error && (
        <p role="alert" className="flex items-start gap-2 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </p>
      )}

      <p className="text-body text-xs">
        PDF, ZIP, PNG, JPEG, SVG, MP4, MP3 or TXT, up to 200MB. Stored privately —
        customers reach it through a signed link that expires, never a public URL.
      </p>
    </div>
  );
}
