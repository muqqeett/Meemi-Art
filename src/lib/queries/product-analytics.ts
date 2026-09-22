import "server-only";

import { Prisma, type AnalyticsEventType } from "@/generated/prisma/client";
import { dateKeyInZone, eachDay, previousRange, type DateRange } from "@/lib/analytics/date-range";
import { averageOrderCents, funnelRates, percentChange, ratio } from "@/lib/analytics/metrics";
import { prisma } from "@/lib/prisma";
import { SUCCESSFUL_ORDER } from "@/lib/queries/successful-order";

/**
 * Analytics over a reporting period — overview, product table, product detail.
 *
 * Every metric follows the definitions in `lib/analytics/metrics.ts`. The
 * sources of truth are the existing tables: `SUCCESSFUL_ORDER` for purchases,
 * revenue and orders (unchanged, and attributed to `placedAt` like the rest of
 * the admin); orders of any status for checkout attempts; `Review`,
 * `WishlistItem` and `DigitalAccess` for their own state. `AnalyticsEvent`
 * supplies only what nothing else records: views, add-to-cart, wishlist
 * additions and downloads by date.
 *
 * Aggregation happens in the database. Each function runs a fixed number of
 * queries however many products exist — no per-product queries anywhere.
 *
 * Revenue has two granularities, both pre-existing conventions: order revenue
 * (`Order.totalCents`, after any order-level discount) for the store totals,
 * and line revenue (`OrderItem.totalCents`) for per-product figures. A coupon
 * applied to a whole order is not apportioned across its lines, so the sum of
 * product revenue can exceed store revenue by exactly the discounts given.
 */

type Window = { gte?: Date; lt: Date };

function window(range: DateRange): Window {
  return range.start ? { gte: range.start, lt: range.end } : { lt: range.end };
}

/** Postgres timestamps are stored as UTC wall time; make that explicit so the session's zone cannot shift a bound. */
function utc(instant: Date) {
  return Prisma.sql`(${instant.toISOString()}::timestamptz AT TIME ZONE 'UTC')`;
}

type EventCounts = Record<AnalyticsEventType, number>;
const NO_EVENTS: EventCounts = { PRODUCT_VIEW: 0, ADD_TO_CART: 0, WISHLIST_ADD: 0, DOWNLOAD: 0 };

async function eventCounts(range: DateRange, productId?: string): Promise<EventCounts> {
  const rows = await prisma.analyticsEvent.groupBy({
    by: ["type"],
    where: { createdAt: window(range), ...(productId ? { productId } : {}) },
    _count: { _all: true },
  });
  const counts = { ...NO_EVENTS };
  for (const row of rows) counts[row.type] = row._count._all;
  return counts;
}

/** Distinct daily visitor keys — "visitor-days", since keys rotate at midnight. */
async function visitorDays(range: DateRange, productId?: string): Promise<number> {
  const rows = await prisma.$queryRaw<{ n: number }[]>`
    SELECT COUNT(DISTINCT "visitorKey")::int AS n
    FROM "AnalyticsEvent"
    WHERE "type" = 'PRODUCT_VIEW'::"AnalyticsEventType"
      AND "visitorKey" IS NOT NULL
      AND "createdAt" < ${utc(range.end)}
      ${range.start ? Prisma.sql`AND "createdAt" >= ${utc(range.start)}` : Prisma.empty}
      ${productId ? Prisma.sql`AND "productId" = ${productId}` : Prisma.empty}`;
  return rows[0]?.n ?? 0;
}

/** Event counts per Pakistani calendar day, grouped in the database. */
async function eventsByDay(range: DateRange, productId?: string) {
  if (!range.start) return new Map<string, EventCounts>();
  const rows = await prisma.$queryRaw<{ day: string; type: AnalyticsEventType; n: number }[]>`
    SELECT to_char(timezone(${range.timeZone}, "createdAt" AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS day,
           "type"::text AS type,
           COUNT(*)::int AS n
    FROM "AnalyticsEvent"
    WHERE "createdAt" >= ${utc(range.start)} AND "createdAt" < ${utc(range.end)}
      ${productId ? Prisma.sql`AND "productId" = ${productId}` : Prisma.empty}
    GROUP BY 1, 2`;
  const byDay = new Map<string, EventCounts>();
  for (const row of rows) {
    const counts = byDay.get(row.day) ?? { ...NO_EVENTS };
    counts[row.type] = row.n;
    byDay.set(row.day, counts);
  }
  return byDay;
}

// ---------------------------------------------------------------- overview

async function storeTotals(range: DateRange) {
  const placedAt = window(range);
  const successful = { ...SUCCESSFUL_ORDER, placedAt };

  const [orders, units, buyers, attempts, events, visitors, newCustomers] = await Promise.all([
    prisma.order.aggregate({ where: successful, _count: { _all: true }, _sum: { totalCents: true } }),
    prisma.orderItem.aggregate({ where: { order: successful }, _sum: { quantity: true } }),
    // Distinct customers with a successful order; returns one id per buyer.
    prisma.order.groupBy({ by: ["userId"], where: successful }),
    prisma.order.count({ where: { placedAt } }),
    eventCounts(range),
    visitorDays(range),
    prisma.user.count({ where: { role: "CUSTOMER", createdAt: placedAt } }),
  ]);

  const revenueCents = orders._sum.totalCents ?? 0;
  const orderCount = orders._count._all;
  const purchases = units._sum.quantity ?? 0;

  return {
    revenueCents,
    orders: orderCount,
    customers: buyers.length,
    newCustomers,
    checkoutStarts: attempts,
    purchases,
    views: events.PRODUCT_VIEW,
    visitorDays: visitors,
    addToCart: events.ADD_TO_CART,
    wishlistAdds: events.WISHLIST_ADD,
    downloads: events.DOWNLOAD,
    averageOrderCents: averageOrderCents(revenueCents, orderCount),
    conversion: ratio(purchases, events.PRODUCT_VIEW),
  };
}

export type StoreTotals = Awaited<ReturnType<typeof storeTotals>>;

export async function getAnalyticsOverview(range: DateRange) {
  const previous = previousRange(range);

  const [current, prior, successfulOrders, dailyEvents] = await Promise.all([
    storeTotals(range),
    previous ? storeTotals(previous) : Promise.resolve(null),
    // Narrow projection of this period's successful orders, bucketed by
    // Pakistani day below. The sale rule stays `SUCCESSFUL_ORDER` itself
    // rather than a SQL re-statement of it.
    range.start
      ? prisma.order.findMany({
          where: { ...SUCCESSFUL_ORDER, placedAt: window(range) },
          select: { placedAt: true, totalCents: true, items: { select: { quantity: true } } },
        })
      : Promise.resolve([]),
    eventsByDay(range),
  ]);

  const series = eachDay(range).map((day) => ({ day, revenue: 0, orders: 0, purchases: 0, views: 0, addToCart: 0 }));
  const index = new Map(series.map((point) => [point.day, point]));
  for (const order of successfulOrders) {
    const point = index.get(dateKeyInZone(order.placedAt, range.timeZone));
    if (!point) continue;
    point.revenue += order.totalCents / 100;
    point.orders += 1;
    point.purchases += order.items.reduce((sum, item) => sum + item.quantity, 0);
  }
  for (const [day, counts] of dailyEvents) {
    const point = index.get(day);
    if (!point) continue;
    point.views = counts.PRODUCT_VIEW;
    point.addToCart = counts.ADD_TO_CART;
  }

  const change = (pick: (totals: StoreTotals) => number | null) => {
    if (!prior) return null;
    const now = pick(current);
    const before = pick(prior);
    return now === null || before === null ? null : percentChange(now, before);
  };

  return {
    range,
    previous,
    current,
    changes: {
      revenue: change((t) => t.revenueCents),
      orders: change((t) => t.orders),
      customers: change((t) => t.customers),
      views: change((t) => t.views),
      purchases: change((t) => t.purchases),
      averageOrder: change((t) => t.averageOrderCents),
      wishlistAdds: change((t) => t.wishlistAdds),
      downloads: change((t) => t.downloads),
    },
    series,
    isEmpty:
      current.orders === 0 && current.views === 0 && current.addToCart === 0 && current.checkoutStarts === 0 &&
      current.wishlistAdds === 0 && current.downloads === 0,
  };
}

// ---------------------------------------------------------------- product table

export const PRODUCT_SORTS = {
  revenue: "Revenue",
  purchases: "Purchases",
  views: "Views",
  conversion: "Conversion",
  cart: "Add to cart",
  checkout: "Checkout starts",
  wishlist: "Wishlist adds",
  downloads: "Downloads",
  reviews: "Reviews",
  rating: "Rating",
} as const;
export type ProductSort = keyof typeof PRODUCT_SORTS;

export function parseProductSort(value: string | undefined): ProductSort {
  return value && value in PRODUCT_SORTS ? (value as ProductSort) : "revenue";
}

export const PRODUCT_PAGE_SIZE = 20;

export type ProductMetricsRow = {
  id: string;
  name: string;
  isActive: boolean;
  priceCents: number;
  categoryName: string;
  imageUrl: string | null;
  views: number;
  addToCart: number;
  checkoutStarts: number;
  purchases: number;
  revenueCents: number;
  conversion: number | null;
  wishlistAdds: number;
  downloads: number;
  reviews: number;
  rating: number | null;
};

/**
 * Every product's funnel for a period, in five queries, sorted and paged.
 * Reviews and rating are all-time, like the product page shows them.
 */
export async function getProductMetricsTable(range: DateRange, sort: ProductSort, page: number) {
  const rows = await getProductMetricsRows(range);

  const value = (row: ProductMetricsRow): number | null => {
    switch (sort) {
      case "revenue": return row.revenueCents;
      case "purchases": return row.purchases;
      case "views": return row.views;
      case "conversion": return row.conversion;
      case "cart": return row.addToCart;
      case "checkout": return row.checkoutStarts;
      case "wishlist": return row.wishlistAdds;
      case "downloads": return row.downloads;
      case "reviews": return row.reviews;
      case "rating": return row.rating;
    }
  };

  // Highest first; undefined values ("—") after every real number; name breaks ties.
  rows.sort((a, b) => {
    const va = value(a);
    const vb = value(b);
    if (va === null && vb !== null) return 1;
    if (vb === null && va !== null) return -1;
    return (vb ?? 0) - (va ?? 0) || a.name.localeCompare(b.name);
  });

  const pages = Math.max(1, Math.ceil(rows.length / PRODUCT_PAGE_SIZE));
  const current = Math.min(Math.max(1, page), pages);

  return {
    rows: rows.slice((current - 1) * PRODUCT_PAGE_SIZE, current * PRODUCT_PAGE_SIZE),
    total: rows.length,
    page: current,
    pages,
    sort,
  };
}

/**
 * Every product's funnel for a period, unsorted and unpaged — the rows the
 * table above sorts and pages. Five queries however many products exist.
 *
 * Exported so other readers of product performance (the admin notifications'
 * attention checks) use this one engine rather than a second copy of it.
 */
export async function getProductMetricsRows(range: DateRange): Promise<ProductMetricsRow[]> {
  const placedAt = window(range);

  const [products, events, sales, attempts, reviews] = await Promise.all([
    prisma.product.findMany({
      select: {
        id: true,
        name: true,
        isActive: true,
        priceCents: true,
        category: { select: { name: true } },
        images: { select: { url: true }, orderBy: { sortOrder: "asc" }, take: 1 },
      },
    }),
    prisma.analyticsEvent.groupBy({
      by: ["productId", "type"],
      where: { createdAt: placedAt },
      _count: { _all: true },
    }),
    prisma.orderItem.groupBy({
      by: ["productId"],
      where: { productId: { not: null }, order: { ...SUCCESSFUL_ORDER, placedAt } },
      _sum: { quantity: true, totalCents: true },
    }),
    // One line per product per order (the cart holds each product once), so
    // lines on orders of any status are checkout attempts for that product.
    prisma.orderItem.groupBy({
      by: ["productId"],
      where: { productId: { not: null }, order: { placedAt } },
      _count: { _all: true },
    }),
    prisma.review.groupBy({
      by: ["productId"],
      where: { status: "APPROVED" },
      _count: { _all: true },
      _avg: { rating: true },
    }),
  ]);

  const eventsBy = new Map<string, EventCounts>();
  for (const row of events) {
    const counts = eventsBy.get(row.productId) ?? { ...NO_EVENTS };
    counts[row.type] = row._count._all;
    eventsBy.set(row.productId, counts);
  }
  const salesBy = new Map(sales.map((row) => [row.productId as string, row._sum]));
  const attemptsBy = new Map(attempts.map((row) => [row.productId as string, row._count._all]));
  const reviewsBy = new Map(reviews.map((row) => [row.productId, row]));

  const rows: ProductMetricsRow[] = products.map((product) => {
    const counts = eventsBy.get(product.id) ?? NO_EVENTS;
    const sold = salesBy.get(product.id);
    const review = reviewsBy.get(product.id);
    const purchases = sold?.quantity ?? 0;
    return {
      id: product.id,
      name: product.name,
      isActive: product.isActive,
      priceCents: product.priceCents,
      categoryName: product.category.name,
      imageUrl: product.images[0]?.url ?? null,
      views: counts.PRODUCT_VIEW,
      addToCart: counts.ADD_TO_CART,
      checkoutStarts: attemptsBy.get(product.id) ?? 0,
      purchases,
      revenueCents: sold?.totalCents ?? 0,
      conversion: ratio(purchases, counts.PRODUCT_VIEW),
      wishlistAdds: counts.WISHLIST_ADD,
      downloads: counts.DOWNLOAD,
      reviews: review?._count._all ?? 0,
      rating: review?._avg.rating ?? null,
    };
  });

  return rows;
}

// ---------------------------------------------------------------- one product

async function productPeriod(productId: string, range: DateRange) {
  const placedAt = window(range);
  const [events, visitors, sold, attempts] = await Promise.all([
    eventCounts(range, productId),
    visitorDays(range, productId),
    prisma.orderItem.aggregate({
      where: { productId, order: { ...SUCCESSFUL_ORDER, placedAt } },
      _sum: { quantity: true, totalCents: true },
      _count: { _all: true },
    }),
    prisma.orderItem.count({ where: { productId, order: { placedAt } } }),
  ]);

  const counts = {
    views: events.PRODUCT_VIEW,
    addToCart: events.ADD_TO_CART,
    checkoutStarts: attempts,
    purchases: sold._sum.quantity ?? 0,
  };
  return {
    ...counts,
    visitorDays: visitors,
    revenueCents: sold._sum.totalCents ?? 0,
    orders: sold._count._all,
    wishlistAdds: events.WISHLIST_ADD,
    downloads: events.DOWNLOAD,
    rates: funnelRates(counts),
  };
}

export type ProductPeriod = Awaited<ReturnType<typeof productPeriod>>;

export async function getProductAnalytics(productId: string, range: DateRange) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      name: true,
      slug: true,
      isActive: true,
      priceCents: true,
      compareAtCents: true,
      category: { select: { name: true } },
      images: { select: { url: true }, orderBy: { sortOrder: "asc" }, take: 1 },
      asset: { select: { version: true } },
    },
  });
  if (!product) return null;

  const previous = previousRange(range);

  const [current, prior, ratings, savedNow, savedAndBought, access, activeGrants, lines, dailyEvents] =
    await Promise.all([
      productPeriod(productId, range),
      previous ? productPeriod(productId, previous) : Promise.resolve(null),
      prisma.review.groupBy({
        by: ["rating"],
        where: { productId, status: "APPROVED" },
        _count: { _all: true },
      }),
      prisma.wishlistItem.count({ where: { productId } }),
      // Customers who have it saved now AND have bought it on a successful
      // order. Current state against all-time purchases — stated as such.
      prisma.user.count({
        where: {
          wishlist: { items: { some: { productId } } },
          orders: { some: { ...SUCCESSFUL_ORDER, items: { some: { productId } } } },
        },
      }),
      prisma.digitalAccess.aggregate({ where: { productId }, _count: { _all: true }, _sum: { downloadCount: true } }),
      prisma.digitalAccess.count({ where: { productId, revokedAt: null } }),
      range.start
        ? prisma.orderItem.findMany({
            where: { productId, order: { ...SUCCESSFUL_ORDER, placedAt: window(range) } },
            select: { quantity: true, totalCents: true, order: { select: { placedAt: true } } },
          })
        : Promise.resolve([]),
      eventsByDay(range, productId),
    ]);

  const distribution = [5, 4, 3, 2, 1].map((stars) => ({
    stars,
    count: ratings.find((row) => row.rating === stars)?._count._all ?? 0,
  }));
  const reviewCount = distribution.reduce((sum, row) => sum + row.count, 0);
  const ratingTotal = distribution.reduce((sum, row) => sum + row.stars * row.count, 0);

  const series = eachDay(range).map((day) => ({ day, views: 0, addToCart: 0, purchases: 0, revenue: 0 }));
  const index = new Map(series.map((point) => [point.day, point]));
  for (const line of lines) {
    const point = index.get(dateKeyInZone(line.order.placedAt, range.timeZone));
    if (!point) continue;
    point.purchases += line.quantity;
    point.revenue += line.totalCents / 100;
  }
  for (const [day, counts] of dailyEvents) {
    const point = index.get(day);
    if (!point) continue;
    point.views = counts.PRODUCT_VIEW;
    point.addToCart = counts.ADD_TO_CART;
  }

  const change = (pick: (period: ProductPeriod) => number) =>
    prior ? percentChange(pick(current), pick(prior)) : null;

  return {
    product: {
      id: product.id,
      name: product.name,
      slug: product.slug,
      isActive: product.isActive,
      priceCents: product.priceCents,
      compareAtCents: product.compareAtCents,
      categoryName: product.category.name,
      imageUrl: product.images[0]?.url ?? null,
      hasFile: product.asset !== null,
      fileVersion: product.asset?.version ?? null,
    },
    range,
    previous,
    current,
    prior,
    changes: {
      views: change((p) => p.views),
      addToCart: change((p) => p.addToCart),
      checkoutStarts: change((p) => p.checkoutStarts),
      purchases: change((p) => p.purchases),
      revenue: change((p) => p.revenueCents),
      wishlistAdds: change((p) => p.wishlistAdds),
      downloads: change((p) => p.downloads),
    },
    reviews: {
      count: reviewCount,
      average: reviewCount > 0 ? Math.round((ratingTotal / reviewCount) * 10) / 10 : null,
      distribution,
    },
    wishlist: { savedNow, savedAndBought },
    access: {
      grants: access._count._all,
      activeGrants,
      downloadsAllTime: access._sum.downloadCount ?? 0,
      downloadRate: ratio(access._sum.downloadCount ?? 0, access._count._all),
    },
    series,
  };
}
