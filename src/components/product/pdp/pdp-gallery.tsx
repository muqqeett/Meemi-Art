"use client";

import { useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Share2,
  Check,
  Maximize2,
} from "lucide-react";

import { WishlistButton } from "@/components/product/wishlist-button";
import { PdpLightbox } from "@/components/product/pdp/pdp-lightbox";
import { duration, ease } from "@/lib/motion";
import { cn } from "@/lib/utils";

type GalleryImage = { id: string; url: string; alt: string };

/**
 * Product gallery — Figma 79:665.
 *
 *   row       458 image column + 35 gap + 52 rail
 *   main      458 × 610, #F2F2F2 ground, 8px radius
 *   thumbs    76 × 101 each, 20.237 apart, right-aligned under the main image
 *   rail      wishlist and share at the top, up/down at the bottom, each a
 *             52 × 52 #F2F2F2 square with a 20px glyph and 16px padding
 *
 * The arrows step the selection rather than scrolling a strip: with at most a
 * handful of shots there is nothing to scroll, and a control that sometimes
 * does nothing is worse than one that always advances.
 *
 * The rail collapses under the image below `lg`, where a 52px column beside a
 * shrinking photo costs more width than it earns.
 */
export function PdpGallery({
  images,
  productId,
  productName,
  isWishlisted,
}: {
  images: GalleryImage[];
  productId: string;
  productName: string;
  isWishlisted: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  if (images.length === 0) {
    return (
      <div className="flex aspect-square w-full items-center justify-center rounded-2xl border border-pdp-hairline bg-pdp-surface text-sm text-pdp-body">
        No image available
      </div>
    );
  }

  const active = images[Math.min(index, images.length - 1)];
  const step = (by: number) => {
    setLoaded(false);
    setIndex((i) => (i + by + images.length) % images.length);
  };

  /**
   * Copies the page URL. `navigator.share` is offered first because on a phone
   * it opens the real share sheet; the clipboard is the desktop fallback and
   * gets a visible confirmation, since nothing else on screen would change.
   */
  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: productName, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // A dismissed share sheet is a user decision, not an error.
    }
  }

  const railButton =
    "flex size-[52px] items-center justify-center rounded-[8px] bg-pdp-surface text-pdp-price transition-colors hover:bg-pdp-hairline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pdp-price";

  return (
    /* Capped at the design's 458px while stacked and centred: the 458×610
       portrait scales with the column, and on a tablet a full-width gallery
       would stand 918px tall and push the price and buy buttons off screen. */
    <div className="mx-auto flex w-full min-w-0 flex-col gap-5 sm:max-w-[458px] lg:mx-0 lg:max-w-none lg:flex-row lg:gap-[35px]">
      <div className="flex min-w-0 flex-1 flex-col gap-3 sm:gap-6 wide:w-[458px] wide:flex-none">
        {/* The stage — Figma direction, MeemiArt tokens.

            Square at every width, and the artwork runs to the frame.

            The drawn 458×610 was built around a portrait bottle; every image in
            this catalogue is 1:1, so that frame left 109px of dead band above
            and below the art at 1440, and a 32px inset on each side on top of
            it — 36% of the stage showing nothing. A square frame with no
            padding gives the picture the whole area. A non-square upload still
            fits whole: `object-contain` letterboxes it rather than cropping.

            `group` drives the hover zoom and the controls' reveal; the whole
            thing is a button, so the image is clickable and keyboard-reachable
            without a nested-interactive warning. */}
        <div className="group/stage relative aspect-square w-full overflow-hidden rounded-2xl border border-pdp-hairline bg-pdp-surface">
          {/* Ambient glow. Two very low-opacity radial washes in brand tokens —
              enough to lift the product off a flat rectangle, nowhere near
              enough to tint it. Sits under the image and ignores pointers. */}
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute -top-1/4 left-1/2 size-[85%] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,var(--color-royal-200)_0%,transparent_70%)] opacity-40 blur-[64px]" />
            <div className="absolute -bottom-1/4 left-1/2 size-[70%] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,var(--color-brand-200)_0%,transparent_70%)] opacity-35 blur-[64px]" />
          </div>

          <button
            type="button"
            onClick={() => setZoomed(true)}
            aria-label={`Open ${productName} image ${index + 1} full screen`}
            className="absolute inset-0 cursor-zoom-in focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-pdp-price"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={active.id}
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.99 }}
                transition={{ duration: duration.normal, ease: ease.enter }}
                className="absolute inset-0 block"
              >
                <Image
                  src={active.url}
                  alt={active.alt || productName}
                  fill
                  priority
                  sizes="(min-width: 1440px) 458px, (min-width: 1024px) 40vw, (min-width: 640px) 458px, 92vw"
                  onLoad={() => setLoaded(true)}
                  ref={(node) => {
                    // A cached image is already decoded before React attaches
                    // `onLoad`, so that handler never fires and the placeholder
                    // would sit on top of a picture that is already there.
                    if (node?.complete) setLoaded(true);
                  }}
                  /* Contained, so the artwork is never cropped. The hover zoom
                     is 3.5% and lives inside `overflow-hidden`, so it cannot
                     escape the rounded stage. Disabled under reduced motion. */
                  className="object-contain transition-transform duration-500 ease-out group-hover/stage:scale-[1.02] motion-reduce:transition-none motion-reduce:group-hover/stage:scale-100"
                />
              </motion.span>
            </AnimatePresence>
          </button>

          {/* Soft placeholder until the first image decodes. No spinner — a
              tinted panel the same size as the image cannot shift layout. */}
          {!loaded && (
            <div aria-hidden className="pointer-events-none absolute inset-0 animate-pulse bg-pdp-hairline/40" />
          )}

          {/* Counter, top-right. Small, translucent, tabular so it cannot
              jitter as the index changes. */}
          {images.length > 1 && (
            <p className="pointer-events-none absolute top-3 right-3 rounded-full border border-pdp-hairline bg-surface/70 px-2.5 py-1 text-xs text-pdp-meta backdrop-blur tabular-nums">
              {String(index + 1).padStart(2, "0")}
              <span className="text-pdp-subtle"> / {String(images.length).padStart(2, "0")}</span>
            </p>
          )}

          {/* Expand, bottom-right. Quiet until the stage is hovered or a
              keyboard reaches it; always visible on touch, where there is no
              hover to reveal it. */}
          <button
            type="button"
            onClick={() => setZoomed(true)}
            aria-label="View full screen"
            className="absolute right-3 bottom-3 inline-flex size-11 items-center justify-center rounded-full border border-pdp-hairline bg-surface/70 text-pdp-price backdrop-blur transition-all duration-200 hover:bg-surface focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pdp-price lg:opacity-0 lg:group-hover/stage:opacity-100"
          >
            <Maximize2 className="size-4" aria-hidden />
          </button>

          {/* Step arrows on the stage itself, so the image can be browsed
              without reaching the rail. */}
          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => step(-1)}
                aria-label="Previous image"
                className="absolute top-1/2 left-2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full border border-pdp-hairline bg-surface/70 text-pdp-price backdrop-blur transition-all duration-200 hover:bg-surface focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pdp-price lg:opacity-0 lg:group-hover/stage:opacity-100"
              >
                <ChevronLeft className="size-4" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => step(1)}
                aria-label="Next image"
                className="absolute top-1/2 right-2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full border border-pdp-hairline bg-surface/70 text-pdp-price backdrop-blur transition-all duration-200 hover:bg-surface focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pdp-price lg:opacity-0 lg:group-hover/stage:opacity-100"
              >
                <ChevronRight className="size-4" aria-hidden />
              </button>
            </>
          )}
        </div>

        {images.length > 1 && (
          <div
            role="tablist"
            aria-label={`${productName} images`}
            /* Right-aligned in the design, but only once the strip fits. While
               it scrolls, `justify-end` would push the first thumbnail past the
               scroll origin and make it unreachable. */
            className="no-scrollbar flex gap-3 overflow-x-auto py-1 sm:gap-4 lg:justify-end"
          >
            {images.map((image, i) => (
              <button
                key={image.id}
                role="tab"
                type="button"
                aria-selected={i === index}
                aria-label={`View image ${i + 1} of ${images.length}`}
                onClick={() => {
                  setLoaded(false);
                  setIndex(i);
                }}
                className={cn(
                  "relative size-16 shrink-0 overflow-hidden rounded-xl bg-pdp-surface sm:size-[76px]",
                  "transition-[box-shadow,opacity,transform] duration-300 ease-out",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pdp-price",
                  i === index
                    ? "opacity-100 ring-2 ring-pdp-price"
                    : "opacity-60 ring-1 ring-pdp-hairline hover:opacity-100 hover:ring-pdp-border",
                )}
              >
                {/* Contained too, so a thumbnail is a true index of the frame
                    it selects rather than a differently-cropped picture. */}
                <Image src={image.url} alt="" fill sizes="76px" className="object-contain" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Two groups pinned to the ends of the column — `justify-between` over a
          stretched height rather than the design's literal 362px gap, so the
          rail still reads as top-and-bottom when the image is not exactly 610
          tall, which below 1440 it is not. */}
      <div className="flex shrink-0 flex-row justify-center gap-5 lg:w-[52px] lg:flex-col lg:justify-between">
        <div className="flex flex-row gap-5 lg:flex-col">
          <WishlistButton
            productId={productId}
            productName={productName}
            initialSaved={isWishlisted}
            variant="inline"
            className="size-[52px] rounded-[8px] border-0 bg-pdp-surface text-pdp-price hover:bg-pdp-hairline"
          />

          <button type="button" onClick={share} className={railButton} aria-label={copied ? "Link copied" : `Share ${productName}`}>
            {copied ? (
              <Check className="size-5 text-success" aria-hidden />
            ) : (
              <Share2 className="size-5" aria-hidden />
            )}
          </button>
        </div>

        {images.length > 1 && (
          <div className="flex flex-row gap-5 lg:flex-col">
            <button
              type="button"
              onClick={() => step(-1)}
              className={railButton}
              aria-label="Previous image"
            >
              <ChevronUp className="size-5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => step(1)}
              className={railButton}
              aria-label="Next image"
            >
              <ChevronDown className="size-5" aria-hidden />
            </button>
          </div>
        )}
      </div>

      {/* Rendered only while open, so the large sources are never fetched for
          a viewer nobody asked for — the stage image stays the LCP element.

          Mounted and unmounted directly rather than wrapped in
          `AnimatePresence`. The viewer portals its content to `body`, and
          presence tracking across that boundary did not release the child on
          close — measured: both Escape and the close button left it on screen
          at full opacity. The entrance still animates; only the exit fade is
          given up, which is the right trade for a control that must always
          close. */}
      {zoomed && (
        <PdpLightbox
          images={images}
          index={index}
          productName={productName}
          onIndexChange={setIndex}
          onClose={() => setZoomed(false)}
        />
      )}
    </div>
  );
}
