import "server-only";

import type { ProjectStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { MAX_PROJECTS_PER_PRODUCT, PROJECT_CAP_STATUSES } from "@/lib/projects/mutations";
import { SUCCESSFUL_ORDER_ITEM } from "@/lib/queries/successful-order";

/**
 * What the account "Projects" page reads.
 *
 * Scoped by the user id the page took from its own `requireUser` call, as the
 * downloads and wishlist queries are — there is no parameter a browser could
 * pass to widen either result to someone else's projects or purchases.
 *
 * Nothing that identifies storage is selected: no image key, no format, no
 * dimensions. `imageUrl` is the public delivery reference and is null until
 * approved photos can be published, so the page shows a placeholder rather
 * than constructing anything.
 */

export type AccountProject = {
  id: string;
  status: ProjectStatus;
  caption: string | null;
  displayName: string | null;
  rejectionReason: string | null;
  imageUrl: string | null;
  createdAt: Date;
  product: { name: string; slug: string; isActive: boolean };
};

export async function getProjectsForUser(userId: string): Promise<AccountProject[]> {
  return prisma.customerProject.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      caption: true,
      displayName: true,
      rejectionReason: true,
      imageUrl: true,
      createdAt: true,
      product: { select: { name: true, slug: true, isActive: true } },
    },
  });
}

/** A published product this customer bought, and how many of its slots are used. */
export type ShareableProduct = { id: string; name: string; used: number; remaining: number };

/**
 * The products the submission form offers.
 *
 * A convenience for the form, not a gate: the upload route re-checks the
 * product, the COMPLETED + PAID purchase and the cap on every request. The
 * rule is the same one — `SUCCESSFUL_ORDER_ITEM` and the cap statuses — so the
 * list and the server rarely disagree, and when they do the server wins.
 */
export async function getShareableProducts(userId: string): Promise<ShareableProduct[]> {
  const purchases = await prisma.orderItem.findMany({
    where: { AND: [SUCCESSFUL_ORDER_ITEM, { order: { userId }, product: { isActive: true } }] },
    select: { productId: true, product: { select: { name: true } } },
    distinct: ["productId"],
  });

  const products = purchases.flatMap((row) =>
    row.productId && row.product ? [{ id: row.productId, name: row.product.name }] : [],
  );
  if (products.length === 0) return [];

  const used = await prisma.customerProject.groupBy({
    by: ["productId"],
    where: { userId, productId: { in: products.map((product) => product.id) }, status: { in: PROJECT_CAP_STATUSES } },
    _count: { _all: true },
  });
  const usedBy = new Map(used.map((row) => [row.productId, row._count._all]));

  return products
    .map((product) => {
      const count = usedBy.get(product.id) ?? 0;
      return { ...product, used: count, remaining: Math.max(0, MAX_PROJECTS_PER_PRODUCT - count) };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
