"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-guards";
import type { ActionResult } from "@/lib/actions/cart";

/**
 * The wishlist is account-bound by design — it should survive a device change,
 * which a cookie-based guest list would not. Signed-out shoppers are told to
 * sign in rather than silently losing the item.
 */
export async function toggleWishlist(
  productId: string,
): Promise<ActionResult<{ added: boolean }>> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, error: "Sign in to save items to your wishlist." };
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true },
  });
  if (!product) return { ok: false, error: "That product no longer exists." };

  const wishlist = await prisma.wishlist.upsert({
    where: { userId: user.id },
    create: { userId: user.id },
    update: {},
    select: { id: true },
  });

  const existing = await prisma.wishlistItem.findUnique({
    where: { wishlistId_productId: { wishlistId: wishlist.id, productId } },
    select: { id: true },
  });

  if (existing) {
    await prisma.wishlistItem.delete({ where: { id: existing.id } });
    revalidatePath("/account/wishlist");
    return { ok: true, data: { added: false } };
  }

  await prisma.wishlistItem.create({
    data: { wishlistId: wishlist.id, productId },
  });
  revalidatePath("/account/wishlist");
  return { ok: true, data: { added: true } };
}

export async function removeFromWishlist(productId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in to manage your wishlist." };

  const wishlist = await prisma.wishlist.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });
  if (!wishlist) return { ok: true };

  await prisma.wishlistItem.deleteMany({
    where: { wishlistId: wishlist.id, productId },
  });

  revalidatePath("/account/wishlist");
  return { ok: true };
}
