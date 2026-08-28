/**
 * Pushes every sellable product to the Paddle catalogue from the command line.
 *
 * Does the same work as the button in admin settings, for the case where the
 * catalogue needs seeding before anyone has logged in — a fresh environment, a
 * deploy step, or a first run against a new Paddle account.
 *
 * Creates and updates Paddle products and one-time prices. It moves no money,
 * touches no order, and cannot mark anything paid.
 *
 *   npm run paddle:sync            sync everything
 *   npm run paddle:sync -- --dry   report what would change, call nothing
 */
import "dotenv/config";

type Product = {
  id: string;
  name: string;
  sku: string;
  priceCents: number;
  paddlePriceId: string | null;
  paddlePriceCents: number | null;
};

async function main() {
  const dryRun = process.argv.includes("--dry");

  const { paymentConfig } = await import("../src/lib/payments/config");

  console.log(`\nPaddle environment : ${paymentConfig.paddle.env}`);
  console.log(`API base           : ${paymentConfig.paddle.apiBase}`);
  console.log(`Currency           : ${paymentConfig.currency}`);
  console.log(`Driver             : ${paymentConfig.driver}\n`);

  if (paymentConfig.driver !== "paddle") {
    console.error("PAYMENT_PROVIDER is not 'paddle'. Nothing to sync.");
    process.exit(1);
  }
  if (!paymentConfig.paddle.apiKey) {
    console.error("PADDLE_API_KEY is not set. Nothing to sync.");
    process.exit(1);
  }

  const { prisma } = await import("../src/lib/prisma");

  const products: Product[] = await prisma.product.findMany({
    where: { isActive: true, asset: { isNot: null } },
    select: {
      id: true,
      name: true,
      sku: true,
      priceCents: true,
      paddlePriceId: true,
      paddlePriceCents: true,
    },
    orderBy: { createdAt: "asc" },
  });

  if (products.length === 0) {
    console.log(
      "No sellable products. A product needs to be active and have an uploaded file.\n",
    );
    process.exit(0);
  }

  if (dryRun) {
    for (const product of products) {
      const state = !product.paddlePriceId
        ? "would CREATE"
        : product.paddlePriceCents !== product.priceCents
          ? `would UPDATE (${product.paddlePriceCents} -> ${product.priceCents})`
          : "unchanged";
      console.log(`  ${state.padEnd(34)} ${product.sku}  ${product.name}`);
    }
    console.log(`\n${products.length} product(s) inspected. Nothing was sent.\n`);
    process.exit(0);
  }

  const { syncAllProductsToPaddle } = await import("../src/lib/payments/paddle-catalog");
  const results = await syncAllProductsToPaddle();

  const bySku = new Map(products.map((product) => [product.id, product]));
  let failed = 0;

  for (const result of results) {
    const product = bySku.get(result.productId);
    const label = `${product?.sku ?? result.productId}  ${product?.name ?? ""}`.trim();
    if (result.ok) {
      console.log(`  ${result.action.toUpperCase().padEnd(10)} ${label}  → ${result.paddlePriceId}`);
    } else {
      failed++;
      console.error(`  FAILED     ${label}  → ${result.error}`);
    }
  }

  console.log(
    `\n${results.length - failed} of ${results.length} product(s) synced to Paddle ${paymentConfig.paddle.env}.\n`,
  );
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
