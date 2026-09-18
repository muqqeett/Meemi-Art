import "server-only";

import { after } from "next/server";

import type { AnalyticsEventType, PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Recording analytics events — always after, never instead of, the real work.
 *
 * An event is written only once the customer's action has succeeded, and it is
 * written after the response has been sent (`after`), so it adds no latency to
 * the add to cart, the wishlist save or the download. Nothing here throws: a
 * failed insert is logged by error class and forgotten. The cart, the wishlist,
 * checkout, payment and downloads cannot fail because analytics did.
 */

export type TrackableEvent = {
  type: AnalyticsEventType;
  productId: string;
  userId?: string | null;
  visitorKey?: string | null;
  quantity?: number | null;
  /** When it happened. Defaults to the database's clock. */
  occurredAt?: Date;
};

type EventDb = Pick<PrismaClient, "analyticsEvent">;

function logFailure(type: string, error: unknown): void {
  // The class only: a driver message can carry connection details.
  const kind = error instanceof Error ? error.constructor.name : "unknown";
  console.warn(`[analytics] ${type} event not recorded:`, kind);
}

/** Insert one event. Resolves true when stored, false otherwise — never rejects. */
export async function recordEvent(event: TrackableEvent, db: EventDb = prisma): Promise<boolean> {
  try {
    await db.analyticsEvent.create({
      data: {
        type: event.type,
        productId: event.productId,
        userId: event.userId ?? null,
        visitorKey: event.visitorKey ?? null,
        quantity: event.quantity ?? null,
        ...(event.occurredAt ? { createdAt: event.occurredAt } : {}),
      },
    });
    return true;
  } catch (error) {
    logFailure(event.type, error);
    return false;
  }
}

/**
 * Record an event once the response has gone out.
 *
 * `build` runs after the response too — so looking up the signed-in user, say,
 * costs the customer nothing — and may return null to record nothing. Outside
 * a request (a script), `after` is unavailable and the work simply runs in the
 * background instead.
 */
export function trackAfterResponse(
  eventOrBuild: TrackableEvent | (() => Promise<TrackableEvent | null> | TrackableEvent | null),
): void {
  const run = async () => {
    try {
      const event = typeof eventOrBuild === "function" ? await eventOrBuild() : eventOrBuild;
      if (event) await recordEvent(event);
    } catch (error) {
      logFailure("pending", error);
    }
  };
  try {
    after(run);
  } catch {
    void run();
  }
}

/**
 * Record something the signed-in customer did, after the response.
 *
 * Takes the session user rather than an id, so a server action can record an
 * event without ever handling a user id itself.
 */
export function trackUserEvent(type: AnalyticsEventType, productId: string, user: { id: string }): void {
  trackAfterResponse({ type, productId, userId: user.id });
}
