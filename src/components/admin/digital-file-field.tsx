"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, FileCheck2, Loader2, AlertCircle } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { UploadError, postUploadStep, sendToCloudinary } from "@/components/admin/direct-upload";
import { formatBytes } from "@/lib/format-bytes";
import { duration, ease } from "@/lib/motion";
import {
  ALLOWED_DIGITAL_TYPES,
  CONTENT_SNIFF_BYTES,
  MAX_DIGITAL_BYTES,
  digitalContentMatches,
} from "@/lib/storage/types";

const MAX_MB = MAX_DIGITAL_BYTES / (1024 * 1024);

const DIGITAL_MESSAGES = {
  failed: "PDF upload failed. Please try again.",
  tooLarge: `PDF upload failed because the file is too large. Files must be ${MAX_MB} MB or smaller.`,
  wrongType: "Only PDF, ZIP, PNG, JPEG, SVG, MP4, MP3 and TXT files are supported for digital products.",
};

/**
 * The type to declare for a file. Some systems give a PDF no MIME type at all;
 * the extension then stands in as the claim, and the content check that
 * follows — here and on the server — decides whether it is true.
 */
function declaredTypeOf(file: File): string {
  if (file.type) return file.type;
  return /\.pdf$/i.test(file.name) ? "application/pdf" : "";
}

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
 * The file goes straight to Cloudinary, privately, with parameters
 * `/api/admin/digital-upload` signs; the route then verifies the stored file —
 * including that its content really is the declared type — before attaching it
 * to the product. It used to be posted through the route itself, which Vercel
 * refuses above 4.5 MB.
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
  const [progress, setProgress] = useState(0);
  const [current, setCurrent] = useState(asset);

  async function upload(file: File) {
    if (!productId || state === "uploading") return;

    setError(null);
    const reject = (message: string) => {
      setError(message);
      setState("error");
    };

    // First gate, before any bandwidth is spent. The server checks all of it
    // again against what storage actually holds.
    const type = declaredTypeOf(file);
    if (!(ALLOWED_DIGITAL_TYPES as readonly string[]).includes(type)) return reject(DIGITAL_MESSAGES.wrongType);
    if (file.size === 0) return reject("That file is empty.");
    if (file.size > MAX_DIGITAL_BYTES) return reject(DIGITAL_MESSAGES.tooLarge);

    const head = new Uint8Array(await file.slice(0, CONTENT_SNIFF_BYTES).arrayBuffer());
    if (!digitalContentMatches(head, type)) {
      return reject(
        type === "application/pdf"
          ? "That file isn't a valid PDF. Only real PDF files can be uploaded as PDFs."
          : "That file's contents don't match its file type.",
      );
    }

    setState("uploading");
    setProgress(0);

    try {
      const endpoint = "/api/admin/digital-upload";
      const signed = await postUploadStep<{ uploadUrl: string; fields: Record<string, string> }>(
        endpoint,
        { step: "sign", productId, filename: file.name, type, size: file.size },
        DIGITAL_MESSAGES,
      );
      // Sent as "upload" (no extension) so the stored id matches existing files;
      // the real filename is recorded by finalize below.
      const key = await sendToCloudinary(signed.uploadUrl, signed.fields, file, DIGITAL_MESSAGES, setProgress, "upload");
      const payload = await postUploadStep<{ filename: string; contentType: string; bytes: number }>(
        endpoint,
        { step: "finalize", productId, key, filename: file.name, type },
        DIGITAL_MESSAGES,
      );

      setCurrent({
        filename: payload.filename,
        contentType: payload.contentType,
        bytes: payload.bytes,
        version: current?.version ?? "1",
        updatedAt: new Date(),
      });
      setState("done");
      // The publish guard reads the asset server-side, so the form needs the
      // fresh server state before "Published" can be ticked.
      router.refresh();
    } catch (caught) {
      reject(caught instanceof UploadError ? caught.message : DIGITAL_MESSAGES.failed);
    }
  }

  if (!productId) {
    return (
      <p className="text-body rounded-md border border-border bg-[var(--admin-raised)] px-4 py-3 text-sm">
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
            className="flex items-start gap-3 rounded-md border border-border bg-[var(--admin-raised)] px-4 py-3"
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
        accept={`${ALLOWED_DIGITAL_TYPES.join(",")},.pdf`}
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
          ? `Uploading… ${progress}%`
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
        PDF, ZIP, PNG, JPEG, SVG, MP4, MP3 or TXT, up to {MAX_MB}MB. Stored privately —
        customers reach it through a signed link that expires, never a public URL.
      </p>
    </div>
  );
}
