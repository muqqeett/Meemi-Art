"use client";

import { useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronUp, ChevronDown, Share2, Check } from "lucide-react";

import { WishlistButton } from "@/components/product/wishlist-button";
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

  if (images.length === 0) {
    return (
      <div className="flex aspect-square w-full items-center justify-center rounded-2xl bg-pdp-surface text-sm text-pdp-body lg:aspect-[458/610] lg:rounded-[8px]">
        No image available
      </div>
    );
  }

  const active = images[Math.min(index, images.length - 1)];
  const step = (by: number) => setIndex((i) => (i + by + images.length) % images.length);

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
        {/* Square below `lg`, the drawn 458×610 from there up.

              Every product image in this catalogue is 1:1, and `object-contain`
              inside a 0.75 frame therefore paid ~116px of empty band on a
              phone — enough to push the purchase buttons out of the first
              viewport at 390×844, which is the one thing this layout exists to
              prevent. A non-square upload still fits: the frame contains it. */}
          <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-pdp-surface lg:aspect-[458/610] lg:rounded-[8px]">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={active.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: duration.fast, ease: ease.enter }}
              className="absolute inset-0"
            >
              <Image
                src={active.url}
                alt={active.alt || productName}
                fill
                priority
                sizes="(min-width: 1440px) 458px, (min-width: 1024px) 40vw, (min-width: 640px) 458px, 92vw"
                /* The image someone decides to buy from. It is shown whole:
                   the drawn 458×610 frame stays, and a cover that is not that
                   shape sits centred on the surface tint rather than losing
                   its top and bottom. */
                className="object-contain"
              />
            </motion.div>
          </AnimatePresence>
        </div>

        {images.length > 1 && (
          <div
            role="tablist"
            aria-label={`${productName} images`}
            /* Right-aligned in the design, but only once the strip fits. While
               it scrolls, `justify-end` would push the first thumbnail past the
               scroll origin and make it unreachable. */
            className="no-scrollbar flex gap-[20px] overflow-x-auto lg:justify-end"
          >
            {images.map((image, i) => (
              <button
                key={image.id}
                role="tab"
                type="button"
                aria-selected={i === index}
                aria-label={`View image ${i + 1} of ${images.length}`}
                onClick={() => setIndex(i)}
                className={cn(
                  "relative h-[68px] w-[52px] shrink-0 overflow-hidden rounded-lg bg-pdp-surface transition-shadow sm:h-[101px] sm:w-[76px] sm:rounded-[8px]",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pdp-price",
                  i === index
                    ? "ring-2 ring-pdp-price"
                    : "ring-1 ring-transparent hover:ring-pdp-border",
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
    </div>
  );
}
