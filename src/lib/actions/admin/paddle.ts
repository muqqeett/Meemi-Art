"use server";

import { revalidatePath } from "next/cache";

import { getAdminOrNull, type SessionUser } from "@/lib/auth-guards";
import { recordActivity } from "@/lib/admin/activity";
import { paymentConfig } from "@/lib/payments/config";
import { syncAllProductsToPaddle, syncProductToPaddle } from "@/lib/payments/paddle-catalog";

/**
 * Admin actions for the Paddle catalogue.
 *
 * Syncing is the only Paddle write an operator can trigger, and it moves no
 * money: it creates or updates a product and a one-time price. There is
 * deliberately no action here that changes a payment or an order — that state
 * comes from signed webhooks and nowhere else.
 *
 * The role is re-checked inside each action. The admin layout guards the pages,
 * but a server action is its own entry point and can be invoked directly.
 */

export type SyncResult =
  | {
      ok: true;
      message: string;
      /**
       * The catalogue ids, so the form can show "Connected" without a reload.
       * These are identifiers, not credentials — Paddle publishes them in its
       * own dashboard and they appear in checkout requests.
       */
      paddleProductId?: string;
      paddlePriceId?: string;
    }
  | { ok: false; error: string };

/** Returns the actor as well as the verdict, so the sync can be attributed. */
async function adminOrDenied(): Promise<
  { admin: SessionUser; denied?: never } | { admin?: never; denied: SyncResult }
> {
  const admin = await getAdminOrNull();
  if (!admin) {
    return { denied: { ok: false, error: "You don't have permission to do that." } };
  }
  return { admin };
}

/** Guard so the button cannot fire pointless API calls when Paddle is off. */
function assertPaddle(): SyncResult | null {
  if (paymentConfig.driver !== "paddle") {
    return { ok: false, error: "PAYMENT_PROVIDER is not set to paddle." };
  }
  if (!paymentConfig.paddle.apiKey) {
    return { ok: false, error: "PADDLE_API_KEY is not set." };
  }
  return null;
}

export async function syncCatalogToPaddle(): Promise<SyncResult> {
  const { admin, denied } = await adminOrDenied();
  if (denied) return denied;

  const offline = assertPaddle();
  if (offline) return offline;

  const results = await syncAllProductsToPaddle();
  const failed = results.filter((result) => !result.ok);
  const changed = results.filter(
    (result) => result.ok && result.action !== "unchanged",
  ).length;

  await recordActivity({
    actorId: admin.id,
    action: "payment.catalog_synced",
    entityType: "payment",
    // The environment name, not a key. Nothing here identifies a credential.
    meta: {
      env: paymentConfig.paddle.env,
      products: results.length,
      changed,
      failed: failed.length,
    },
  });

  revalidatePath("/admin/settings");
  revalidatePath("/admin/products");

  if (failed.length > 0) {
    // The reason is already logged server-side with the product id; the
    // operator gets a count and a pointer rather than a wall of API detail.
    return {
      ok: false,
      error: `${failed.length} of ${results.length} product(s) failed to sync. Check the server log.`,
    };
  }

  return {
    ok: true,
    message:
      results.length === 0
        ? "No sellable products to sync. A product needs a price and an uploaded file."
        : `Synced ${results.length} product(s) to Paddle ${paymentConfig.paddle.env}. ${changed} changed.`,
  };
}

/**
 * Create — or bring back into step — the Paddle product and one-time price for
 * a single product, and hand the ids back to the caller.
 *
 * Safe to press twice. `syncProductToPaddle` reuses whatever ids the row
 * already carries, so an already-connected product is updated in place rather
 * than duplicated in the Paddle catalogue.
 */
export async function syncOneProductToPaddle(productId: string): Promise<SyncResult> {
  const { admin, denied } = await adminOrDenied();
  if (denied) return denied;

  const offline = assertPaddle();
  if (offline) return offline;

  const result = await syncProductToPaddle(productId);

  await recordActivity({
    actorId: admin.id,
    action: "payment.product_synced",
    entityType: "product",
    entityId: productId,
    meta: {
      env: paymentConfig.paddle.env,
      outcome: result.ok ? result.action : "failed",
    },
  });

  revalidatePath("/admin/settings");
  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${productId}/edit`);

  if (!result.ok) return { ok: false, error: result.error };

  const wording =
    result.action === "created"
      ? "Connected to Paddle."
      : result.action === "updated"
        ? "Paddle price updated to match."
        : "Already in step with Paddle.";

  return {
    ok: true,
    message: wording,
    paddleProductId: result.paddleProductId,
    paddlePriceId: result.paddlePriceId,
  };
}
