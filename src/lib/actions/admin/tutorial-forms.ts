"use server";

import { redirect } from "next/navigation";

import { deleteTutorial, publishTutorial, unpublishTutorial } from "@/lib/actions/admin/tutorials";

/**
 * Form wrappers for the tutorial list and preview.
 *
 * `<form action>` wants an action that returns nothing, while the actions
 * themselves return a result the editor uses. These adapt one to the other
 * without duplicating a rule: each calls the real action, which re-checks the
 * admin and records the audit entry itself.
 */

function idFrom(formData: FormData): string {
  const id = formData.get("id");
  return typeof id === "string" ? id : "";
}

export async function publishTutorialAction(formData: FormData): Promise<void> {
  const result = await publishTutorial(idFrom(formData));
  // A refusal (too short, too few steps) is shown on the list, where the editor
  // can act on it.
  if (!result.ok) redirect(`/admin/content/tutorials?error=${encodeURIComponent(result.error)}`);
}

export async function unpublishTutorialAction(formData: FormData): Promise<void> {
  await unpublishTutorial(idFrom(formData));
}

export async function deleteTutorialAction(formData: FormData): Promise<void> {
  const result = await deleteTutorial(idFrom(formData));
  if (result.ok) redirect("/admin/content/tutorials");
}
