import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Records what an administrator did, as it happens.
 *
 * Nothing here is ever backfilled. The table starts empty and fills only from
 * real actions, because an audit trail that invents its own history is worse
 * than an empty one — it looks authoritative and is not.
 *
 * ── Why this never throws ──────────────────────────────────────────────────
 *
 * Logging is not the operation. If the log write fails, the product was still
 * saved and the review was still approved; surfacing that failure to the admin
 * — or worse, rolling their change back — would make an observability feature
 * into an availability risk. Failures are swallowed and reported to the server
 * console, which is where an operator would look.
 *
 * Callers therefore do not need to await it for correctness, but they should:
 * a server action that returns before its log write lands can be torn down
 * mid-write.
 */

/** Verb namespaces, so the log can be filtered without matching strings. */
export type ActivityEntity =
  | "product"
  | "category"
  | "order"
  | "review"
  | "coupon"
  | "payment"
  | "email";

export async function recordActivity(input: {
  actorId: string;
  /** Machine-readable verb, e.g. `product.updated`. */
  action: string;
  entityType: ActivityEntity;
  /** Null for actions that are not about a single record. */
  entityId?: string | null;
  /**
   * A small amount of context that makes the entry readable months later — a
   * product name, an order number, what changed. Never secrets, never tokens,
   * never a whole record.
   */
  meta?: Prisma.InputJsonValue;
}): Promise<void> {
  try {
    await prisma.adminActivity.create({
      data: {
        actorId: input.actorId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        meta: input.meta,
      },
    });
  } catch (error) {
    console.error("[activity] could not record", input.action, error);
  }
}
