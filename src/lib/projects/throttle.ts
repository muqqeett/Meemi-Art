import "server-only";

import { createHash } from "node:crypto";
import { Redis } from "@upstash/redis";

/**
 * Rate limit for customer project uploads and submissions.
 *
 * Follows the two-layer design of `lib/security/login-throttle.ts` and
 * `lib/assistant/throttle.ts` — in-process counters always, Upstash Redis on
 * top when configured, and an attempt refused if either layer refuses — as its
 * own module with its own `meemiart:projects:*` keys. It reads and writes none
 * of the sign-in or assistant counters.
 *
 * Keyed by the signed-in user, never by anything the request supplies: every
 * attempt here is already authenticated, so the account is the natural budget
 * and a shared office address does not throttle its neighbours.
 *
 *   sign     20 upload signatures per user per hour. A customer choosing and
 *            re-choosing a photo needs a few; twenty stops a script minting
 *            signatures.
 *   submit   10 submissions or edits per user per hour. The three-per-product
 *            cap is the real ceiling; this stops hammering at it.
 */

export type ProjectAttempt = "sign" | "submit";

const LIMITS: Record<ProjectAttempt, { limit: number; windowSeconds: number }> = {
  sign: { limit: 20, windowSeconds: 60 * 60 },
  submit: { limit: 10, windowSeconds: 60 * 60 },
};

type Window = { count: number; expires: number };

const windows = new Map<string, Window>();
const MAX_TRACKED = 10_000;

function sweep(now: number) {
  for (const [key, window] of windows) {
    if (window.expires <= now) windows.delete(key);
  }
  if (windows.size > MAX_TRACKED) windows.clear();
}

function hitLocal(key: string, limit: number, windowSeconds: number, now: number): boolean {
  const existing = windows.get(key);
  if (!existing || existing.expires <= now) {
    windows.set(key, { count: 1, expires: now + windowSeconds * 1000 });
    return true;
  }
  existing.count += 1;
  return existing.count <= limit;
}

/** Null when Upstash is not configured; local counters then stand alone. */
const redis: Redis | null = (() => {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null;
  try {
    return Redis.fromEnv();
  } catch {
    return null;
  }
})();

/** Hashed, so no user id is stored as a Redis key. */
function sharedKey(kind: ProjectAttempt, userId: string): string {
  const digest = createHash("sha256").update(userId).digest("hex").slice(0, 32);
  return `meemiart:projects:${kind}:${digest}`;
}

/**
 * Count one attempt and report whether it may proceed.
 *
 * `INCR` then `EXPIRE` in one pipeline, refreshed on every attempt, for the
 * reasons given in the sign-in throttle: atomic counting, and no key can be
 * left without an expiry. Redis errors are swallowed and the local verdict
 * stands; the endpoint in a connection error is half of a credential, so
 * nothing is logged.
 */
export async function allowProjectAttempt(kind: ProjectAttempt, userId: string): Promise<boolean> {
  const { limit, windowSeconds } = LIMITS[kind];
  const now = Date.now();
  sweep(now);

  const localOk = hitLocal(`${kind}:${userId}`, limit, windowSeconds, now);
  if (!redis) return localOk;

  try {
    const [count] = await redis
      .pipeline()
      .incr(sharedKey(kind, userId))
      .expire(sharedKey(kind, userId), windowSeconds)
      .exec<[number, number]>();
    return localOk && count <= limit;
  } catch {
    return localOk;
  }
}

/** The configured limits, for the test harness. */
export const PROJECT_ATTEMPT_LIMITS = LIMITS;

/** Whether a shared store is in use. The harness asserts it is not. */
export const projectThrottleUsesRedis = redis !== null;
