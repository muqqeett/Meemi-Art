import "server-only";

import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { ANALYTICS_TIME_ZONE, previousRange, resolveRange, type DateRange } from "@/lib/analytics/date-range";
import { formatMoney } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { UNSELLABLE_PRODUCT } from "@/lib/queries/operational-alerts";
import { getProductMetricsRows, type ProductMetricsRow } from "@/lib/queries/product-analytics";
import { SUCCESSFUL_ORDER } from "@/lib/queries/successful-order";
import {
  NOTIFICATION_RULES,
  dedupeKeys,
  plural,
  safeAdminHref,
  weekStartKey,
  type NotificationRules,
  type NotificationTypeName,
} from "@/lib/notifications/rules";

/**
 * Finding what an admin should be told, and recording it once.
 *
 * Nothing here is hooked into checkout, payments, reviews, downloads or the
 * wishlist. Each detector reads the table that is already the authority for
 * its occurrence and describes what it finds:
 *
 *   new order         Order, through `SUCCESSFUL_ORDER` — the one definition
 *                     of a sale — dated by `completedAt`
 *   payment failure   Payment.failedAt, whatever the payment did next
 *   new review        Review.createdAt
 *   downloads         AnalyticsEvent DOWNLOAD, one line per product per day
 *   wishlist          AnalyticsEvent WISHLIST_ADD, only past a daily threshold
 *   needs attention   the existing product analytics, over the last 7 days
 *   can't deliver     the operational alerts' own unsellable-product filter
 *
 * So the payment path, the webhook and every customer action run exactly as
 * they did; a notification is a reading of what they already wrote.
 *
 * Idempotency is the database's, not this module's: every occurrence has a
 * deterministic `dedupeKey`, rows are written with `skipDuplicates`, and the
 * unique constraint turns a second detection — the next sweep, another server,
 * two admins loading pages at once — into nothing.
 *
 * No customer detail is ever copied into a notification: no email, no name, no
 * payment failure reason. Orders are named by number, reviews by product.
 */

export type NotificationDraft = {
  type: NotificationTypeName;
  title: string;
  message: string;
  href: string | null;
  entityType: string | null;
  entityId: string | null;
  dedupeKey: string;
  occurredAt: Date;
  metadata?: Prisma.InputJsonValue;
};

type SyncDb = Pick<PrismaClient, "order" | "payment" | "review" | "product" | "adminNotification" | "$queryRaw">;

export type SyncOptions = {
  now?: Date;
  db?: SyncDb;
  rules?: NotificationRules;
  /** Which families to run. Both by default. */
  events?: boolean;
  analytics?: boolean;
  /** The product analytics engine; injectable so the harness can pin a clock. */
  metricsRows?: (range: DateRange) => Promise<ProductMetricsRow[]>;
};

export type SyncReport = { created: number; updated: number; detected: number };

/** Postgres timestamps are stored as UTC wall time; make that explicit so the session's zone cannot shift a bound. */
function utc(instant: Date) {
  return Prisma.sql`(${instant.toISOString()}::timestamptz AT TIME ZONE 'UTC')`;
}

/** "2026-09-22" → "Sep 22". */
function dayLabel(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function draft(fields: NotificationDraft): NotificationDraft {
  // Built from ids here, and still checked: a row can only ever link inside the admin.
  return { ...fields, href: safeAdminHref(fields.href) };
}

// -------------------------------------------------------------- detectors

async function detectOrders(db: SyncDb, since: Date, now: Date, rules: NotificationRules) {
  const orders = await db.order.findMany({
    where: { ...SUCCESSFUL_ORDER, completedAt: { gte: since, lte: now } },
    select: { id: true, orderNumber: true, totalCents: true, completedAt: true, _count: { select: { items: true } } },
    orderBy: { completedAt: "desc" },
    take: rules.maxPerKind,
  });
  return orders.map((order) =>
    draft({
      type: "ORDER_COMPLETED",
      title: "New order received",
      message: `Order ${order.orderNumber} was successfully placed for ${formatMoney(order.totalCents)}.`,
      href: `/admin/orders/${encodeURIComponent(order.orderNumber)}`,
      entityType: "order",
      entityId: order.id,
      dedupeKey: dedupeKeys.orderCompleted(order.id),
      occurredAt: order.completedAt ?? now,
      metadata: { orderNumber: order.orderNumber, totalCents: order.totalCents, items: order._count.items },
    }),
  );
}

async function detectPaymentFailures(db: SyncDb, since: Date, now: Date, rules: NotificationRules) {
  // By `failedAt`, not by current status: a payment that failed and was then
  // retried successfully still failed, and the admin may want to know.
  const payments = await db.payment.findMany({
    where: { failedAt: { gte: since, lte: now } },
    select: { id: true, failedAt: true, order: { select: { id: true, orderNumber: true } } },
    orderBy: { failedAt: "desc" },
    take: rules.maxPerKind,
  });
  return payments
    .filter((payment) => payment.failedAt)
    .map((payment) =>
      draft({
        type: "PAYMENT_FAILED",
        title: "Order payment issue",
        // The provider's failure reason is deliberately left out.
        message: `Order ${payment.order.orderNumber} encountered a payment failure.`,
        href: `/admin/orders/${encodeURIComponent(payment.order.orderNumber)}`,
        entityType: "order",
        entityId: payment.order.id,
        dedupeKey: dedupeKeys.paymentFailed(payment.id, payment.failedAt as Date),
        occurredAt: payment.failedAt as Date,
        metadata: { orderNumber: payment.order.orderNumber },
      }),
    );
}

async function detectReviews(db: SyncDb, since: Date, now: Date, rules: NotificationRules) {
  const reviews = await db.review.findMany({
    where: { createdAt: { gte: since, lte: now } },
    select: { id: true, rating: true, status: true, createdAt: true, product: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
    take: rules.maxPerKind,
  });
  return reviews.map((review) => {
    const pending = review.status === "PENDING";
    return draft({
      type: "REVIEW_SUBMITTED",
      title: "New review submitted",
      // Named by product and rating only — never by reviewer.
      message: `A new ${review.rating}-star review was submitted for ${review.product.name}.${pending ? " It is waiting for moderation." : ""}`,
      href: pending ? "/admin/reviews?status=PENDING" : "/admin/reviews",
      entityType: "review",
      entityId: review.id,
      dedupeKey: dedupeKeys.reviewSubmitted(review.id),
      occurredAt: review.createdAt,
      metadata: { productId: review.product.id, productName: review.product.name, rating: review.rating, status: review.status },
    });
  });
}

type ActivityRow = { productId: string; type: "DOWNLOAD" | "WISHLIST_ADD"; day: string; n: number; first: string };

/**
 * Downloads and wishlist saves, grouped by product and shop day in the
 * database. One line per product per day, however busy the day, and wishlist
 * days only once they cross the threshold — the admin hears that a pattern is
 * being saved, not about every save.
 */
async function detectActivity(db: SyncDb, since: Date, now: Date, rules: NotificationRules) {
  const rows = await db.$queryRaw<ActivityRow[]>`
    SELECT "productId",
           "type"::text AS type,
           to_char(timezone(${ANALYTICS_TIME_ZONE}, "createdAt" AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS day,
           COUNT(*)::int AS n,
           to_char(MIN("createdAt"), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS first
    FROM "AnalyticsEvent"
    WHERE "type" IN ('DOWNLOAD'::"AnalyticsEventType", 'WISHLIST_ADD'::"AnalyticsEventType")
      AND "createdAt" >= ${utc(since)}
      AND "createdAt" < ${utc(now)}
    GROUP BY 1, 2, 3
    ORDER BY 3 DESC
    LIMIT ${rules.maxPerKind * 2}`;

  const relevant = rows.filter(
    (row) => row.type === "DOWNLOAD" || (row.type === "WISHLIST_ADD" && row.n >= rules.wishlistDailyThreshold),
  );
  if (relevant.length === 0) return [];

  // One query for every product name, not one per row.
  const products = await db.product.findMany({
    where: { id: { in: [...new Set(relevant.map((row) => row.productId))] } },
    select: { id: true, name: true },
  });
  const names = new Map(products.map((product) => [product.id, product.name]));

  return relevant.flatMap((row) => {
    const name = names.get(row.productId);
    if (!name) return [];
    const href = `/admin/products/performance/${row.productId}?range=7d`;
    const occurredAt = new Date(row.first);
    return row.type === "DOWNLOAD"
      ? [
          draft({
            type: "PRODUCT_DOWNLOADED",
            title: "Digital product downloaded",
            message: `${name} was downloaded ${plural(row.n, "time", "times")} on ${dayLabel(row.day)}.`,
            href,
            entityType: "product",
            entityId: row.productId,
            dedupeKey: dedupeKeys.productDownloaded(row.productId, row.day),
            occurredAt,
            metadata: { productName: name, day: row.day, count: row.n },
          }),
        ]
      : [
          draft({
            type: "WISHLIST_ACTIVITY",
            title: "Wishlist activity",
            message: `${name} was saved to ${plural(row.n, "wishlist", "wishlists")} on ${dayLabel(row.day)}.`,
            href,
            entityType: "product",
            entityId: row.productId,
            dedupeKey: dedupeKeys.wishlistActivity(row.productId, row.day),
            occurredAt,
            metadata: { productName: name, day: row.day, count: row.n },
          }),
        ];
  });
}

async function detectConfiguration(db: SyncDb, rules: NotificationRules) {
  const products = await db.product.findMany({
    where: UNSELLABLE_PRODUCT,
    select: { id: true, name: true, updatedAt: true },
    take: rules.maxPerKind,
  });
  return products.map((product) =>
    draft({
      type: "PRODUCT_CONFIGURATION",
      title: "Product can't be delivered",
      message: `${product.name} is published but has no digital file, so a buyer would receive nothing.`,
      href: `/admin/products/${product.id}/edit`,
      entityType: "product",
      entityId: product.id,
      dedupeKey: dedupeKeys.productUnsellable(product.id, product.updatedAt),
      occurredAt: product.updatedAt,
      metadata: { productName: product.name },
    }),
  );
}

/**
 * Products that drew attention without selling, or whose sales fell. Read
 * from the existing product analytics — the same rows the performance page
 * shows — over the last seven shop days and the seven before.
 *
 * Informational only: each line states what was measured, never a cause.
 */
async function detectAttention(
  now: Date,
  rules: NotificationRules,
  metricsRows: (range: DateRange) => Promise<ProductMetricsRow[]>,
) {
  const { range } = resolveRange({ preset: "7d" }, now);
  const previous = previousRange(range);
  const [current, before] = await Promise.all([metricsRows(range), previous ? metricsRows(previous) : Promise.resolve([])]);
  const prior = new Map(before.map((row) => [row.id, row]));
  const week = weekStartKey(now);

  return current.flatMap((row) => {
    if (!row.isActive) return [];
    const last = prior.get(row.id);
    const previousPurchases = last?.purchases ?? 0;

    // In priority order; a product gets at most one line a week.
    let rule: string | null = null;
    let message = "";
    if (previousPurchases >= rules.attentionMinPreviousPurchases && row.purchases <= previousPurchases * rules.attentionDropRatio) {
      rule = "sales-drop";
      message = `${row.name} sold ${row.purchases} in the last 7 days, down from ${previousPurchases} the week before.`;
    } else if (row.purchases === 0 && row.views >= rules.attentionMinViews) {
      rule = "traffic-no-sales";
      message = `${row.name} has received ${plural(row.views, "view", "views")} in the last 7 days but no purchases.`;
    } else if (row.purchases === 0 && row.wishlistAdds >= rules.attentionMinWishlistAdds) {
      rule = "saved-no-sales";
      message = `${row.name} was saved to wishlists ${plural(row.wishlistAdds, "time", "times")} in the last 7 days without a purchase.`;
    }
    if (!rule) return [];

    return [
      draft({
        type: "PRODUCT_ATTENTION",
        title: "Product needs attention",
        message,
        href: `/admin/products/performance/${row.id}?range=7d`,
        entityType: "product",
        entityId: row.id,
        dedupeKey: dedupeKeys.productAttention(row.id, week),
        occurredAt: now,
        metadata: {
          productName: row.name,
          rule,
          week,
          views: row.views,
          purchases: row.purchases,
          wishlistAdds: row.wishlistAdds,
          previousPurchases,
        },
      }),
    ];
  });
}

// -------------------------------------------------------------- writing

function toRow(d: NotificationDraft): Prisma.AdminNotificationCreateManyInput {
  return {
    type: d.type,
    title: d.title,
    message: d.message,
    href: d.href,
    entityType: d.entityType,
    entityId: d.entityId,
    dedupeKey: d.dedupeKey,
    occurredAt: d.occurredAt,
    metadata: d.metadata,
  };
}

/** Write once per key; anything already recorded is skipped by the unique constraint. */
async function writeOnce(db: SyncDb, drafts: NotificationDraft[]): Promise<number> {
  if (drafts.length === 0) return 0;
  const result = await db.adminNotification.createMany({ data: drafts.map(toRow), skipDuplicates: true });
  return result.count;
}

/**
 * Daily totals (downloads, wishlist saves) keep one row per product per day
 * and update its count as the day goes on. Only rows whose count changed are
 * touched, and the read state is left alone — a later download does not make
 * an already-read line demand attention again.
 */
async function writeTotals(db: SyncDb, drafts: NotificationDraft[]): Promise<{ created: number; updated: number }> {
  if (drafts.length === 0) return { created: 0, updated: 0 };
  const existing = await db.adminNotification.findMany({
    where: { dedupeKey: { in: drafts.map((d) => d.dedupeKey) } },
    select: { dedupeKey: true, metadata: true },
  });
  const known = new Map(existing.map((row) => [row.dedupeKey, row.metadata as { count?: number } | null]));

  const created = await writeOnce(db, drafts.filter((d) => !known.has(d.dedupeKey)));

  let updated = 0;
  for (const d of drafts) {
    const before = known.get(d.dedupeKey);
    const count = (d.metadata as { count?: number } | undefined)?.count;
    if (before === undefined || before?.count === count) continue;
    await db.adminNotification.update({
      where: { dedupeKey: d.dedupeKey },
      data: { message: d.message, metadata: d.metadata },
    });
    updated++;
  }
  return { created, updated };
}

/**
 * Run the detectors and record what they find.
 *
 * Safe to call as often as anything likes — duplicates are impossible — but
 * each call costs queries, so the admin reaches it through the throttle below.
 */
export async function syncNotifications(options: SyncOptions = {}): Promise<SyncReport> {
  const now = options.now ?? new Date();
  const db = options.db ?? prisma;
  const rules = options.rules ?? NOTIFICATION_RULES;
  const since = new Date(now.getTime() - rules.lookbackDays * 86_400_000);
  const runEvents = options.events ?? true;
  const runAnalytics = options.analytics ?? true;

  const report: SyncReport = { created: 0, updated: 0, detected: 0 };

  if (runEvents) {
    const [orders, failures, reviews, activity, configuration] = await Promise.all([
      detectOrders(db, since, now, rules),
      detectPaymentFailures(db, since, now, rules),
      detectReviews(db, since, now, rules),
      detectActivity(db, since, now, rules),
      detectConfiguration(db, rules),
    ]);
    const once = [...orders, ...failures, ...reviews, ...configuration];
    report.detected += once.length + activity.length;
    report.created += await writeOnce(db, once);
    const totals = await writeTotals(db, activity);
    report.created += totals.created;
    report.updated += totals.updated;
  }

  if (runAnalytics) {
    const attention = await detectAttention(now, rules, options.metricsRows ?? getProductMetricsRows);
    report.detected += attention.length;
    report.created += await writeOnce(db, attention);
  }

  return report;
}

// -------------------------------------------------------------- the throttle

let lastEventSweep = 0;
let lastAnalyticsSweep = 0;
let running: Promise<void> | null = null;

/**
 * Bring notifications up to date, at most once a minute per server for
 * events and once an hour for the attention checks.
 *
 * Called from the admin layout, so it only ever runs for a signed-in admin —
 * there is no public route that can make it work. It never throws: a failure
 * is logged by error class and the page renders with what is already stored.
 *
 * The throttle is per server instance and deliberately so. It only saves
 * queries; correctness does not depend on it, because the unique key already
 * makes a duplicate impossible whichever instance runs a sweep.
 */
export async function syncNotificationsIfDue(now: Date = new Date()): Promise<void> {
  if (running) return running;

  const at = now.getTime();
  const events = at - lastEventSweep >= NOTIFICATION_RULES.eventSweepMs;
  const analytics = at - lastAnalyticsSweep >= NOTIFICATION_RULES.analyticsSweepMs;
  if (!events && !analytics) return;

  if (events) lastEventSweep = at;
  if (analytics) lastAnalyticsSweep = at;

  running = syncNotifications({ now, events, analytics })
    .then(() => undefined)
    .catch((error: unknown) => {
      const kind = error instanceof Error ? error.constructor.name : "unknown";
      console.warn("[notifications] sweep failed:", kind);
    })
    .finally(() => {
      running = null;
    });
  return running;
}

/** For the harness: forget when the last sweep ran. */
export function resetNotificationSweepForTests(): void {
  lastEventSweep = 0;
  lastAnalyticsSweep = 0;
  running = null;
}
