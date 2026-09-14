import "server-only";

import { createHash } from "node:crypto";
import { Redis } from "@upstash/redis";

/**
 * Rate limit for the crochet assistant.
 *
 * Every allowed request can cost two model calls, so this is a cost control as
 * much as an abuse control. It follows the two-layer design of
 * `lib/security/login-throttle.ts` — in-process counters always, Upstash Redis
 * on top when configured, and a request refused if either layer refuses — but
 * it is its own module with its own `meemiart:assistant:*` keys. Nothing here
 * reads or writes the sign-in counters.
 *
 * ── Two windows ─────────────────────────────────────────────────────────────
 *
 *   per client   20 messages per 10 minutes. A shopper browsing and asking
 *                follow-ups sends a handful; twenty leaves room to explore
 *                while stopping a script.
 *   global       600 messages per hour across the whole store. A ceiling on
 *                spend if many sources arrive at once; generous for real
 *                traffic on a store this size.
 */

const CLIENT_LIMIT = 20;
const CLIENT_WINDOW_SECONDS = 10 * 60;
const GLOBAL_LIMIT = 600;
const GLOBAL_WINDOW_SECONDS = 60 * 60;

type Window = { count: number; expires: number };

const windows = new Map<string, Window>();
const MAX_TRACKED = 10_000;

function sweep(now: number) {
  for (const [key, window] of windows) {
    if (window.expires <= now) windows.delete(key);
  }
  if (windows.size > MAX_TRACKED) windows.clear();
}

/** Count one hit locally; returns the seconds until the window resets, or 0 when allowed. */
function hitLocal(key: string, limit: number, windowSeconds: number, now: number): number {
  const existing = windows.get(key);
  if (!existing || existing.expires <= now) {
    windows.set(key, { count: 1, expires: now + windowSeconds * 1000 });
    return 0;
  }
  existing.count += 1;
  return existing.count <= limit ? 0 : Math.ceil((existing.expires - now) / 1000);
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

/** Hashed, so neither an IP nor anything personal is stored as a key. */
function clientKey(clientId: string): string {
  const digest = createHash("sha256").update(clientId).digest("hex").slice(0, 32);
  return `meemiart:assistant:client:${digest}`;
}

async function hitShared(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  if (!redis) return true;
  const [count] = await redis
    .pipeline()
    .incr(key)
    .expire(key, windowSeconds)
    .exec<[number, number]>();
  return count <= limit;
}

export type ThrottleVerdict = { allowed: true } | { allowed: false; retryAfterSeconds: number };

/**
 * Record one assistant request and report whether it may proceed.
 *
 * `clientId` is the caller's address as the platform reports it. Both windows
 * are always counted — never short-circuited — so a refused client still counts
 * against the global budget.
 *
 * Redis errors are swallowed and the local verdict stands: a cache outage must
 * not take the feature down, and the endpoint in a connection error is half of
 * a credential, so it is not logged.
 */
export async function allowAssistantRequest(clientId: string): Promise<ThrottleVerdict> {
  const now = Date.now();
  sweep(now);

  const clientWait = hitLocal(`c:${clientId}`, CLIENT_LIMIT, CLIENT_WINDOW_SECONDS, now);
  const globalWait = hitLocal("g", GLOBAL_LIMIT, GLOBAL_WINDOW_SECONDS, now);
  let wait = Math.max(clientWait, globalWait);

  if (redis) {
    try {
      const hour = Math.floor(now / (GLOBAL_WINDOW_SECONDS * 1000));
      const [clientOk, globalOk] = await Promise.all([
        hitShared(clientKey(clientId), CLIENT_LIMIT, CLIENT_WINDOW_SECONDS),
        hitShared(`meemiart:assistant:global:${hour}`, GLOBAL_LIMIT, GLOBAL_WINDOW_SECONDS),
      ]);
      if (!clientOk) wait = Math.max(wait, CLIENT_WINDOW_SECONDS);
      if (!globalOk) wait = Math.max(wait, 60);
    } catch {
      // Local verdict stands.
    }
  }

  return wait > 0 ? { allowed: false, retryAfterSeconds: wait } : { allowed: true };
}

/** Test hook: forget local counters. Not used by the application. */
export function resetAssistantThrottleForTests(): void {
  windows.clear();
}
