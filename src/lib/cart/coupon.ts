import "server-only";

import { cookies } from "next/headers";

import { prisma } from "@/lib/prisma";
import type { AppliedCoupon } from "@/lib/cart/totals";

const COUPON_COOKIE = "mh_coupon";

export type CouponResult =
  | { ok: true; coupon: AppliedCoupon }
  | { ok: false; error: string };

/**
 * Validate a coupon against the live record. Every rule is checked here, on the
 * server — the client only ever receives the resolved discount.
 */
export async function validateCoupon(
  rawCode: string,
  subtotalCents: number,
): Promise<CouponResult> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return { ok: false, error: "Enter a coupon code." };

  const coupon = await prisma.coupon.findUnique({ where: { code } });

  // Deliberately identical message for "missing" and "inactive" so the endpoint
  // cannot be used to enumerate which codes exist.
  if (!coupon || !coupon.isActive) {
    return { ok: false, error: "That coupon code isn't valid." };
  }

  const now = new Date();
  if (coupon.startsAt > now) {
    return { ok: false, error: "That coupon isn't active yet." };
  }
  if (coupon.expiresAt && coupon.expiresAt < now) {
    return { ok: false, error: "That coupon has expired." };
  }
  if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
    return { ok: false, error: "That coupon has reached its usage limit." };
  }
  if (subtotalCents < coupon.minOrderCents) {
    const shortfall = (coupon.minOrderCents - subtotalCents) / 100;
    return {
      ok: false,
      error: `Spend $${shortfall.toFixed(2)} more to use this coupon.`,
    };
  }

  return {
    ok: true,
    coupon: {
      id: coupon.id,
      code: coupon.code,
      type: coupon.type,
      value: coupon.value,
      minOrderCents: coupon.minOrderCents,
    },
  };
}

/** The code the shopper has applied, if any. Re-validated on every read. */
export async function getAppliedCoupon(
  subtotalCents: number,
): Promise<AppliedCoupon | null> {
  const cookieStore = await cookies();
  const code = cookieStore.get(COUPON_COOKIE)?.value;
  if (!code) return null;

  const result = await validateCoupon(code, subtotalCents);
  return result.ok ? result.coupon : null;
}

export async function setAppliedCoupon(code: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COUPON_COOKIE, code.toUpperCase(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });
}

export async function clearAppliedCoupon(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COUPON_COOKIE);
}
