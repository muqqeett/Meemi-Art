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
