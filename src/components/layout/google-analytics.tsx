"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";

/** Google Analytics 4 web data stream for MeemiArt. */
export const GA_MEASUREMENT_ID = "G-YENBFHY7XE";

/** Google's documented per-property opt-out: while true, gtag sends no hits. */
const GA_DISABLE_KEY = `ga-disable-${GA_MEASUREMENT_ID}`;

/** Staff pages. Customer-facing analytics should never see them. */
export function isAdminPath(pathname: string | null): boolean {
  return pathname === "/admin" || (pathname?.startsWith("/admin/") ?? false);
}

/**
 * The Google Analytics 4 tag, for customer-facing pages only.
 *
 * Rendered once, from the root layout. It is the standard gtag snippet loaded
 * through `next/script` with `afterInteractive`, so it never delays first
 * render; the default `config` call records page views, and the stream's
 * enhanced measurement records client-side navigations from browser history.
 *
 * Admin routes are kept out in two ways, because a script cannot be unloaded:
 *
 *   - Opening an admin page directly never renders the tag, so gtag is not
 *     loaded at all.
 *   - Navigating client-side from the shop into the admin (the account menu
 *     links there) finds gtag already running. The opt-out flag is set during
 *     render — before the router commits the new URL and GA sees the history
 *     change — so the admin page view is never sent. Leaving the admin clears
 *     it again.
 */
export function GoogleAnalytics() {
  const pathname = usePathname();
  const admin = isAdminPath(pathname);

  if (typeof window !== "undefined") {
    setAnalyticsDisabled(admin);
  }

  if (admin) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_MEASUREMENT_ID}');`}
      </Script>
    </>
  );
}

/** Idempotent, so it is safe for React to call more than once per render. */
function setAnalyticsDisabled(disabled: boolean): void {
  (window as unknown as Record<string, boolean>)[GA_DISABLE_KEY] = disabled;
}
