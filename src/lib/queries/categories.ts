import "server-only";

import { cache } from "react";

import { prisma } from "@/lib/prisma";
import {
  SHOP_CATEGORY_SLUGS,
  type ShopMenuCategory,
} from "@/lib/shop-categories";

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
 * The five menu categories with what is listed in each, and their listed
 * sub-categories — for the Shop menu and the mobile drawer.
 *
 * Counts use the same "listed" rule as the category page (active, with a
 * downloadable file). Only the five fixed slugs are read, whatever else exists
 * in the CMS, and a category that is missing or empty simply is not returned
 * with a count — the menus draw it as "Soon".
 */
export const getShopMenuCategories = cache(async (): Promise<ShopMenuCategory[]> => {
  const listed = { isActive: true, asset: { isNot: null } } as const;
  const rows = await prisma.category.findMany({
    where: { isActive: true, slug: { in: SHOP_CATEGORY_SLUGS } },
    select: {
      slug: true,
      _count: { select: { products: { where: listed } } },
      children: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: {
          name: true,
          slug: true,
          _count: { select: { products: { where: listed } } },
        },
      },
    },
  });

  return rows.map((row) => ({
    slug: row.slug,
    // The category page lists its own products and its sub-categories', so the
    // menus quote that same total.
    count: row._count.products + row.children.reduce((sum, child) => sum + child._count.products, 0),
    subs: row.children
      .map((child) => ({ name: child.name, slug: child.slug, count: child._count.products }))
      .filter((child) => child.count > 0),
  }));
});

export type CategoryPageData = {
  category: { id: string; name: string; slug: string; description: string | null; image: string | null };
  /** Set on a sub-category page; the page then sits under this parent. */
  sub: { id: string; name: string; slug: string; description: string | null } | null;
  /** Sub-categories with something listed, in CMS order — the chips. */
  subs: { name: string; slug: string; count: number }[];
  /** Listed products in the whole category, sub-categories included. */
  totalCount: number;
  /** Listed products this page shows: the sub-category's, or the whole category's. */
  currentCount: number;
  /** The category slugs the listing covers. */
  listingSlugs: string[];
};

export type CategoryPageLookup =
  | { status: "ok"; data: CategoryPageData }
  /** A sub-category was asked for as if it were top-level; send it home. */
  | { status: "redirect"; to: string }
  | { status: "missing" };

/**
 * Everything a category or sub-category page needs, from the real tree.
 *
 * "Listed" is the shop's one rule (active, with a downloadable file), so a
 * chip's count, the page's headline count and the grid always agree. A slug
 * resolves only when the category is active; a sub-category resolves only
 * beneath its own parent, and a sub-category's slug used on its own is sent to
 * the page it really lives on rather than shown twice.
 */
export const getCategoryPage = cache(
  async (slug: string, subSlug?: string): Promise<CategoryPageLookup> => {
    const listed = { isActive: true, asset: { isNot: null } } as const;
    const category = await prisma.category.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        image: true,
        isActive: true,
        parentId: true,
        parent: { select: { slug: true, isActive: true } },
        _count: { select: { products: { where: listed } } },
        children: {
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            _count: { select: { products: { where: listed } } },
          },
        },
      },
    });

    if (!category || !category.isActive) return { status: "missing" };

    if (category.parentId) {
      if (subSlug || !category.parent?.isActive) return { status: "missing" };
      return { status: "redirect", to: `/c/${category.parent.slug}/${category.slug}` };
    }

    const sub = subSlug ? category.children.find((child) => child.slug === subSlug) : undefined;
    if (subSlug && !sub) return { status: "missing" };

    const totalCount =
      category._count.products + category.children.reduce((sum, c) => sum + c._count.products, 0);

    return {
      status: "ok",
      data: {
        category: {
          id: category.id,
          name: category.name,
          slug: category.slug,
          description: category.description,
          image: category.image,
        },
        sub: sub ? { id: sub.id, name: sub.name, slug: sub.slug, description: sub.description } : null,
        subs: category.children
          .map((child) => ({ name: child.name, slug: child.slug, count: child._count.products }))
          .filter((child) => child.count > 0),
        totalCount,
        currentCount: sub ? sub._count.products : totalCount,
        listingSlugs: sub ? [sub.slug] : [category.slug, ...category.children.map((c) => c.slug)],
      },
    };
  },
);

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
/**
 * The category pages worth listing in the sitemap, as paths: a top-level
 * category (`/c/<slug>`) when it or any sub-category has a listed product, and
 * a sub-category (`/c/<parent>/<slug>`) when it has its own. The same rule as
 * the pages' own indexing, so the sitemap never lists a page that is noindex.
 */
export async function getCategorySitemapPaths(): Promise<{ path: string; updatedAt: Date }[]> {
  const listed = { isActive: true, asset: { isNot: null } } as const;
  const roots = await prisma.category.findMany({
    where: { isActive: true, parentId: null },
    select: {
      slug: true,
      updatedAt: true,
      _count: { select: { products: { where: listed } } },
      children: {
        where: { isActive: true },
        select: {
          slug: true,
          updatedAt: true,
          _count: { select: { products: { where: listed } } },
        },
      },
    },
  });

  return roots.flatMap((root) => {
    const total =
      root._count.products + root.children.reduce((sum, child) => sum + child._count.products, 0);
    if (total === 0) return [];
    return [
      { path: `/c/${root.slug}`, updatedAt: root.updatedAt },
      ...root.children
        .filter((child) => child._count.products > 0)
        .map((child) => ({ path: `/c/${root.slug}/${child.slug}`, updatedAt: child.updatedAt })),
    ];
  });
}

export async function getAllCategorySlugs() {
  return prisma.category.findMany({
    where: { isActive: true, products: { some: { isActive: true } } },
    select: { slug: true, updatedAt: true },
  });
}
