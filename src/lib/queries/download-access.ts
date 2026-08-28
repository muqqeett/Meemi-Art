import "server-only";

import { prisma } from "@/lib/prisma";

/**
 * The single authorisation question behind every download.
 *
 * Is there an unrevoked `DigitalAccess` joining *this* user to *this* product,
 * through an order that is COMPLETED and a payment that is PAID?
 *
 * Four independent conditions, each of which must hold:
 *
 *   userId       the caller, taken from the session — never from the request
 *   revokedAt    null, so a refund closes the door
 *   order        COMPLETED, which only a verified webhook can set
 *   payment      PAID, re-checked through the order item's own order
 *
 * The grant row itself can only be created inside `applyEvent`, which is
 * reachable solely from the signed webhook. The order and payment are then
 * re-checked here so that even a hand-edited grant row cannot open a download
 * that was never paid for.
 *
 * This lives in one place on purpose. It used to be written out inside the
 * route and copied into the test harness, which meant the test could keep
 * passing while the route drifted. Both now call this.
 *
 * Returns `null` for every failure — unknown product, someone else's purchase,
 * unpaid, failed, refunded. The caller answers 404 to all of them, so the
 * endpoint cannot be used to discover which products exist.
 */
export type DownloadableAsset = {
  accessId: string;
  productName: string;
  storageKey: string;
  filename: string;
  contentType: string;
};

export async function findDownloadableAsset(
  userId: string,
  productId: string,
): Promise<DownloadableAsset | null> {
  const access = await prisma.digitalAccess.findFirst({
    where: {
      userId,
      productId,
      revokedAt: null,
      order: { status: "COMPLETED" },
      orderItem: { order: { payment: { status: "PAID" } } },
    },
    select: {
      id: true,
      product: {
        select: {
          name: true,
          asset: { select: { storageKey: true, filename: true, contentType: true } },
        },
      },
    },
  });

  if (!access?.product.asset) return null;

  return {
    accessId: access.id,
    productName: access.product.name,
    storageKey: access.product.asset.storageKey,
    filename: access.product.asset.filename,
    contentType: access.product.asset.contentType,
  };
}

/**
 * The same question, without loading the storage key.
 *
 * For callers that only need to know whether a download is permitted — a test,
 * or a page deciding whether to show a button. Not selecting the key at all is
 * strictly safer than selecting it and choosing not to use it.
 */
export async function canDownload(userId: string, productId: string): Promise<boolean> {
  const found = await prisma.digitalAccess.findFirst({
    where: {
      userId,
      productId,
      revokedAt: null,
      order: { status: "COMPLETED" },
      orderItem: { order: { payment: { status: "PAID" } } },
    },
    select: { id: true },
  });

  return found !== null;
}
