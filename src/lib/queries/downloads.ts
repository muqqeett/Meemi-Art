import "server-only";

import { prisma } from "@/lib/prisma";

/**
 * What a customer is entitled to download.
 *
 * Scoped by user id from the session in every query here — there is no
 * parameter a caller could pass to widen the result to someone else's
 * purchases.
 *
 * `storageKey` is never selected. The account page has no use for it, and a
 * field that is never loaded cannot be leaked by a careless serialisation.
 */

export type DownloadEntry = {
  accessId: string;
  productId: string;
  productName: string;
  productSlug: string;
  imageUrl: string | null;
  orderNumber: string;
  purchasedAt: Date;
  /** False once a refund has withdrawn access. */
  isActive: boolean;
  revokedReason: string | null;
  fileName: string;
  fileBytes: number;
  fileVersion: string;
  downloadCount: number;
  lastDownloadAt: Date | null;
};

export async function getDownloadsForUser(userId: string): Promise<DownloadEntry[]> {
  const rows = await prisma.digitalAccess.findMany({
    where: { userId },
    orderBy: { grantedAt: "desc" },
    select: {
      id: true,
      productId: true,
      grantedAt: true,
      revokedAt: true,
      revokedReason: true,
      downloadCount: true,
      lastDownloadAt: true,
      order: { select: { orderNumber: true, placedAt: true } },
      product: {
        select: {
          name: true,
          slug: true,
          images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } },
          asset: { select: { filename: true, bytes: true, version: true } },
        },
      },
    },
  });

  return rows.map((row) => ({
    accessId: row.id,
    productId: row.productId,
    productName: row.product.name,
    productSlug: row.product.slug,
    imageUrl: row.product.images[0]?.url ?? null,
    orderNumber: row.order.orderNumber,
    purchasedAt: row.grantedAt,
    isActive: row.revokedAt === null,
    revokedReason: row.revokedReason,
    fileName: row.product.asset?.filename ?? "",
    fileBytes: row.product.asset?.bytes ?? 0,
    fileVersion: row.product.asset?.version ?? "",
    downloadCount: row.downloadCount,
    lastDownloadAt: row.lastDownloadAt,
  }));
}
