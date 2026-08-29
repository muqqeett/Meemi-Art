/**
 * Dashboard accuracy harness.
 *
 * Proves that Revenue and Orders count successful purchases and nothing else.
 *
 * The method is a differential: every metric is read before the fixtures exist
 * and again afterwards, and the harness asserts on the *delta*. That means it
 * never has to know or care what real production data says — it only checks
 * what each fixture contributed. Real customer orders are read, never written.
 *
 * Fixtures are namespaced `zz-analytics-` on their own inactive product, and
 * cleanup runs in `finally` and is verified.
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";

import { prisma } from "../src/lib/prisma";
import {
  getDashboardStats,
  getRevenueSeries,
  getBestSellers,
  getSalesByCategory,
} from "../src/lib/queries/analytics";

const TAG = `zz-analytics-${randomUUID().slice(0, 8)}`;
const PRICE = 1234; // cents — distinctive, so contributions are unambiguous

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

type OrderStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "CANCELLED" | "REFUNDED";
type PayStatus = "PENDING" | "PAID" | "FAILED" | "REFUNDED" | "PROCESSING" | "CANCELLED";

async function snapshot() {
  const [stats, series, sellers, categories] = await Promise.all([
    getDashboardStats(),
    getRevenueSeries(),
    getBestSellers(50),
    getSalesByCategory(),
  ]);

  const now = new Date();
  const thisMonth = series.find(
    (bucket) => bucket.month === now.toLocaleDateString("en-US", { month: "short" }),
  );

  return {
    revenueTotal: stats.revenueTotalCents,
    revenue30: stats.revenue30Cents,
    orders: stats.ordersTotal,
    orders30: stats.orders30,
    monthRevenue: thisMonth?.revenue ?? 0,
    monthOrders: thisMonth?.orders ?? 0,
    sellerUnits: sellers.reduce((n, row) => n + row.unitsSold, 0),
    categoryRevenue: categories.reduce((n, row) => n + row.revenueCents, 0),
  };
}

async function makeOrder(
  userId: string,
  email: string,
  productId: string,
  status: OrderStatus,
  paymentStatus: PayStatus | null,
  placedAt?: Date,
) {
  await prisma.order.create({
    data: {
      orderNumber: `${TAG}-${randomUUID().slice(0, 6)}`,
      userId,
      email,
      customerName: "Analytics Harness",
      status,
      subtotalCents: PRICE,
      totalCents: PRICE,
      ...(placedAt ? { placedAt } : {}),
      items: {
        create: [
          {
            productId,
            name: "Analytics fixture",
            slug: `${TAG}-product`,
            sku: TAG.toUpperCase().slice(0, 32),
            unitPriceCents: PRICE,
            quantity: 1,
            totalCents: PRICE,
          },
        ],
      },
      ...(paymentStatus
        ? {
            payment: {
              create: {
                provider: "paddle",
                status: paymentStatus,
                amountCents: PRICE,
                currency: "USD",
              },
            },
          }
        : {}),
    },
  });
}

/** Create one order of the given shape, then report what it moved. */
async function contribution(
  label: string,
  userId: string,
  email: string,
  productId: string,
  status: OrderStatus,
  paymentStatus: PayStatus | null,
  shouldCount: boolean,
) {
  const before = await snapshot();
  await makeOrder(userId, email, productId, status, paymentStatus);
  const after = await snapshot();

  const dRevenue = after.revenueTotal - before.revenueTotal;
  const dOrders = after.orders - before.orders;
  const dMonthRevenue = Math.round((after.monthRevenue - before.monthRevenue) * 100);
  const dMonthOrders = after.monthOrders - before.monthOrders;
  const dUnits = after.sellerUnits - before.sellerUnits;
  const dCategory = after.categoryRevenue - before.categoryRevenue;

  const wantRevenue = shouldCount ? PRICE : 0;
  const wantOrders = shouldCount ? 1 : 0;

  console.log(`\n  ${label}  (${status} + ${paymentStatus ?? "no payment"})`);
  check(
    `    revenue ${shouldCount ? "counted" : "excluded"}`,
    dRevenue === wantRevenue,
    `moved ${dRevenue}, expected ${wantRevenue}`,
  );
  check(
    `    orders ${shouldCount ? "counted" : "excluded"}`,
    dOrders === wantOrders,
    `moved ${dOrders}, expected ${wantOrders}`,
  );
  check(
    `    monthly revenue chart`,
    dMonthRevenue === wantRevenue,
    `moved ${dMonthRevenue}, expected ${wantRevenue}`,
  );
  check(
    `    monthly orders chart`,
    dMonthOrders === wantOrders,
    `moved ${dMonthOrders}, expected ${wantOrders}`,
  );
  check(`    best sellers units`, dUnits === wantOrders, `moved ${dUnits}`);
  check(`    revenue by category`, dCategory === wantRevenue, `moved ${dCategory}`);
}

async function main() {
  console.log(`\nDashboard accuracy — fixtures tagged ${TAG}\n`);

  const category = await prisma.category.findFirstOrThrow({ select: { id: true } });
  const product = await prisma.product.create({
    data: {
      name: `${TAG} product`,
      slug: `${TAG}-product`,
      sku: TAG.toUpperCase().slice(0, 32),
      brand: "Meemi Art",
      description: "Fixture for the dashboard accuracy harness.",
      priceCents: PRICE,
      categoryId: category.id,
      isActive: false,
    },
    select: { id: true },
  });

  const user = await prisma.user.create({
    data: { email: `${TAG}@example.invalid`, name: `${TAG}` },
    select: { id: true, email: true },
  });

  const cases: [string, OrderStatus, PayStatus | null, boolean][] = [
    ["1. COMPLETED + PAID", "COMPLETED", "PAID", true],
    ["2. PENDING + unpaid", "PENDING", "PENDING", false],
    ["3. CANCELLED", "CANCELLED", "CANCELLED", false],
    ["4. FAILED payment", "PENDING", "FAILED", false],
    ["5. REFUNDED", "REFUNDED", "REFUNDED", false],
    ["6. COMPLETED but payment not PAID", "COMPLETED", "PENDING", false],
    ["7. PAID but order not COMPLETED", "PROCESSING", "PAID", false],
    ["8. Order with no payment row at all", "COMPLETED", null, false],
  ];

  for (const [label, status, pay, shouldCount] of cases) {
    await contribution(label, user.id, user.email, product.id, status, pay, shouldCount);
  }

  console.log("\n9. Date-range windows");
  // A paid order placed 45 days ago: inside all-time, outside the 30-day window.
  const before = await snapshot();
  await makeOrder(
    user.id,
    user.email,
    product.id,
    "COMPLETED",
    "PAID",
    new Date(Date.now() - 45 * 86_400_000),
  );
  const after = await snapshot();

  check(
    "    45-day-old paid order counts in all-time revenue",
    after.revenueTotal - before.revenueTotal === PRICE,
    `moved ${after.revenueTotal - before.revenueTotal}`,
  );
  check(
    "    and is excluded from the 30-day window",
    after.revenue30 - before.revenue30 === 0,
    `moved ${after.revenue30 - before.revenue30}`,
  );
  check(
    "    all-time order count includes it",
    after.orders - before.orders === 1,
  );
  check(
    "    30-day order count excludes it",
    after.orders30 - before.orders30 === 0,
  );

  console.log("\n10. Totals across every fixture");
  // Nine orders were created; exactly two of them are successful.
  const successful = await prisma.order.count({
    where: {
      orderNumber: { startsWith: TAG },
      status: "COMPLETED",
      payment: { status: "PAID" },
    },
  });
  const created = await prisma.order.count({
    where: { orderNumber: { startsWith: TAG } },
  });
  check(
    "    9 fixture orders created, 2 successful",
    created === 9 && successful === 2,
    `created ${created}, successful ${successful}`,
  );

  console.log(`\n${passed} passed, ${failed} failed\n`);
}

async function cleanup() {
  // Users cascade to their orders, items and payments.
  const users = await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
  const products = await prisma.product.deleteMany({
    where: { slug: { startsWith: TAG } },
  });
  console.log(`Cleanup: ${users.count} users, ${products.count} products removed.`);

  const stray =
    (await prisma.user.count({ where: { email: { startsWith: TAG } } })) +
    (await prisma.product.count({ where: { slug: { startsWith: TAG } } })) +
    (await prisma.order.count({ where: { orderNumber: { startsWith: TAG } } }));

  if (stray > 0) {
    console.error(`LEFTOVER FIXTURES (${stray}). Remove rows tagged ${TAG} by hand.`);
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error("\nHarness error:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup();
    await prisma.$disconnect();
    if (failed > 0) process.exitCode = 1;
  });
