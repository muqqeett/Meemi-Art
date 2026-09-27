"use server";

import { redirect } from "next/navigation";

import { deleteArticle, publishArticle, unpublishArticle } from "@/lib/actions/admin/articles";

/**
 * Form wrappers for the article list and preview.
 *
 * `<form action>` wants an action that returns nothing, while the actions
 * themselves return a result the editor uses. These adapt one to the other
 * without duplicating a single rule: each simply calls the real action, which
 * re-checks the admin and records the audit entry itself.
 */

async function idFrom(formData: FormData): Promise<string> {
  const id = formData.get("id");
  return typeof id === "string" ? id : "";
}

export async function publishArticleAction(formData: FormData): Promise<void> {
  const result = await publishArticle(await idFrom(formData));
  // A refusal (too short, no sections) is shown on the article's own page,
  // where the editor can act on it.
  if (!result.ok) redirect(`/admin/content/articles?error=${encodeURIComponent(result.error)}`);
}

export async function unpublishArticleAction(formData: FormData): Promise<void> {
  await unpublishArticle(await idFrom(formData));
}

export async function deleteArticleAction(formData: FormData): Promise<void> {
  const result = await deleteArticle(await idFrom(formData));
  if (result.ok) redirect("/admin/content/articles");
}

export async function createTopicAction(formData: FormData): Promise<void> {
  const { createTopic } = await import("@/lib/actions/admin/articles");
  const raw = {
    name: String(formData.get("name") ?? ""),
    slug: String(formData.get("slug") ?? ""),
    description: String(formData.get("description") ?? ""),
    sortOrder: Number(formData.get("sortOrder") ?? 0) || 0,
  };
  const result = await createTopic(raw);
  if (!result.ok) redirect(`/admin/content/topics?error=${encodeURIComponent(result.error)}`);
}

export async function deleteTopicAction(formData: FormData): Promise<void> {
  const { deleteTopic } = await import("@/lib/actions/admin/articles");
  const id = formData.get("id");
  const result = await deleteTopic(typeof id === "string" ? id : "");
  if (!result.ok) redirect(`/admin/content/topics?error=${encodeURIComponent(result.error)}`);
}
