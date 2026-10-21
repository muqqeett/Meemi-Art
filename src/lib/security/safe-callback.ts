/**
 * Where a shopper lands after signing in.
 *
 * `callbackUrl` arrives from a query string and a hidden form field, so it is
 * attacker-controlled: a crafted login link must never be able to send someone
 * to another site once they have entered their password.
 *
 * Checking only for a leading `/` and a missing `//` is not enough. Browsers
 * parse a redirect target with the WHATWG URL algorithm, which treats `\` as
 * `/` and silently drops tab and line-feed characters, so `/\evil.com` and
 * `/<TAB>/evil.com` both resolve to `//evil.com` — another origin. Anything with
 * a backslash or a control character is therefore refused outright, and the
 * result is finally resolved against a placeholder origin as a backstop.
 * Percent-encoded forms such as `/%2f%2fevil.com` are not decoded by the parser
 * and stay on this site, so they are left alone.
 */

const FALLBACK = "/account";
const PLACEHOLDER_ORIGIN = "https://callback.invalid";

export function safeCallback(callbackUrl?: string | null): string {
  if (!callbackUrl) return FALLBACK;
  if (!callbackUrl.startsWith("/") || callbackUrl.startsWith("//")) return FALLBACK;
  // Backslashes and C0 controls / DEL (tab, CR and LF included).
  if (/[\\\u0000-\u001f\u007f]/.test(callbackUrl)) return FALLBACK;

  try {
    if (new URL(callbackUrl, PLACEHOLDER_ORIGIN).origin !== PLACEHOLDER_ORIGIN) {
      return FALLBACK;
    }
  } catch {
    return FALLBACK;
  }

  return callbackUrl;
}
