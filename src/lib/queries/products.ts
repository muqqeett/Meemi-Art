import "server-only";

import { PUBLIC_REVIEW } from "@/lib/queries/review-visibility";

import { cache } from "react";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-guards";
import { commerceConfig } from "@/lib/config";
import type { Prisma } from "@/generated/prisma/client";
import type { ProductFilters } from "@/lib/validations/commerce";

export type ProductCardData = {
  id: string;
  name: string;
  slug: string;
  brand: string;
  shortDescription: string | null;
  priceCents: number;
  compareAtCents: number | null;
  ratingAvg: number;
  reviewCount: number;
  featured: boolean;
  imageUrl: string | null;
  imageAlt: string;
  /** Revealed on hover — the second shot in the gallery, when there is one. */
  hoverImageUrl: string | null;
  categoryName: string;
  categorySlug: string;
  /** False when unpublished or missing its file — it cannot be sold. */
  isAvailable: boolean;
  isWishlisted: boolean;
  /**
   * At most one editorial badge, derived from facts already in the record.
   *
   * Deliberately not "Best seller": that would need real order volume, and a
   * ranking invented from anything else is a lie printed on the product.
   */
  badge: "new" | null;
};

/** How long a product counts as new. */
const NEW_FOR_DAYS = 30;

/** Shared shape so the card projection is identical everywhere. */
const cardSelect = {
  id: true,
  name: true,
  slug: true,
  brand: true,
  shortDescription: true,
  priceCents: true,
  compareAtCents: true,
  ratingAvg: true,
  reviewCount: true,
  featured: true,
  createdAt: true,
  isActive: true,
  category: { select: { name: true, slug: true } },
  // Two images: the card cross-fades to the second one on hover.
  images: { orderBy: { sortOrder: "asc" }, take: 2, select: { url: true, alt: true } },
  // Existence only.  must never reach a page.
  asset: { select: { id: true } },
} satisfies Prisma.ProductSelect;

type RawCardProduct = Prisma.ProductGetPayload<{ select: typeof cardSelect }>;

/** Ids of the current user's wishlisted products, or an empty set when signed out. */
const getWishlistedIds = cache(async (): Promise<Set<string>> => {
  const user = await getCurrentUser();
  if (!user) return new Set();

  const wishlist = await prisma.wishlist.findUnique({
    where: { userId: user.id },
    select: { items: { select: { productId: true } } },
  });

  return new Set(wishlist?.items.map((item) => item.productId) ?? []);
});

function toCard(product: RawCardProduct, wishlisted: Set<string>): ProductCardData {
  // A file never runs out, so the only question is whether it can be delivered
  // at all: published, and with an asset behind it.
  const isAvailable = product.isActive && product.asset !== null;

  const isNew =
    Date.now() - product.createdAt.getTime() < NEW_FOR_DAYS * 24 * 60 * 60 * 1000;

  // "Last few" and "Made to order" both described physical scarcity and are
  // gone with it. Novelty is the one claim still true of a digital product.
  const badge: ProductCardData["badge"] = isNew ? "new" : null;

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    brand: product.brand,
    shortDescription: product.shortDescription,
    priceCents: product.priceCents,
    compareAtCents: product.compareAtCents,
    ratingAvg: product.ratingAvg,
    reviewCount: product.reviewCount,
    featured: product.featured,
    imageUrl: product.images[0]?.url ?? null,
    imageAlt: product.images[0]?.alt ?? product.name,
    hoverImageUrl: product.images[1]?.url ?? null,
    categoryName: product.category.name,
    categorySlug: product.category.slug,
    isAvailable,
    isWishlisted: wishlisted.has(product.id),
    badge,
  };
}

// --------------------------------------------------------------- listings

export type ProductListResult = {
  products: ProductCardData[];
  total: number;
  page: number;
  pageCount: number;
  /** Facet counts computed against the same filters, minus the facet itself. */
  brands: { name: string; count: number }[];
  priceRange: { minCents: number; maxCents: number };
};

function buildOrderBy(sort: ProductFilters["sort"]): Prisma.ProductOrderByWithRelationInput[] {
  switch (sort) {
    case "price-asc":
      return [{ priceCents: "asc" }, { name: "asc" }];
    case "price-desc":
      return [{ priceCents: "desc" }, { name: "asc" }];
    case "rating":
      return [{ ratingAvg: "desc" }, { reviewCount: "desc" }];
    case "name-asc":
      return [{ name: "asc" }];
    case "newest":
    default:
      return [{ createdAt: "desc" }];
  }
}

/**
 * Server-side product search and filtering.
 *
 * Everything — search, category, price, rating, stock, sort and pagination —
 * runs as SQL. Nothing is filtered client-side after the fact.
 */
export async function listProducts(
  filters: ProductFilters,
  options: { categorySlug?: string } = {},
): Promise<ProductListResult> {
  const categorySlug = options.categorySlug ?? filters.category;

  const where: Prisma.ProductWhereInput = { isActive: true };

  if (filters.q) {
    // Postgres ILIKE via Prisma's insensitive mode, across the fields a
    // shopper would reasonably expect to match.
    where.OR = [
      { name: { contains: filters.q, mode: "insensitive" } },
      { brand: { contains: filters.q, mode: "insensitive" } },
      { shortDescription: { contains: filters.q, mode: "insensitive" } },
      { description: { contains: filters.q, mode: "insensitive" } },
      { category: { name: { contains: filters.q, mode: "insensitive" } } },
    ];
  }

  if (categorySlug) {
    where.category = { slug: categorySlug };
  }

  if (filters.brand) {
    where.brand = filters.brand;
  }

  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    where.priceCents = {
      ...(filters.minPrice !== undefined ? { gte: filters.minPrice } : {}),
      ...(filters.maxPrice !== undefined ? { lte: filters.maxPrice } : {}),
    };
  }

  if (filters.rating) {
    where.ratingAvg = { gte: filters.rating };
  }

  // The "in stock" filter is gone from the UI — a file cannot sell out. The
  // listing still excludes products with no asset, since those cannot be
  // delivered and should not appear in a catalogue at all.
  where.asset = { isNot: null };

  const take = commerceConfig.productsPerPage;
  const skip = (filters.page - 1) * take;

  const [rows, total, brandGroups, priceAgg, wishlisted] = await Promise.all([
    prisma.product.findMany({
      where,
      select: cardSelect,
      orderBy: buildOrderBy(filters.sort),
      take,
      skip,
    }),
    prisma.product.count({ where }),
    prisma.product.groupBy({
      by: ["brand"],
      where: { ...where, brand: undefined },
      _count: { brand: true },
      orderBy: { brand: "asc" },
    }),
    prisma.product.aggregate({
      where: { isActive: true, ...(categorySlug ? { category: { slug: categorySlug } } : {}) },
      _min: { priceCents: true },
      _max: { priceCents: true },
    }),
    getWishlistedIds(),
  ]);

  return {
    products: rows.map((row) => toCard(row, wishlisted)),
    total,
    page: filters.page,
    pageCount: Math.max(1, Math.ceil(total / take)),
    brands: brandGroups.map((group) => ({
      name: group.brand,
      count: group._count.brand,
    })),
    priceRange: {
      minCents: priceAgg._min.priceCents ?? 0,
      maxCents: priceAgg._max.priceCents ?? 30_000,
    },
  };
}

/** Most recently added pieces, for the New Arrivals rail. */
export async function getNewArrivals(limit = 4): Promise<ProductCardData[]> {
  const [rows, wishlisted] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true },
      select: cardSelect,
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    getWishlistedIds(),
  ]);

  return rows.map((row) => toCard(row, wishlisted));
}

/**
 * Best sellers by units actually sold, excluding cancelled orders. Falls back
 * to top-rated products when there is no order history yet.
 */
export async function getBestSellers(limit = 4): Promise<ProductCardData[]> {
  const grouped = await prisma.orderItem.groupBy({
    by: ["productId"],
    where: { order: { status: { not: "CANCELLED" } }, productId: { not: null } },
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: "desc" } },
    take: limit,
  });

  const ids = grouped.map((row) => row.productId).filter((id): id is string => Boolean(id));

  if (ids.length === 0) {
    const [rows, wishlisted] = await Promise.all([
      prisma.product.findMany({
        where: { isActive: true },
        select: cardSelect,
        orderBy: [{ ratingAvg: "desc" }, { reviewCount: "desc" }],
        take: limit,
      }),
      getWishlistedIds(),
    ]);
    return rows.map((row) => toCard(row, wishlisted));
  }

  const [rows, wishlisted] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true, id: { in: ids } },
      select: cardSelect,
    }),
    getWishlistedIds(),
  ]);

  // Preserve the units-sold ordering that the groupBy established.
  const rank = new Map(ids.map((id, index) => [id, index]));
  return rows
    .map((row) => toCard(row, wishlisted))
    .sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
}

export async function getFeaturedProducts(limit = 4): Promise<ProductCardData[]> {
  const [rows, wishlisted] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true, featured: true },
      select: cardSelect,
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    getWishlistedIds(),
  ]);

  return rows.map((row) => toCard(row, wishlisted));
}

export async function getRelatedProducts(
  productId: string,
  categoryId: string,
  limit = 4,
): Promise<ProductCardData[]> {
  const [rows, wishlisted] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true, categoryId, id: { not: productId } },
      select: cardSelect,
      orderBy: [{ ratingAvg: "desc" }, { reviewCount: "desc" }],
      take: limit,
    }),
    getWishlistedIds(),
  ]);

  return rows.map((row) => toCard(row, wishlisted));
}

export async function getProductsBySlugs(slugs: string[]): Promise<ProductCardData[]> {
  if (slugs.length === 0) return [];

  const [rows, wishlisted] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true, slug: { in: slugs } },
      select: cardSelect,
    }),
    getWishlistedIds(),
  ]);

  const cards = rows.map((row) => toCard(row, wishlisted));
  // Preserve the caller's ordering (most-recently-viewed first).
  const order = new Map(slugs.map((slug, index) => [slug, index]));
  return cards.sort((a, b) => (order.get(a.slug) ?? 0) - (order.get(b.slug) ?? 0));
}

/** Typeahead suggestions for the header search. */
export async function searchSuggestions(query: string, limit = 6) {
  const q = query.trim();
  if (q.length < 2) return { products: [], categories: [] };

  const [products, categories] = await Promise.all([
    prisma.product.findMany({
      where: {
        isActive: true,
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { brand: { contains: q, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        name: true,
        slug: true,
        brand: true,
        priceCents: true,
        images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } },
      },
      orderBy: [{ featured: "desc" }, { ratingAvg: "desc" }],
      take: limit,
    }),
    prisma.category.findMany({
      where: { isActive: true, name: { contains: q, mode: "insensitive" } },
      select: { id: true, name: true, slug: true },
      take: 3,
    }),
  ]);

  return {
    products: products.map((product) => ({
      id: product.id,
      name: product.name,
      slug: product.slug,
      brand: product.brand,
      priceCents: product.priceCents,
      imageUrl: product.images[0]?.url ?? null,
    })),
    categories,
  };
}

// --------------------------------------------------------------- detail

export const getProductBySlug = cache(async (slug: string) => {
  const product = await prisma.product.findUnique({
    where: { slug },
    include: {
      category: { select: { id: true, name: true, slug: true } },
      images: { orderBy: { sortOrder: "asc" } },
      // Metadata only. `storageKey` is deliberately not selected — this
      // object is serialised into a page, and the key is what would let
      // someone sign their own download URL.
      asset: { select: { filename: true, contentType: true, bytes: true, version: true } },
      reviews: {
        // Rejected and pending reviews are not public — see PUBLIC_REVIEW.
        where: PUBLIC_REVIEW,
        orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
        take: 8,
        include: { user: { select: { name: true, image: true } } },
      },
    },
  });

  if (!product || !product.isActive) return null;

  const wishlisted = await getWishlistedIds();

  return {
    ...product,
    isWishlisted: wishlisted.has(product.id),
    /** False when the file is missing — the product cannot be delivered. */
    isAvailable: product.asset !== null,
  };
});

export type ProductDetail = NonNullable<Awaited<ReturnType<typeof getProductBySlug>>>;

/** Slugs for static params and the sitemap. */
export async function getAllProductSlugs() {
  return prisma.product.findMany({
    where: { isActive: true },
    select: { slug: true, updatedAt: true },
    orderBy: { createdAt: "desc" },
  });
}
