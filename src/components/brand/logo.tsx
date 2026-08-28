import Link from "next/link";

import { cn } from "@/lib/utils";
import { siteConfig } from "@/lib/config";

type LogoProps = {
  /** `light` for dark backgrounds (footer, campaign panels), `dark` elsewhere. */
  tone?: "light" | "dark";
  size?: "sm" | "md" | "lg";
  className?: string;
  /** Render as plain text when it already sits inside a link. */
  asLink?: boolean;
};

/**
 * `lg` is the drawn size: 32px on a 28px line, which is deliberately tighter
 * than the type is tall — that is what stops the two words drifting apart.
 *
 * The line height is written with the `/` syntax rather than a separate
 * `leading-*` class because a bare `text-[32px]` also emits a default 1.5
 * leading, which wins over `leading-7` and opens the mark back up to 48px.
 */
const SIZES = {
  sm: "text-xl/5",
  md: "text-2xl/6",
  lg: "text-[32px]/7",
} as const;

/**
 * The wordmark — Figma 222:5.
 *
 * Purely typographic, and the two halves are distinguished by weight alone:
 * "Meemi" in Source Sans 3 SemiBold with -1.2px tracking, a space, then "Art"
 * in ExtraBold with normal tracking. 32px, `#191919`.
 *
 * The negative tracking belongs to "Meemi" only. Carrying it onto "Art" would
 * close up the heavier weight and lose the contrast the mark is built on, so
 * the two spans are tracked separately rather than the whole line.
 *
 * The space between them is a real space in the design, not a gap — keeping it
 * inside the text means the mark still reads as "Meemi Art" when copied, and
 * to a screen reader.
 */
export function Logo({ tone = "dark", size = "lg", className, asLink = true }: LogoProps) {
  const mark = (
    <span
      className={cn(
        "font-wordmark whitespace-nowrap",
        SIZES[size],
        tone === "light" ? "text-white" : "text-near-black",
        className,
      )}
    >
      <span className="font-semibold tracking-[-1.2px]">Meemi</span>{" "}
      <span className="font-extrabold">Art</span>
    </span>
  );

  if (!asLink) return mark;

  return (
    <Link
      href="/"
      aria-label={`${siteConfig.name} — home`}
      className="inline-flex items-center rounded-xs focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest"
    >
      {mark}
    </Link>
  );
}
