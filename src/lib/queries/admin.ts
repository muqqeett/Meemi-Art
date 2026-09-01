import "server-only";

import { prisma } from "@/lib/prisma";
import {
  SUCCESSFUL_ORDER,
  isSuccessfulOrder,
} from "@/lib/queries/successful-order";
import { PUBLIC_REVIEW } from "@/lib/queries/review-visibility";
import type { Prisma } from "@/generated/prisma/client";
import type { OrderStatus, ReviewStatus } from "@/generated/prisma/enums";

const PER_PAGE = 15;

// --------------------------------------------------------------- products

export async function listAdminProducts(options: {
  q?: string;
  categoryId?: string;
  fileState?: "unsellable";
  status?: "active" | "inactive";
  page?: number;
}) {
  const page = Math.max(1, options.page ?? 1);

  const where: Prisma.ProductWhereInput = {};

  if (options.q) {
    where.OR = [
      { name: { contains: options.q, mode: "insensitive" } },
      { sku: { contains: options.q, mode: "insensitive" } },
      { brand: { contains: options.q, mode: "insensitive" } },
    ];
  }
  if (options.categoryId) where.categoryId = options.categoryId;
  if (options.status) where.isActive = options.status === "active";

  // Stock is gone, but "cannot be sold" still matters: a published product
  // with no file attached is one a customer could pay for and receive nothing.
  if (options.fileState === "unsellable") {
    where.asset = { is: null };
  }

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: PER_PAGE,
      skip: (page - 1) * PER_PAGE,
      select: {
        id: true,
        name: true,
        slug: true,
        sku: true,
        brand: true,
        priceCents: true,
        compareAtCents: true,
        featured: true,
        isActive: true,
        ratingAvg: true,
        reviewCount: true,
        createdAt: true,
        category: { select: { name: true } },
        images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } },
        // Metadata only — storageKey stays on the server.
        asset: { select: { filename: true, bytes: true, version: true } },
      },
    }),
    prisma.product.count({ where }),
  ]);

  return {
    products: products.map((product) => ({
      ...product,
      hasFile: product.asset !== null,
    })),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / PER_PAGE)),
  };
}

export async function getAdminProduct(id: string) {
  return prisma.product.findUnique({
    where: { id },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      // The admin form shows file metadata and offers a replace control. It
      // never needs storageKey, and never receives it.
      asset: {
        select: { filename: true, contentType: true, bytes: true, version: true, updatedAt: true },
      },
    },
  });
}

// --------------------------------------------------------------- orders

export async function listAdminOrders(options: {
  q?: string;
  status?: OrderStatus;
  page?: number;
}) {
  const page = Math.max(1, options.page ?? 1);

  const where: Prisma.OrderWhereInput = {};

  if (options.q) {
    where.OR = [
      { orderNumber: { contains: options.q, mode: "insensitive" } },
      { email: { contains: options.q, mode: "insensitive" } },
      { customerName: { contains: options.q, mode: "insensitive" } },
    ];
  }
  if (options.status) where.status = options.status;

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { placedAt: "desc" },
      take: PER_PAGE,
      skip: (page - 1) * PER_PAGE,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        totalCents: true,
        placedAt: true,
        email: true,
        customerName: true,
        currency: true,
        user: { select: { id: true, name: true } },
        payment: {
          select: {
            status: true,
            provider: true,
            providerTransactionId: true,
            refundedAt: true,
          },
        },
        _count: { select: { items: true } },
      },
    }),
    prisma.order.count({ where }),
  ]);

  return { orders, total, page, pageCount: Math.max(1, Math.ceil(total / PER_PAGE)) };
}

export async function getAdminOrder(orderNumber: string) {
  return prisma.order.findUnique({
    where: { orderNumber },
    include: {
      items: { orderBy: { name: "asc" } },
      payment: true,
      user: { select: { id: true, name: true, email: true, createdAt: true } },
    },
  });
}

// --------------------------------------------------------------- customers

export async function listAdminCustomers(options: { q?: string; page?: number }) {
  const page = Math.max(1, options.page ?? 1);

  const where: Prisma.UserWhereInput = { role: "CUSTOMER" };
  if (options.q) {
    where.OR = [
      { name: { contains: options.q, mode: "insensitive" } },
      { email: { contains: options.q, mode: "insensitive" } },
    ];
  }

  const [customers, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: PER_PAGE,
      skip: (page - 1) * PER_PAGE,
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        createdAt: true,
        _count: { select: { orders: true, reviews: true } },
        // What the customer actually paid, on the dashboard's one definition.
        // Was "not cancelled", which counted pending and refunded orders as
        // money the customer had spent.
        orders: {
          where: SUCCESSFUL_ORDER,
          select: { totalCents: true },
        },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return {
    customers: customers.map((customer) => ({
      id: customer.id,
      name: customer.name,
      email: customer.email,
      image: customer.image,
      createdAt: customer.createdAt,
      orderCount: customer._count.orders,
      reviewCount: customer._count.reviews,
      totalSpentCents: customer.orders.reduce((sum, order) => sum + order.totalCents, 0),
    })),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / PER_PAGE)),
  };
}

export async function getAdminCustomer(id: string) {
  const customer = await prisma.user.findFirst({
    where: { id, role: "CUSTOMER" },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      image: true,
      createdAt: true,
      reviews: {
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          rating: true,
          title: true,
          createdAt: true,
          product: { select: { name: true, slug: true } },
        },
      },
      // The full history is listed whatever its status — an admin looking at a
      // customer needs to see the cancelled and refunded ones. Only the
      // `spent` total below is narrowed to successful orders, which is why the
      // payment status is selected here.
      orders: {
        orderBy: { placedAt: "desc" },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          totalCents: true,
          placedAt: true,
          payment: { select: { status: true } },
          _count: { select: { items: true } },
        },
      },
    },
  });

  if (!customer) return null;

  const spent = customer.orders
    .filter(isSuccessfulOrder)
    .reduce((sum, order) => sum + order.totalCents, 0);

  return {
    ...customer,
    totalSpentCents: spent,
    averageOrderCents:
      customer.orders.length > 0 ? Math.round(spent / customer.orders.length) : 0,
  };
}

// --------------------------------------------------------------- reviews

export async function listAdminReviews(options: {
  q?: string;
  rating?: number;
  productId?: string;
  status?: ReviewStatus;
  page?: number;
}) {
  const page = Math.max(1, options.page ?? 1);

  const where: Prisma.ReviewWhereInput = {};

  if (options.q) {
    where.OR = [
      { title: { contains: options.q, mode: "insensitive" } },
      { body: { contains: options.q, mode: "insensitive" } },
      { product: { name: { contains: options.q, mode: "insensitive" } } },
      { user: { name: { contains: options.q, mode: "insensitive" } } },
      { user: { email: { contains: options.q, mode: "insensitive" } } },
    ];
  }
  if (options.rating) where.rating = options.rating;
  if (options.productId) where.productId = options.productId;
  if (options.status) where.status = options.status;

  const [reviews, total, distribution, statusCounts] = await Promise.all([
    prisma.review.findMany({
      where,
      // Anything waiting on a decision comes first regardless of age — the
      // queue is the reason to open this page.
      orderBy: [{ createdAt: "desc" }],
      take: PER_PAGE,
      skip: (page - 1) * PER_PAGE,
      select: {
        id: true,
        rating: true,
        title: true,
        body: true,
        status: true,
        featured: true,
        createdAt: true,
        product: { select: { id: true, name: true, slug: true } },
        user: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.review.count({ where }),
    // Rating spread across the whole table, not the current filter — it is a
    // summary of the shop, not of the page.
    prisma.review.groupBy({
      by: ["rating"],
      _count: { rating: true },
      orderBy: { rating: "desc" },
    }),
    prisma.review.groupBy({ by: ["status"], _count: { status: true } }),
  ]);

  // The headline average is what a shopper sees, so it counts only what a
  // shopper can see — the same `PUBLIC_REVIEW` gate the storefront uses.
  const averageAgg = await prisma.review.aggregate({
    where: PUBLIC_REVIEW,
    _avg: { rating: true },
  });

  return {
    reviews,
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / PER_PAGE)),
    distribution: distribution.map((row) => ({
      rating: row.rating,
      count: row._count.rating,
    })),
    statusCounts: statusCounts.map((row) => ({
      status: row.status,
      count: row._count.status,
    })),
    average: Math.round((averageAgg._avg.rating ?? 0) * 10) / 10,
  };
}

/** Products that have at least one review, for the moderation filter. */
export async function listReviewedProducts() {
  return prisma.product.findMany({
    where: { reviews: { some: {} } },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

// --------------------------------------------------------------- coupons

export async function listAdminCoupons() {
  return prisma.coupon.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { orders: true } } },
  });
}

// --------------------------------------------------------------- categories

export async function listAdminCategories() {
  return prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      parent: { select: { id: true, name: true } },
      _count: { select: { products: true, children: true } },
    },
  });
}
