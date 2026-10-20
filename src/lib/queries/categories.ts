import "server-only";

import { cache } from "react";

import { prisma } from "@/lib/prisma";

export const getFeaturedCategories = cache(async () => {
  return prisma.category.findMany({
    where: { isActive: true, parentId: null },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, slug: true, icon: true, image: true },
    take: 4,
  });
});

export const getCategoryBySlug = cache(async (slug: string) => {
  return prisma.category.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      image: true,
      isActive: true,
      _count: { select: { products: { where: { isActive: true } } } },
    },
  });
});

/** Every active category, for filter sidebars and admin selects. */
export const getAllCategories = cache(async () => {
  return prisma.category.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      image: true,
      description: true,
      _count: { select: { products: { where: { isActive: true } } } },
    },
  });
});

/**
 * Every active category with the number of products a customer can open in it.
 *
 * Not the same number as `getAllCategories` reports. The category page lists a
 * product only when it is active AND has a downloadable file behind it
 * (`where.asset = { isNot: null }` in `listProducts`), so a count of active
 * products alone can promise "3 patterns" on a page that shows none. Counting
 * with the same two conditions keeps a homepage tile and the page it links to
 * telling the same story. If the listing's rule changes, change it here too.
 */
export const getCategoriesWithListedCounts = cache(async () => {
  return prisma.category.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: {
      slug: true,
      _count: {
        select: { products: { where: { isActive: true, asset: { isNot: null } } } },
      },
    },
  });
});

/**
 * Category slugs for the sitemap — only those that actually have something in
 * them.
 *
 * An empty category renders "No products yet", which is an under-construction
 * page however politely it is worded, and listing one invites a crawler to
 * index it as thin content. The filter is on live data rather than a flag, so
 * a category becomes eligible again by the ordinary act of publishing a
 * product into it; nothing has to be remembered or switched back on.
 */
export async function getAllCategorySlugs() {
  return prisma.category.findMany({
    where: { isActive: true, products: { some: { isActive: true } } },
    select: { slug: true, updatedAt: true },
  });
}
