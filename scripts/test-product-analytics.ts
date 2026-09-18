/**
 * Product analytics harness.
 *
 * Proves the analytics definitions and their plumbing:
 *
 *   - reporting periods in Asia/Karachi: today, 7/30/90 days, custom, all time,
 *     inclusive start / exclusive end, the equal previous period, validation,
 *     and DST-safety (checked against a zone that has DST)
 *   - rates and changes: zero denominators, zero baselines, rounding
 *   - the cookieless visitor key: stable within a day, rotated across days,
 *     derived from — never containing — the address
 *   - bot and prefetch filtering, and the view beacon route's refusals
 *   - view recording: published products only, de-duplication, the burst
 *     brake, no user id on views
 *   - non-blocking events: a failing database never throws
 *   - every metric, per product and store-wide, against dated fixtures:
 *     views, visitor-days, add to cart, checkout starts, purchases, revenue,
 *     conversion, wishlist, reviews, rating, downloads, the Karachi day
 *     boundary, previous-period comparison, and exclusion of failed, pending,
 *     unpaid and refunded orders exactly as `SUCCESSFUL_ORDER` defines them
 *   - admin-only access and the event hooks, checked in source
 *
 * LOCAL DATABASE ONLY, NO NETWORK. Prisma is pointed at `LOCAL_DATABASE_URL`
 * before anything imports it and the script refuses to start otherwise;
 * credentials are removed and outbound HTTP is a counted tripwire. Fixtures are
 * namespaced `zz-analytics-v2-<run>`, dated in August 2026, and removed in
 * `finally` with the cleanup verified.
 *
 * Run: npm run test:product-analytics
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

const REMOVED_CREDENTIALS = [
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
  "CLOUDINARY_URL",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "GEMINI_API_KEY",
  "PADDLE_API_KEY",
];
for (const name of REMOVED_CREDENTIALS) delete process.env[name];
const SECRET = "harness-visitor-secret";

let outbound = 0;
const refuse = (): never => {
  outbound++;
  throw new Error("Outbound network request blocked by the analytics harness.");
};
globalThis.fetch = (async () => refuse()) as typeof fetch;
https.request = refuse as unknown as typeof https.request;
https.get = refuse as unknown as typeof https.get;
http.request = refuse as unknown as typeof http.request;
http.get = refuse as unknown as typeof http.get;

const RUN = `zz-analytics-v2-${randomUUID().slice(0, 8)}`;
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

/** A Karachi wall-clock time as a UTC instant (Karachi is UTC+5, no DST). */
const pk = (date: string, time = "12:00") => new Date(`${date}T${time}:00+05:00`);

async function main() {
  const { prisma } = await import("../src/lib/prisma");
  const dates = await import("../src/lib/analytics/date-range");
  const metrics = await import("../src/lib/analytics/metrics");
  const { visitorKey } = await import("../src/lib/analytics/visitor");
  const { isLikelyBot, isPrefetch } = await import("../src/lib/analytics/traffic");
  const events = await import("../src/lib/analytics/events");
  const views = await import("../src/lib/analytics/product-views");
  const queries = await import("../src/lib/queries/product-analytics");
  const viewRoute = await import("../src/app/api/analytics/view/route");

  const createdUsers: string[] = [];
  let categoryId: string | null = null;

  try {
    const [server] = await prisma.$queryRaw<{ addr: string | null }[]>`SELECT inet_server_addr()::text AS addr`;
    check("connected database server is local", server.addr === null || /^(127\.0\.0\.1|::1)(\/\d+)?$/.test(server.addr), String(server.addr));

    // -------------------------------------------------------------- periods
    console.log("\nReporting periods (Asia/Karachi)");
    // 20:30 UTC on the 18th is 01:30 on the 19th in Karachi.
    const now = new Date("2026-09-18T20:30:00Z");
    const range = (input: Parameters<typeof dates.resolveRange>[0], opts?: Parameters<typeof dates.resolveRange>[2]) =>
      dates.resolveRange(input, now, opts);

    const today = range({ preset: "today" }).range;
    check("'today' is the Pakistani calendar day, not UTC's", today.fromDate === "2026-09-19" && today.toDate === "2026-09-19", `${today.fromDate}`);
    check("today starts at Karachi midnight (19:00 UTC the day before)", today.start?.toISOString() === "2026-09-18T19:00:00.000Z");
    check("today ends, exclusively, at the next Karachi midnight", today.end.toISOString() === "2026-09-19T19:00:00.000Z" && today.days === 1);

    const week = range({ preset: "7d" }).range;
    check("last 7 days is today and the six days before", week.fromDate === "2026-09-13" && week.toDate === "2026-09-19" && week.days === 7);
    check("7/30/90-day ranges start at Karachi midnight", week.start?.toISOString() === "2026-09-12T19:00:00.000Z" && range({ preset: "90d" }).range.days === 90);
    check("no preset falls back to the last 30 days", range({}).range.preset === "30d" && range({}).range.days === 30);

    const month = range({ preset: "30d" }).range;
    const before = dates.previousRange(month)!;
    check("previous period has the same length", before.days === 30);
    check("previous period ends exactly where the current one starts — no gap, no overlap", before.end.getTime() === month.start!.getTime());
    check("previous period of today is yesterday", dates.previousRange(today)!.fromDate === "2026-09-18");

    const custom = range({ preset: "custom", from: "2026-08-01", to: "2026-08-07" });
    check("custom range is honoured with inclusive days", custom.invalid === null && custom.range.days === 7 && custom.range.start?.toISOString() === "2026-07-31T19:00:00.000Z" && custom.range.end.toISOString() === "2026-08-07T19:00:00.000Z");
    check("custom single day", range({ preset: "custom", from: "2026-08-05", to: "2026-08-05" }).range.days === 1);
    check("custom end in the future is clamped to today", range({ preset: "custom", from: "2026-09-10", to: "2026-12-31" }).range.toDate === "2026-09-19");
    for (const [label, input] of [
      ["malformed dates", { preset: "custom", from: "08/01/2026", to: "2026-08-07" }],
      ["impossible dates", { preset: "custom", from: "2026-02-30", to: "2026-03-02" }],
      ["start after end", { preset: "custom", from: "2026-08-07", to: "2026-08-01" }],
      ["start in the future", { preset: "custom", from: "2026-10-01", to: "2026-10-02" }],
      ["more than 366 days", { preset: "custom", from: "2024-01-01", to: "2026-09-01" }],
    ] as const) {
      const result = range(input);
      check(`custom range rejected (${label}) — falls back and says why`, result.invalid !== null && result.range.preset === "30d");
    }
    check("unknown preset falls back", range({ preset: "forever" }).range.preset === "30d");
    check("'all time' only where allowed", range({ preset: "all" }).range.preset === "30d" && range({ preset: "all" }, { allowAll: true }).range.start === null);
    check("all time has no previous period", dates.previousRange(range({ preset: "all" }, { allowAll: true }).range) === null);
    check("each day of a range is listed once, oldest first", dates.eachDay(week).join() === ["2026-09-13", "2026-09-14", "2026-09-15", "2026-09-16", "2026-09-17", "2026-09-18", "2026-09-19"].join());
    check("Karachi offset is read, not assumed (+300 min)", dates.zoneOffsetMinutes(now) === 300);
    // DST safety, proven on a zone that has it.
    const ny = "America/New_York";
    check("DST start: midnight is found on both sides of the change", dates.startOfDayInZone("2026-03-08", ny).toISOString() === "2026-03-08T05:00:00.000Z" && dates.startOfDayInZone("2026-03-09", ny).toISOString() === "2026-03-09T04:00:00.000Z");
    check("DST end: the 25-hour day is 25 hours", dates.startOfDayInZone("2026-11-02", ny).getTime() - dates.startOfDayInZone("2026-11-01", ny).getTime() === 25 * 3_600_000);
    check("range links reproduce the range", dates.rangeSearch(custom.range) === "range=custom&from=2026-08-01&to=2026-08-07" && dates.rangeSearch(week) === "range=7d");

    // -------------------------------------------------------------- rates
    console.log("\nRates and changes");
    check("zero denominator is undefined, not zero", metrics.ratio(5, 0) === null && metrics.formatRate(metrics.ratio(5, 0)) === "—");
    check("zero numerator is a real 0%", metrics.ratio(0, 8) === 0 && metrics.formatRate(0) === "0.0%");
    check("rates format to one decimal", metrics.formatRate(1 / 3) === "33.3%" && metrics.formatRate(0.042) === "4.2%");
    check("change from zero has no percentage", metrics.percentChange(10, 0) === null && metrics.percentChange(0, 0) === null);
    check("change is exact to one decimal", metrics.percentChange(114.2, 100) === 14.2 && metrics.percentChange(50, 100) === -50);
    const noTraffic = metrics.funnelRates({ views: 0, addToCart: 0, checkoutStarts: 0, purchases: 0 });
    check("an empty funnel is all undefined, never NaN", Object.values(noTraffic).every((v) => v === null));
    const funnel = metrics.funnelRates({ views: 200, addToCart: 20, checkoutStarts: 10, purchases: 4 });
    check("funnel stages use the documented denominators", funnel.viewToCart === 0.1 && funnel.cartToCheckout === 0.5 && funnel.checkoutToPurchase === 0.4 && funnel.conversion === 0.02);
    check("average order value", metrics.averageOrderCents(1000, 3) === 333 && metrics.averageOrderCents(0, 0) === null);

    // -------------------------------------------------------------- visitor key
    console.log("\nCookieless visitor key");
    const base = { address: "203.0.113.7", userAgent: "Mozilla/5.0 Test", dayKey: "2026-08-01", secret: SECRET };
    const k1 = visitorKey(base)!;
    check("same visitor, same day → same key", k1 === visitorKey(base));
    check("next day → an unrelated key (no cross-day tracking)", k1 !== visitorKey({ ...base, dayKey: "2026-08-02" }));
    check("different address or browser → different key", k1 !== visitorKey({ ...base, address: "203.0.113.8" }) && k1 !== visitorKey({ ...base, userAgent: "Other" }));
    check("the key is 32 hex chars and contains neither address nor agent", /^[0-9a-f]{32}$/.test(k1) && !k1.includes("203") && !k1.includes("Mozilla"));
    check("no secret → no key", visitorKey({ ...base, secret: "" }) === null);

    console.log("\nBot and prefetch filtering");
    const chrome = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
    check("a real browser is not a bot", !isLikelyBot(chrome));
    check("crawlers, unfurlers, monitors and scripts are", ["Googlebot/2.1", "facebookexternalhit/1.1", "curl/8.4.0", "python-requests/2.31", "Mozilla/5.0 HeadlessChrome/120", "WhatsApp/2.23"].every(isLikelyBot));
    check("a missing user agent is not a person", isLikelyBot(null) && isLikelyBot(""));
    check("prefetch and prerender requests are recognised", isPrefetch(new Headers({ "sec-purpose": "prefetch" })) && isPrefetch(new Headers({ purpose: "prefetch" })) && isPrefetch(new Headers({ "sec-purpose": "prefetch;prerender" })) && !isPrefetch(new Headers()));

    const beacon = (headers: Record<string, string>, body = '{"productId":"abcdefgh12345678"}') =>
      viewRoute.POST(new Request("http://localhost:3000/api/analytics/view", { method: "POST", headers: { host: "localhost:3000", ...headers }, body }));
    const refusals = await Promise.all([
      beacon({ origin: "https://evil.example", "user-agent": chrome }),
      beacon({ "user-agent": chrome }),
      beacon({ origin: "http://localhost:3000", "user-agent": "Googlebot/2.1" }),
      beacon({ origin: "http://localhost:3000", "user-agent": chrome, "sec-purpose": "prefetch" }),
      beacon({ origin: "http://localhost:3000", "user-agent": chrome }, "not json"),
      beacon({ origin: "http://localhost:3000", "user-agent": chrome }, '{"productId":"../../etc"}'),
      beacon({ origin: "http://localhost:3000", "user-agent": chrome }, JSON.stringify({ productId: "x".repeat(400) })),
    ]);
    check("the beacon answers every refusal with the same empty 204", refusals.every((r) => r.status === 204));
    check("the beacon never returns a body or sets a cookie", (await Promise.all(refusals.map((r) => r.text()))).every((t) => t === "") && refusals.every((r) => !r.headers.has("set-cookie")));

    // -------------------------------------------------------------- non-blocking
    console.log("\nNon-blocking events");
    const originalWarn = console.warn;
    const warned: string[] = [];
    console.warn = (...args: unknown[]) => void warned.push(args.map(String).join(" "));
    let threw = false;
    let stored = true;
    try {
      stored = await events.recordEvent(
        { type: "ADD_TO_CART", productId: "missing" },
        { analyticsEvent: { create: async () => { throw new Error("connect ECONNREFUSED postgresql://admin:hunter2@db.internal:5432/prod"); } } } as never,
      );
    } catch {
      threw = true;
    } finally {
      console.warn = originalWarn;
    }
    check("a failing database never throws from recordEvent", !threw && stored === false);
    check("the failure is logged by class only, never the message", warned.length === 1 && !/hunter2|ECONNREFUSED/.test(warned.join()));
    let trackThrew = false;
    try {
      events.trackAfterResponse(() => { throw new Error("builder exploded"); });
    } catch {
      trackThrew = true;
    }
    check("trackAfterResponse never throws, even when its builder does", !trackThrew);

    // -------------------------------------------------------------- fixtures
    const category = await prisma.category.create({ data: { name: "Analytics fixtures", slug: RUN, isActive: false, sortOrder: 9999 } });
    categoryId = category.id;
    const makeProduct = (key: string, isActive = true, priceCents = 1000) =>
      prisma.product.create({
        data: { name: `Fixture ${key} ${RUN}`, slug: `${RUN}-${key}`, sku: `${RUN}-${key}`, brand: "Meemi Art", description: "Analytics fixture.", priceCents, categoryId: category.id, isActive },
        select: { id: true },
      });
    const a = await makeProduct("a");
    const b = await makeProduct("b", true, 500);
    const draft = await makeProduct("draft", false);

    const buyer = await prisma.user.create({ data: { email: `${RUN}-buyer@example.test`, name: "Buyer" }, select: { id: true } });
    const other = await prisma.user.create({ data: { email: `${RUN}-other@example.test`, name: "Other" }, select: { id: true } });
    createdUsers.push(buyer.id, other.id);

    // ---- views through the real recording rules
    console.log("\nView recording");
    views.resetViewBurstsForTests();
    const at = (instant: Date) => ({ now: () => instant, secret: SECRET });
    const visit = (productId: string, address: string, instant: Date) =>
      views.recordProductView({ productId, address, userAgent: chrome }, at(instant));
    check("unknown product records nothing", (await visit("doesnotexist000", "198.51.100.1", pk("2026-08-03"))) === "unknown_product");
    check("unpublished product records nothing", (await visit(draft.id, "198.51.100.1", pk("2026-08-03"))) === "unknown_product");
    check("a view is recorded", (await visit(a.id, "198.51.100.1", pk("2026-08-03", "10:00"))) === "recorded");
    check("the same visitor within 30 minutes is the same view", (await visit(a.id, "198.51.100.1", pk("2026-08-03", "10:20"))) === "duplicate");
    check("after 30 minutes it is a new view", (await visit(a.id, "198.51.100.1", pk("2026-08-03", "10:45"))) === "recorded");
    check("a different visitor is a separate view", (await visit(a.id, "198.51.100.2", pk("2026-08-03", "10:46"))) === "recorded");
    check("the same visitor tomorrow is a new visitor-day", (await visit(a.id, "198.51.100.1", pk("2026-08-04", "09:00"))) === "recorded");
    const storedViews = await prisma.analyticsEvent.findMany({ where: { productId: a.id, type: "PRODUCT_VIEW" }, select: { userId: true, visitorKey: true } });
    check("views never carry a user id; each carries only a hashed key", storedViews.length === 4 && storedViews.every((v) => v.userId === null && /^[0-9a-f]{32}$/.test(v.visitorKey ?? "")));
    views.resetViewBurstsForTests();
    let burst: string = "";
    for (let i = 0; i <= views.VIEW_BURST; i++) burst = await visit(b.id, "198.51.100.99", pk("2026-08-05", "08:00"));
    check("a visitor beyond the hourly burst is ignored", burst === "rate_limited");
    // Only the first of those was a real view (the rest were duplicates).
    await prisma.analyticsEvent.deleteMany({ where: { productId: b.id, type: "PRODUCT_VIEW" } });
    views.resetViewBurstsForTests();

    // ---- dated events for the metric checks (range: 1–7 Aug 2026, Karachi)
    const ev = (type: "PRODUCT_VIEW" | "ADD_TO_CART" | "WISHLIST_ADD" | "DOWNLOAD", productId: string, createdAt: Date, extra: Record<string, unknown> = {}) =>
      prisma.analyticsEvent.create({ data: { type, productId, createdAt, ...extra } });
    // Views on A in range: the 4 recorded above + 2 boundary cases inside.
    await ev("PRODUCT_VIEW", a.id, pk("2026-08-01", "00:00"), { visitorKey: "e".repeat(32) }); // first instant: in
    await ev("PRODUCT_VIEW", a.id, pk("2026-08-07", "23:59"), { visitorKey: "f".repeat(32) }); // last minute: in
    await ev("PRODUCT_VIEW", a.id, pk("2026-08-08", "00:00"), { visitorKey: "f".repeat(32) }); // next midnight: out
    await ev("PRODUCT_VIEW", a.id, new Date("2026-07-31T18:59:59Z"), { visitorKey: "e".repeat(32) }); // 23:59:59 Jul 31 PKT: out (previous)
    for (let i = 0; i < 4; i++) await ev("ADD_TO_CART", a.id, pk("2026-08-03", "11:00"), { userId: buyer.id, quantity: 1 });
    await ev("ADD_TO_CART", b.id, pk("2026-08-03", "11:00"), { quantity: 1 });
    await ev("WISHLIST_ADD", a.id, pk("2026-08-02"), { userId: buyer.id });
    await ev("WISHLIST_ADD", a.id, pk("2026-08-06"), { userId: other.id });
    for (let i = 0; i < 3; i++) await ev("DOWNLOAD", a.id, pk("2026-08-05"), { userId: buyer.id });
    // Previous period (25–31 Jul): two views, one add to cart.
    await ev("PRODUCT_VIEW", a.id, pk("2026-07-28"), { visitorKey: "c".repeat(32) });
    await ev("ADD_TO_CART", a.id, pk("2026-07-28"), { quantity: 1 });

    // ---- orders: exactly SUCCESSFUL_ORDER counts, everything else is an attempt
    let orderSeq = 0;
    const order = async (opts: {
      placedAt: Date;
      status: "COMPLETED" | "PENDING" | "REFUNDED" | "CANCELLED";
      payment: "PAID" | "PENDING" | "FAILED" | "REFUNDED";
      provider?: string;
      lines: { product: { id: string }; cents: number; qty?: number }[];
      totalCents?: number;
      userId?: string;
    }) => {
      const subtotal = opts.lines.reduce((s, l) => s + l.cents * (l.qty ?? 1), 0);
      return prisma.order.create({
        data: {
          orderNumber: `${RUN}-${++orderSeq}`,
          userId: opts.userId ?? buyer.id,
          status: opts.status,
          email: "buyer@example.test",
          customerName: "Buyer",
          subtotalCents: subtotal,
          totalCents: opts.totalCents ?? subtotal,
          placedAt: opts.placedAt,
          payment: { create: { status: opts.payment, amountCents: opts.totalCents ?? subtotal, provider: opts.provider ?? "paddle" } },
          items: {
            create: opts.lines.map((l) => ({
              productId: l.product.id,
              name: "Fixture line",
              slug: `${RUN}-line`,
              sku: `${RUN}-line`,
              unitPriceCents: l.cents,
              quantity: l.qty ?? 1,
              totalCents: l.cents * (l.qty ?? 1),
            })),
          },
        },
        select: { id: true, items: { select: { id: true, productId: true } } },
      });
    };

    // In range — successful (with an order-level discount: 1500 lines → 1400 paid).
    const paid1 = await order({ placedAt: pk("2026-08-03", "13:00"), status: "COMPLETED", payment: "PAID", lines: [{ product: a, cents: 1000 }, { product: b, cents: 500 }], totalCents: 1400 });
    // In range — successful on the built-in sandbox driver: SUCCESSFUL_ORDER counts it, and so does analytics.
    await order({ placedAt: pk("2026-08-07", "23:30"), status: "COMPLETED", payment: "PAID", provider: "sandbox", lines: [{ product: a, cents: 1000 }] });
    // In range — attempts that are not sales.
    await order({ placedAt: pk("2026-08-04"), status: "PENDING", payment: "PENDING", lines: [{ product: a, cents: 1000 }] });
    await order({ placedAt: pk("2026-08-04"), status: "PENDING", payment: "FAILED", lines: [{ product: a, cents: 1000 }] });
    await order({ placedAt: pk("2026-08-05"), status: "REFUNDED", payment: "REFUNDED", lines: [{ product: a, cents: 1000 }] });
    await order({ placedAt: pk("2026-08-05"), status: "COMPLETED", payment: "PENDING", lines: [{ product: a, cents: 1000 }] });
    // Just outside the range, on the Karachi side of midnight.
    await order({ placedAt: pk("2026-08-08", "00:10"), status: "COMPLETED", payment: "PAID", lines: [{ product: a, cents: 1000 }] });
    // Previous period — one sale.
    await order({ placedAt: pk("2026-07-29"), status: "COMPLETED", payment: "PAID", lines: [{ product: a, cents: 1000 }], userId: other.id });

    // Reviews (all-time): two approved, one pending.
    await prisma.review.create({ data: { productId: a.id, userId: buyer.id, rating: 5, title: "t", body: "b", status: "APPROVED" } });
    await prisma.review.create({ data: { productId: a.id, userId: other.id, rating: 3, title: "t", body: "b", status: "APPROVED" } });
    await prisma.review.create({ data: { productId: b.id, userId: buyer.id, rating: 1, title: "t", body: "b", status: "PENDING" } });
    // Wishlist now: buyer (who bought A) and other (who bought A last period) both saved A.
    for (const userId of [buyer.id, other.id]) {
      const wl = await prisma.wishlist.create({ data: { userId } });
      await prisma.wishlistItem.create({ data: { wishlistId: wl.id, productId: a.id } });
    }
    // Access: one grant on A with 5 recorded downloads.
    await prisma.digitalAccess.create({ data: { userId: buyer.id, orderId: paid1.id, orderItemId: paid1.items.find((i) => i.productId === a.id)!.id, productId: a.id, downloadCount: 5 } });

    const aug = dates.resolveRange({ preset: "custom", from: "2026-08-01", to: "2026-08-07" }, now).range;

    // -------------------------------------------------------------- product detail
    console.log("\nProduct detail metrics (1–7 Aug 2026, Karachi)");
    const detail = (await queries.getProductAnalytics(a.id, aug))!;
    const c = detail.current;
    check("views: 4 recorded + 2 boundary views; the next midnight and the previous second are out", c.views === 6, String(c.views));
    check("visitor-days: distinct daily keys", c.visitorDays === 5, String(c.visitorDays));
    check("add to cart", c.addToCart === 4, String(c.addToCart));
    check("checkout starts: every order with the product, whatever its status", c.checkoutStarts === 6, String(c.checkoutStarts));
    check("purchases: only SUCCESSFUL_ORDER lines (incl. the sandbox-driver sale it accepts)", c.purchases === 2, String(c.purchases));
    check("failed, pending, unpaid and refunded orders add no purchases or revenue", c.revenueCents === 2000, String(c.revenueCents));
    check("wishlist additions and downloads in the period", c.wishlistAdds === 2 && c.downloads === 3);
    check("funnel rates use the documented denominators", c.rates.viewToCart === 4 / 6 && c.rates.cartToCheckout === 6 / 4 && c.rates.checkoutToPurchase === 2 / 6 && c.rates.conversion === 2 / 6);
    check("previous period: the 7 days before", detail.previous?.fromDate === "2026-07-25" && detail.previous?.toDate === "2026-07-31");
    check("previous period counts its own views, carts and sales", detail.prior?.views === 2 && detail.prior?.addToCart === 1 && detail.prior?.purchases === 1, JSON.stringify(detail.prior && { v: detail.prior.views, c: detail.prior.addToCart, p: detail.prior.purchases }));
    check("changes against the previous period", detail.changes.purchases === 100 && detail.changes.views === 200 && detail.changes.addToCart === 300);
    check("reviews: approved only, with the average and distribution", detail.reviews.count === 2 && detail.reviews.average === 4 && detail.reviews.distribution.find((d) => d.stars === 5)?.count === 1 && detail.reviews.distribution.find((d) => d.stars === 1)?.count === 0);
    check("wishlist now, and saved-and-bought", detail.wishlist.savedNow === 2 && detail.wishlist.savedAndBought === 2);
    check("access: grants, all-time downloads and download rate", detail.access.grants === 1 && detail.access.downloadsAllTime === 5 && detail.access.downloadRate === 5);
    const aug7 = detail.series.find((p) => p.day === "2026-08-07");
    check("series buckets by the Karachi day: the 23:30 PKT sale lands on 7 Aug", aug7?.purchases === 1 && aug7?.views === 1 && detail.series.length === 7, JSON.stringify(aug7));
    check("series totals equal the period totals", detail.series.reduce((s, p) => s + p.views, 0) === c.views && detail.series.reduce((s, p) => s + p.purchases, 0) === c.purchases);
    check("an unknown product has no analytics", (await queries.getProductAnalytics("doesnotexist000", aug)) === null);

    // -------------------------------------------------------------- product table
    console.log("\nProduct table");
    const table = await queries.getProductMetricsTable(aug, "revenue", 1);
    const all = [...table.rows];
    for (let p = 2; p <= table.pages; p++) all.push(...(await queries.getProductMetricsTable(aug, "revenue", p)).rows);
    const rowA = all.find((r) => r.id === a.id);
    const rowB = all.find((r) => r.id === b.id);
    check("every product appears once across pages", all.filter((r) => r.id === a.id).length === 1 && all.length === table.total);
    check("table row matches the detail page", !!rowA && rowA.views === 6 && rowA.addToCart === 4 && rowA.checkoutStarts === 6 && rowA.purchases === 2 && rowA.revenueCents === 2000 && rowA.wishlistAdds === 2 && rowA.downloads === 3 && rowA.reviews === 2 && rowA.rating === 4, JSON.stringify(rowA));
    check("a product with sales but no views has conversion undefined, not infinite", !!rowB && rowB.purchases === 1 && rowB.views === 0 && rowB.conversion === null);
    const byViews = await queries.getProductMetricsTable(aug, "views", 1);
    check("sorting by views puts the most viewed first", byViews.rows[0].views >= (byViews.rows[1]?.views ?? 0));
    const byConversion = await queries.getProductMetricsTable(aug, "conversion", 1);
    const firstNull = byConversion.rows.findIndex((r) => r.conversion === null);
    check("undefined conversions sort after real ones", firstNull === -1 || byConversion.rows.slice(firstNull).every((r) => r.conversion === null));
    check("an out-of-range page is clamped", (await queries.getProductMetricsTable(aug, "revenue", 999)).page === table.pages);
    check("an unknown sort falls back to revenue", queries.parseProductSort("drop table") === "revenue");

    // -------------------------------------------------------------- store overview
    console.log("\nStore overview");
    const overview = await queries.getAnalyticsOverview(aug);
    // Differential against fixtures only would need a before-read; this local
    // range (Aug 2026) holds nothing but these fixtures, which is checked first.
    const foreign = await prisma.order.count({ where: { placedAt: { gte: aug.start!, lt: aug.end }, NOT: { orderNumber: { startsWith: RUN } } } });
    check("the fixture period is otherwise empty on this local database", foreign === 0, String(foreign));
    const o = overview.current;
    check("revenue is order revenue (after the order-level discount): 1400 + 1000", o.revenueCents === 2400, String(o.revenueCents));
    check("orders and purchases (units)", o.orders === 2 && o.purchases === 3, `${o.orders}/${o.purchases}`);
    check("customers: distinct buyers with a successful order", o.customers === 1);
    check("checkout starts: every order placed, any status", o.checkoutStarts === 6, String(o.checkoutStarts));
    check("average order value", o.averageOrderCents === 1200);
    check("store views, carts, wishlist adds, downloads", o.views >= 6 && o.addToCart === 5 && o.wishlistAdds === 2 && o.downloads === 3, JSON.stringify({ v: o.views, c: o.addToCart }));
    check("store conversion is purchases ÷ views", o.conversion === metrics.ratio(o.purchases, o.views));
    check("revenue change vs previous period (1000 → 2400)", overview.changes.revenue === 140);
    const day3 = overview.series.find((p) => p.day === "2026-08-03");
    check("daily revenue in the store currency's units, by Karachi day", day3?.revenue === 14 && day3.orders === 1 && overview.series.length === 7);
    check("an overview with activity is not empty", overview.isEmpty === false);
    const quiet = await queries.getAnalyticsOverview(dates.resolveRange({ preset: "custom", from: "2025-01-01", to: "2025-01-07" }, now).range);
    check("a period with nothing in it reports empty, with undefined rates", quiet.isEmpty && quiet.current.conversion === null && quiet.current.averageOrderCents === null);

    // -------------------------------------------------------------- access and hooks
    console.log("\nAccess control and hooks (source)");
    check("admin layout requires an admin on every admin page", /await requireAdmin\(\)/.test(read("src/app/admin/layout.tsx")));
    check("requireAdmin re-reads the role from the database", /findUnique[\s\S]*select: \{ role: true \}/.test(read("src/lib/auth-guards.ts")) && /role !== "ADMIN"\) notFound\(\)/.test(read("src/lib/auth-guards.ts")));
    for (const page of ["src/app/admin/analytics/page.tsx", "src/app/admin/products/performance/page.tsx", "src/app/admin/products/performance/[id]/page.tsx"]) {
      check(`${page.split("admin/")[1]} lives under the admin layout`, page.startsWith("src/app/admin/") && read(page).length > 0);
    }
    check("the only public analytics endpoint returns no data", !/json\(|JSON\.stringify\(\{/.test(read("src/app/api/analytics/view/route.ts")));
    const cart = read("src/lib/actions/cart.ts");
    check("add to cart is tracked after the cart write, and after the response", cart.indexOf("trackAfterResponse(") > cart.indexOf("prisma.cartItem.upsert"));
    const wish = read("src/lib/actions/wishlist.ts");
    check(
      "wishlist is tracked only for a successful add, from the session user",
      /if \(result\.ok && result\.data\.added && user\) \{\s*trackUserEvent\("WISHLIST_ADD", productId, user\);\s*\}/.test(wish),
    );
    const dl = read("src/app/api/download/[productId]/route.ts");
    check("downloads are tracked after authorisation and the existing counter", dl.indexOf("trackAfterResponse(") > dl.indexOf("findDownloadableAsset(") && dl.indexOf("trackAfterResponse(") > dl.indexOf("downloadCount: { increment: 1 }"));
    check("checkout and payment code records no events", !/trackAfterResponse|trackUserEvent|analyticsEvent/.test(read("src/lib/actions/checkout.ts") + read("src/lib/payments/payment-service.ts")));
  } finally {
    if (createdUsers.length > 0) await prisma.user.deleteMany({ where: { id: { in: createdUsers } } });
    if (categoryId) {
      await prisma.product.deleteMany({ where: { categoryId } });
      await prisma.category.delete({ where: { id: categoryId } });
    }
    const leftovers =
      (await prisma.product.count({ where: { slug: { startsWith: RUN } } })) +
      (await prisma.user.count({ where: { email: { startsWith: RUN } } })) +
      (await prisma.order.count({ where: { orderNumber: { startsWith: RUN } } })) +
      (await prisma.analyticsEvent.count({ where: { product: { slug: { startsWith: RUN } } } }));
    check("fixtures removed (products, events, orders, users, reviews, wishlists, access)", leftovers === 0, String(leftovers));
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
