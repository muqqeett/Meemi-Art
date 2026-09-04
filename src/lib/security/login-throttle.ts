import "server-only";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { Redis } from "@upstash/redis";

/**
 * Throttle for the credential sign-in path.
 *
 * ── Why this is not the existing rate limiter ──────────────────────────────
 *
 * `withinRateLimit` in `lib/email/email-service.ts` counts rows in `EmailLog`.
 * That is the right store for "how many verification mails has this address
 * been sent", and the wrong one here twice over: a sign-in attempt is not an
 * email, and writing one row per attempt would fill the mail log — and the
 * admin Email Health screen that reads it — with records of messages nobody
 * ever sent.
 *
 * ── Two layers, and why both are kept ──────────────────────────────────────
 *
 * This began as counters in module scope. That works, but the counters belong
 * to one instance, and a serverless deployment runs several: an attacker whose
 * requests land on different instances gets a multiple of the limit rather
 * than the limit.
 *
 * Upstash Redis now holds the authoritative counters, shared by every
 * instance. The in-process counters are deliberately kept underneath rather
 * than deleted:
 *
 *   · An attempt is refused if EITHER layer refuses it. Redis adds the
 *     cross-instance dimension; it never relaxes the local one. There is no
 *     arrangement of requests in which adding Redis lets through something the
 *     old code would have blocked.
 *   · If Redis is unreachable, the local counters are already warm and simply
 *     carry on. Availability of a cache is not a precondition for signing in.
 *
 * ── Two independent windows ────────────────────────────────────────────────
 *
 *   by email  stops one account being ground down, however many sources.
 *   by IP     stops one source working through many accounts, which is what
 *             credential stuffing is and what an email-keyed limit misses
 *             entirely, since every attempt uses a different address.
 *
 * Either window tripping refuses the attempt.
 *
 * Only failures are counted, and a success clears the address, so a customer
 * who mistypes twice and then gets it right starts clean.
 */

type Window = { count: number; expires: number };

/** Attempts allowed per address before the window closes. */
const EMAIL_LIMIT = 8;
/** Attempts allowed per source address. Higher: offices and phones share one. */
const IP_LIMIT = 30;
/** How long a window lasts. */
const WINDOW_MS = 15 * 60 * 1000;
/** The same window, in the unit Redis expiry wants. */
const WINDOW_SECONDS = WINDOW_MS / 1000;

/**
 * Module scope, so the map survives between requests on the same instance and
 * is discarded when it is recycled. Nothing here is persisted, and no
 * credential is ever placed in it — the keys are an address and a client IP.
 */
const windows = new Map<string, Window>();

/**
 * Bounded so a flood of unique keys cannot grow the map without limit; without
 * this, the throttle becomes its own memory-exhaustion vector.
 */
const MAX_TRACKED = 10_000;

function sweep(now: number) {
  for (const [key, window] of windows) {
    if (window.expires <= now) windows.delete(key);
  }
  // Still oversized after dropping the expired: the map is under abuse. Clear
  // it rather than grow. This forfeits in-flight counters, which is the safe
  // direction to fail for availability and the reason the cap is generous.
  if (windows.size > MAX_TRACKED) windows.clear();
}

function hit(key: string, limit: number, now: number): boolean {
  const existing = windows.get(key);

  if (!existing || existing.expires <= now) {
    windows.set(key, { count: 1, expires: now + WINDOW_MS });
    return true;
  }

  existing.count += 1;
  return existing.count <= limit;
}

// ---------------------------------------------------------------- shared store

/**
 * The Redis client, or null when the deployment has no Upstash configured.
 *
 * Built once and reused. Absent credentials are not an error: local
 * development and preview deployments run perfectly well on the in-process
 * counters alone, and requiring Upstash to sign in locally would be a poor
 * trade. `Redis.fromEnv()` reads `UPSTASH_REDIS_REST_URL` and
 * `UPSTASH_REDIS_REST_TOKEN`; neither value is read, logged or handled here.
 */
const redis: Redis | null = (() => {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }
  try {
    return Redis.fromEnv();
  } catch {
    // A malformed URL should degrade to local counting, not break sign-in.
    return null;
  }
})();

/**
 * Keys are hashes, never the value itself.
 *
 * An email address in a Redis key is a customer list to anyone who can run
 * `SCAN`, and an IP is personal data. A SHA-256 prefix is deterministic — the
 * same address always lands on the same key — while carrying nothing back.
 * Thirty-two hex characters is 128 bits: collisions are not a practical
 * concern, and a collision would only mean two addresses sharing a budget.
 */
function keyFor(kind: "email" | "ip", value: string): string {
  const digest = createHash("sha256").update(value).digest("hex").slice(0, 32);
  return `meemiart:login:${kind}:${digest}`;
}

/**
 * Count one attempt in the shared store and report whether it is within limit.
 *
 * `INCR` is atomic, which is the whole reason it is used here: two requests
 * arriving at the same instant are counted twice and receive different values,
 * so concurrency cannot be used to slip past the limit. A read-then-write pair
 * would have exactly that race.
 *
 * ── One deliberate difference from the in-process window ───────────────────
 *
 * The expiry is refreshed on every attempt rather than only on the first. The
 * local map holds a fixed window that ends 15 minutes after the first attempt;
 * this one ends 15 minutes after the *last*. The difference only ever shows up
 * for a key that is being hit continuously — that is, an attack — and there it
 * extends the block rather than shortening it.
 *
 * It is written this way because the alternative sets the expiry only when the
 * counter reads 1, and if that second call fails the key is left with no
 * expiry at all, forever. Guaranteeing that every key dies matters more than
 * matching the local window to the second.
 */
async function hitShared(key: string, limit: number): Promise<boolean> {
  if (!redis) return true;

  const [count] = await redis
    .pipeline()
    .incr(key)
    .expire(key, WINDOW_SECONDS)
    .exec<[number, number]>();

  return count <= limit;
}

/**
 * The client's address, as far as the platform will say.
 *
 * `x-forwarded-for` is set by Vercel's edge and is the leftmost entry. It is
 * spoofable in a deployment that sits behind nothing, which is why this is one
 * of two windows rather than the only one. An unknown address falls back to a
 * single shared bucket: better that anonymous callers share a limit than that
 * they escape one.
 */
async function clientAddress(): Promise<string> {
  const list = await headers();
  const forwarded = list.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first || list.get("x-real-ip") || "unknown";
}

/** Addresses are compared case-insensitively, as the login lookup does. */
function normalise(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Record an attempt and report whether it may proceed.
 *
 * Called *before* the password is checked, so the cost of an attempt is paid
 * whether or not the address exists. That is deliberate: counting only real
 * accounts would turn the throttle into an oracle for which addresses are
 * registered.
 *
 * ── What happens when Redis is down ────────────────────────────────────────
 *
 * The local verdict has already been computed by the time Redis is consulted,
 * so an outage costs nothing: the attempt is judged on the in-process counters
 * exactly as it was before Upstash existed. The failure is swallowed rather
 * than surfaced — the caller returns the same generic message it always has,
 * and no infrastructure state reaches the user.
 *
 * Nothing about the error is logged either. A connection failure carries the
 * endpoint, and the endpoint is half of the credential pair.
 */
export async function allowLoginAttempt(email: string): Promise<boolean> {
  const now = Date.now();
  sweep(now);

  const address = normalise(email);
  const ip = await clientAddress();

  // Both are evaluated, never short-circuited: an attempt must count against
  // the source even when the address window is what refuses it, or an attacker
  // could keep their IP counter cold by reusing one blocked address.
  const localEmailOk = hit(`e:${address}`, EMAIL_LIMIT, now);
  const localIpOk = hit(`i:${ip}`, IP_LIMIT, now);
  const localOk = localEmailOk && localIpOk;

  if (!redis) return localOk;

  try {
    // Counted in parallel for one round trip's latency rather than two, and
    // both are always counted, for the same reason the local pair is.
    const [sharedEmailOk, sharedIpOk] = await Promise.all([
      hitShared(keyFor("email", address), EMAIL_LIMIT),
      hitShared(keyFor("ip", ip), IP_LIMIT),
    ]);

    // Either layer may refuse. Redis only ever adds refusals.
    return localOk && sharedEmailOk && sharedIpOk;
  } catch {
    return localOk;
  }
}

/**
 * Clear an address's window after a genuine sign-in.
 *
 * The source window is deliberately left alone: a shared office address should
 * not have its budget reset by one person signing in successfully, which is
 * exactly the cover an attacker on the same network would want. That property
 * is why this deletes one key and not two.
 *
 * A failure here is harmless and is ignored: the worst case is that a customer
 * who had already failed a few times keeps those attempts against them until
 * the window lapses on its own.
 */
export async function clearLoginAttempts(email: string): Promise<void> {
  const address = normalise(email);
  windows.delete(`e:${address}`);

  if (!redis) return;
  try {
    await redis.del(keyFor("email", address));
  } catch {
    // Deliberately silent — see above.
  }
}
