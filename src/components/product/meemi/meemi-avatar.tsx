"use client";

import { useState } from "react";
import Image from "next/image";

import type { MeemiTipKind } from "@/lib/meemi/tips";
import { cn } from "@/lib/utils";

/**
 * Meemi's artwork.
 *
 * One character in four poses — the same body, cap, colours and face, with only
 * the arms and the expression changing — drawn as flat SVG from the brand's own
 * tokens (`brand-700`/`brand-600` purple, a warm cream body, the star gold of
 * the rating stars for the yarn). They live in `public/brand/meemi/` beside the
 * other brand art, are a couple of kilobytes each, and carry no text.
 *
 * Which pose is showing follows the guide's existing state: there is no new
 * state here, only a mapping from the message Meemi is currently showing.
 */

export type MeemiExpression = "wave" | "guide" | "happy" | "thinking";

export const MEEMI_ARTWORK: Record<MeemiExpression, { src: string; width: number; height: number }> = {
  wave: { src: "/brand/meemi/meemi-wave.svg", width: 64, height: 64 },
  guide: { src: "/brand/meemi/meemi-guide.svg", width: 64, height: 64 },
  happy: { src: "/brand/meemi/meemi-happy.svg", width: 64, height: 64 },
  thinking: { src: "/brand/meemi/meemi-thinking.svg", width: 64, height: 64 },
};

/** The pose for the message on screen — resting on a friendly wave. */
export function expressionForTip(kind: MeemiTipKind | null): MeemiExpression {
  switch (kind) {
    case "wishlist":
    case "cart":
      return "happy";
    case "explain-difficulty":
    case "techniques":
      return "thinking";
    case "guide":
    case "section-difficulty":
    case "section-techniques":
      return "guide";
    default:
      return "wave";
  }
}

export function MeemiAvatar({
  expression = "wave",
  className,
}: {
  expression?: MeemiExpression;
  className?: string;
}) {
  const [artworkFailed, setArtworkFailed] = useState(false);
  const artwork = MEEMI_ARTWORK[expression];

  // Artwork that cannot be fetched falls back to the mark below rather than a
  // broken image: the control keeps its size, its label and its behaviour.
  if (artworkFailed) return <MeemiMark className={className} />;

  return (
    <Image
      src={artwork.src}
      width={artwork.width}
      height={artwork.height}
      alt=""
      // Flat SVG at a fixed 48–56px: the optimiser has nothing to do, and this
      // keeps it out of the image pipeline entirely.
      unoptimized
      // Meemi itself is what is lazy: this component is only imported and
      // mounted a couple of seconds after the page has settled, well clear of
      // LCP. By then the avatar is on screen, so `loading="lazy"` would only
      // risk a blank avatar in a backgrounded tab.
      loading="eager"
      decoding="async"
      onError={() => setArtworkFailed(true)}
      className={cn("size-full object-contain", className)}
    />
  );
}

/** The plain yarn mark the guide used before the character existed. */
function MeemiMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden className={cn("size-full", className)}>
      {/* The ball. */}
      <circle cx="24" cy="25" r="15" className="fill-brand-50 stroke-brand-700" strokeWidth="2" />
      {/* Wound strands, clipped to the ball by staying inside it. */}
      <path d="M12.5 19.5c6 3.5 17 4 23-2" className="stroke-brand-600" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <path d="M10.5 26.5c7 4 20 4.5 27-1" className="stroke-brand-600" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <path d="M14 33.5c6 2.5 15 2.5 21-1.5" className="stroke-brand-600" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <path d="M19 11.5c-3 6-3.5 19 1 27" className="stroke-brand-400" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      {/* The loose end, curling away. */}
      <path d="M37.5 33c3 1.5 4.5 4 3.5 6.5" className="stroke-brand-700" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}
