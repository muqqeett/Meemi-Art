"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { syncProductRating } from "@/lib/queries/reviews";
import { getAdminOrNull, type SessionUser } from "@/lib/auth-guards";
import { recordActivity } from "@/lib/admin/activity";
import type { ReviewStatus } from "@/generated/prisma/enums";
import type { AdminResult } from "@/lib/actions/admin/products";

/**
 * Review moderation.
 *
 * Reviews are customer-authored, so every action here changes only *visibility*
 * — approve, reject, feature. Nothing can create or edit the text or the star
 * rating of a review, because a shop writing its own testimony is fraud.
 *
 * Every mutation recomputes the parent product's cached `ratingAvg` and
 * `reviewCount`, which the storefront, product cards and JSON-LD all read. That
 * matters more than it looks: rejecting a review must also pull its stars out
 * of the average, or the shop keeps advertising a rating it no longer stands
 * behind.
 */
async function adminOrDenied(): Promise<
  { admin: SessionUser; denied?: never } | { admin?: never; denied: AdminResult }
> {
  const admin = await getAdminOrNull();
  if (!admin) {
    return { denied: { ok: false, error: "You don't have permission to do that." } };
  }
  return { admin };
}

// syncProductRating now lives in lib/queries/reviews.ts so the customer
// review action and this moderation flow share one implementation.

/** Paths that show review content, revalidated together after any decision. */
function revalidateReview(productSlug: string) {
  revalidatePath("/admin/reviews");
  revalidatePath(`/products/${productSlug}`);
  revalidatePath("/");
}

/**
 * Approve, reject, or send a review back to the queue.
 *
 * `REJECTED` is not a delete: the row stays, the customer's words are
 * preserved, and the decision is reversible. Only the storefront gate
 * (`PUBLIC_REVIEW`) changes what is shown.
 */
export async function setReviewStatus(
  id: string,
  status: ReviewStatus,
): Promise<AdminResult> {
  const { admin, denied } = await adminOrDenied();
  if (denied) return denied;

  const review = await prisma.review.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      status: true,
      featured: true,
      productId: true,
      product: { select: { slug: true, name: true } },
    },
  });
  if (!review) return { ok: false, error: "That review no longer exists." };
  if (review.status === status) return { ok: true, message: "No change." };

  try {
    await prisma.review.update({
      where: { id: review.id },
      data: {
        status,
        // A review that is no longer public cannot stay pinned to the top of
        // the product page. Un-featuring here rather than leaving a dangling
        // flag means "featured" always implies "visible".
        ...(status === "APPROVED" ? {} : { featured: false }),
      },
    });
    await syncProductRating(review.productId);

    await recordActivity({
      actorId: admin.id,
      action: `review.${status.toLowerCase()}`,
      entityType: "review",
      entityId: review.id,
      meta: {
        product: review.product.name,
        title: review.title,
        from: review.status,
        to: status,
      },
    });

    revalidateReview(review.product.slug);

    const message =
      status === "APPROVED"
        ? "Review approved and visible on the product page."
        : status === "REJECTED"
          ? "Review hidden from the storefront. The customer's text is kept."
          : "Review moved back to the queue.";
    return { ok: true, message };
  } catch (error) {
    console.error("[admin] setReviewStatus", error);
    return { ok: false, error: "Couldn't update that review." };
  }
}

/**
 * Pin a review to the top of its product page.
 *
 * Only an approved review can be featured — promoting something the storefront
 * is hiding would put it back in front of customers through the side door.
 */
export async function setReviewFeatured(
  id: string,
  featured: boolean,
): Promise<AdminResult> {
  const { admin, denied } = await adminOrDenied();
  if (denied) return denied;

  const review = await prisma.review.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      status: true,
      featured: true,
      product: { select: { slug: true, name: true } },
    },
  });
  if (!review) return { ok: false, error: "That review no longer exists." };

  if (featured && review.status !== "APPROVED") {
    return { ok: false, error: "Approve this review before featuring it." };
  }
  if (review.featured === featured) return { ok: true, message: "No change." };

  try {
    await prisma.review.update({ where: { id: review.id }, data: { featured } });

    await recordActivity({
      actorId: admin.id,
      action: featured ? "review.featured" : "review.unfeatured",
      entityType: "review",
      entityId: review.id,
      meta: { product: review.product.name, title: review.title },
    });

    revalidateReview(review.product.slug);
    return {
      ok: true,
      message: featured
        ? "Review pinned to the top of the product page."
        : "Review unpinned.",
    };
  } catch (error) {
    console.error("[admin] setReviewFeatured", error);
    return { ok: false, error: "Couldn't update that review." };
  }
}

/**
 * Apply one decision to several reviews.
 *
 * Bulk moderation only ever changes status — there is no bulk delete, because
 * an irreversible action over a checkbox list is the wrong shape for a
 * mis-click. Ratings are resynced once per affected product, not once per
 * review.
 */
export async function moderateReviews(
  ids: string[],
  status: ReviewStatus,
): Promise<AdminResult<{ updated: number }>> {
  const { admin, denied } = await adminOrDenied();
  if (denied) return denied;

  const unique = [...new Set(ids)].filter(Boolean);
  if (unique.length === 0) return { ok: false, error: "Select at least one review." };

  const reviews = await prisma.review.findMany({
    where: { id: { in: unique } },
    select: { id: true, productId: true, product: { select: { slug: true } } },
  });
  if (reviews.length === 0) return { ok: false, error: "Those reviews no longer exist." };

  try {
    const result = await prisma.review.updateMany({
      where: { id: { in: reviews.map((review) => review.id) } },
      data: { status, ...(status === "APPROVED" ? {} : { featured: false }) },
    });

    for (const productId of new Set(reviews.map((review) => review.productId))) {
      await syncProductRating(productId);
    }

    await recordActivity({
      actorId: admin.id,
      action: `review.bulk_${status.toLowerCase()}`,
      entityType: "review",
      meta: { count: result.count, status },
    });

    revalidatePath("/admin/reviews");
    revalidatePath("/");
    for (const slug of new Set(reviews.map((review) => review.product.slug))) {
      revalidatePath(`/products/${slug}`);
    }

    return {
      ok: true,
      message: `${result.count} ${result.count === 1 ? "review" : "reviews"} updated.`,
      data: { updated: result.count },
    };
  } catch (error) {
    console.error("[admin] moderateReviews", error);
    return { ok: false, error: "Couldn't update those reviews." };
  }
}

export async function deleteReview(id: string): Promise<AdminResult> {
  const { admin, denied } = await adminOrDenied();
  if (denied) return denied;

  const review = await prisma.review.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      rating: true,
      productId: true,
      product: { select: { slug: true, name: true } },
    },
  });
  if (!review) return { ok: false, error: "That review no longer exists." };

  try {
    await prisma.review.delete({ where: { id: review.id } });
    await syncProductRating(review.productId);

    // Logged after the delete: the row is gone, so the entry is the only
    // remaining record that it existed.
    await recordActivity({
      actorId: admin.id,
      action: "review.deleted",
      entityType: "review",
      entityId: review.id,
      meta: {
        product: review.product.name,
        title: review.title,
        rating: review.rating,
      },
    });

    revalidateReview(review.product.slug);
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
  const { admin, denied } = await adminOrDenied();
  if (denied) return denied;

  try {
    const products = await prisma.product.findMany({ select: { id: true } });
    for (const product of products) {
      await syncProductRating(product.id);
    }

    await recordActivity({
      actorId: admin.id,
      action: "review.ratings_resynced",
      entityType: "review",
      meta: { products: products.length },
    });

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
