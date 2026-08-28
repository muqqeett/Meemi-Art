import "server-only";

import { redirect, notFound } from "next/navigation";
import { cache } from "react";

import { auth } from "@/auth";
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
 * Require an admin. Signed-out users go to login; signed-in non-admins get a
 * 404 rather than a 403 so the existence of the admin area is not confirmed.
 */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?callbackUrl=%2Fadmin");
  if (user.role !== "ADMIN") notFound();
  return user;
}

/** Non-redirecting variant for server actions that return typed errors. */
export async function getAdminOrNull(): Promise<SessionUser | null> {
  const user = await getCurrentUser();
  return user?.role === "ADMIN" ? user : null;
}
