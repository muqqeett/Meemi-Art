"use server";

import { revalidatePath } from "next/cache";

import {
  deleteOwnProjectForSession,
  updateOwnProjectForSession,
  type ProjectResult,
} from "@/lib/projects/mutations";

/**
 * Customer project actions.
 *
 * Thin wrappers, as for the wishlist: every rule — session, ownership, cap,
 * storage — lives in `lib/projects/mutations.ts`, which resolves the user from
 * the session itself. These take only the project's words or its id.
 * Submission is not here: it goes through `/api/projects/upload`, beside the
 * direct upload it completes.
 */

export async function updateMyProject(input: {
  projectId: string;
  caption?: string | null;
  displayName?: string | null;
}): Promise<ProjectResult<{ id: string; status: "PENDING" }>> {
  const result = await updateOwnProjectForSession(input);
  if (result.ok) revalidatePath("/account/projects");
  return result;
}

export async function deleteMyProject(input: { projectId: string }): Promise<ProjectResult<{ id: string }>> {
  const result = await deleteOwnProjectForSession(input);
  if (result.ok) revalidatePath("/account/projects");
  return result;
}
