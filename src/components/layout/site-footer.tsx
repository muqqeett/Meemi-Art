import Image from "next/image";
import Link from "next/link";

import { legalNav, siteConfig } from "@/lib/config";

/**
 * Footer — Figma 222:495. Rendered by the storefront layout, so every
 * shop-facing page closes on it. Admin and the auth pages have no footer.
 *
 *   band     #312D49, 1200px content, 120px x / 60px y padding
 *   headings Segoe UI Bold 16.9/22.5, white, uppercase
 *   links    Segoe UI Regular 15/22.5, #DFE0E1
 *   legal    Segoe UI Regular 14/24, #9695A8
 *
 * Built to the drawing exactly: three columns, "Stay up to date" carrying the
 * address rather than a signup form. The newsletter field that used to live
 * here is gone; `subscribeToNewsletter` still exists in lib/actions but has no
 * call site.
 *
 * Every link points at a route that exists. The design lists several that do
 * not — Store Locator, Gift Card Balance, Student Discount, Service Discount,
 * Promotion Exclusions, Transparency in Supply Chain, Blogs, Investors — for a
 * single-vendor digital shop with none of those things. They are omitted
 * rather than shipped as dead links; a footer full of 404s is worse than a
 * shorter footer, and a payment provider checking the site will follow them.
 */

const SUPPORT = [
  { label: "Contact Us", href: "/contact" },
  { label: "FAQ", href: "/faq" },
  { label: "Refunds & Cancellations", href: "/refunds" },
  { label: "Terms & Conditions", href: "/terms" },
  { label: "Privacy Policy", href: "/privacy" },
] as const;

const ABOUT = [
  { label: "Our Story", href: "/about" },
  { label: "Shop", href: "/shop" },
] as const;

export function SiteFooter() {
  return (
    <footer className="mt-auto w-full overflow-hidden bg-slate-deep">
      {/* The drawn 120px gutter needs a 1440 frame to sit in. Below that it was
          eating 240px of a 1009px laptop, which is what pushed the columns out
          of the footer entirely. Restored exactly at `wide`. */}
      <div className="mx-auto w-full max-w-[1440px] px-5 py-[60px] sm:max-lg:px-8 lg:max-wide:px-12 wide:px-[120px]">
        {/* 607 + 303 + 1fr is the Figma frame, and it only fits the 1200px
            content column that a 1440 viewport provides. At 1024 those rigid
            widths totalled 1131px inside 769px of space, so "About" was clipped
            and "Stay up to date" — the contact address — was pushed past the
            edge and hidden completely by the panel's `overflow-hidden`.

            Three columns share the width by ratio between lg and 1440, and the
            drawn widths return at `wide` where they fit. Disjoint ranges, for
            the ordering reason noted on `--breakpoint-wide` in globals.css. */}
        <div className="grid gap-10 sm:max-lg:grid-cols-2 lg:max-wide:grid-cols-[2fr_1fr_1fr] lg:max-wide:gap-12 wide:grid-cols-[607px_303px_1fr]">
          <div>
            <h2 className="font-ui text-[16.875px] leading-[22.5px] font-bold text-white uppercase">
              Support
            </h2>
            <ul className="mt-1 grid gap-x-6 gap-y-1 sm:grid-cols-2">
              {SUPPORT.map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="font-ui text-[15px] leading-[22.5px] text-footer-text transition-colors hover:text-white"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="font-ui text-[16.875px] leading-[22.5px] font-bold text-white uppercase">
              About
            </h2>
            <ul className="mt-1 space-y-1">
              {ABOUT.map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="font-ui text-[15px] leading-[22.5px] text-footer-text transition-colors hover:text-white"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="font-ui text-[16.875px] leading-[22.5px] font-semibold text-white uppercase">
              Stay up to date
            </h2>
            <a
              href={`mailto:${siteConfig.email}`}
              className="font-ui mt-1 block text-[15px] leading-[22.5px] text-footer-text transition-colors hover:text-white"
            >
              {siteConfig.email}
            </a>
          </div>
        </div>

        {/* The policy row. Every one of these has to resolve from every page:
            it is the first thing a payment provider's verification check
            follows, and a 404 here fails the review. */}
        <ul className="mt-6 flex flex-wrap items-center gap-4">
          {legalNav.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="font-ui text-sm leading-6 text-footer-muted transition-colors hover:text-footer-text"
              >
                {item.title}
              </Link>
            </li>
          ))}
        </ul>

        {/* The design ends on App Store and Google Play badges. There is no
            Meemi Art app, and a store badge that leads nowhere is a broken
            promise on the most-scrutinised part of the page — so the row
            carries the copyright line instead. Restore the badges when an app
            exists; the exported artwork is in public/home/. */}
        <p className="font-ui mt-8 border-t border-white/10 pt-6 text-sm leading-6 text-footer-muted">
          © {new Date().getFullYear()} {siteConfig.name}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

/** Kept so the exported badge artwork has a call site when an app ships. */
export function AppStoreBadges() {
  return (
    <ul className="flex items-center justify-center gap-4">
      <li>
        <Image
          src="/home/badge-app-store.svg"
          alt="Download on the App Store"
          width={112}
          height={37}
        />
      </li>
      <li>
        <Image
          src="/home/badge-google-play.png"
          alt="Get it on Google Play"
          width={127}
          height={38}
        />
      </li>
    </ul>
  );
}
