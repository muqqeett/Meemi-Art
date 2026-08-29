/**
 * Review authorisation harness.
 *
 * Proves the rule the whole feature rests on: only a customer with a COMPLETED,
 * PAID order containing a product may review that product, and no customer can
 * touch another customer's review.
 *
 * This runs against whatever DATABASE_URL is configured, which is currently the
 * production database. So it is written to be safe there:
 *
 *   - every fixture is namespaced `zz-review-test-` and created by this script
 *   - the product it reviews is one it creates, inactive and unpublished, so no
 *     real product's cached ratingAvg/reviewCount is ever touched
 *   - cleanup runs in `finally` and is verified afterwards
 *
 * It does not test the UI. It tests the server-side gate, which is the part
 * that would actually let someone review something they never bought.
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";

import { prisma } from "../src/lib/prisma";
import { hasPurchasedProduct, getVerifiedReviewerIds } from "../src/lib/queries/reviews";

const TAG = `zz-review-test-${randomUUID().slice(0, 8)}`;

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

async function makeUser(label: string) {
  return prisma.user.create({
    data: {
      email: `${TAG}-${label}@example.invalid`,
      name: `${TAG} ${label}`,
    },
    select: { id: true, email: true },
  });
}

/** An order for one product, at the given order + payment status. */
async function makeOrder(
  userId: string,
  email: string,
  productId: string,
  status: "COMPLETED" | "PENDING" | "CANCELLED" | "REFUNDED",
  paymentStatus: "PAID" | "PENDING" | "REFUNDED" | "FAILED" | null,
) {
  const order = await prisma.order.create({
    data: {
      orderNumber: `${TAG}-${randomUUID().slice(0, 6)}`,
      userId,
      email,
      customerName: "Test Harness",
      status,
      subtotalCents: 1000,
      totalCents: 1000,
      items: {
        create: [
          {
            productId,
            name: "Harness product",
            slug: `${TAG}-product`,
            sku: `${TAG}`.toUpperCase().slice(0, 32),
            unitPriceCents: 1000,
            quantity: 1,
            totalCents: 1000,
          },
        ],
      },
      ...(paymentStatus
        ? {
            payment: {
              create: {
                provider: "paddle",
                status: paymentStatus,
                amountCents: 1000,
                currency: "USD",
              },
            },
          }
        : {}),
    },
    select: { id: true },
  });

  return order;
}

async function main() {
  console.log(`\nReview authorisation — fixtures tagged ${TAG}\n`);

  // An inactive, unpublished product so nothing customer-facing is affected
  // even while the harness is mid-run.
  const category = await prisma.category.findFirst({ select: { id: true } });
  if (!category) throw new Error("No category exists; cannot build a fixture product.");

  const product = await prisma.product.create({
    data: {
      name: `${TAG} product`,
      slug: `${TAG}-product`,
      sku: `${TAG}`.toUpperCase().slice(0, 32),
      brand: "Meemi Art",
      description: "Fixture for the review authorisation harness.",
      priceCents: 1000,
      categoryId: category.id,
      isActive: false,
    },
    select: { id: true },
  });

  // A second product nobody in this harness buys, for the negative case.
  const unbought = await prisma.product.create({
    data: {
      name: `${TAG} unbought`,
      slug: `${TAG}-unbought`,
      sku: `${TAG}-U`.toUpperCase().slice(0, 32),
      brand: "Meemi Art",
      description: "Never purchased by any harness user.",
      priceCents: 1000,
      categoryId: category.id,
      isActive: false,
    },
    select: { id: true },
  });

  const buyer = await makeUser("buyer");
  const stranger = await makeUser("stranger");
  const pendingBuyer = await makeUser("pending");
  const cancelledBuyer = await makeUser("cancelled");
  const refundedBuyer = await makeUser("refunded");
  const unpaidBuyer = await makeUser("unpaid");

  await makeOrder(buyer.id, buyer.email, product.id, "COMPLETED", "PAID");
  await makeOrder(pendingBuyer.id, pendingBuyer.email, product.id, "PENDING", "PENDING");
  await makeOrder(
    cancelledBuyer.id,
    cancelledBuyer.email,
    product.id,
    "CANCELLED",
    "FAILED",
  );
  await makeOrder(
    refundedBuyer.id,
    refundedBuyer.email,
    product.id,
    "REFUNDED",
    "REFUNDED",
  );
  // Order marked complete but payment never landed — the exact shape a missed
  // webhook or a hand-edited row would leave behind.
  await makeOrder(unpaidBuyer.id, unpaidBuyer.email, product.id, "COMPLETED", "PENDING");

  console.log("1. A customer who bought the product");
  check("purchaser is eligible", await hasPurchasedProduct(buyer.id, product.id));

  console.log("\n2. A customer who never bought it");
  check(
    "stranger with no order is refused",
    !(await hasPurchasedProduct(stranger.id, product.id)),
  );
  check(
    "buyer is refused on a product they did not buy",
    !(await hasPurchasedProduct(buyer.id, unbought.id)),
  );

  console.log("\n3. Orders that are not COMPLETED + PAID");
  check("pending order grants nothing", !(await hasPurchasedProduct(pendingBuyer.id, product.id)));
  check(
    "cancelled order grants nothing",
    !(await hasPurchasedProduct(cancelledBuyer.id, product.id)),
  );
  check(
    "refunded order grants nothing",
    !(await hasPurchasedProduct(refundedBuyer.id, product.id)),
  );
  check(
    "completed-but-unpaid order grants nothing",
    !(await hasPurchasedProduct(unpaidBuyer.id, product.id)),
  );

  // The unauthenticated case is not testable from here: importing the action
  // pulls in `next/navigation`, which needs a React client runtime this script
  // does not have. It is checked in the browser against the dev server instead.

  console.log("\n4. One review per customer per product");
  await prisma.review.create({
    data: {
      productId: product.id,
      userId: buyer.id,
      rating: 4,
      title: "First",
      body: "The original review body, long enough to pass validation.",
    },
  });

  let duplicateRejected = false;
  try {
    await prisma.review.create({
      data: {
        productId: product.id,
        userId: buyer.id,
        rating: 1,
        title: "Second",
        body: "A duplicate row for the same (product, user) pair.",
      },
    });
  } catch {
    duplicateRejected = true;
  }
  check("duplicate (product, user) is rejected by the database", duplicateRejected);

  console.log("\n5. One customer cannot modify another's review");
  // The action upserts on productId_userId with the id from the session. The
  // closest a stranger can get is their own row on the same product, so assert
  // that an upsert keyed on the stranger leaves the buyer's row untouched and
  // creates a separate one.
  await prisma.review.upsert({
    where: { productId_userId: { productId: product.id, userId: stranger.id } },
    create: {
      productId: product.id,
      userId: stranger.id,
      rating: 1,
      title: "Stranger",
      body: "Written under the stranger's own id, as the action would.",
    },
    update: { rating: 1, title: "Stranger", body: "Overwritten." },
  });

  const buyerRow = await prisma.review.findUnique({
    where: { productId_userId: { productId: product.id, userId: buyer.id } },
    select: { title: true, rating: true },
  });
  check(
    "buyer's review is unchanged by the stranger's write",
    buyerRow?.title === "First" && buyerRow?.rating === 4,
    JSON.stringify(buyerRow),
  );
  check(
    "two distinct rows exist",
    (await prisma.review.count({ where: { productId: product.id } })) === 2,
  );

  console.log("\n6. Verified-purchase badge reflects real purchases");
  const verified = await getVerifiedReviewerIds(product.id, [buyer.id, stranger.id]);
  check("buyer is marked verified", verified.has(buyer.id));
  check("stranger is not marked verified", !verified.has(stranger.id));

  console.log(`\n${passed} passed, ${failed} failed\n`);
}

async function cleanup() {
  // Users cascade to their orders, order items, payments and reviews.
  const users = await prisma.user.deleteMany({
    where: { email: { startsWith: TAG } },
  });
  const products = await prisma.product.deleteMany({
    where: { slug: { startsWith: TAG } },
  });
  console.log(`Cleanup: ${users.count} users, ${products.count} products removed.`);

  const strayUsers = await prisma.user.count({ where: { email: { startsWith: TAG } } });
  const strayProducts = await prisma.product.count({
    where: { slug: { startsWith: TAG } },
  });
  const strayOrders = await prisma.order.count({
    where: { orderNumber: { startsWith: TAG } },
  });

  if (strayUsers || strayProducts || strayOrders) {
    console.error(
      `LEFTOVER FIXTURES — users:${strayUsers} products:${strayProducts} orders:${strayOrders}. Remove rows tagged ${TAG} by hand.`,
    );
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
