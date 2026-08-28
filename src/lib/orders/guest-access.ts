import "server-only";

import { cookies } from "next/headers";

const GUEST_ORDERS_COOKIE = "mh_orders";
const MAX_REMEMBERED = 10;

/**
 * Guests have no account to authorise against, but they still need to see the
 * confirmation for the order they just placed.
 *
 * Rather than making order numbers themselves the secret — they are short and
 * guessable — the ids of orders placed in this browser are recorded in an
 * httpOnly cookie. The order page grants access to the owning account, or to a
 * browser that holds the id.
 */
export async function rememberGuestOrder(orderId: string): Promise<void> {
  const cookieStore = await cookies();
  const existing = cookieStore.get(GUEST_ORDERS_COOKIE)?.value ?? "";

  const ids = [orderId, ...existing.split(",").filter(Boolean)]
    .filter((id, index, all) => all.indexOf(id) === index)
    .slice(0, MAX_REMEMBERED);

  cookieStore.set(GUEST_ORDERS_COOKIE, ids.join(","), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
}

export async function getRememberedOrderIds(): Promise<string[]> {
  const cookieStore = await cookies();
  const value = cookieStore.get(GUEST_ORDERS_COOKIE)?.value ?? "";
  return value.split(",").filter(Boolean);
}
