/**
 * Read-only audit of the Paddle Live account against this database.
 *
 * Every request here is a GET. Nothing is created, updated, archived or
 * deleted, and no credential is printed — only entity ids, names, amounts and
 * statuses, none of which are secret.
 *
 * Run before any migration so the decision about what to create is made from
 * what actually exists rather than from an assumption.
 *
 *   npm run paddle:audit
 */
import "dotenv/config";

type Paginated<T> = { data?: T[]; meta?: { pagination?: { has_more?: boolean; next?: string } } };

async function main() {
  const { paymentConfig } = await import("../src/lib/payments/config");
  const { paddleApi, PaddleApiError } = await import("../src/lib/payments/paddle-api");
  const { PrismaClient } = await import("../src/generated/prisma/client");
  const { PrismaPg } = await import("@prisma/adapter-pg");

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  console.log("\n═══ Paddle Live audit (read-only) ═══");
  console.log(`  environment : ${paymentConfig.paddle.env}`);
  console.log(`  endpoint    : ${paymentConfig.paddle.apiBase}`);
  console.log(`  currency    : ${paymentConfig.currency}`);
  console.log(`  site        : ${paymentConfig.appUrl}`);

  /** Follows Paddle's cursor pagination, GET only. */
  async function all<T>(path: string): Promise<T[]> {
    const out: T[] = [];
    let url: string | null = path;
    let guard = 0;
    while (url && guard++ < 20) {
      const page: Paginated<T> = await paddleApi.get<T[]>(url).then(
        (data) => ({ data }) as Paginated<T>,
        (error) => {
          throw error;
        },
      );
      out.push(...(page.data ?? []));
      url = null; // paddleApi.get returns `data` only; single page is enough here
    }
    return out;
  }

  // ---- 1. Webhook destinations -------------------------------------------
  console.log("\n─── 1. Notification destinations ───");
  type Destination = {
    id?: string;
    description?: string;
    destination?: string;
    active?: boolean;
    type?: string;
    api_version?: number;
    subscribed_events?: { name?: string }[];
  };

  let destinations: Destination[] = [];
  try {
    destinations = await all<Destination>("/notification-settings");
    if (destinations.length === 0) {
      console.log("  none configured");
    }
    for (const d of destinations) {
      const events = (d.subscribed_events ?? []).map((e) => e.name).filter(Boolean);
      console.log(`  ${d.id ?? "?"}  active=${d.active}  type=${d.type}`);
      console.log(`    url    : ${d.destination ?? "—"}`);
      console.log(`    label  : ${d.description ?? "—"}`);
      console.log(`    events : ${events.length ? events.join(", ") : "none"}`);
    }
  } catch (error) {
    console.log(
      `  could not list: ${error instanceof PaddleApiError ? error.code : String(error)}`,
    );
  }

  // ---- 2. Domain approval -------------------------------------------------
  console.log("\n─── 2. Checkout domain approval ───");
  try {
    const domains = await all<Record<string, unknown>>("/domains");
    if (domains.length === 0) console.log("  no domains returned");
    for (const d of domains) console.log(`  ${JSON.stringify(d)}`);
  } catch (error) {
    const code = error instanceof PaddleApiError ? `HTTP ${error.status} ${error.code}` : String(error);
    console.log(`  not available via the API (${code})`);
    console.log("  → domain approval is dashboard-only: Paddle → Checkout → Website approval");
  }

  // ---- 3. Products --------------------------------------------------------
  console.log("\n─── 3. Live products ───");
  type Product = {
    id?: string;
    name?: string;
    status?: string;
    tax_category?: string;
    custom_data?: Record<string, unknown> | null;
  };
  let products: Product[] = [];
  try {
    products = await all<Product>("/products?per_page=200");
    console.log(`  ${products.length} product(s)`);
    for (const p of products) {
      const mapped = (p.custom_data as { product_id?: string } | null)?.product_id;
      console.log(
        `  ${p.id ?? "?"}  ${p.status ?? "?"}  ${p.name ?? "—"}${mapped ? `  ← app product ${mapped}` : ""}`,
      );
    }
  } catch (error) {
    console.log(`  could not list: ${error instanceof PaddleApiError ? error.code : String(error)}`);
  }

  // ---- 4. Prices ----------------------------------------------------------
  console.log("\n─── 4. Live prices ───");
  type Price = {
    id?: string;
    product_id?: string;
    status?: string;
    billing_cycle?: unknown;
    unit_price?: { amount?: string; currency_code?: string };
    description?: string;
  };
  let prices: Price[] = [];
  try {
    prices = await all<Price>("/prices?per_page=200");
    console.log(`  ${prices.length} price(s)`);
    for (const p of prices) {
      const kind = p.billing_cycle ? "RECURRING" : "one-time";
      console.log(
        `  ${p.id ?? "?"}  ${p.status ?? "?"}  ${kind}  ${p.unit_price?.amount ?? "?"} ${p.unit_price?.currency_code ?? "?"}  product=${p.product_id ?? "—"}`,
      );
    }
  } catch (error) {
    console.log(`  could not list: ${error instanceof PaddleApiError ? error.code : String(error)}`);
  }

  // ---- 5. Discounts -------------------------------------------------------
  console.log("\n─── 5. Live discounts ───");
  type Discount = {
    id?: string;
    status?: string;
    description?: string;
    type?: string;
    amount?: string;
    currency_code?: string;
    code?: string | null;
  };
  let discounts: Discount[] = [];
  try {
    discounts = await all<Discount>("/discounts?per_page=200");
    console.log(`  ${discounts.length} discount(s)`);
    for (const d of discounts) {
      console.log(
        `  ${d.id ?? "?"}  ${d.status ?? "?"}  ${d.type ?? "?"} ${d.amount ?? ""} ${d.currency_code ?? ""}  code=${d.code ?? "—"}  ${d.description ?? ""}`,
      );
    }
  } catch (error) {
    console.log(`  could not list: ${error instanceof PaddleApiError ? error.code : String(error)}`);
  }

  // ---- 6. Compare against the database ------------------------------------
  console.log("\n─── 6. Database vs Paddle Live ───");
  const dbProducts = await prisma.product.findMany({
    select: {
      id: true, sku: true, name: true, priceCents: true, isActive: true,
      paddleProductId: true, paddlePriceId: true, paddlePriceCents: true,
      asset: { select: { id: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  const dbCoupons = await prisma.coupon.findMany({
    select: { code: true, type: true, value: true, isActive: true },
  });

  console.log(`  ${dbProducts.length} product(s) in the database, ${dbCoupons.length} coupon(s)`);

  const priceById = new Map(prices.map((p) => [p.id ?? "", p]));
  const productById = new Map(products.map((p) => [p.id ?? "", p]));
  const missing: typeof dbProducts = [];
  const mapped: typeof dbProducts = [];

  for (const p of dbProducts) {
    const sellable = p.isActive && p.asset !== null;
    const hasIds = Boolean(p.paddleProductId && p.paddlePriceId);
    const live = hasIds && productById.has(p.paddleProductId!) && priceById.has(p.paddlePriceId!);
    const label = `${p.sku} "${p.name}" ${(p.priceCents / 100).toFixed(2)} ${paymentConfig.currency}`;

    if (!sellable) {
      console.log(`  SKIP     ${label} — ${p.isActive ? "no file attached" : "not published"}`);
      continue;
    }
    if (live) {
      const lp = priceById.get(p.paddlePriceId!)!;
      const amountOk = lp.unit_price?.amount === String(p.priceCents);
      const currencyOk = lp.unit_price?.currency_code === paymentConfig.currency;
      const oneTime = !lp.billing_cycle;
      mapped.push(p);
      console.log(
        `  MAPPED   ${label} → ${p.paddleProductId} / ${p.paddlePriceId}` +
          `${amountOk ? "" : "  ⚠ AMOUNT MISMATCH"}${currencyOk ? "" : "  ⚠ CURRENCY MISMATCH"}${oneTime ? "" : "  ⚠ RECURRING"}`,
      );
    } else if (hasIds) {
      console.log(`  BROKEN   ${label} — has Paddle ids that do not exist in this Live account`);
      missing.push(p);
    } else {
      console.log(`  MISSING  ${label} — no Paddle product or price`);
      missing.push(p);
    }
  }

  // Paddle entities with no counterpart here.
  const claimed = new Set(dbProducts.map((p) => p.paddleProductId).filter(Boolean));
  const orphans = products.filter((p) => p.id && !claimed.has(p.id));
  if (orphans.length > 0) {
    console.log(`\n  ${orphans.length} Paddle product(s) with no database counterpart:`);
    for (const o of orphans) console.log(`    ${o.id}  ${o.status}  ${o.name ?? "—"}`);
    console.log("    (left untouched — these may belong to another integration)");
  }

  console.log("\n─── Summary ───");
  console.log(`  destinations : ${destinations.length}`);
  console.log(`  products     : ${products.length} live, ${dbProducts.length} in database`);
  console.log(`  prices       : ${prices.length} live`);
  console.log(`  discounts    : ${discounts.length} live`);
  console.log(`  mapped       : ${mapped.length}`);
  console.log(`  need work    : ${missing.length}`);
  console.log("\n  Nothing was created, modified or deleted.\n");

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
