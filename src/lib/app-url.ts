import "server-only";

import { siteConfig } from "@/lib/config";

/**
 * The absolute origin this deployment is reachable at.
 *
 * Two subsystems need it and neither can use a relative URL: Paddle return
 * links, which the provider redirects a customer back to, and links inside
 * transactional email, which are read in an inbox with no page to be relative
 * to. They resolved it separately until both were found to have the same bug,
 * so the resolution lives here once and they share it. Divergence is now a
 * compile-time impossibility rather than something a test has to notice.
 *
 * `server-only` because `SITE_URL` is deliberately not a `NEXT_PUBLIC_`
 * variable — see the note on `siteConfig.url`. In the browser it would be
 * undefined and this would quietly answer `http://localhost:3000`.
 */

/** Last resort when nothing is configured — mirrors `siteConfig.url`'s default. */
const LOCAL_ORIGIN = "http://localhost:3000";

/**
 * The first value that is actually set, trimmed.
 *
 * `??` alone was not enough. A hosting platform writes an empty string for a
 * variable that exists but was left blank, and an empty string is not nullish
 * — so it won the chain and resolved the origin to `""`, turning every return
 * URL and every email link into a bare path while a perfectly good `SITE_URL`
 * sat behind it, ignored.
 *
 * Blank and whitespace-only now fall through, following the `.trim() || …`
 * idiom already used in `lib/email/config.ts` and the download route.
 */
function firstSet(...values: (string | undefined)[]): string {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return "";
}

/**
 * Resolve the origin, with no trailing slash.
 *
 * Precedence, unchanged from both call sites: `NEXT_PUBLIC_APP_URL`, then
 * `SITE_URL`, then `siteConfig.url`. `LOCAL_ORIGIN` is only reached when all
 * three are blank, which happens when `SITE_URL` is set-but-empty —
 * `siteConfig.url` derives from the same variable, so it is empty too and
 * cannot supply its own default.
 */
export function resolveAppUrl(): string {
  return firstSet(
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.SITE_URL,
    siteConfig.url,
    LOCAL_ORIGIN,
  ).replace(/\/+$/, "");
}
