import "server-only";

import { cache } from "react";

import { prisma } from "@/lib/prisma";

/**
 * Highly-rated recent reviews for the homepage.
 *
 * These are real rows written against real products — the storefront never
 * renders invented testimonials. If the table is empty the section simply does
 * not render.
 */
export const getFeaturedReviews = cache(async (limit = 3) => {
  const reviews = await prisma.review.findMany({
    where: { rating: { gte: 4 }, body: { not: "" } },
    orderBy: [{ rating: "desc" }, { createdAt: "desc" }],
    take: limit,
    select: {
      id: true,
      rating: true,
      title: true,
      body: true,
      createdAt: true,
      user: { select: { name: true } },
      product: { select: { name: true, slug: true } },
    },
  });

  return reviews;
});

/** Aggregate rating across the whole catalogue, for the reviews section. */
export const getReviewSummary = cache(async () => {
  const [agg, productCount] = await Promise.all([
    prisma.review.aggregate({ _avg: { rating: true }, _count: true }),
    prisma.product.count({ where: { isActive: true } }),
  ]);

  return {
    average: Math.round((agg._avg.rating ?? 0) * 10) / 10,
    count: agg._count,
    productCount,
  };
});

/**
 * Recalculate a product's cached rating aggregates from its live reviews.
 *
 * `Product.ratingAvg` and `Product.reviewCount` are denormalised — the product
 * grid, cards, PDP header and JSON-LD all read them rather than aggregating on
 * every render. Anything that writes a review has to call this, or the number
 * on the card drifts away from the reviews on the page.
 *
 * Lives here rather than in the admin action it started in, so the customer
 * flow and the admin moderation flow share one implementation instead of two
 * that can disagree.
 */
export async function syncProductRating(productId: string): Promise<void> {
  const agg = await prisma.review.aggregate({
    where: { productId },
    _avg: { rating: true },
    _count: true,
  });

  await prisma.product.update({
    where: { id: productId },
    data: {
      ratingAvg: Math.round((agg._avg.rating ?? 0) * 10) / 10,
      reviewCount: agg._count,
    },
  });
}

/**
 * May this user review this product?
 *
 * The single authorisation question behind the whole feature, and the only
 * place it is answered. Eligibility is a purchase that actually completed:
 *
 *   an OrderItem for this product
 *   on an order belonging to this user
 *   whose order status is COMPLETED
 *   and whose payment is PAID
 *
 * The order and payment are both checked, matching the rule the download route
 * uses. A pending, failed, cancelled or refunded order grants nothing — a
 * refunded customer keeping the ability to post a review would be the same
 * mistake as keeping the download.
 *
 * `userId` always comes from the session. Nothing here is taken from a form
 * field, so a caller cannot nominate someone else's purchase.
 */
export async function hasPurchasedProduct(
  userId: string,
  productId: string,
): Promise<boolean> {
  const item = await prisma.orderItem.findFirst({
    where: {
      productId,
      order: {
        userId,
        status: "COMPLETED",
        payment: { status: "PAID" },
      },
    },
    select: { id: true },
  });

  return item !== null;
}

/** A customer's own review, as the form needs it back. */
export type OwnReview = { id: string; rating: number; title: string; body: string };

/**
 * For a set of products, which ones may this user review and what have they
 * already written.
 *
 * The batched form of `hasPurchasedProduct`, for pages that show several
 * products at once. It asks the question the feature actually turns on — *has
 * this user ever bought this product* — rather than asking about the status of
 * whichever order the page happens to be rendering. Those differ: the same
 * product can sit on a paid order and on a later cancelled one, and eligibility
 * follows the purchase, not the page.
 *
 * Nothing here is time-bounded. There is no window, cutoff or expiry: a
 * purchase from two years ago answers this exactly as one from this morning.
 *
 * Products the user has not bought are absent from the map entirely, so a
 * caller cannot accidentally render a form by reading a missing key as `null` —
 * "not purchased" and "purchased, not yet reviewed" are different shapes.
 *
 * Two queries rather than a join so the review lookup is keyed on the same
 * unique constraint the write uses.
 */
export async function getReviewEligibility(
  userId: string,
  productIds: string[],
): Promise<Map<string, OwnReview | null>> {
  const unique = [...new Set(productIds)];
  if (unique.length === 0) return new Map();

  const purchased = await prisma.orderItem.findMany({
    where: {
      productId: { in: unique },
      order: {
        userId,
        status: "COMPLETED",
        payment: { status: "PAID" },
      },
    },
    select: { productId: true },
    distinct: ["productId"],
  });

  const eligible = purchased
    .map((row) => row.productId)
    .filter((id): id is string => id !== null);

  if (eligible.length === 0) return new Map();

  const own = await prisma.review.findMany({
    where: { userId, productId: { in: eligible } },
    select: { id: true, productId: true, rating: true, title: true, body: true },
  });
  const byProduct = new Map(own.map((review) => [review.productId, review]));

  return new Map(
    eligible.map((id) => {
      const existing = byProduct.get(id);
      return [
        id,
        existing
          ? {
              id: existing.id,
              rating: existing.rating,
              title: existing.title,
              body: existing.body,
            }
          : null,
      ];
    }),
  );
}

/** This user's own review of a product, or null. Used to prefill the form. */
export async function getOwnReview(userId: string, productId: string) {
  return prisma.review.findUnique({
    where: { productId_userId: { productId, userId } },
    select: { id: true, rating: true, title: true, body: true, updatedAt: true },
  });
}

/**
 * Which of these reviewers actually bought the product.
 *
 * Every review written through this application is gated on a purchase, so in
 * practice all of them are verified. It is computed rather than assumed
 * because rows can predate the gate, and a "Verified purchase" badge that is
 * merely decorative is worse than none.
 */
export async function getVerifiedReviewerIds(
  productId: string,
  userIds: string[],
): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();

  const rows = await prisma.orderItem.findMany({
    where: {
      productId,
      order: {
        userId: { in: userIds },
        status: "COMPLETED",
        payment: { status: "PAID" },
      },
    },
    select: { order: { select: { userId: true } } },
  });

  return new Set(rows.map((row) => row.order.userId));
}
