"use client";

import { useCallback, useRef, useState } from "react";
import Image from "next/image";
import {
  Upload,
  Trash2,
  Star,
  ArrowLeft,
  ArrowRight,
  Loader2,
  AlertCircle,
  Check,
  ImageIcon,
  Replace,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { duration, ease } from "@/lib/motion";
import { cn } from "@/lib/utils";

export type ManagedImage = {
  url: string;
  alt: string;
  /** Storage handle, kept so the object can be deleted from the CDN later. */
  key?: string | null;
};

type UploadSlot = {
  id: string;
  name: string;
  progress: number;
  error?: string;
  /**
   * Set only once the server has returned a URL. The success tick is driven by
   * this and nothing else — an upload is never shown as done on optimism.
   */
  done?: boolean;
};

const MAX_IMAGES = 8;
/** How long the confirmed tick stays before the row clears itself. */
const SUCCESS_HOLD_MS = 900;
const MAX_MB = 8;
const ACCEPT = "image/jpeg,image/png,image/webp,image/avif";

/**
 * Product image manager.
 *
 * The first image is the primary one — it is what appears on cards, in search
 * and in Open Graph metadata — so ordering is meaningful rather than cosmetic.
 * "Set primary" moves an image to position one; the arrows nudge it either way.
 *
 * Uploads run one file at a time through `/api/admin/upload` with real progress
 * from XMLHttpRequest (fetch cannot report upload progress), and each file
 * reports its own failure without taking down the rest of the batch.
 */
export function ProductImageManager({
  images,
  onChange,
  error,
}: {
  images: ManagedImage[];
  onChange: (next: ManagedImage[]) => void;
  error?: string;
}) {
  const [slots, setSlots] = useState<UploadSlot[]>([]);
  /** True while files are dragged over the drop zone. */
  const [dragging, setDragging] = useState(false);
  /** Index of the tile currently being dragged to a new position, if any. */
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const replaceIndexRef = useRef<number | null>(null);

  const uploadOne = useCallback((file: File, slotId: string): Promise<ManagedImage | null> => {
    return new Promise((resolve) => {
      const body = new FormData();
      body.append("file", file);

      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/admin/upload");

      xhr.upload.addEventListener("progress", (event) => {
        if (!event.lengthComputable) return;
        const progress = Math.round((event.loaded / event.total) * 100);
        setSlots((current) =>
          current.map((slot) => (slot.id === slotId ? { ...slot, progress } : slot)),
        );
      });

      xhr.addEventListener("load", () => {
        let payload: { url?: string; key?: string; error?: string } = {};
        try {
          payload = JSON.parse(xhr.responseText);
        } catch {
          payload = {};
        }

        if (xhr.status >= 200 && xhr.status < 300 && payload.url) {
          resolve({ url: payload.url, key: payload.key ?? null, alt: "" });
          return;
        }

        setSlots((current) =>
          current.map((slot) =>
            slot.id === slotId
              ? { ...slot, error: payload.error ?? `Upload failed (${xhr.status}).` }
              : slot,
          ),
        );
        resolve(null);
      });

      xhr.addEventListener("error", () => {
        setSlots((current) =>
          current.map((slot) =>
            slot.id === slotId ? { ...slot, error: "Network error during upload." } : slot,
          ),
        );
        resolve(null);
      });

      xhr.send(body);
    });
  }, []);

  const handleFiles = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;

      const replaceAt = replaceIndexRef.current;
      replaceIndexRef.current = null;

      const incoming = Array.from(fileList);
      const room = replaceAt !== null ? 1 : MAX_IMAGES - images.length;
      const accepted = incoming.slice(0, Math.max(0, room));

      const rejected: UploadSlot[] = incoming.slice(accepted.length).map((file) => ({
        id: crypto.randomUUID(),
        name: file.name,
        progress: 0,
        error: `Only ${MAX_IMAGES} images per product.`,
      }));

      const active: UploadSlot[] = accepted.map((file) => ({
        id: crypto.randomUUID(),
        name: file.name,
        progress: 0,
      }));

      setSlots((current) => [...current, ...active, ...rejected]);

      const uploaded: ManagedImage[] = [];
      for (const [index, file] of accepted.entries()) {
        // Reject oversized files before spending bandwidth on them.
        if (file.size > MAX_MB * 1024 * 1024) {
          setSlots((current) =>
            current.map((slot) =>
              slot.id === active[index].id
                ? { ...slot, error: `Larger than ${MAX_MB}MB.` }
                : slot,
            ),
          );
          continue;
        }

        const result = await uploadOne(file, active[index].id);
        if (result) {
          uploaded.push({ ...result, alt: "" });

          // The server has confirmed the object exists. Hold the tick briefly
          // so the outcome is legible, then let the row animate out.
          const slotId = active[index].id;
          setSlots((current) =>
            current.map((slot) =>
              slot.id === slotId ? { ...slot, progress: 100, done: true } : slot,
            ),
          );
          window.setTimeout(
            () => setSlots((current) => current.filter((slot) => slot.id !== slotId)),
            SUCCESS_HOLD_MS,
          );
        }
      }

      if (uploaded.length === 0) return;

      if (replaceAt !== null) {
        const next = [...images];
        // Keep the alt text already written for that slot.
        next[replaceAt] = { ...uploaded[0], alt: images[replaceAt]?.alt ?? "" };
        onChange(next);
      } else {
        onChange([...images, ...uploaded]);
      }
    },
    [images, onChange, uploadOne],
  );

  function move(from: number, to: number) {
    if (to < 0 || to >= images.length) return;
    const next = [...images];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  }

  function makePrimary(index: number) {
    move(index, 0);
  }

  function remove(index: number) {
    onChange(images.filter((_, i) => i !== index));
  }

  function setAlt(index: number, alt: string) {
    onChange(images.map((image, i) => (i === index ? { ...image, alt } : image)));
  }

  const atCapacity = images.length >= MAX_IMAGES;

  return (
    <div className="space-y-4">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="sr-only"
        onChange={(event) => {
          void handleFiles(event.target.files);
          event.target.value = "";
        }}
      />

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void handleFiles(event.dataTransfer.files);
        }}
        className={cn(
          "flex flex-col items-center justify-center gap-3 border border-dashed px-6 py-10 text-center transition-colors",
          dragging ? "border-brand-700 bg-brand-50" : "border-border bg-surface-alt",
          atCapacity && "opacity-60",
        )}
      >
        <ImageIcon className="size-6 text-brand-700" aria-hidden />
        <div>
          <p className="text-sm font-medium text-foreground">
            Drag photos here, or choose files
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            JPEG, PNG, WebP or AVIF · up to {MAX_MB}MB each · {images.length}/{MAX_IMAGES}{" "}
            used
          </p>
        </div>

        <Button
          type="button"
          variant="brandOutline"
          size="pillSm"
          disabled={atCapacity}
          onClick={() => inputRef.current?.click()}
        >
          <Upload aria-hidden />
          Choose photos
        </Button>
      </div>

      {/* Idle → uploading → confirmed, or → failed. Rows collapse rather than
          vanishing, so a batch does not jump under the pointer as each file
          finishes. */}
      {/* `empty:hidden` keeps the parent's vertical rhythm intact while the
          list is empty — the element has to stay mounted for exit animations
          to run, but it must not claim a gap when there is nothing in it. */}
      <ul className="space-y-2 empty:hidden" aria-live="polite">
        <AnimatePresence initial={false}>
          {slots.map((slot) => (
            <motion.li
              key={slot.id}
              layout
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: duration.fast, ease: ease.standard }}
              className="overflow-hidden"
            >
              <span className="flex items-center gap-3 border border-border bg-card px-3 py-2 text-sm">
                {slot.error ? (
                  <AlertCircle className="size-4 shrink-0 text-destructive" aria-hidden />
                ) : slot.done ? (
                  <motion.span
                    initial={{ scale: 0.5 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: duration.fast, ease: ease.enter }}
                    className="inline-flex shrink-0"
                  >
                    <Check className="size-4 text-success" aria-hidden />
                  </motion.span>
                ) : (
                  <Loader2
                    className="size-4 shrink-0 animate-spin text-brand-700"
                    aria-hidden
                  />
                )}

                <span className="min-w-0 flex-1 truncate">{slot.name}</span>

                {slot.error ? (
                  <>
                    <span className="text-xs text-destructive">{slot.error}</span>
                    <button
                      type="button"
                      onClick={() => setSlots((c) => c.filter((s) => s.id !== slot.id))}
                      className="text-muted-foreground hover:text-foreground"
                      aria-label={`Dismiss error for ${slot.name}`}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </>
                ) : slot.done ? (
                  <span className="text-xs font-medium text-success">Uploaded</span>
                ) : (
                  <span className="flex items-center gap-2">
                    <span className="h-1 w-24 overflow-hidden bg-surface-deep">
                      <span
                        className="block h-full bg-brand-700 transition-[width] duration-200 ease-out"
                        style={{ width: `${slot.progress}%` }}
                      />
                    </span>
                    <span className="w-9 text-right text-xs text-muted-foreground tabular-nums">
                      {slot.progress}%
                    </span>
                  </span>
                )}
              </span>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      <AnimatePresence>
        {error && (
          <motion.p
            role="alert"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: duration.fast, ease: ease.standard }}
            className="text-sm text-destructive"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      {images.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2">
          {images.map((image, index) => (
            <li
              key={`${image.url}-${index}`}
              // Drag is an enhancement layered on top of the move buttons
              // below, which remain the keyboard-operable path.
              draggable
              onDragStart={() => setDragIndex(index)}
              onDragEnd={() => setDragIndex(null)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                if (dragIndex !== null && dragIndex !== index) move(dragIndex, index);
                setDragIndex(null);
              }}
              className={cn(
                "flex cursor-grab gap-3 border bg-card p-3 transition-colors active:cursor-grabbing",
                index === 0 ? "border-brand-700" : "border-border",
                dragIndex === index && "opacity-50",
              )}
            >
              <span className="relative size-24 shrink-0 overflow-hidden bg-surface-alt">
                <Image
                  src={image.url}
                  alt={image.alt || "Product photo preview"}
                  fill
                  sizes="96px"
                  className="object-contain"
                  unoptimized
                />
                {index === 0 && (
                  <span className="label-caps absolute inset-x-0 bottom-0 bg-brand-700 py-0.5 text-center text-[0.5625rem] text-white">
                    Primary
                  </span>
                )}
              </span>

              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="space-y-1">
                  <Label htmlFor={`alt-${index}`} className="text-xs">
                    Alt text
                  </Label>
                  <Input
                    id={`alt-${index}`}
                    value={image.alt}
                    onChange={(event) => setAlt(index, event.target.value)}
                    placeholder="Describe the photo for screen readers"
                    className="h-9 text-sm"
                  />
                </div>

                <div className="mt-auto flex flex-wrap items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-lg"
                    onClick={() => makePrimary(index)}
                    disabled={index === 0}
                    aria-label={`Make image ${index + 1} the primary photo`}
                    title="Set as primary"
                  >
                    <Star className={cn(index === 0 && "fill-star text-star")} aria-hidden />
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-lg"
                    onClick={() => move(index, index - 1)}
                    disabled={index === 0}
                    aria-label={`Move image ${index + 1} earlier`}
                    title="Move earlier"
                  >
                    <ArrowLeft aria-hidden />
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-lg"
                    onClick={() => move(index, index + 1)}
                    disabled={index === images.length - 1}
                    aria-label={`Move image ${index + 1} later`}
                    title="Move later"
                  >
                    <ArrowRight aria-hidden />
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-lg"
                    onClick={() => {
                      replaceIndexRef.current = index;
                      inputRef.current?.click();
                    }}
                    aria-label={`Replace image ${index + 1}`}
                    title="Replace"
                  >
                    <Replace aria-hidden />
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-lg"
                    className="ml-auto text-muted-foreground hover:text-destructive"
                    onClick={() => remove(index)}
                    aria-label={`Remove image ${index + 1}`}
                    title="Remove"
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
