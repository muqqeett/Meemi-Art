import "server-only";

import { prisma } from "@/lib/prisma";
import { getProductsBySlugs, type ProductCardData } from "@/lib/queries/products";

/**
 * The user's wishlist, resolved to full product cards so prices and stock are
 * always live rather than whatever they were when the item was saved.
 */
export async function getWishlistProducts(userId: string): Promise<ProductCardData[]> {
  const wishlist = await prisma.wishlist.findUnique({
    where: { userId },
    select: {
      items: {
        orderBy: { createdAt: "desc" },
        select: { product: { select: { slug: true, isActive: true } } },
      },
    },
  });

  const slugs =
    wishlist?.items
      .filter((item) => item.product.isActive)
      .map((item) => item.product.slug) ?? [];

  return getProductsBySlugs(slugs);
}
