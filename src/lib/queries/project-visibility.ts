import "server-only";

import type { Prisma } from "@/generated/prisma/client";

/**
 * Which customer projects the public may see.
 *
 * One definition, imported by every storefront read, so a hidden or rejected
 * project cannot survive on one surface after being moderated on another.
 *
 * Approved alone is not enough: the project must also carry a published image
 * reference and belong to a published product. Moderation clears `imageUrl`
 * whenever a project leaves APPROVED, and nothing sets it yet — publishing an
 * authenticated image is still to be verified — so today this matches nothing,
 * which is the intended state.
 */
export const PUBLIC_PROJECT = {
  status: "APPROVED",
  imageUrl: { not: null },
  product: { isActive: true },
} as const satisfies Prisma.CustomerProjectWhereInput;
