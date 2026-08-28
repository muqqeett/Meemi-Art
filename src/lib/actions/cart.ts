"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { getOrCreateCartId, getCart } from "@/lib/cart/cart-service";
import { validateCoupon, setAppliedCoupon, clearAppliedCoupon } from "@/lib/cart/coupon";
import { addToCartSchema, updateCartItemSchema, couponCodeSchema } from "@/lib/validations/commerce";
import { commerceConfig } from "@/lib/config";

export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { data?: undefined } : { data: T }))
  | { ok: false; error: string };

function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

/**
 * Whether a product can be bought right now.
 *
 * There is no stock to check — a file can be sold any number of times. What
 * can go wrong is a product that has been unpublished, or one whose digital
 * asset is missing, which would leave the buyer with nothing to download.
 */
async function isSellable(productId: string): Promise<boolean> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { isActive: true, asset: { select: { id: true } } },
  });

  return Boolean(product?.isActive && product.asset);
}

export async function addToCart(input: {
  productId: string;
  quantity: number;
}): Promise<ActionResult<{ itemCount: number }>> {
  const parsed = addToCartSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "That selection isn't valid.");
  }

  const { productId, quantity } = parsed.data;

  if (!(await isSellable(productId))) {
    return fail("That item is no longer available.");
  }

  const cartId = await getOrCreateCartId();

  const existing = await prisma.cartItem.findUnique({
    where: { cartId_productId: { cartId, productId } },
    select: { quantity: true },
  });

  const desired = (existing?.quantity ?? 0) + quantity;
  const capped = Math.min(desired, commerceConfig.maxQuantityPerItem);

  if (existing && capped === existing.quantity) {
    return fail(`Limit ${commerceConfig.maxQuantityPerItem} per item.`);
  }

  await prisma.cartItem.upsert({
    where: { cartId_productId: { cartId, productId } },
    create: { cartId, productId, quantity: capped },
    update: { quantity: capped },
  });

  revalidatePath("/cart");
  revalidatePath("/checkout");

  const cart = await prisma.cartItem.aggregate({
    where: { cartId },
    _sum: { quantity: true },
  });

  return { ok: true, data: { itemCount: cart._sum.quantity ?? 0 } };
}

export async function updateCartItem(input: {
  itemId: string;
  quantity: number;
}): Promise<ActionResult> {
  const parsed = updateCartItemSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "That quantity isn't valid.");
  }

  const { itemId, quantity } = parsed.data;
  const cartId = await getOrCreateCartId();

  // Scope by cart id so one shopper cannot mutate another's line.
  const item = await prisma.cartItem.findFirst({
    where: { id: itemId, cartId },
    select: { id: true, productId: true },
  });
  if (!item) return fail("That item is no longer in your bag.");

  if (quantity === 0) {
    await prisma.cartItem.delete({ where: { id: item.id } });
    revalidatePath("/cart");
    revalidatePath("/checkout");
    return { ok: true };
  }

  if (!(await isSellable(item.productId))) {
    await prisma.cartItem.delete({ where: { id: item.id } });
    revalidatePath("/cart");
    return fail("That item is no longer available and has been removed from your bag.");
  }

  await prisma.cartItem.update({ where: { id: item.id }, data: { quantity } });
  revalidatePath("/cart");
  revalidatePath("/checkout");
  return { ok: true };
}

export async function removeCartItem(itemId: string): Promise<ActionResult> {
  const cartId = await getOrCreateCartId();

  const item = await prisma.cartItem.findFirst({
    where: { id: itemId, cartId },
    select: { id: true },
  });
  if (!item) return fail("That item is no longer in your bag.");

  await prisma.cartItem.delete({ where: { id: item.id } });
  revalidatePath("/cart");
  revalidatePath("/checkout");
  return { ok: true };
}

export async function clearCart(): Promise<ActionResult> {
  const cartId = await getOrCreateCartId();
  await prisma.cartItem.deleteMany({ where: { cartId } });
  await clearAppliedCoupon();
  revalidatePath("/cart");
  return { ok: true };
}

export async function applyCoupon(code: string): Promise<ActionResult<{ code: string }>> {
  const parsed = couponCodeSchema.safeParse(code);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Enter a coupon code.");
  }

  const cart = await getCart();
  if (cart.lines.length === 0) return fail("Add something to your bag first.");

  const result = await validateCoupon(parsed.data, cart.totals.subtotalCents);
  if (!result.ok) return fail(result.error);

  await setAppliedCoupon(result.coupon.code);
  revalidatePath("/cart");
  revalidatePath("/checkout");

  return { ok: true, data: { code: result.coupon.code } };
}

export async function removeCoupon(): Promise<ActionResult> {
  await clearAppliedCoupon();
  revalidatePath("/cart");
  revalidatePath("/checkout");
  return { ok: true };
}
