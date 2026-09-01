import "server-only";

import type { Prisma } from "@/generated/prisma/client";

/**
 * Which reviews the public may see.
 *
 * One definition, imported by every storefront read, so a rejected review
 * cannot survive on one surface after being moderated on another.
 *
 * `APPROVED` is the default on the column, so every review written before
 * moderation existed — and every review written since, which is still
 * auto-approved on submit — stays visible. Moderation is a way to *remove*
 * something, not a queue every customer has to wait in; making it a queue
 * would silently hide honest reviews from a shop that has one moderator.
 *
 * `PENDING` and `REJECTED` are hidden from the storefront and remain visible
 * in the admin, which is the only place they are actionable.
 */
export const PUBLIC_REVIEW = {
  status: "APPROVED",
} as const satisfies Prisma.ReviewWhereInput;
