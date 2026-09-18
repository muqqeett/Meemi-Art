import { createHmac } from "node:crypto";

/**
 * Anonymous, cookieless visitor counting.
 *
 * A view needs some notion of "the same visitor" to be de-duplicated and to
 * count visitors per day. This derives one without a cookie and without
 * storing anything that identifies a person:
 *
 *   daily salt   HMAC(secret, "visitor-salt:" + today in Asia/Karachi)
 *   visitor key  HMAC(daily salt, client address + user agent), 32 hex chars
 *
 * Only the key is stored. The address and user agent are read from the request
 * and discarded; the salt is never stored at all and is recomputed from the
 * server secret. Because the salt changes at every Pakistani midnight, the same
 * visitor gets an unrelated key the next day — a visitor can be counted within
 * a day, but cannot be followed across days, and there is no profile to build.
 * Someone holding the database alone cannot reverse a key to an address.
 *
 * Pure apart from hashing: callers pass the day and secret, so the harness can
 * prove the rotation deterministically.
 */
export function visitorKey(input: {
  address: string | null;
  userAgent: string | null;
  dayKey: string;
  secret: string;
}): string | null {
  if (!input.secret || !input.address) return null;
  const salt = createHmac("sha256", input.secret).update(`meemiart:visitor-salt:${input.dayKey}`).digest();
  return createHmac("sha256", salt)
    .update(`${input.address}\n${input.userAgent ?? ""}`)
    .digest("hex")
    .slice(0, 32);
}
