import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-guards";
import { calculateTotals, type AppliedCoupon, type OrderTotals } from "@/lib/cart/totals";
import { getAppliedCoupon } from "@/lib/cart/coupon";

const GUEST_CART_COOKIE = "mh_cart";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export type CartLineView = {
  id: string;
  productId: string;
  name: string;
  slug: string;
  brand: string;
  sku: string;
  imageUrl: string | null;
  unitPriceCents: number;
  compareAtCents: number | null;
  quantity: number;
  /**
   * Whether the line can still be bought. A digital product has no stock, so
   * this only asks whether it is still published and still has a file behind
   * it — a product whose asset was removed cannot be delivered.
   */
  isAvailable: boolean;
  lineTotalCents: number;
};

export type CartView = {
  id: string | null;
  lines: CartLineView[];
  itemCount: number;
  totals: OrderTotals;
  coupon: AppliedCoupon | null;
};

const EMPTY_CART: CartView = {
  id: null,
  lines: [],
  itemCount: 0,
  totals: calculateTotals({ lines: [] }),
  coupon: null,
};

/**
 * Resolve the current cart id without creating anything — safe to call during
 * rendering, where writing a cookie is not allowed.
 */
async function resolveCartId(): Promise<string | null> {
  const user = await getCurrentUser();

  if (user) {
    const cart = await prisma.cart.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    return cart?.id ?? null;
  }

  const cookieStore = await cookies();
  const guestId = cookieStore.get(GUEST_CART_COOKIE)?.value;
  if (!guestId) return null;

  const cart = await prisma.cart.findFirst({
    where: { id: guestId, userId: null },
    select: { id: true },
  });
  return cart?.id ?? null;
}

/**
 * Resolve or create the cart. Only call from a server action or route handler —
 * it sets a cookie for guests, which React forbids during render.
 */
export async function getOrCreateCartId(): Promise<string> {
  const user = await getCurrentUser();

  if (user) {
    const existing = await prisma.cart.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (existing) return existing.id;

    const created = await prisma.cart.create({
      data: { userId: user.id },
      select: { id: true },
    });
    return created.id;
  }

  const cookieStore = await cookies();
  const guestId = cookieStore.get(GUEST_CART_COOKIE)?.value;

  if (guestId) {
    const existing = await prisma.cart.findFirst({
      where: { id: guestId, userId: null },
      select: { id: true },
    });
    if (existing) return existing.id;
  }

  const created = await prisma.cart.create({ data: {}, select: { id: true } });
  cookieStore.set(GUEST_CART_COOKIE, created.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
  return created.id;
}

/**
 * Read the current cart with prices, stock and totals resolved server-side.
 * Cached per request so the header badge and the page body share one query.
 */
export const getCart = cache(async (coupon?: AppliedCoupon | null): Promise<CartView> => {
  const cartId = await resolveCartId();
  if (!cartId) return EMPTY_CART;

  const items = await prisma.cartItem.findMany({
    where: { cartId },
    orderBy: { createdAt: "asc" },
    include: {
      product: {
        include: {
          images: { orderBy: { sortOrder: "asc" }, take: 1 },
          // Selected as a boolean only. `storageKey` must never travel to a
          // page, so the asset is checked for existence and nothing more.
          asset: { select: { id: true } },
        },
      },
    },
  });

  const lines: CartLineView[] = items.map((item) => {
    const { product } = item;
    const unitPriceCents = product.priceCents;

    return {
      id: item.id,
      productId: product.id,
      name: product.name,
      slug: product.slug,
      brand: product.brand,
      sku: product.sku,
      imageUrl: product.images[0]?.url ?? null,
      unitPriceCents,
      compareAtCents: product.compareAtCents,
      quantity: item.quantity,
      isAvailable: product.isActive && product.asset !== null,
      lineTotalCents: unitPriceCents * item.quantity,
    };
  });

  return {
    id: cartId,
    lines,
    itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
    totals: calculateTotals({ lines, coupon }),
    coupon: coupon ?? null,
  };
});

/**
 * The cart with any applied coupon resolved and re-validated against the live
 * subtotal. This is what the cart page and checkout render from.
 */
export async function getCartWithCoupon(): Promise<CartView> {
  const base = await getCart();
  if (base.lines.length === 0) return base;

  const coupon = await getAppliedCoupon(base.totals.subtotalCents);
  return coupon ? getCart(coupon) : base;
}

/** Lightweight count for the header badge. */
export const getCartCount = cache(async (): Promise<number> => {
  const cartId = await resolveCartId();
  if (!cartId) return 0;

  const result = await prisma.cartItem.aggregate({
    where: { cartId },
    _sum: { quantity: true },
  });
  return result._sum.quantity ?? 0;
});

/**
 * Fold a guest cart into the user's cart after sign-in, summing quantities for
 * products present in both. Called from the login action.
 */
export async function mergeGuestCartIntoUser(userId: string): Promise<void> {
  const cookieStore = await cookies();
  const guestId = cookieStore.get(GUEST_CART_COOKIE)?.value;
  if (!guestId) return;

  const guestCart = await prisma.cart.findFirst({
    where: { id: guestId, userId: null },
    include: { items: true },
  });
  if (!guestCart) return;

  if (guestCart.items.length > 0) {
    const userCart = await prisma.cart.upsert({
      where: { userId },
      create: { userId },
      update: {},
      select: { id: true },
    });

    for (const item of guestCart.items) {
      await prisma.cartItem.upsert({
        where: {
          cartId_productId: { cartId: userCart.id, productId: item.productId },
        },
        create: {
          cartId: userCart.id,
          productId: item.productId,
          quantity: item.quantity,
        },
        update: { quantity: { increment: item.quantity } },
      });
    }
  }

  await prisma.cart.delete({ where: { id: guestCart.id } });
  cookieStore.delete(GUEST_CART_COOKIE);
}

export async function clearGuestCartCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(GUEST_CART_COOKIE);
}
