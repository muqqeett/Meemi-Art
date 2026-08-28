"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import { duration, ease } from "@/lib/motion";
import { cn } from "@/lib/utils";

type GalleryImage = { id: string; url: string; alt: string };

/**
 * Product gallery: a large primary image with a thumbnail rail on desktop and
 * swipe arrows on mobile. Thumbnails are real buttons in a tablist so the
 * gallery is fully keyboard operable.
 */
export function ProductGallery({
  images,
  productName,
}: {
  images: GalleryImage[];
  productName: string;
}) {
  const [index, setIndex] = useState(0);

  if (images.length === 0) {
    return (
      <div className="flex aspect-[4/5] items-center justify-center rounded-2xl bg-surface-alt text-sm text-muted-foreground">
        No image available
      </div>
    );
  }

  const active = images[Math.min(index, images.length - 1)];
  const go = (next: number) => setIndex((next + images.length) % images.length);

  return (
    <div className="flex flex-col-reverse gap-4 lg:flex-row">
      {images.length > 1 && (
        <div
          role="tablist"
          aria-label={`${productName} images`}
          className="no-scrollbar flex gap-3 overflow-x-auto lg:flex-col lg:overflow-visible"
        >
          {images.map((image, imageIndex) => (
            <button
              key={image.id}
              role="tab"
              type="button"
              aria-selected={imageIndex === index}
              aria-label={`View image ${imageIndex + 1} of ${images.length}`}
              onClick={() => setIndex(imageIndex)}
              className={cn(
                "relative size-18 shrink-0 overflow-hidden rounded-lg bg-surface-alt lg:size-20",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600",
              )}
            >
              <Image
                src={image.url}
                alt=""
                fill
                sizes="80px"
                className={cn(
                  "object-cover transition-opacity duration-200",
                  imageIndex === index ? "opacity-100" : "opacity-70 hover:opacity-100",
                )}
              />

              {/* The selection ring travels between thumbnails instead of
                  blinking on and off. It is an inset overlay rather than a
                  border, so nothing in the rail changes size and the layout
                  animation cannot shift the row. */}
              {imageIndex === index && (
                <motion.span
                  aria-hidden
                  layoutId="gallery-thumb-active"
                  transition={{ duration: duration.fast, ease: ease.standard }}
                  className="pointer-events-none absolute inset-0 rounded-lg ring-2 ring-brand-600 ring-inset"
                />
              )}
            </button>
          ))}
        </div>
      )}

      <div className="relative flex-1 overflow-hidden rounded-2xl bg-surface-alt">
        <div className="relative aspect-[4/5]">
          <AnimatePresence mode="wait" initial={false}>
            {/* Crossfade with a whisper of scale — a slide would fight the
                thumbnail rail, which is the real navigation here. */}
            <motion.div
              key={active.id}
              data-reveal
              initial={{ opacity: 0, scale: 1.02 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1 }}
              transition={{ duration: duration.fast, ease: ease.enter }}
              className="absolute inset-0"
            >
              <Image
                src={active.url}
                alt={active.alt || productName}
                fill
                priority
                sizes="(min-width: 1024px) 46vw, 92vw"
                className="object-cover"
              />
            </motion.div>
          </AnimatePresence>
        </div>

        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(index - 1)}
              aria-label="Previous image"
              className="absolute top-1/2 left-3 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-ink shadow-sm backdrop-blur-sm transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            >
              <ChevronLeft className="size-5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => go(index + 1)}
              aria-label="Next image"
              className="absolute top-1/2 right-3 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-ink shadow-sm backdrop-blur-sm transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            >
              <ChevronRight className="size-5" aria-hidden />
            </button>

            <p
              aria-live="polite"
              className="absolute right-3 bottom-3 rounded-full bg-ink/75 px-2.5 py-1 text-xs font-medium text-white"
            >
              {index + 1} / {images.length}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
