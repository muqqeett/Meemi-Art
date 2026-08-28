import "server-only";

import { paymentConfig } from "@/lib/payments/config";

/**
 * Paddle's webhook source addresses, fetched from Paddle rather than pinned.
 *
 * https://api.paddle.com/ips is the source of truth and the list changes, so
 * hard-coding it guarantees a future outage on a day nobody remembers why. It
 * is cached for an hour, which is short enough to pick up a change and long
 * enough that a burst of deliveries does not become a burst of lookups.
 *
 * This is defence in depth, not the security boundary. The signature check in
 * the driver is what actually proves a delivery came from Paddle: an IP can be
 * spoofed at the edge, and a request that arrives through a proxy carries
 * whatever `x-forwarded-for` that proxy chose to write. The allowlist is here
 * to make unsigned junk cheap to reject before any crypto runs.
 *
 * Which is why it fails OPEN. If Paddle's own API is unreachable and we hold
 * no cached list, refusing every delivery would turn their outage into our
 * lost payments — while the signature check, the thing that matters, is still
 * running. A miss is logged loudly instead.
 */

const IPS_ENDPOINT = "https://api.paddle.com/ips";
const CACHE_TTL_MS = 60 * 60 * 1000;

type Cache = { cidrs: string[]; fetchedAt: number };
let cache: Cache | null = null;

/** Fetches the current list, falling back to the last good one on failure. */
async function getAllowedCidrs(): Promise<string[] | null> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.cidrs;
  }

  try {
    const response = await fetch(IPS_ENDPOINT, {
      // Never let a hung lookup hold a webhook open past the provider's
      // delivery timeout — a retried delivery is worse than a skipped check.
      signal: AbortSignal.timeout(3000),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const payload = (await response.json()) as { data?: { ipv4_cidrs?: unknown } };
    const cidrs = payload.data?.ipv4_cidrs;

    if (!Array.isArray(cidrs) || cidrs.some((entry) => typeof entry !== "string")) {
      throw new Error("Unexpected response shape");
    }

    cache = { cidrs: cidrs as string[], fetchedAt: Date.now() };
    return cache.cidrs;
  } catch (error) {
    console.warn("[webhook] could not refresh Paddle IP list", error);
    // A stale list is still far better than none.
    return cache?.cidrs ?? null;
  }
}

/** IPv4 dotted quad to a 32-bit integer, or null if it is not one. */
function toInt(address: string): number | null {
  const parts = address.trim().split(".");
  if (parts.length !== 4) return null;

  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    value = value * 256 + octet;
  }
  return value;
}

function withinCidr(address: string, cidr: string): boolean {
  const [network, bitsRaw] = cidr.split("/");
  const bits = Number(bitsRaw ?? 32);
  if (!Number.isInteger(bits) || bits < 0 || bits > 32) return false;

  const target = toInt(address);
  const base = toInt(network);
  if (target === null || base === null) return false;

  if (bits === 0) return true;
  // >>> 0 keeps the mask unsigned; a plain << 32-bits would go negative.
  const mask = (0xffffffff << (32 - bits)) >>> 0;
  return ((target ^ base) & mask) >>> 0 === 0;
}

/**
 * The client address, read from the proxy headers a host actually sets.
 *
 * `x-forwarded-for` is a list; the leftmost entry is the original client and
 * every entry after it is a hop. Only the first is of interest, and it is only
 * trustworthy because the platform in front of this app rewrites the header —
 * which is the reason this check is not the security boundary.
 */
export function clientAddress(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip")?.trim() ?? null;
}

export type IpCheck =
  | { allowed: true; reason: "in-allowlist" | "skipped" }
  | { allowed: false; address: string };

/**
 * Whether a delivery may proceed to signature verification.
 *
 * Skipped entirely for the sandbox driver, whose "deliveries" originate from
 * this same server and would never appear in Paddle's list.
 */
export async function checkWebhookSource(headers: Headers): Promise<IpCheck> {
  if (paymentConfig.driver !== "paddle") {
    return { allowed: true, reason: "skipped" };
  }

  const address = clientAddress(headers);
  if (!address) {
    console.warn("[webhook] no client address on request; allowing on signature alone");
    return { allowed: true, reason: "skipped" };
  }

  const cidrs = await getAllowedCidrs();
  if (!cidrs) {
    console.warn("[webhook] no Paddle IP list available; allowing on signature alone");
    return { allowed: true, reason: "skipped" };
  }

  return cidrs.some((cidr) => withinCidr(address, cidr))
    ? { allowed: true, reason: "in-allowlist" }
    : { allowed: false, address };
}
