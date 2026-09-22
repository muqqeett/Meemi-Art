"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { adminOrDenied } from "@/lib/actions/admin/guard";
import { markAllRead, markRead, notificationTarget } from "@/lib/notifications/feed";

/**
 * The notification page's three buttons: mark one read, mark all read, and
 * open (mark read, then go where the notification points).
 *
 * Each is a separate entry point that anyone who knows its id could call, so
 * each re-checks the admin itself rather than trusting the layout to have
 * run. The verified admin is then handed to the feed, so the session is not
 * resolved twice. They take `FormData` so the page works as plain forms, with
 * no client JavaScript. A caller who is not an admin is sent to /admin, where
 * the admin layout answers with a 404 — the same as every other admin route.
 */

/** The bell lives in the admin layout, so every admin page shows the new count. */
function refresh() {
  revalidatePath("/admin", "layout");
}

export async function markNotificationReadAction(formData: FormData): Promise<void> {
  const { admin, denied } = await adminOrDenied();
  if (denied) redirect("/admin");

  await markRead(formData.get("id"), { currentAdmin: async () => admin });
  refresh();
}

export async function markAllNotificationsReadAction(): Promise<void> {
  const { admin, denied } = await adminOrDenied();
  if (denied) redirect("/admin");

  await markAllRead({ currentAdmin: async () => admin });
  refresh();
}

/**
 * Mark read and follow the link. The destination is read from the stored row
 * and re-validated as an internal admin path — never taken from the form — so
 * this cannot be turned into an open redirect.
 */
export async function openNotificationAction(formData: FormData): Promise<void> {
  const { admin, denied } = await adminOrDenied();
  if (denied) redirect("/admin");

  const id = formData.get("id");
  const target = await notificationTarget(id, { currentAdmin: async () => admin });
  if (target.ok) await markRead(id, { currentAdmin: async () => admin });
  refresh();
  redirect(target.ok && target.data.href ? target.data.href : "/admin/notifications");
}
