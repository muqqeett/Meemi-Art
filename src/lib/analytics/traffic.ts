/**
 * Which requests are not a person looking at a product.
 *
 * A view is only worth counting if a human saw the page. The beacon that
 * reports views already waits until the page is visible and is not being
 * prerendered; the server checks again here, because the endpoint is public.
 *
 * Deliberately a short, readable list rather than a vendor database: it
 * catches the crawlers, link unfurlers, monitors and scripted clients that
 * actually hit a shop. A determined bot that spoofs a browser gets through —
 * which is why views are also de-duplicated and rate-limited per visitor.
 */

const BOT_PATTERN =
  /bot|crawl|spider|slurp|scrap|preview|fetcher|facebookexternalhit|embedly|whatsapp|telegram|discord|slack|skype|headless|lighthouse|pagespeed|pingdom|uptime|monitor|statuscake|curl\/|wget|python|httpclient|axios|node-fetch|undici|go-http|java\/|okhttp|libwww|phantom|selenium|puppeteer|playwright|vercel/i;

export function isLikelyBot(userAgent: string | null): boolean {
  if (!userAgent || userAgent.length < 10) return true;
  return BOT_PATTERN.test(userAgent);
}

/** True for speculative requests the browser makes before anyone navigates. */
export function isPrefetch(headers: Headers): boolean {
  const purpose = `${headers.get("sec-purpose") ?? ""} ${headers.get("purpose") ?? ""} ${headers.get("x-purpose") ?? ""}`;
  return /prefetch|prerender|preview/i.test(purpose) || headers.has("next-router-prefetch");
}
