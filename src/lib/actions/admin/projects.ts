"use server";

import { revalidatePath } from "next/cache";

import {
  approveProjectAsAdmin,
  hideProjectAsAdmin,
  rejectProjectAsAdmin,
  type ModerationResult,
} from "@/lib/projects/moderation";

/**
 * Customer project moderation actions.
 *
 * Thin wrappers: the admin check (against the database), the transition
 * table, the approval-time purchase re-check and the activity log all live in
 * `lib/projects/moderation.ts`. The homepage shows no projects and is never
 * revalidated from here.
 */

function revalidateProject(result: ModerationResult) {
  if (!result.ok) return;
  revalidatePath("/admin/projects");
  revalidatePath(`/products/${result.data.productSlug}`);
}

export async function approveProject(projectId: string): Promise<ModerationResult> {
  const result = await approveProjectAsAdmin({ projectId });
  revalidateProject(result);
  return result;
}

export async function rejectProject(projectId: string, reason: string): Promise<ModerationResult> {
  const result = await rejectProjectAsAdmin({ projectId, reason });
  revalidateProject(result);
  return result;
}

export async function hideProject(projectId: string): Promise<ModerationResult> {
  const result = await hideProjectAsAdmin({ projectId });
  revalidateProject(result);
  return result;
}
