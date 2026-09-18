import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";
import { ANALYTICS_TIME_ZONE, dateKeyInZone } from "@/lib/analytics/date-range";
import { recordEvent } from "@/lib/analytics/events";
import { visitorKey } from "@/lib/analytics/visitor";
import { prisma } from "@/lib/prisma";

/**
 * Deciding whether a product-page view is recorded.
 *
 * Called after the beacon's response has been sent. Every "no" is silent: the
 * browser always gets the same empty 204, so the endpoint reveals nothing about
 * products, keys or limits.
 *
 *   1. The product must exist and be published — nobody counts views of a
 *      draft, and a guessed id records nothing.
 *   2. The visitor key is derived from the request (see `visitor.ts`) and only
 *      the key is kept.
 *   3. A visitor seen more than `VIEW_BURST` times in an hour on this server is
 *      ignored for the rest of that hour — a cheap brake on scripted traffic
 *      that spoofs a browser.
 *   4. The same visitor viewing the same product again within
 *      `DEDUPE_MINUTES` is one view, not several: refreshes and back-button
 *      returns do not inflate the count.
 */

export const DEDUPE_MINUTES = 30;
export const VIEW_BURST = 120;
const BURST_WINDOW_MS = 60 * 60 * 1000;
const MAX_TRACKED = 10_000;

type ViewDb = Pick<PrismaClient, "product" | "analyticsEvent">;

export type ViewDeps = {
  db: ViewDb;
  now: () => Date;
  secret: string;
};

export type ViewOutcome = "recorded" | "unknown_product" | "duplicate" | "rate_limited" | "failed";

/** Per-instance burst counter, keyed by the (already anonymous) visitor key. */
const bursts = new Map<string, { count: number; expires: number }>();

function overBurst(key: string, now: number): boolean {
  if (bursts.size > MAX_TRACKED) {
    for (const [k, w] of bursts) if (w.expires <= now) bursts.delete(k);
    if (bursts.size > MAX_TRACKED) bursts.clear();
  }
  const window = bursts.get(key);
  if (!window || window.expires <= now) {
    bursts.set(key, { count: 1, expires: now + BURST_WINDOW_MS });
    return false;
  }
  window.count += 1;
  return window.count > VIEW_BURST;
}

/** For the harness: forget burst counters between scenarios. */
export function resetViewBurstsForTests(): void {
  bursts.clear();
}

export async function recordProductView(
  input: { productId: string; address: string | null; userAgent: string | null },
  overrides?: Partial<ViewDeps>,
): Promise<ViewOutcome> {
  const deps: ViewDeps = {
    db: prisma,
    now: () => new Date(),
    secret: process.env.AUTH_SECRET ?? "",
    ...overrides,
  };

  try {
    const product = await deps.db.product.findFirst({
      where: { id: input.productId, isActive: true },
      select: { id: true },
    });
    if (!product) return "unknown_product";

    const now = deps.now();
    const key = visitorKey({
      address: input.address,
      userAgent: input.userAgent,
      dayKey: dateKeyInZone(now, ANALYTICS_TIME_ZONE),
      secret: deps.secret,
    });

    if (key) {
      if (overBurst(key, now.getTime())) return "rate_limited";

      const recent = await deps.db.analyticsEvent.findFirst({
        where: {
          type: "PRODUCT_VIEW",
          productId: product.id,
          visitorKey: key,
          createdAt: { gte: new Date(now.getTime() - DEDUPE_MINUTES * 60_000) },
        },
        select: { id: true },
      });
      if (recent) return "duplicate";
    }

    // Views never carry a user id, signed in or not: a view is counted, not
    // attributed to a person.
    // Stamped with the same instant the day key and the de-duplication window
    // were computed from, so the three can never disagree.
    const stored = await recordEvent(
      { type: "PRODUCT_VIEW", productId: product.id, visitorKey: key, occurredAt: now },
      deps.db,
    );
    return stored ? "recorded" : "failed";
  } catch (error) {
    const kind = error instanceof Error ? error.constructor.name : "unknown";
    console.warn("[analytics] view not recorded:", kind);
    return "failed";
  }
}
