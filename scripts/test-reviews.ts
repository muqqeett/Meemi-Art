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
import {
  hasPurchasedProduct,
  getVerifiedReviewerIds,
  getReviewEligibility,
} from "../src/lib/queries/reviews";

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
  // Nothing on Review carries the badge, so there is no column a customer
  // could set. It is derived from the orders on every render.
  const reviewColumns = Object.keys(
    await prisma.review.findFirstOrThrow({ where: { productId: product.id } }),
  );
  check(
    "no verified/badge column exists on Review to be set by hand",
    !reviewColumns.some((column) => /verif|badge/i.test(column)),
    reviewColumns.join(","),
  );

  console.log("\n7. Eligibility never expires");
  // Backdate the whole purchase by three years — order, completion and the
  // review itself — and ask again. Nothing in the eligibility query looks at
  // time, so this must be indistinguishable from a purchase made today.
  const longAgo = new Date(Date.now() - 3 * 365 * 24 * 60 * 60 * 1000);
  await prisma.order.updateMany({
    where: { userId: buyer.id, orderNumber: { startsWith: TAG } },
    data: { placedAt: longAgo, completedAt: longAgo },
  });
  await prisma.review.update({
    where: { productId_userId: { productId: product.id, userId: buyer.id } },
    data: { createdAt: longAgo },
  });

  check(
    "a three-year-old purchase still grants review permission",
    await hasPurchasedProduct(buyer.id, product.id),
  );

  const lateEligibility = await getReviewEligibility(buyer.id, [product.id, unbought.id]);
  check("batched eligibility includes the old purchase", lateEligibility.has(product.id));
  check(
    "batched eligibility excludes the unbought product",
    !lateEligibility.has(unbought.id),
  );
  check(
    "existing review is returned for prefilling",
    lateEligibility.get(product.id)?.title === "First",
    JSON.stringify(lateEligibility.get(product.id)),
  );

  console.log("\n8. Editing years later updates rather than duplicates");
  const before = await prisma.review.findUniqueOrThrow({
    where: { productId_userId: { productId: product.id, userId: buyer.id } },
    select: { id: true },
  });

  // Exactly the statement the action runs.
  await prisma.review.upsert({
    where: { productId_userId: { productId: product.id, userId: buyer.id } },
    create: {
      productId: product.id,
      userId: buyer.id,
      rating: 5,
      title: "Should not be reached",
      body: "The row already exists, so this branch must not run.",
    },
    update: {
      rating: 5,
      title: "Revised years later",
      body: "Coming back to this long after buying it, and changing my mind.",
    },
  });

  const after = await prisma.review.findUniqueOrThrow({
    where: { productId_userId: { productId: product.id, userId: buyer.id } },
    select: { id: true, rating: true, title: true },
  });

  check("the same review row is updated, not replaced", after.id === before.id);
  check(
    "the edit took effect",
    after.rating === 5 && after.title === "Revised years later",
  );
  check(
    "still exactly two reviews on the product",
    (await prisma.review.count({ where: { productId: product.id } })) === 2,
  );

  console.log("\n9. A non-purchaser cannot reach another customer's review");
  // The action keys its upsert on the session user, so the only row a stranger
  // can ever address is their own. Confirm the buyer's row is untouched by an
  // upsert made under the stranger's id after the edit above.
  await prisma.review.upsert({
    where: { productId_userId: { productId: product.id, userId: stranger.id } },
    create: {
      productId: product.id,
      userId: stranger.id,
      rating: 3,
      title: "Stranger again",
      body: "A second attempt under the stranger's own id.",
    },
    update: { rating: 3, title: "Stranger again", body: "A second attempt." },
  });

  const buyerAfterStranger = await prisma.review.findUniqueOrThrow({
    where: { productId_userId: { productId: product.id, userId: buyer.id } },
    select: { id: true, title: true },
  });
  check(
    "buyer's row survives the stranger's second write intact",
    buyerAfterStranger.id === before.id &&
      buyerAfterStranger.title === "Revised years later",
  );
  check(
    "stranger has no eligibility despite having a review row",
    !(await hasPurchasedProduct(stranger.id, product.id)),
  );
  check(
    "stranger's batched eligibility is empty",
    (await getReviewEligibility(stranger.id, [product.id])).size === 0,
  );

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
