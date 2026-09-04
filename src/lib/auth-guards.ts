import "server-only";

import { redirect, notFound } from "next/navigation";
import { cache } from "react";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/generated/prisma/enums";

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: Role;
};

/**
 * The single source of truth for "who is making this request".
 *
 * Cached per-request so a page that guards itself and also renders a header
 * does not re-verify the JWT several times.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth();
  if (!session?.user?.id) return null;

  return {
    id: session.user.id,
    email: session.user.email ?? "",
    name: session.user.name ?? null,
    image: session.user.image ?? null,
    role: session.user.role ?? "CUSTOMER",
  };
});

/**
 * Require a signed-in user. Redirects to login, preserving the intended
 * destination. Use at the top of any private page, action or route handler.
 */
export async function requireUser(callbackUrl?: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    const target = callbackUrl
      ? `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`
      : "/login";
    redirect(target);
  }
  return user;
}

/**
 * Is the caller an admin *right now*, according to the database?
 *
 * Sessions are JWTs with a thirty-day life and `role` is written into the token
 * when it is issued, so the copy on the session says what was true at sign-in
 * and nothing more. Revoking someone's admin rights in the database therefore
 * revoked nothing: their existing token still claimed ADMIN and went on
 * claiming it until they signed in again or the month elapsed. For an
 * offboarded administrator that is a month of continued access to customer
 * records, orders and every destructive action in the panel.
 *
 * The token still says *who* is asking — that part is signed and cannot be
 * forged. The row says what they may *do*.
 *
 * Both admin entry points go through here, so pages and server actions get the
 * same answer; a fix applied only to actions would still leave a demoted admin
 * able to read every admin screen. `cache` makes it one query per request no
 * matter how many guards run during a render.
 *
 * Failure is denial. A guard that opens when the database is unreachable is
 * not a guard, and the cost of the safe direction is an admin seeing an error
 * for as long as the outage lasts.
 */
const verifyAdminRole = cache(async (userId: string): Promise<boolean> => {
  try {
    const fresh = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    // A missing row denies too: a deleted account must not keep acting on the
    // strength of a token that outlived it.
    return fresh?.role === "ADMIN";
  } catch (error) {
    console.error("[auth] could not verify admin role for", userId, error);
    return false;
  }
});

/**
 * Require an admin. Signed-out users go to login; signed-in non-admins get a
 * 404 rather than a 403 so the existence of the admin area is not confirmed.
 */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?callbackUrl=%2Fadmin");
  if (user.role !== "ADMIN") notFound();
  if (!(await verifyAdminRole(user.id))) notFound();
  return user;
}

/** Non-redirecting variant for server actions that return typed errors. */
export async function getAdminOrNull(): Promise<SessionUser | null> {
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") return null;
  return (await verifyAdminRole(user.id)) ? user : null;
}
