import Link from "next/link";

import { cn } from "@/lib/utils";
import { siteConfig } from "@/lib/config";

/**
 * Shared furniture for the authentication screens — Figma "Log in" (102:128)
 * and "Sign up" (118:631).
 *
 * These live here rather than in `components/brand` or `components/ui` on
 * purpose: they are shaped by one design for one flow, and putting them in a
 * shared folder invites a future change here to move the storefront.
 */

/**
 * The decorative panel appears from `lg` (1024px) up and is not rendered at
 * all below it. That breakpoint is written literally everywhere it is used —
 * Tailwind scans source for complete class strings, so a constant
 * interpolated into a template literal would compile to no CSS at all.
 */

/**
 * The two soft glows the design places in opposite corners of the dark panel
 * (`Ellipse 1` bottom-left, `Ellipse 2` top-right, 379px each).
 *
 * Drawn as radial gradients rather than the exported SVG: the design's asset
 * is a flat blurred shape that a gradient reproduces exactly, and a gradient
 * costs no request, scales to any panel size, and cannot expire the way the
 * Figma asset URL does.
 */
export function AuthGlow() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -bottom-24 -left-24 size-[320px] rounded-full bg-[radial-gradient(circle,var(--color-royal-500)_0%,transparent_70%)] opacity-30 blur-[60px]" />
      <div className="absolute -top-24 -right-16 size-[320px] rounded-full bg-[radial-gradient(circle,var(--color-brand-400)_0%,transparent_70%)] opacity-30 blur-[60px]" />
    </div>
  );
}

/**
 * The wordmark.
 *
 * The Figma file's mark is "BALA." — an italic bold wordmark with a coloured
 * full stop. That full stop is the only distinctive thing about it, so it is
 * what carries over: MeemiArt's own wordmark, then the same accent dot. The
 * brand name is never the placeholder's.
 *
 * `tone` exists because the mark appears twice in this flow: white on the dark
 * panel at desktop, and dark on the form column at mobile, where the panel it
 * normally sits on is not rendered at all.
 */
export function AuthWordmark({
  tone = "light",
  className,
}: {
  tone?: "light" | "dark";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "font-wordmark inline-flex items-baseline text-xl whitespace-nowrap lg:text-2xl",
        tone === "light" ? "text-white" : "text-near-black",
        className,
      )}
    >
      <span className="font-semibold tracking-[-1px]">Meemi</span>
      <span className="ml-[0.3em] font-extrabold">Art</span>
      <span className="text-royal-500 ml-[2px] font-extrabold">.</span>
      <span className="sr-only"> — {siteConfig.name}</span>
    </span>
  );
}

/**
 * The authentication screen: decorative panel beside the form at desktop, form
 * alone below it.
 *
 * The panel is `hidden` rather than collapsed or shrunk. A cropped version of
 * it on a phone costs a third of the viewport and pushes the first input under
 * the fold, and reserving the space without drawing it is worse still — so
 * below `lg` it does not enter the layout at all, and the form column becomes
 * the whole page.
 *
 * The cut is at `lg` (1024) rather than at `md` (768): a 50/50 split at 768
 * leaves 384px a side, which is narrower than the 420px the form wants, so the
 * tablet range takes the single-column form too.
 */
export function AuthScreen({
  title,
  subtitle,
  headline = "Made by hand. Ready the moment you buy.",
  children,
}: {
  /**
   * Optional: the secondary screens in this flow (reset, verify) render their
   * own heading alongside a status icon, so they pass nothing here and keep it.
   */
  title?: string;
  subtitle?: string;
  /** The large italic line on the decorative panel. */
  headline?: string;
  children: React.ReactNode;
}) {
  return (
    <div data-fill className="grid min-h-dvh lg:grid-cols-2">
      {/* Decorative panel — desktop only. */}
      <aside className="relative isolate hidden overflow-hidden bg-brand-900 px-12 py-10 lg:flex lg:flex-col lg:justify-between xl:px-16">
        <AuthGlow />

        <Link
          href="/"
          aria-label={`${siteConfig.name} — home`}
          className="relative w-fit rounded-xs focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-royal-400"
        >
          <AuthWordmark />
        </Link>

        <p className="font-display relative max-w-[420px] text-[2rem] leading-[1.2] font-light text-balance italic xl:text-[2.5rem]">
          <span className="bg-gradient-to-b from-white to-white/45 bg-clip-text text-transparent">
            {headline}
          </span>
        </p>

        <p className="relative text-xs text-white/40">
          © {new Date().getFullYear()} {siteConfig.name}
        </p>
      </aside>

      {/* Form column. Centres itself in the viewport at every width. */}
      <div className="flex flex-col justify-center px-5 py-8 sm:px-8 lg:px-12 xl:px-16">
        <div className="mx-auto flex w-full max-w-[420px] flex-col gap-6">
          {/* The mark only appears here when the panel that normally carries
              it is not rendered. */}
          <Link
            href="/"
            aria-label={`${siteConfig.name} — home`}
            className="w-fit rounded-xs focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-royal-500 lg:hidden"
          >
            <AuthWordmark tone="dark" />
          </Link>

          {title && (
            <div className="flex flex-col gap-1.5">
              <h1 className="font-display text-2xl leading-tight font-semibold text-foreground lg:text-[1.75rem]">
                {title}
              </h1>
              {subtitle && <p className="text-body text-sm">{subtitle}</p>}
            </div>
          )}

          {children}
        </div>
      </div>
    </div>
  );
}
