import { NextResponse } from "next/server";

import { getCartWithCoupon } from "@/lib/cart/cart-service";

/**
 * Current cart for the header drawer.
 *
 * Scoped implicitly to the caller: the cart is resolved from their session or
 * their httpOnly guest cookie, so there is no id to tamper with.
 */
export async function GET() {
  try {
    const cart = await getCartWithCoupon();
    return NextResponse.json(cart, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[api/cart]", error);
    return NextResponse.json({ error: "Unable to load your bag." }, { status: 500 });
  }
}
