import "server-only";

import { prisma } from "@/lib/prisma";
import { paymentConfig } from "@/lib/payments/config";
import { paddleApi, PaddleApiError } from "@/lib/payments/paddle-api";

/**
 * Keeps the Paddle catalogue in step with the product table.
 *
 * One MeemiArt product maps to one Paddle product carrying exactly one price:
 *
 *     Product  ->  Paddle product (pro_...)  ->  one-time price (pri_...)
 *
 * The price is created **without** a `billing_cycle`, which is what makes it
 * one-time. A `billing_cycle` would turn it into a subscription, and MeemiArt
 * sells files, not memberships — so the field is never sent, and
 * `assertOneTime` refuses to adopt a price that has one.
 *
 * Prices in Paddle are immutable in the way that matters here: the amount can
 * be edited, but a price that has been used keeps its id. So a price change on
 * our side updates the existing Paddle price rather than making a new one,
 * which keeps historical transactions pointing at something that still exists.
 *
 * `paddlePriceCents` records the amount at the last sync. Comparing it against
 * `priceCents` tells the admin screen whether a product has drifted out of
 * sync without spending an API call per product.
 */

export type SyncOutcome =
  | { ok: true; productId: string; paddleProductId: string; paddlePriceId: string; action: "created" | "updated" | "unchanged" }
  | { ok: false; productId: string; error: string };

type PaddleProduct = { id: string; status?: string };
type PaddlePrice = {
  id: string;
  status?: string;
  billing_cycle?: unknown;
  unit_price?: { amount?: string; currency_code?: string };
};

/**
 * A price with a billing cycle is a subscription. Adopting one would quietly
 * enrol customers in recurring charges, so it is refused rather than reused.
 */
function assertOneTime(price: PaddlePrice): void {
  if (price.billing_cycle) {
    throw new Error(
      `Paddle price ${price.id} is recurring. MeemiArt sells one-time products only.`,
    );
  }
}

/**
 * Create or update the Paddle product and price for one MeemiArt product.
 *
 * Safe to run repeatedly: it reuses whatever ids the row already carries and
 * only writes when something actually differs.
 */
export async function syncProductToPaddle(productId: string): Promise<SyncOutcome> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      name: true,
      sku: true,
      shortDescription: true,
      description: true,
      priceCents: true,
      paddleProductId: true,
      paddlePriceId: true,
      paddlePriceCents: true,
    },
  });

  if (!product) return { ok: false, productId, error: "Product not found." };

  if (product.priceCents <= 0) {
    return { ok: false, productId, error: "Product has no price to sync." };
  }

  try {
    // --- Paddle product -----------------------------------------------------
    const description =
      (product.shortDescription ?? product.description).slice(0, 500) || product.name;

    let paddleProductId = product.paddleProductId;

    if (paddleProductId) {
      await paddleApi.patch<PaddleProduct>(`/products/${paddleProductId}`, {
        name: product.name.slice(0, 200),
        description,
        custom_data: { product_id: product.id, sku: product.sku },
      });
    } else {
      const created = await paddleApi.post<PaddleProduct>("/products", {
        name: product.name.slice(0, 200),
        description,
        // Digital goods. Paddle uses this to work out sales tax as merchant of
        // record; "standard" is the correct category for a downloadable file.
        tax_category: "standard",
        custom_data: { product_id: product.id, sku: product.sku },
      });
      paddleProductId = created.id;
    }

    // --- One-time price -----------------------------------------------------
    const amount = String(product.priceCents);
    let paddlePriceId = product.paddlePriceId;
    let action: "created" | "updated" | "unchanged" = "unchanged";

    if (paddlePriceId) {
      const existing = await paddleApi.get<PaddlePrice>(`/prices/${paddlePriceId}`);
      assertOneTime(existing);

      const sameAmount = existing.unit_price?.amount === amount;
      const sameCurrency = existing.unit_price?.currency_code === paymentConfig.currency;

      if (!sameAmount || !sameCurrency) {
        await paddleApi.patch<PaddlePrice>(`/prices/${paddlePriceId}`, {
          unit_price: { amount, currency_code: paymentConfig.currency },
        });
        action = "updated";
      }
    } else {
      const created = await paddleApi.post<PaddlePrice>("/prices", {
        product_id: paddleProductId,
        description: `${product.name} — one-time`.slice(0, 200),
        // No `billing_cycle` key: that is what makes this a one-time price.
        unit_price: { amount, currency_code: paymentConfig.currency },
        quantity: { minimum: 1, maximum: 100 },
        custom_data: { product_id: product.id },
      });
      assertOneTime(created);
      paddlePriceId = created.id;
      action = "created";
    }

    await prisma.product.update({
      where: { id: product.id },
      data: {
        paddleProductId,
        paddlePriceId,
        paddlePriceCents: product.priceCents,
        paddleSyncedAt: new Date(),
      },
    });

    return { ok: true, productId: product.id, paddleProductId, paddlePriceId, action };
  } catch (error) {
    const message =
      error instanceof PaddleApiError
        ? `Paddle refused the sync (${error.code}).`
        : error instanceof Error
          ? error.message
          : "Sync failed.";
    console.error("[paddle-catalog] sync failed for", product.id, error);
    return { ok: false, productId: product.id, error: message };
  }
}

/** Sync every sellable product. Sequential on purpose — Paddle rate-limits. */
export async function syncAllProductsToPaddle(): Promise<SyncOutcome[]> {
  const products = await prisma.product.findMany({
    where: { isActive: true, asset: { isNot: null } },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });

  const results: SyncOutcome[] = [];
  for (const product of products) {
    results.push(await syncProductToPaddle(product.id));
  }
  return results;
}

/**
 * Products whose Paddle price no longer matches what this database charges.
 *
 * Pure database read, no API call: `paddlePriceCents` is what Paddle was last
 * told, so any row where it differs from `priceCents` is out of step.
 */
export async function findDriftedProducts(): Promise<
  { id: string; name: string; priceCents: number; paddlePriceCents: number | null }[]
> {
  const products = await prisma.product.findMany({
    where: { isActive: true, asset: { isNot: null } },
    select: { id: true, name: true, priceCents: true, paddlePriceCents: true },
  });

  return products.filter((p) => p.paddlePriceCents !== p.priceCents);
}
