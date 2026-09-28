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
