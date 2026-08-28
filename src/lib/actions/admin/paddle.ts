"use server";

import { revalidatePath } from "next/cache";

import { getAdminOrNull } from "@/lib/auth-guards";
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
  | { ok: true; message: string }
  | { ok: false; error: string };

async function assertAdmin(): Promise<SyncResult | null> {
  const admin = await getAdminOrNull();
  if (!admin) return { ok: false, error: "You don't have permission to do that." };
  return null;
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
  const denied = (await assertAdmin()) ?? assertPaddle();
  if (denied) return denied;

  const results = await syncAllProductsToPaddle();
  const failed = results.filter((result) => !result.ok);
  const changed = results.filter(
    (result) => result.ok && result.action !== "unchanged",
  ).length;

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

export async function syncOneProductToPaddle(productId: string): Promise<SyncResult> {
  const denied = (await assertAdmin()) ?? assertPaddle();
  if (denied) return denied;

  const result = await syncProductToPaddle(productId);

  revalidatePath("/admin/settings");
  revalidatePath("/admin/products");

  return result.ok
    ? { ok: true, message: `Synced to Paddle (${result.action}).` }
    : { ok: false, error: result.error };
}
