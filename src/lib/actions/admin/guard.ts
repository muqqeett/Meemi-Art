import "server-only";

import { getAdminOrNull, type SessionUser } from "@/lib/auth-guards";

/**
 * The shared shape and gate for every admin server action.
 *
 * This is a plain module rather than a `"use server"` file on purpose: it holds
 * a type and a helper, neither of which should be reachable as a remote
 * endpoint. Action files import from it; nothing here is exposed to the client.
 */

export type AdminResult<T = undefined> =
  | { ok: true; message?: string; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/**
 * Re-check the role and return who is acting.
 *
 * Every admin action calls this itself. The admin layout also guards the pages,
 * but a server action is a separate entry point — it can be invoked directly by
 * anyone who knows its id and must never rely on a layout having run.
 *
 * It returns the admin as well as the verdict because the audit log has to name
 * an actor, and a guard that only answers yes/no forces every caller to resolve
 * the session a second time.
 */
export async function adminOrDenied(): Promise<
  { admin: SessionUser; denied?: never } | { admin?: never; denied: AdminResult }
> {
  const admin = await getAdminOrNull();
  if (!admin) {
    return { denied: { ok: false, error: "You don't have permission to do that." } };
  }
  return { admin };
}
