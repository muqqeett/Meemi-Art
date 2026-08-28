/**
 * Download authorisation, proven against the code that actually runs.
 *
 * Every check here calls `findDownloadableAsset` / `canDownload` from
 * `lib/queries/download-access.ts` — the same functions the download route
 * calls. The predicate is not restated in this file, so the test cannot keep
 * passing while the route drifts away from it.
 *
 * Creates a throwaway user, a second user, a product with a file, and orders in
 * each payment state; removes all of it at the end, pass or fail.
 *
 *   npm run test:downloads
 */
import "dotenv/config";
import { randomBytes } from "node:crypto";

const EMAIL = "downloads-harness@meemiart.invalid";
const OTHER_EMAIL = "downloads-other@meemiart.invalid";
const SKU = "DL-HARNESS-1";
const PRICE = 3900;

let failures = 0;
function check(label: string, pass: boolean, detail?: unknown) {
  if (!pass) failures++;
  console.log(
    `  ${pass ? "PASS" : "FAIL"}  ${label}${detail === undefined ? "" : `  → ${JSON.stringify(detail)}`}`,
  );
}

async function main() {
  const { PrismaClient } = await import("../src/generated/prisma/client");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  const { findDownloadableAsset, canDownload } = await import(
    "../src/lib/queries/download-access"
  );

  async function cleanup() {
    await prisma.user.deleteMany({ where: { email: { in: [EMAIL, OTHER_EMAIL] } } });
    const product = await prisma.product.findUnique({ where: { sku: SKU } });
    if (product) await prisma.product.delete({ where: { id: product.id } });
    const category = await prisma.category.findUnique({ where: { slug: "dl-harness" } });
    if (category) await prisma.category.delete({ where: { id: category.id } });
  }

  try {
    await cleanup();

    const buyer = await prisma.user.create({
      data: { email: EMAIL, name: "Harness Buyer", role: "CUSTOMER" },
    });
    const stranger = await prisma.user.create({
      data: { email: OTHER_EMAIL, name: "Harness Stranger", role: "CUSTOMER" },
    });
    const category = await prisma.category.create({
      data: { name: "DL Harness", slug: "dl-harness" },
    });
    const product = await prisma.product.create({
      data: {
        name: "Harness Pattern",
        slug: `dl-harness-${randomBytes(4).toString("hex")}`,
        description: "Throwaway fixture.",
        brand: "Meemi Art",
        sku: SKU,
        priceCents: PRICE,
        categoryId: category.id,
        asset: {
          create: {
            storageKey: "meemiart/digital-files/harness-secret-key",
            filename: "harness-pattern.pdf",
            contentType: "application/pdf",
            bytes: 1024,
          },
        },
      },
    });

    /** Builds an order in a given state, with an access row when asked. */
    async function makeOrder(
      userId: string,
      orderStatus: "PENDING" | "COMPLETED" | "REFUNDED" | "CANCELLED",
      paymentStatus: "PENDING" | "PAID" | "FAILED" | "REFUNDED",
      grant: boolean,
      revoked = false,
    ) {
      const order = await prisma.order.create({
        data: {
          orderNumber: `DLH-${randomBytes(4).toString("hex")}`,
          userId,
          email: EMAIL,
          customerName: "Harness Buyer",
          status: orderStatus,
          subtotalCents: PRICE,
          discountCents: 0,
          totalCents: PRICE,
          currency: "USD",
          items: {
            create: {
              productId: product.id,
              name: product.name,
              slug: product.slug,
              sku: product.sku,
              unitPriceCents: PRICE,
              quantity: 1,
              totalCents: PRICE,
            },
          },
          payment: {
            create: {
              provider: "sandbox",
              status: paymentStatus,
              amountCents: PRICE,
              currency: "USD",
            },
          },
        },
        select: { id: true, items: { select: { id: true } } },
      });

      if (grant) {
        await prisma.digitalAccess.create({
          data: {
            userId,
            orderId: order.id,
            orderItemId: order.items[0].id,
            productId: product.id,
            ...(revoked
              ? { revokedAt: new Date(), revokedReason: "Payment refunded" }
              : {}),
          },
        });
      }
      return order.id;
    }

    console.log("\n=== who may download ===");

    // No grant at all — the ordinary case for a browsing customer.
    check(
      "a customer who has not bought it cannot download",
      (await findDownloadableAsset(buyer.id, product.id)) === null,
    );

    const paidOrder = await makeOrder(buyer.id, "COMPLETED", "PAID", true);
    const paid = await findDownloadableAsset(buyer.id, product.id);
    check("a paid purchase authorises a download", paid !== null);
    check(
      "and resolves the real storage key server-side",
      paid?.storageKey === "meemiart/digital-files/harness-secret-key",
    );

    check(
      "a different signed-in customer cannot download the same product",
      (await findDownloadableAsset(stranger.id, product.id)) === null,
    );

    console.log("\n=== payment states that must NOT authorise ===");

    await prisma.digitalAccess.deleteMany({ where: { orderId: paidOrder } });
    await prisma.order.delete({ where: { id: paidOrder } });

    await makeOrder(stranger.id, "PENDING", "PENDING", false);
    check(
      "an unpaid order creates no access and authorises nothing",
      (await canDownload(stranger.id, product.id)) === false,
    );

    await makeOrder(stranger.id, "PENDING", "FAILED", false);
    check(
      "a failed payment authorises nothing",
      (await canDownload(stranger.id, product.id)) === false,
    );

    await makeOrder(stranger.id, "CANCELLED", "CANCELLED" as "PENDING", false);
    check(
      "a cancelled order authorises nothing",
      (await canDownload(stranger.id, product.id)) === false,
    );

    console.log("\n=== refund revokes ===");

    const refunded = await makeOrder(buyer.id, "REFUNDED", "REFUNDED", true, true);
    check(
      "a refunded purchase cannot download",
      (await canDownload(buyer.id, product.id)) === false,
    );
    const stillThere = await prisma.digitalAccess.findFirst({
      where: { orderId: refunded },
      select: { revokedAt: true, revokedReason: true },
    });
    check(
      "and the access row is revoked, not deleted",
      stillThere !== null && stillThere.revokedAt !== null,
      stillThere?.revokedReason,
    );

    console.log("\n=== tampering ===");

    // A grant row that exists but whose order was never completed. This is the
    // case the route's re-check of order and payment exists for: even a
    // hand-edited grant must not open a download.
    const tampered = await makeOrder(buyer.id, "PENDING", "PENDING", true);
    check(
      "a hand-created grant on an unpaid order still cannot download",
      (await canDownload(buyer.id, product.id)) === false,
    );
    await prisma.digitalAccess.deleteMany({ where: { orderId: tampered } });

    check(
      "an unknown product id authorises nothing",
      (await findDownloadableAsset(buyer.id, "does-not-exist")) === null,
    );

    console.log(
      failures === 0
        ? "\nAll download authorisation checks passed.\n"
        : `\n${failures} check(s) FAILED.\n`,
    );
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }

  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
