/**
 * Admin notifications harness.
 *
 * Proves: notifications are derived from the tables that are the authority
 * for each occurrence (orders through SUCCESSFUL_ORDER, payment failures,
 * reviews, downloads, wishlist activity, product analytics, unsellable
 * products); every occurrence is recorded exactly once however often it is
 * detected; read state is per admin; only admins can read or mark anything;
 * links stay inside the admin; no customer details are copied in; and the
 * payment, checkout, download, review and wishlist code paths are untouched.
 *
 * LOCAL DATABASE ONLY, NO NETWORK.
 *
 *   - Prisma is pointed at LOCAL_DATABASE_URL before anything imports it, and
 *     the script refuses to start unless that is a localhost database.
 *   - Every outbound HTTP(S) request and `fetch` is refused and counted; the
 *     harness fails unless the count is zero.
 *   - Fixtures are namespaced `zz-notify-<run>`, dated in 2031 so real local
 *     data cannot fall inside the windows under test, and removed in
 *     `finally` with the cleanup verified.
 *
 * Run: npm run test:notifications
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import http from "node:http";
import https from "node:https";
import path from "node:path";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

const localUrl = process.env.LOCAL_DATABASE_URL;
if (!localUrl) {
  console.error("Refusing to run: LOCAL_DATABASE_URL is not set.");
  process.exit(1);
}
if (!LOCAL_HOSTS.has(new URL(localUrl).hostname)) {
  console.error("Refusing to run: LOCAL_DATABASE_URL is not a local database.");
  process.exit(1);
}
// Must happen before `src/lib/prisma` is imported — it reads DATABASE_URL once.
process.env.DATABASE_URL = localUrl;

for (const name of [
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
  "CLOUDINARY_URL",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "GEMINI_API_KEY",
  "PADDLE_API_KEY",
]) {
  delete process.env[name];
}

let outbound = 0;
const refuse = (): never => {
  outbound++;
  throw new Error("Outbound network request blocked by the notifications harness.");
};
globalThis.fetch = (async () => refuse()) as typeof fetch;
https.request = refuse as unknown as typeof https.request;
https.get = refuse as unknown as typeof https.get;
http.request = refuse as unknown as typeof http.request;
http.get = refuse as unknown as typeof http.get;

const RUN = `zz-notify-${randomUUID().slice(0, 8)}`;
const ROOT = path.resolve(__dirname, "..");
const read = (file: string) => readFileSync(path.join(ROOT, file), "utf8");

let passed = 0;
let failed = 0;
function check(name: string, condition: boolean, detail = "") {
  if (condition) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

// A Wednesday. Karachi is UTC+5, so this is 14:00 there; the shop week began
// on Monday 2031-03-10. Nothing real lives in these windows.
const NOW = new Date("2031-03-12T09:00:00.000Z");
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000);

async function main() {
  const { prisma } = await import("../src/lib/prisma");
  const rules = await import("../src/lib/notifications/rules");
  const sync = await import("../src/lib/notifications/sync");
  const feed = await import("../src/lib/notifications/feed");

  const runStart = new Date();
  const createdUsers: string[] = [];
  const createdProducts: string[] = [];
  let categoryId: string | null = null;

  try {
    // ------------------------------------------------------------ fixtures
    const category = await prisma.category.create({
      data: { name: `${RUN} category`, slug: `${RUN}-category` },
      select: { id: true },
    });
    categoryId = category.id;

    const product = (suffix: string, isActive: boolean) =>
      prisma.product.create({
        data: {
          name: `${RUN} ${suffix}`,
          slug: `${RUN}-${suffix}`,
          sku: `${RUN}-${suffix}`.toUpperCase().slice(0, 32),
          brand: "Meemi Art",
          description: "Fixture for the notifications harness.",
          priceCents: 1500,
          categoryId: category.id,
          isActive,
        },
        select: { id: true, name: true, updatedAt: true },
      });
    const productA = await product("alpha", false);
    const productB = await product("beta", false);
    const productC = await product("gamma", true); // published, no file
    createdProducts.push(productA.id, productB.id, productC.id);

    const user = (suffix: string, role: "ADMIN" | "CUSTOMER") =>
      prisma.user.create({ data: { email: `${RUN}-${suffix}@example.test`, name: `${RUN} ${suffix}`, role }, select: { id: true } });
    const adminA = await user("admin-a", "ADMIN");
    const adminB = await user("admin-b", "ADMIN");
    const customer = await user("customer", "CUSTOMER");
    createdUsers.push(adminA.id, adminB.id, customer.id);

    const CUSTOMER_EMAIL = `${RUN}-customer@example.test`;
    const CUSTOMER_NAME = `${RUN} Private Buyer`;
    const FAILURE_REASON = "card_declined: insufficient_funds (sensitive)";

    const order = (suffix: string, status: "COMPLETED" | "PENDING", payment: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
      prisma.order.create({
        data: {
          orderNumber: `${RUN}-${suffix}`.toUpperCase(),
          userId: customer.id,
          status,
          email: CUSTOMER_EMAIL,
          customerName: CUSTOMER_NAME,
          subtotalCents: 1500,
          totalCents: 1500,
          placedAt: minutesAgo(180),
          ...extra,
          items: { create: [{ productId: productA.id, name: productA.name, slug: "x", sku: "X", unitPriceCents: 1500, quantity: 1, totalCents: 1500 }] },
          payment: { create: { amountCents: 1500, provider: "sandbox", ...payment } as never },
        },
        select: { id: true, orderNumber: true },
      });

    const paidOrder = await order("paid", "COMPLETED", { status: "PAID", paidAt: minutesAgo(120) }, { completedAt: minutesAgo(120) });
    const pendingOrder = await order("pending", "PENDING", { status: "PENDING" });
    const failedOrder = await order("failed", "PENDING", { status: "FAILED", failedAt: minutesAgo(60), failureReason: FAILURE_REASON });
    const failedPayment = await prisma.payment.findUniqueOrThrow({ where: { orderId: failedOrder.id }, select: { id: true, failedAt: true } });

    const review = await prisma.review.create({
      data: { productId: productA.id, userId: customer.id, rating: 5, title: "Lovely", body: `Written by ${CUSTOMER_NAME}`, status: "PENDING", createdAt: minutesAgo(30) },
      select: { id: true },
    });

    const event = (type: "DOWNLOAD" | "WISHLIST_ADD", productId: string, m: number) =>
      prisma.analyticsEvent.create({ data: { type, productId, userId: customer.id, createdAt: minutesAgo(m) } });
    await event("DOWNLOAD", productA.id, 60);
    await event("DOWNLOAD", productA.id, 50);
    await event("WISHLIST_ADD", productA.id, 40); // two saves: below the threshold
    await event("WISHLIST_ADD", productA.id, 39);
    await event("WISHLIST_ADD", productB.id, 45); // three saves: at the threshold
    await event("WISHLIST_ADD", productB.id, 44);
    await event("WISHLIST_ADD", productB.id, 43);

    // The product analytics engine, pinned: product A drew 50 views and sold nothing.
    const metricsRow = (id: string, name: string, overrides: Record<string, unknown>) => ({
      id, name, isActive: true, priceCents: 1500, categoryName: "x", imageUrl: null,
      views: 0, addToCart: 0, checkoutStarts: 0, purchases: 0, revenueCents: 0, conversion: null,
      wishlistAdds: 0, downloads: 0, reviews: 0, rating: null, ...overrides,
    });
    let analyticsCalls = 0;
    const metricsRows = async (range: { start: Date | null }) => {
      analyticsCalls++;
      const current = range.start && range.start.getTime() > NOW.getTime() - 8 * 86_400_000;
      return current ? [metricsRow(productA.id, productA.name, { views: 50 })] : [];
    };

    const runSync = (now = NOW) => sync.syncNotifications({ now, metricsRows: metricsRows as never });
    const keys = {
      order: rules.dedupeKeys.orderCompleted(paidOrder.id),
      pending: rules.dedupeKeys.orderCompleted(pendingOrder.id),
      failure: rules.dedupeKeys.paymentFailed(failedPayment.id, failedPayment.failedAt as Date),
      review: rules.dedupeKeys.reviewSubmitted(review.id),
      download: rules.dedupeKeys.productDownloaded(productA.id, "2031-03-12"),
      wishlistA: rules.dedupeKeys.wishlistActivity(productA.id, "2031-03-12"),
      wishlistB: rules.dedupeKeys.wishlistActivity(productB.id, "2031-03-12"),
      attention: rules.dedupeKeys.productAttention(productA.id, "2031-03-10"),
      unsellable: rules.dedupeKeys.productUnsellable(productC.id, productC.updatedAt),
    };
    const byKey = (key: string) => prisma.adminNotification.findUnique({ where: { dedupeKey: key } });
    const fixtureCount = () =>
      prisma.adminNotification.count({ where: { dedupeKey: { in: Object.values(keys) } } });

    // ------------------------------------------------------------ rules
    console.log("\nRules");
    check("the shop week starts on Monday, in Karachi", rules.weekStartKey(NOW) === "2031-03-10", rules.weekStartKey(NOW));
    check("Sunday night in Karachi still belongs to that week", rules.weekStartKey(new Date("2031-03-16T18:00:00Z")) === "2031-03-10");
    check("Monday morning in Karachi starts the next week", rules.weekStartKey(new Date("2031-03-16T19:30:00Z")) === "2031-03-17");
    check("internal admin paths are allowed", rules.safeAdminHref("/admin/orders/MA-1") === "/admin/orders/MA-1" && rules.safeAdminHref("/admin") === "/admin");
    check(
      "anything leaving the admin is refused",
      [
        "https://evil.example/admin",
        "//evil.example",
        "/adminx",
        "javascript:alert(1)",
        "/admin/x\\y",
        "/shop",
        "/admin/ x",
      ].every((href) => rules.safeAdminHref(href) === null),
    );
    check("thresholds are defined in one place", rules.NOTIFICATION_RULES.wishlistDailyThreshold === 3 && rules.NOTIFICATION_RULES.lookbackDays === 14);

    // ------------------------------------------------------------ detection
    console.log("\nDetection (each from its authoritative table)");
    const first = await runSync();
    check("the sweep records what it detects", first.created >= 7, JSON.stringify(first));

    const orderRow = await byKey(keys.order);
    check("a completed, paid order is announced", orderRow?.type === "ORDER_COMPLETED" && orderRow.title === "New order received");
    check(
      "it names the order and total, and links to that order",
      !!orderRow &&
        orderRow.message.includes(paidOrder.orderNumber) &&
        orderRow.message.includes("$15.00") &&
        orderRow.href === `/admin/orders/${paidOrder.orderNumber}` &&
        orderRow.entityType === "order" &&
        orderRow.entityId === paidOrder.id,
    );
    check("it is dated when the order completed, not when it was noticed", orderRow?.occurredAt.getTime() === minutesAgo(120).getTime());
    check("an unpaid, pending order is not announced", (await byKey(keys.pending)) === null);

    const failureRow = await byKey(keys.failure);
    check("a payment failure is announced", failureRow?.type === "PAYMENT_FAILED" && failureRow.title === "Order payment issue");
    check("it links to the order", failureRow?.href === `/admin/orders/${failedOrder.orderNumber}` && failureRow.entityId === failedOrder.id);
    check("the provider's failure reason is not copied in", !JSON.stringify(failureRow).includes("insufficient_funds"));

    const reviewRow = await byKey(keys.review);
    check("a new review is announced by product and rating", reviewRow?.type === "REVIEW_SUBMITTED" && reviewRow.message.includes(productA.name) && reviewRow.message.includes("5-star"));
    check("a pending review links to the moderation queue", reviewRow?.href === "/admin/reviews?status=PENDING" && reviewRow.entityId === review.id);

    const downloadRow = await byKey(keys.download);
    check("downloads are one line per product per day", downloadRow?.type === "PRODUCT_DOWNLOADED" && downloadRow.message.includes("2 times"));
    check("the download line links to the product's performance", downloadRow?.href === `/admin/products/performance/${productA.id}?range=7d` && downloadRow.entityId === productA.id);

    check("wishlist saves below the daily threshold stay quiet", (await byKey(keys.wishlistA)) === null);
    const wishlistRow = await byKey(keys.wishlistB);
    check("a day at the threshold is announced once", wishlistRow?.type === "WISHLIST_ACTIVITY" && wishlistRow.message.includes("3 wishlists"));

    const attentionRow = await byKey(keys.attention);
    check(
      "traffic without sales raises one informational alert",
      attentionRow?.type === "PRODUCT_ATTENTION" && attentionRow.title === "Product needs attention" && attentionRow.message.includes("50 views") && attentionRow.message.includes("no purchases"),
    );
    check("the alert uses the existing product analytics, not a second engine", analyticsCalls === 2, String(analyticsCalls));

    const unsellableRow = await byKey(keys.unsellable);
    check("a published product with no file is flagged", unsellableRow?.type === "PRODUCT_CONFIGURATION" && unsellableRow.href === `/admin/products/${productC.id}/edit`);

    const all = await prisma.adminNotification.findMany({ where: { dedupeKey: { in: Object.values(keys) } } });
    const serialised = JSON.stringify(all);
    check("no customer email is copied into any notification", !serialised.includes(CUSTOMER_EMAIL));
    check("no customer name is copied into any notification", !serialised.includes("Private Buyer"));
    check("every stored link stays inside the admin", all.every((row) => row.href === null || rules.safeAdminHref(row.href) === row.href));

    // ------------------------------------------------------------ deduplication
    console.log("\nDeduplication");
    const before = await fixtureCount();
    await runSync();
    await runSync();
    check("sweeping again creates nothing new", (await fixtureCount()) === before, `${before} → ${await fixtureCount()}`);
    check(
      "the performance alert is not re-raised on the next load",
      (await prisma.adminNotification.count({ where: { type: "PRODUCT_ATTENTION", entityId: productA.id } })) === 1,
    );

    // Two sweeps at once — two servers, two admins loading pages.
    await Promise.all([runSync(), runSync(), runSync()]);
    check("concurrent sweeps cannot duplicate either", (await fixtureCount()) === before);

    // Another download the same day updates the line rather than adding one.
    await feed.markRead([downloadRow!.id], { currentAdmin: async () => adminA });
    await event("DOWNLOAD", productA.id, 10);
    const third = await runSync();
    const updatedDownload = await byKey(keys.download);
    check("a later download updates the day's count", updatedDownload?.message.includes("3 times") === true && third.updated >= 1);
    check("…without a second row", (await prisma.adminNotification.count({ where: { type: "PRODUCT_DOWNLOADED", entityId: productA.id } })) === 1);
    check(
      "…and without marking it unread again",
      (await prisma.adminNotificationRead.count({ where: { notificationId: downloadRow!.id, userId: adminA.id } })) === 1,
    );

    // A new week is a new period: the condition may be raised again, once.
    const nextWeek = new Date(NOW.getTime() + 7 * 86_400_000);
    await sync.syncNotifications({ now: nextWeek, events: false, metricsRows: (async () => [metricsRow(productA.id, productA.name, { views: 60 })]) as never });
    check(
      "the next week may raise it again, once",
      (await prisma.adminNotification.count({ where: { type: "PRODUCT_ATTENTION", entityId: productA.id } })) === 2,
    );

    // Editing the broken product, and leaving it broken, is a new occurrence.
    const edited = await prisma.product.update({ where: { id: productC.id }, data: { name: `${RUN} gamma (edited)` }, select: { updatedAt: true } });
    await runSync();
    check(
      "an edit that leaves the product undeliverable raises it again",
      (await byKey(rules.dedupeKeys.productUnsellable(productC.id, edited.updatedAt))) !== null,
    );
    await runSync();
    check(
      "…once",
      (await prisma.adminNotification.count({ where: { type: "PRODUCT_CONFIGURATION", entityId: productC.id } })) === 2,
    );

    // ------------------------------------------------------------ the feed
    console.log("\nThe feed (per admin)");
    const asA = { currentAdmin: async () => adminA };
    const asB = { currentAdmin: async () => adminB };
    const asNobody = { currentAdmin: async () => null };

    const listA = await feed.listNotifications({ filter: "all", page: 1 }, asA);
    check("an admin can read the feed", listA.ok && listA.data.items.length > 0);
    check(
      "it is newest first",
      listA.ok && listA.data.items.every((item, i, items) => i === 0 || items[i - 1].occurredAt >= item.occurredAt),
    );
    check("each row carries this admin's read state", listA.ok && listA.data.items.some((item) => item.id === downloadRow!.id && item.read));

    const unreadA0 = await feed.unreadCount(asA);
    const unreadB0 = await feed.unreadCount(asB);
    check("unread counts are per admin", unreadA0.ok && unreadB0.ok && unreadB0.data.count === unreadA0.data.count + 1, `${JSON.stringify(unreadA0)} ${JSON.stringify(unreadB0)}`);

    const target = await prisma.adminNotification.findUniqueOrThrow({ where: { dedupeKey: keys.order } });
    const marked = await feed.markRead([target.id], asA);
    const unreadA1 = await feed.unreadCount(asA);
    const unreadB1 = await feed.unreadCount(asB);
    check("an admin can mark one read", marked.ok && marked.data.marked === 1 && unreadA1.ok && unreadA0.ok && unreadA1.data.count === unreadA0.data.count - 1);
    check("…which does not mark it read for another admin", unreadB1.ok && unreadB0.ok && unreadB1.data.count === unreadB0.data.count);
    const again = await feed.markRead([target.id], asA);
    check("marking it again is harmless", again.ok && again.data.marked === 0);
    const ghost = await feed.markRead(["does-not-exist"], asA);
    check("an unknown id creates nothing", ghost.ok && ghost.data.marked === 0 && (await prisma.adminNotificationRead.count({ where: { notificationId: "does-not-exist" } })) === 0);

    const unreadOnlyA = await feed.listNotifications({ filter: "unread" }, asA);
    check("the unread filter hides what this admin has read", unreadOnlyA.ok && !unreadOnlyA.data.items.some((item) => item.id === target.id));

    const all1 = await feed.markAllRead(asA);
    const unreadA2 = await feed.unreadCount(asA);
    const unreadB2 = await feed.unreadCount(asB);
    check("an admin can mark everything read", all1.ok && unreadA2.ok && unreadA2.data.count === 0);
    check("…still only for themselves", unreadB2.ok && unreadB1.ok && unreadB2.data.count === unreadB1.data.count);

    // Past the cap the badge stops counting, and the query stays bounded.
    await prisma.adminNotification.createMany({
      data: Array.from({ length: 105 }, (_, i) => ({
        type: "ORDER_COMPLETED" as const,
        title: "bulk",
        message: "bulk",
        dedupeKey: `${RUN}-bulk-${i}`,
        occurredAt: minutesAgo(5000 + i),
      })),
    });
    const capped = await feed.unreadCount(asB);
    check("the badge caps at 99+", capped.ok && capped.data.count === feed.UNREAD_BADGE_CAP && capped.data.capped);
    const page2 = await feed.listNotifications({ filter: "all", page: 2 }, asB);
    check("the feed is paged", page2.ok && page2.data.page === 2 && page2.data.items.length > 0 && page2.data.items.length <= feed.FEED_PAGE_SIZE);
    const clamped = await feed.listNotifications({ filter: "all", page: 99999 }, asB);
    check("an out-of-range page is clamped", clamped.ok && clamped.data.page === clamped.data.pages);

    // A stored link that is not an internal path is never followed.
    const hostile = await prisma.adminNotification.create({
      data: { type: "ORDER_COMPLETED", title: "x", message: "x", href: "https://evil.example/steal", dedupeKey: `${RUN}-hostile`, occurredAt: NOW },
    });
    const opened = await feed.notificationTarget(hostile.id, asA);
    check("opening a row with an outside link goes nowhere outside", opened.ok && opened.data.href === null);
    const openOrder = await feed.notificationTarget(target.id, asA);
    check("opening a normal row returns its admin link", openOrder.ok && openOrder.data.href === `/admin/orders/${paidOrder.orderNumber}`);

    // ------------------------------------------------------------ authorization
    console.log("\nAuthorization");
    const deniedList = await feed.listNotifications({}, asNobody);
    const deniedCount = await feed.unreadCount(asNobody);
    const deniedMark = await feed.markRead([target.id], asNobody);
    const deniedAll = await feed.markAllRead(asNobody);
    const deniedOpen = await feed.notificationTarget(target.id, asNobody);
    check(
      "a non-admin cannot read, count, mark or open anything",
      [deniedList, deniedCount, deniedMark, deniedAll, deniedOpen].every((r) => !r.ok && r.status === 404 && r.error === "Not found."),
    );
    check("…and the denial changed nothing", (await prisma.adminNotificationRead.count({ where: { userId: customer.id } })) === 0);

    const feedSource = read("src/lib/notifications/feed.ts");
    check("by default the feed asks the same guard every admin route uses", /getAdminOrNull\(\)/.test(feedSource));
    const actions = read("src/lib/actions/admin/notifications.ts");
    const exported = [...actions.matchAll(/export async function (\w+)/g)].map((m) => m[1]);
    check(
      "every notification action re-checks the admin itself",
      exported.length === 3 &&
        exported.every((name) => {
          const body = actions.slice(actions.indexOf(`export async function ${name}`));
          const next = body.indexOf("export async function", 10);
          return /await adminOrDenied\(\)/.test(next > 0 ? body.slice(0, next) : body);
        }),
      exported.join(", "),
    );
    check("the open action never follows a link taken from the form", !/redirect\(\s*formData/.test(actions) && /notificationTarget\(/.test(actions));
    const layout = read("src/app/admin/layout.tsx");
    check(
      "the sweep only runs behind the admin gate",
      layout.indexOf("await requireAdmin()") > 0 && layout.indexOf("await requireAdmin()") < layout.indexOf("syncNotificationsIfDue()"),
    );
    check("nothing public can trigger a sweep", !/syncNotifications/.test(read("src/app/api/analytics/view/route.ts")));

    // ------------------------------------------------------------ untouched paths
    console.log("\nExisting paths are untouched");
    for (const file of [
      "src/lib/payments/payment-service.ts",
      "src/app/api/payments/webhook/route.ts",
      "src/lib/actions/checkout.ts",
      "src/app/api/download/[productId]/route.ts",
      "src/lib/actions/reviews.ts",
      "src/lib/actions/wishlist.ts",
      "src/lib/actions/cart.ts",
    ]) {
      check(`${file.split("/").slice(-2).join("/")} knows nothing about notifications`, !/notification/i.test(read(file)));
    }
    check(
      "new-order detection uses the one definition of a sale",
      /SUCCESSFUL_ORDER/.test(read("src/lib/notifications/sync.ts")),
    );
    check(
      "the unsellable check shares the dashboard's own filter",
      /UNSELLABLE_PRODUCT/.test(read("src/lib/notifications/sync.ts")) && /where: UNSELLABLE_PRODUCT/.test(read("src/lib/queries/operational-alerts.ts")),
    );
  } finally {
    // Everything this run wrote, found by its own keys and ids, then verified gone.
    await prisma.adminNotification.deleteMany({
      where: {
        OR: [
          { createdAt: { gte: runStart } },
          { dedupeKey: { startsWith: RUN } },
          { entityId: { in: createdProducts } },
        ],
      },
    });
    if (createdUsers.length > 0) {
      await prisma.order.deleteMany({ where: { userId: { in: createdUsers } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUsers } } });
    }
    if (createdProducts.length > 0) await prisma.product.deleteMany({ where: { id: { in: createdProducts } } });
    if (categoryId) await prisma.category.delete({ where: { id: categoryId } }).catch(() => undefined);

    const leftovers =
      (await prisma.adminNotification.count({ where: { OR: [{ createdAt: { gte: runStart } }, { dedupeKey: { startsWith: RUN } }] } })) +
      (await prisma.user.count({ where: { email: { startsWith: RUN } } })) +
      (await prisma.product.count({ where: { slug: { startsWith: RUN } } })) +
      (await prisma.order.count({ where: { orderNumber: { startsWith: RUN.toUpperCase() } } })) +
      (await prisma.category.count({ where: { slug: { startsWith: RUN } } }));
    check("fixtures removed (notifications, reads, orders, users, products)", leftovers === 0, String(leftovers));
    check("no outbound network request was attempted", outbound === 0, String(outbound));
    await prisma.$disconnect();
  }
}

main()
  .catch((error) => {
    console.error("\nHarness crashed:", error);
    process.exitCode = 1;
  })
  .finally(() => {
    console.log(`\n${passed} passed, ${failed} failed`);
    if (failed > 0) process.exitCode = 1;
  });
