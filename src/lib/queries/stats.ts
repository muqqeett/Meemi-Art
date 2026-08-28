import "server-only";

import { cache } from "react";

import { prisma } from "@/lib/prisma";

/**
 * Figures for the homepage stat row. Derived from real rows so the numbers on
 * the marketing page cannot drift away from the catalogue.
 */
export const getStorefrontStats = cache(async () => {
  const [customers, products, ratingAgg] = await Promise.all([
    prisma.user.count({ where: { role: "CUSTOMER" } }),
    prisma.product.count({ where: { isActive: true } }),
    prisma.review.aggregate({ _avg: { rating: true } }),
  ]);

  return {
    customers,
    products,
    averageRating: Math.round((ratingAgg._avg.rating ?? 5) * 10) / 10,
  };
});
