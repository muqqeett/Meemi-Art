import "server-only";

import { prisma } from "@/lib/prisma";
import { PUBLIC_PROJECT } from "@/lib/queries/project-visibility";

/** The most a product page will ever ask for at once. */
export const MAX_PUBLIC_PROJECTS = 24;

/**
 * Publicly visible projects for one product, newest decision first.
 *
 * Selects only what a gallery needs to render. No user id, no email, no image
 * key, no moderation data — a field that is never loaded cannot be leaked by a
 * careless serialisation.
 */
export async function getPublicProjectsForProduct(productId: string, limit = 12) {
  return prisma.customerProject.findMany({
    where: { ...PUBLIC_PROJECT, productId },
    orderBy: [{ moderatedAt: "desc" }, { createdAt: "desc" }],
    take: Math.min(Math.max(1, Math.floor(limit)), MAX_PUBLIC_PROJECTS),
    select: {
      id: true,
      imageUrl: true,
      width: true,
      height: true,
      caption: true,
      displayName: true,
      createdAt: true,
    },
  });
}
