import "server-only";

import type { ProjectStatus } from "@/generated/prisma/enums";
import { recordActivity } from "@/lib/admin/activity";
import { prisma } from "@/lib/prisma";
import { hasSuccessfulProjectPurchase, successfulPurchaseWhere } from "@/lib/projects/purchase";
import { customerProjectStorage, type CustomerProjectStorage } from "@/lib/storage/customer-projects";
import { projectModerationSchema, projectRejectionSchema } from "@/lib/validations/commerce";

/**
 * Admin moderation of customer projects.
 *
 * ── Who may act ────────────────────────────────────────────────────────────
 *
 * The session names the caller; the database decides whether they are an
 * admin, on every call, exactly as `getAdminOrNull` does — a token that still
 * says ADMIN after the role was revoked grants nothing. Failure to read the
 * role is denial.
 *
 * ── What an action can do ──────────────────────────────────────────────────
 *
 * There is no "set status". Each action has one target and a fixed set of
 * states it may start from, below. The caller supplies a project id (and, for
 * a rejection, a reason) and nothing else — no status, no moderator, no URL.
 * The move is a conditional update on the state that was checked, so two
 * moderators acting at once cannot produce a transition the table forbids.
 *
 *   approve   PENDING            → APPROVED
 *   reject    PENDING, APPROVED  → REJECTED   (as a review can be hidden after
 *                                              being approved)
 *   hide      PENDING, APPROVED  → HIDDEN
 *
 * REJECTED and HIDDEN return to PENDING only through the customer editing
 * their project — see `updateOwnProjectForSession`.
 *
 * ── Approval ───────────────────────────────────────────────────────────────
 *
 * Re-checks that the product is still published, that the customer still has
 * a COMPLETED + PAID purchase of it (a refund since submission blocks
 * approval), and that Cloudinary still holds the photo as the expected
 * authenticated image. The purchase and publication are checked again inside
 * the conditional update itself, so a refund landing between the check and
 * the write still blocks it.
 *
 * Approval does not publish the photo. `imageUrl` stays null: making an
 * authenticated image publicly deliverable, with its Exif/GPS removed, has not
 * been verified against Cloudinary's documented behaviour — see
 * `lib/storage/customer-projects.ts`. Nothing public can show a project until
 * that lands.
 */

export type ModerationAction = "approve" | "reject" | "hide";

export const PROJECT_MODERATION_TRANSITIONS: Readonly<Record<ModerationAction, readonly ProjectStatus[]>> = {
  approve: ["PENDING"],
  reject: ["PENDING", "APPROVED"],
  hide: ["PENDING", "APPROVED"],
};

const TARGET: Record<ModerationAction, ProjectStatus> = {
  approve: "APPROVED",
  reject: "REJECTED",
  hide: "HIDDEN",
};

export type ModerationFailureCode =
  | "forbidden"
  | "invalid"
  | "not_found"
  | "invalid_transition"
  | "unavailable"
  | "not_eligible"
  | "asset"
  | "storage"
  | "conflict"
  | "failed";

export type ModerationFailure = { ok: false; code: ModerationFailureCode; error: string };
export type ModerationResult =
  | { ok: true; data: { id: string; status: ProjectStatus; productSlug: string; published: false } }
  | ModerationFailure;

export type ModerationDb = Pick<typeof prisma, "user" | "customerProject" | "orderItem">;

export type ModerationDeps = {
  currentUser: () => Promise<{ id: string } | null>;
  db: ModerationDb;
  storage: CustomerProjectStorage;
  recordActivity: typeof recordActivity;
  now: () => Date;
};

const FORBIDDEN = "You don't have permission to do that.";
const INVALID = "Check the details and try again.";
const NOT_FOUND = "That project no longer exists.";
const INVALID_TRANSITION: Record<ModerationAction, string> = {
  approve: "Only a pending project can be approved.",
  reject: "Only a pending or approved project can be rejected.",
  hide: "Only a pending or approved project can be hidden.",
};
const PRODUCT_UNAVAILABLE = "The product isn't published, so this project can't be approved.";
const NOT_ELIGIBLE = "This project isn't eligible for approval.";
const ASSET_MISSING = "The project photo is missing, so it can't be approved.";
const ASSET_INVALID = "The project photo couldn't be verified, so it can't be approved.";
const STORAGE_UNAVAILABLE = "Photo storage isn't available right now. Please try again.";
const CONFLICT = "That project changed while you were looking at it. Refresh and try again.";
const FAILED = "Couldn't update that project.";

function fail(code: ModerationFailureCode, error: string): ModerationFailure {
  return { ok: false, code, error };
}

async function sessionUser(): Promise<{ id: string } | null> {
  const { getCurrentUser } = await import("@/lib/auth-guards");
  const user = await getCurrentUser();
  return user ? { id: user.id } : null;
}

function resolveDeps(overrides?: Partial<ModerationDeps>): ModerationDeps {
  return {
    currentUser: sessionUser,
    db: prisma,
    storage: customerProjectStorage,
    recordActivity,
    now: () => new Date(),
    ...overrides,
  };
}

/** The acting admin, confirmed against the database. Any failure is denial. */
async function confirmedAdmin(deps: ModerationDeps): Promise<{ id: string } | null> {
  try {
    const user = await deps.currentUser();
    if (!user) return null;
    const row = await deps.db.user.findUnique({ where: { id: user.id }, select: { role: true } });
    return row?.role === "ADMIN" ? { id: user.id } : null;
  } catch {
    return null;
  }
}

function errorCode(error: unknown): string | null {
  const code = typeof error === "object" && error !== null ? (error as { code?: unknown }).code : null;
  return typeof code === "string" ? code : null;
}

function logFailure(action: ModerationAction, error: unknown): void {
  const kind = error instanceof Error ? error.constructor.name : "unknown";
  console.error(`[projects] moderation ${action} failed:`, kind, errorCode(error) ?? "");
}

async function moderate(action: ModerationAction, input: unknown, overrides?: Partial<ModerationDeps>): Promise<ModerationResult> {
  const deps = resolveDeps(overrides);
  const { db, storage } = deps;

  const admin = await confirmedAdmin(deps);
  if (!admin) return fail("forbidden", FORBIDDEN);

  let projectId: string;
  let reason: string | null = null;
  if (action === "reject") {
    const parsed = projectRejectionSchema.safeParse(input);
    if (!parsed.success) {
      const issue = parsed.error.issues.find((candidate) => candidate.path[0] === "reason");
      return fail("invalid", issue ? issue.message.replace(/\.?$/, ".") : INVALID);
    }
    projectId = parsed.data.projectId;
    reason = parsed.data.reason;
  } else {
    const parsed = projectModerationSchema.safeParse(input);
    if (!parsed.success) return fail("invalid", INVALID);
    projectId = parsed.data.projectId;
  }

  try {
    const project = await db.customerProject.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        userId: true,
        productId: true,
        imageKey: true,
        status: true,
        product: { select: { name: true, slug: true, isActive: true } },
      },
    });
    if (!project) return fail("not_found", NOT_FOUND);

    const from = PROJECT_MODERATION_TRANSITIONS[action];
    if (!from.includes(project.status)) return fail("invalid_transition", INVALID_TRANSITION[action]);

    if (action === "approve") {
      if (!project.product.isActive) return fail("unavailable", PRODUCT_UNAVAILABLE);
      // Deliberately one generic message: the admin screen does not need to
      // learn, and must never pass on, what happened to the order or payment.
      if (!(await hasSuccessfulProjectPurchase(db, project.userId, project.productId))) {
        return fail("not_eligible", NOT_ELIGIBLE);
      }
      const asset = await storage.inspect(project.imageKey, project.userId);
      if (!asset.ok) {
        if (asset.reason === "unavailable") return fail("storage", STORAGE_UNAVAILABLE);
        return fail("asset", asset.reason === "not_found" ? ASSET_MISSING : ASSET_INVALID);
      }
    }

    const target = TARGET[action];
    const { count } = await db.customerProject.updateMany({
      where: {
        id: project.id,
        status: { in: [...from] },
        ...(action === "approve"
          ? {
              product: {
                isActive: true,
                orderItems: { some: successfulPurchaseWhere(project.userId, project.productId) },
              },
            }
          : {}),
      },
      data: {
        status: target,
        moderatedAt: deps.now(),
        moderatedById: admin.id,
        rejectionReason: reason,
        // Never set here: nothing is published yet, and a hidden or rejected
        // project must not keep a public reference.
        imageUrl: null,
      },
    });
    if (count === 0) {
      return action === "approve" ? fail("conflict", `${CONFLICT} ${NOT_ELIGIBLE}`) : fail("conflict", CONFLICT);
    }

    await deps.recordActivity({
      actorId: admin.id,
      action: `project.${target.toLowerCase()}`,
      entityType: "project",
      entityId: project.id,
      meta: {
        product: project.product.name,
        from: project.status,
        to: target,
        ...(reason ? { reason } : {}),
        ...(action === "approve" ? { published: false } : {}),
      },
    });

    return { ok: true, data: { id: project.id, status: target, productSlug: project.product.slug, published: false } };
  } catch (error) {
    logFailure(action, error);
    return fail("failed", FAILED);
  }
}

/** Approve a pending project. Input: `{ projectId }`. */
export function approveProjectAsAdmin(input: unknown, overrides?: Partial<ModerationDeps>): Promise<ModerationResult> {
  return moderate("approve", input, overrides);
}

/** Reject a pending or approved project. Input: `{ projectId, reason }`. */
export function rejectProjectAsAdmin(input: unknown, overrides?: Partial<ModerationDeps>): Promise<ModerationResult> {
  return moderate("reject", input, overrides);
}

/** Hide a pending or approved project. Input: `{ projectId }`. */
export function hideProjectAsAdmin(input: unknown, overrides?: Partial<ModerationDeps>): Promise<ModerationResult> {
  return moderate("hide", input, overrides);
}
