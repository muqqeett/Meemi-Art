"use client";

import { useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

type GalleryImage = { id: string; url: string; alt: string };

/**
 * Fullscreen product viewer.
 *
 * ── Why this is portalled ──────────────────────────────────────────────────
 *
 * `PageTransition` wraps every route in `.page-enter`, whose entrance keyframe
 * uses `animation-fill-mode: both`. When it finishes it holds
 * `transform: matrix(1, 0, 0, 1, 0, 0)` — an identity transform, not the
 * keyword `none` — and any computed transform other than `none` makes an
 * element the containing block for its `position: fixed` descendants. A viewer
 * rendered in place would therefore be pinned inside the page column instead of
 * covering the screen. Portalling to `body` steps outside that ancestor.
 *
 * Rendered only while open, so the browser never fetches the large sources for
 * a viewer nobody asked for — the PDP's LCP image is the one in the stage, not
 * anything here.
 */
export function PdpLightbox({
  images,
  index,
  productName,
  onIndexChange,
  onClose,
}: {
  images: GalleryImage[];
  index: number;
  productName: string;
  onIndexChange: (next: number) => void;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);

  const step = useCallback(
    (by: number) => {
      onIndexChange((index + by + images.length) % images.length);
    },
    [index, images.length, onIndexChange],
  );

  useEffect(() => {
    closeRef.current?.focus();

    // Lock both, because `html` carries `h-full` and is the scrolling box —
    // locking `body` alone leaves the page scrolling behind the viewer.
    const root = document.documentElement;
    const prev = { root: root.style.overflow, body: document.body.style.overflow };
    root.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      root.style.overflow = prev.root;
      document.body.style.overflow = prev.body;
    };
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") return onClose();
      if (event.key === "ArrowRight") return step(1);
      if (event.key === "ArrowLeft") return step(-1);

      // Keep Tab inside the viewer.
      if (event.key !== "Tab" || !surfaceRef.current) return;
      const focusable = surfaceRef.current.querySelectorAll<HTMLElement>(
        "button:not([disabled])",
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, step]);

  // This only ever renders after a click, so it never reaches the server
  // renderer; the guard is belt-and-braces against a future caller.
  if (typeof document === "undefined") return null;

  const active = images[Math.min(index, images.length - 1)];
  const control =
    "inline-flex size-11 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white backdrop-blur transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

  return createPortal(
    /* The overlay is a plain `div` where it was once a `motion.div`, and it
       carries no entrance animation at all.

       It was changed after the viewer appeared to open without ever becoming
       fully opaque, leaving the picture unpainted even though the image
       element was present, loaded and correctly sized. A CSS fade was tried
       as the replacement and looked no better.

       Both observations came from an inspection pane with a frozen animation
       timeline — see the note in `pdp-gallery.tsx` — which strands every
       animation at its first frame and fully explains what was seen. Framer
       was not shown to be at fault, and neither was the CSS.

       Having no entrance here is still the right call, and for a reason that
       survives the correction: `tw-animate-css` applies
       `animation-fill-mode: both`, so an animation that does not run holds
       its 0% frame — opacity 0 — indefinitely. For a viewer whose only job is
       to show the picture, that is a failure mode worth designing out rather
       than an animation worth keeping. */
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${productName} — image ${index + 1} of ${images.length}`}
      className="fixed inset-0 z-[70] flex flex-col bg-ink/92 backdrop-blur-sm"
      // A click that started and ended on the backdrop closes; one that began
      // on the image and drifted does not.
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div ref={surfaceRef} className="flex min-h-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 px-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
          <p className="text-sm text-white/70 tabular-nums">
            {String(index + 1).padStart(2, "0")}{" "}
            <span className="text-white/35">/ {String(images.length).padStart(2, "0")}</span>
          </p>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className={control}
            aria-label="Close image viewer"
          >
            <X className="size-5" aria-hidden />
          </button>
        </header>

        <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 py-6 sm:px-16">
          {/* Plain React, matching the overlay above and for the same reason.

              `key` remounts the frame whenever the selection changes, so the
              new source is swapped in cleanly. There is deliberately no
              entrance animation on it — same fill-mode argument as the
              overlay: nothing should stand between opening the viewer and
              seeing the picture. */}
          <div key={active.id} className="relative size-full">
            <Image
              src={active.url}
              alt={active.alt || productName}
              fill
              sizes="100vw"
              className="object-contain"
              priority
            />
          </div>

          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => step(-1)}
                className={cn(control, "absolute top-1/2 left-2 -translate-y-1/2 sm:left-5")}
                aria-label="Previous image"
              >
                <ChevronLeft className="size-5" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => step(1)}
                className={cn(control, "absolute top-1/2 right-2 -translate-y-1/2 sm:right-5")}
                aria-label="Next image"
              >
                <ChevronRight className="size-5" aria-hidden />
              </button>
            </>
          )}
        </div>

        {images.length > 1 && (
          <div className="flex justify-center gap-2 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            {images.map((image, i) => (
              <button
                key={image.id}
                type="button"
                onClick={() => {
                  onIndexChange(i);
                }}
                aria-label={`View image ${i + 1}`}
                aria-current={i === index}
                className="inline-flex size-11 items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                <span
                  className={cn(
                    "h-1 rounded-full transition-all duration-300",
                    i === index ? "w-6 bg-white" : "w-1.5 bg-white/35",
                  )}
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
