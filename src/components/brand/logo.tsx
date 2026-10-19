import Link from "next/link";

import { cn } from "@/lib/utils";
import { siteConfig } from "@/lib/config";

type LogoProps = {
  /** `light` for dark backgrounds (footer, campaign panels), `dark` elsewhere. */
  tone?: "light" | "dark";
  size?: "sm" | "md" | "lg";
  className?: string;
  /** Render as plain artwork when it already sits inside a link. */
  asLink?: boolean;
  /** `plum` swaps the focus ring to the Plum Studio violet. */
  focus?: "forest" | "plum";
};

/**
 * Heights, in the wordmark's own 550 x 84 box. The width follows from the
 * aspect ratio, so the mark can never be squashed by a caller.
 */
const SIZES = {
  sm: "h-5",
  md: "h-6",
  lg: "h-[30px]",
} as const;

/**
 * The Meemi Art wordmark.
 *
 * "meemi" is the Plum Studio wordmark, path for path: one round-capped 14px
 * stroke, x-height 52, 26 between letters, and a marigold yarn ball as the dot
 * of the i. "art" is drawn in the same construction (a ring and a stem, a stem
 * and a shoulder, a hooked stem and a bar) so the two read as one word, and
 * sits in the lighter violet so they still read as two: Meemi, then Art.
 *
 * It is vector artwork rather than set type, so it does not depend on a font
 * loading, renders identically on every device, and stays sharp from the
 * 20px mobile header to a favicon. The yarn ball keeps its own colours on both
 * grounds: the design's rule is that it is never recoloured.
 *
 * Static copies live in `public/brand/plum/`: the wordmark on light and on
 * plum, the compact "m" mark, and the app icons derived from it.
 *
 * Inside a link the artwork is hidden from assistive technology and the link
 * carries the name; on its own it is an image with the name as its label.
 */
const MEEMI_D =
  "M9 76V40C9 35.7565 10.6857 31.6869 13.6863 28.6863C16.6869 25.6857 20.7565 24 25 24C29.2435 24 33.3131 25.6857 36.3137 28.6863C39.3143 31.6869 41 35.7565 41 40M41 40V76M41 40C41 35.7565 42.6857 31.6869 45.6863 28.6863C48.6869 25.6857 52.7565 24 57 24C61.2435 24 65.3131 25.6857 68.3137 28.6863C71.3143 31.6869 73 35.7565 73 40V76M99 50H151C150.999 43.8484 148.817 37.8965 144.841 33.2022C140.865 28.5078 135.354 25.3751 129.287 24.3608C123.219 23.3466 116.989 24.5165 111.703 27.6626C106.417 30.8087 102.417 35.7272 100.415 41.5439C99.4715 44.2861 99.0005 47.1441 99 50ZM99 50C98.9994 53.2021 99.5902 56.4015 100.769 59.4318C102.999 65.1648 107.19 69.9213 112.597 72.8558C118.003 75.7904 124.275 76.713 130.298 75.4596C136.32 74.2061 141.703 70.8579 145.49 66.01M177 50H229C228.999 43.8484 226.817 37.8965 222.841 33.2022C218.865 28.5078 213.354 25.3751 207.287 24.3608C201.219 23.3466 194.989 24.5165 189.703 27.6626C184.417 30.8087 180.417 35.7272 178.415 41.5439C177.472 44.2861 177.001 47.1441 177 50ZM177 50C176.999 53.2021 177.59 56.4015 178.769 59.4318C180.999 65.1648 185.19 69.9213 190.597 72.8558C196.003 75.7904 202.275 76.713 208.298 75.4596C214.32 74.2061 219.703 70.8579 223.49 66.01M255 76V40C255 35.7565 256.686 31.6869 259.686 28.6863C262.687 25.6857 266.757 24 271 24C275.243 24 279.313 25.6857 282.314 28.6863C285.314 31.6869 287 35.7565 287 40M287 40V76M287 40C287 35.7565 288.686 31.6869 291.686 28.6863C294.687 25.6857 298.757 24 303 24C307.243 24 311.313 25.6857 314.314 28.6863C317.314 31.6869 319 35.7565 319 40V76M345 76V40";
const ART_D =
  "M435 50A26 26 0 1 1 383 50A26 26 0 1 1 435 50ZM435 24V76M461 76V40C461 35.7565 462.686 31.6869 465.686 28.6863C468.687 25.6857 472.757 24 477 24H485M521 8V56C521 68 528 76 541 76M503 26H539";

function Wordmark({ tone, className, titled }: { tone: "light" | "dark"; className?: string; titled: boolean }) {
  const meemi = tone === "light" ? "#FBF8FF" : "#24113F";
  const art = tone === "light" ? "#DCCDF2" : "#6D43C9";

  return (
    <svg
      viewBox="0 0 550 84"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("block w-auto shrink-0", className)}
      {...(titled ? { role: "img", "aria-label": siteConfig.name } : { "aria-hidden": true })}
    >
      <path d={MEEMI_D} stroke={meemi} strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
      <path d={ART_D} stroke={art} strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
      {/* The yarn ball. Its colours are fixed on both grounds. */}
      <path
        d="M345 29.5C351.351 29.5 356.5 24.3513 356.5 18C356.5 11.6487 351.351 6.5 345 6.5C338.649 6.5 333.5 11.6487 333.5 18C333.5 24.3513 338.649 29.5 345 29.5Z"
        fill="#F5B02E"
      />
      <g stroke="#24113F" strokeWidth="1.955" strokeLinecap="round">
        <path d="M336.4 16.27C339.453 11.6767 342.897 8.42 346.73 6.5" />
        <path d="M336.38 24.32C341.747 17.4267 347.287 13.1867 353 11.6" />
        <path d="M343.27 28.5C347.103 23.42 351.18 20.11 355.5 18.57" />
      </g>
    </svg>
  );
}

export function Logo({
  tone = "dark",
  size = "lg",
  className,
  asLink = true,
  focus = "forest",
}: LogoProps) {
  if (!asLink) {
    return <Wordmark tone={tone} className={cn(SIZES[size], className)} titled />;
  }

  return (
    <Link
      href="/"
      aria-label={`${siteConfig.name} — home`}
      className={
        focus === "plum"
          ? "pl-focus inline-flex items-center rounded-xs"
          : "inline-flex items-center rounded-xs focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest"
      }
    >
      <Wordmark tone={tone} className={cn(SIZES[size], className)} titled={false} />
    </Link>
  );
}
