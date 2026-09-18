"use server";

import { revalidatePath } from "next/cache";

import { trackUserEvent } from "@/lib/analytics/events";
import { getCurrentUser } from "@/lib/auth-guards";
import {
  removeWishlistItemForUser,
  toggleWishlistForUser,
  type WishlistFailure,
  type WishlistResult,
} from "@/lib/wishlist/mutations";

/**
 * The wishlist is account-bound by design — it should survive a device change,
 * which a cookie-based guest list would not. Signed-out shoppers are told to
 * sign in rather than silently losing the item.
 *
 * These are the only wishlist endpoints. Each takes the user from the session
 * and passes it to `lib/wishlist/mutations.ts`; no argument a request supplies
 * can name a different user.
 */

/**
 * Toggle a product, or — when `saved` is given — set it to that state.
 *
 * `saved` is optional, so existing callers that pass only the product id keep
 * the original toggle. Passing the intended state makes repeated or concurrent
 * requests converge on it.
 */
export async function toggleWishlist(
  productId: string,
  saved?: boolean,
): Promise<WishlistResult> {
  const user = await getCurrentUser();
  const result = await toggleWishlistForUser(user, productId, saved);
  if (result.ok) revalidatePath("/account/wishlist");

  // A save that actually happened is recorded after the response. Removals
  // are not events: current state lives in WishlistItem.
  if (result.ok && result.data.added && user) {
    trackUserEvent("WISHLIST_ADD", productId, user);
  }
  return result;
}

export async function removeFromWishlist(
  productId: string,
): Promise<{ ok: true } | WishlistFailure> {
  const result = await removeWishlistItemForUser(await getCurrentUser(), productId);
  if (!result.ok) return result;

  revalidatePath("/account/wishlist");
  return { ok: true };
}
