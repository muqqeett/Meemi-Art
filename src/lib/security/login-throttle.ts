import "server-only";

import { headers } from "next/headers";

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
 * ── What this is, and its limit, stated plainly ────────────────────────────
 *
 * An in-process sliding window. It holds counters in module scope, which means
 * one set of counters per running instance. On a serverless platform several
 * instances may be live at once, so a determined attacker who spreads requests
 * across them gets a multiple of the limit rather than the limit.
 *
 * That is a real weakness and it is deliberate: closing it properly needs a
 * store shared between instances — Redis, Upstash, or a table — and this
 * codebase has neither a KV dependency nor permission to add a table. Between
 * "no limit" and "a limit that a distributed attacker can multiply", the second
 * is strictly better: it stops the ordinary case outright — a script hammering
 * one account, or one address working through a credential dump — because
 * those arrive on a warm instance and are counted.
 *
 * Recorded here so the next person does not mistake it for a complete defence:
 * **a shared store is the real fix, and this is the interim.**
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
 */
export async function allowLoginAttempt(email: string): Promise<boolean> {
  const now = Date.now();
  sweep(now);

  const ip = await clientAddress();

  // Both are evaluated, never short-circuited: an attempt must count against
  // the source even when the address window is what refuses it, or an attacker
  // could keep their IP counter cold by reusing one blocked address.
  const emailOk = hit(`e:${normalise(email)}`, EMAIL_LIMIT, now);
  const ipOk = hit(`i:${ip}`, IP_LIMIT, now);

  return emailOk && ipOk;
}

/**
 * Clear an address's window after a genuine sign-in.
 *
 * The source window is deliberately left alone: a shared office address should
 * not have its budget reset by one person signing in successfully, which is
 * exactly the cover an attacker on the same network would want.
 */
export function clearLoginAttempts(email: string): void {
  windows.delete(`e:${normalise(email)}`);
}
