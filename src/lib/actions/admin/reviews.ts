"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { syncProductRating } from "@/lib/queries/reviews";
import { getAdminOrNull } from "@/lib/auth-guards";
import type { AdminResult } from "@/lib/actions/admin/products";

/**
 * Review moderation.
 *
 * Reviews are customer-authored, so the only actions offered are removal of
 * genuinely abusive or mistaken entries — nothing here can create or edit the
 * text of a review, because a shop editing its own reviews is fraud.
 *
 * Every mutation recomputes the parent product's cached `ratingAvg` and
 * `reviewCount`, which the storefront, product cards and JSON-LD all read.
 */
async function assertAdmin(): Promise<AdminResult | null> {
  const admin = await getAdminOrNull();
  if (!admin) return { ok: false, error: "You don't have permission to do that." };
  return null;
}

// syncProductRating now lives in lib/queries/reviews.ts so the customer
// review action and this moderation flow share one implementation.

export async function deleteReview(id: string): Promise<AdminResult> {
  const denied = await assertAdmin();
  if (denied) return denied;

  const review = await prisma.review.findUnique({
    where: { id },
    select: { id: true, productId: true, product: { select: { slug: true } } },
  });
  if (!review) return { ok: false, error: "That review no longer exists." };

  try {
    await prisma.review.delete({ where: { id: review.id } });
    await syncProductRating(review.productId);

    revalidatePath("/admin/reviews");
    revalidatePath(`/products/${review.product.slug}`);
    revalidatePath("/");
    return { ok: true, message: "Review removed and the product rating recalculated." };
  } catch (error) {
    console.error("[admin] deleteReview", error);
    return { ok: false, error: "Couldn't remove that review." };
  }
}

/**
 * Recompute aggregates for every product.
 *
 * Useful after data has been changed outside the admin — it repairs any drift
 * between the cached rating columns and the actual review rows.
 */
export async function resyncAllRatings(): Promise<AdminResult<{ updated: number }>> {
  const denied = await assertAdmin();
  if (denied) return denied;

  try {
    const products = await prisma.product.findMany({ select: { id: true } });
    for (const product of products) {
      await syncProductRating(product.id);
    }

    revalidatePath("/admin/reviews");
    revalidatePath("/shop");
    return {
      ok: true,
      message: `Recalculated ratings for ${products.length} products.`,
      data: { updated: products.length },
    };
  } catch (error) {
    console.error("[admin] resyncAllRatings", error);
    return { ok: false, error: "Couldn't recalculate ratings." };
  }
}
