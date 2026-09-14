import "server-only";

import type { ProjectStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { hasSuccessfulProjectPurchase } from "@/lib/projects/purchase";
import { allowProjectAttempt, type ProjectAttempt } from "@/lib/projects/throttle";
import {
  customerProjectStorage,
  type CustomerProjectStorage,
  type SignedProjectUpload,
  type VerifiedProjectImage,
} from "@/lib/storage/customer-projects";
import {
  projectDeleteSchema,
  projectSubmissionSchema,
  projectUpdateSchema,
  projectUploadRequestSchema,
} from "@/lib/validations/commerce";

/**
 * Customer project writes.
 *
 * ── Why this is not a server-action file ───────────────────────────────────
 *
 * Every export of a `"use server"` module is an endpoint the browser can call
 * with arguments of its choosing. Nothing here takes a user id at all: each
 * function resolves the signed-in user itself, from the session, and the only
 * thing a caller can supply is the payload. The dependency seam exists for the
 * test harness — it lets a test stand in a session, a database, storage and a
 * limiter — and this module is `server-only`, so no browser can reach it.
 *
 * ── The rules, in the order every path applies them ─────────────────────────
 *
 *   1. A session. No session, nothing else runs.
 *   2. A strict schema. Unknown keys — a status, a user id, a folder — are
 *      refused, not stripped, so the attempt is visible as an attempt.
 *   3. The product exists and is published. Missing and unpublished share one
 *      message, so an id cannot be probed.
 *   4. The purchase — see `lib/projects/purchase.ts`. No order id is ever taken
 *      from the request.
 *   5. At most three projects per customer per product, counting PENDING,
 *      APPROVED and HIDDEN. A REJECTED project does not hold a slot; editing it
 *      back into the queue needs a free one.
 *   6. The row is created PENDING. The status is written here, as a literal,
 *      and is not part of any schema a caller can fill.
 *
 * Purchase is checked when an upload is signed, when the project is created,
 * and again — by `lib/projects/moderation.ts` — when an admin approves it.
 */

export const MAX_PROJECTS_PER_PRODUCT = 3;

/** The statuses that occupy one of a customer's three slots for a product. */
export const PROJECT_CAP_STATUSES: ProjectStatus[] = ["PENDING", "APPROVED", "HIDDEN"];

export type ProjectFailureCode =
  | "sign_in"
  | "invalid"
  | "unavailable"
  | "not_purchased"
  | "limit"
  | "rate_limited"
  | "conflict"
  | "not_found"
  | "storage"
  | "failed";

export type ProjectFailure = {
  ok: false;
  code: ProjectFailureCode;
  error: string;
  requiresSignIn?: true;
};
export type ProjectResult<T> = { ok: true; data: T } | ProjectFailure;

/** The signed-in user as the session reports it, or null. */
export type ProjectSessionUser = { id: string } | null;

/** The delegates these writes use; a test can supply a failing stand-in. */
export type ProjectDb = Pick<typeof prisma, "product" | "orderItem" | "customerProject" | "$transaction">;

type ProjectTx = Parameters<Parameters<ProjectDb["$transaction"]>[0]>[0];

export type ProjectDeps = {
  currentUser: () => Promise<ProjectSessionUser>;
  db: ProjectDb;
  storage: CustomerProjectStorage;
  allowAttempt: (kind: ProjectAttempt, userId: string) => Promise<boolean>;
};

const SIGN_IN = "Sign in to share your project.";
const INVALID_PRODUCT = "That product isn't valid.";
const INVALID_SUBMISSION = "Check the details and try again.";
const UNAVAILABLE = "That product is no longer available.";
const NOT_PURCHASED = "Only customers who have bought this pattern can share a project for it.";
const LIMIT = `You already have ${MAX_PROJECTS_PER_PRODUCT} projects shared for this pattern.`;
const TOO_MANY = "You're doing that a lot. Please wait a while and try again.";
const INVALID_UPLOAD = "That upload couldn't be used. Please upload your photo again.";
const WRONG_FORMAT = "Only JPEG, PNG and WebP photos are supported.";
const TOO_LARGE = "Photos must be 10 MB or smaller.";
const BAD_DIMENSIONS = "Photos must be at least 300 pixels on each side.";
const ALREADY_SUBMITTED = "That photo has already been submitted.";
const NOT_FOUND = "That project couldn't be found.";
const STORAGE_UNAVAILABLE = "Photo uploads aren't available right now.";
const DELETE_STORAGE_FAILED = "We couldn't remove your photo just now, so your project was kept. Please try again.";
const FAILED = "We couldn't save your project. Please try again.";

function fail(code: ProjectFailureCode, error: string): ProjectFailure {
  return code === "sign_in" ? { ok: false, code, error, requiresSignIn: true } : { ok: false, code, error };
}

/**
 * Imported lazily so the module can be loaded outside a request — by the test
 * harness — without pulling in Auth.js. In the application this is simply the
 * existing session helper.
 */
async function sessionUser(): Promise<ProjectSessionUser> {
  const { getCurrentUser } = await import("@/lib/auth-guards");
  const user = await getCurrentUser();
  return user ? { id: user.id } : null;
}

function resolveDeps(overrides?: Partial<ProjectDeps>): ProjectDeps {
  return {
    currentUser: sessionUser,
    db: prisma,
    storage: customerProjectStorage,
    allowAttempt: allowProjectAttempt,
    ...overrides,
  };
}

function errorCode(error: unknown): string | null {
  const code = typeof error === "object" && error !== null ? (error as { code?: unknown }).code : null;
  return typeof code === "string" ? code : null;
}

/**
 * Logs which operation failed and the error's class and code — never its
 * message, which for a connection failure can carry the database address.
 */
function logFailure(operation: string, error: unknown): void {
  const kind = error instanceof Error ? error.constructor.name : "unknown";
  console.error(`[projects] ${operation} failed:`, kind, errorCode(error) ?? "");
}

/** The message of the first issue on one of these fields, if any. */
function fieldMessage(issues: { path: PropertyKey[]; message: string }[], fields: string[]): string | null {
  const issue = issues.find((candidate) => fields.includes(String(candidate.path[0])));
  return issue ? issue.message.replace(/\.?$/, ".") : null;
}

function verificationMessage(reason: Exclude<VerifiedProjectImage, { ok: true }>["reason"]): string {
  switch (reason) {
    case "wrong_format":
      return WRONG_FORMAT;
    case "too_large":
      return TOO_LARGE;
    case "bad_dimensions":
      return BAD_DIMENSIONS;
    case "unavailable":
      return STORAGE_UNAVAILABLE;
    default:
      return INVALID_UPLOAD;
  }
}

/**
 * Serialise every slot-changing write for one user and product. Held until the
 * transaction ends, so a count and the insert or update that depends on it
 * cannot interleave with another request's.
 */
async function lockProjectSlots(tx: ProjectTx, userId: string, productId: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`customer-project:${userId}:${productId}`}, 0))`;
}

function slotsUsed(db: Pick<ProjectDb, "customerProject"> | ProjectTx, userId: string, productId: string) {
  return db.customerProject.count({ where: { userId, productId, status: { in: PROJECT_CAP_STATUSES } } });
}

/**
 * Rules 3–5 for one user and product. `userId` is always the session's; this
 * helper is not exported, so nothing outside the module can nominate one.
 */
async function eligibilityFailure(db: ProjectDb, userId: string, productId: string): Promise<ProjectFailure | null> {
  const product = await db.product.findUnique({ where: { id: productId }, select: { isActive: true } });
  if (!product?.isActive) return fail("unavailable", UNAVAILABLE);

  if (!(await hasSuccessfulProjectPurchase(db, userId, productId))) return fail("not_purchased", NOT_PURCHASED);

  if ((await slotsUsed(db, userId, productId)) >= MAX_PROJECTS_PER_PRODUCT) return fail("limit", LIMIT);

  return null;
}

/**
 * Same-origin check for the upload route.
 *
 * Stricter than the assistant's: a missing `Origin` is refused, not waved
 * through. Browsers send it on every POST made by `fetch`, same-origin
 * included, so its absence means the request did not come from this site's
 * own page.
 */
export function isSameOriginRequest(origin: string | null, host: string | null): boolean {
  if (!origin || !host) return false;
  try {
    const url = new URL(origin);
    return (url.protocol === "https:" || url.protocol === "http:") && url.host === host;
  } catch {
    return false;
  }
}

/** Sign one photo upload for the signed-in customer. */
export async function signProjectUploadForSession(
  input: unknown,
  overrides?: Partial<ProjectDeps>,
): Promise<ProjectResult<SignedProjectUpload>> {
  const { currentUser, db, storage, allowAttempt } = resolveDeps(overrides);

  try {
    const user = await currentUser();
    if (!user) return fail("sign_in", SIGN_IN);

    const parsed = projectUploadRequestSchema.safeParse(input);
    if (!parsed.success) {
      return fail("invalid", fieldMessage(parsed.error.issues, ["contentType", "bytes"]) ?? INVALID_PRODUCT);
    }

    if (!(await allowAttempt("sign", user.id))) return fail("rate_limited", TOO_MANY);

    const ineligible = await eligibilityFailure(db, user.id, parsed.data.productId);
    if (ineligible) return ineligible;

    if (!storage.isConfigured) return fail("storage", STORAGE_UNAVAILABLE);

    return { ok: true, data: storage.sign(user.id) };
  } catch (error) {
    logFailure("sign", error);
    return fail("failed", FAILED);
  }
}

/**
 * Turn an uploaded photo into a PENDING project for the signed-in customer.
 *
 * The key must sit under this user's own prefix, is checked against existing
 * projects before Cloudinary is asked anything (so an already-claimed photo is
 * never destroyed), and is then verified against what storage actually holds.
 * Width, height, size and format are taken from that verification, never from
 * the request.
 *
 * The claim and the cap are re-checked inside a transaction holding an
 * advisory lock on this user and product, so concurrent submissions cannot slip
 * a fourth project in between a count and an insert, and the unique key on
 * `imageKey` backs the claim.
 */
export async function createProjectForSession(
  input: unknown,
  overrides?: Partial<ProjectDeps>,
): Promise<ProjectResult<{ id: string; status: "PENDING" }>> {
  const { currentUser, db, storage, allowAttempt } = resolveDeps(overrides);

  try {
    const user = await currentUser();
    if (!user) return fail("sign_in", SIGN_IN);

    const parsed = projectSubmissionSchema.safeParse(input);
    if (!parsed.success) {
      return fail("invalid", fieldMessage(parsed.error.issues, ["caption", "displayName"]) ?? INVALID_SUBMISSION);
    }
    const { productId, imageKey } = parsed.data;
    const caption = parsed.data.caption || null;
    const displayName = parsed.data.displayName || null;

    // Local and free: a key that is not shaped as this user's is refused before
    // any database or Cloudinary work, and nothing is destroyed.
    if (!storage.isOwnedKey(imageKey, user.id)) return fail("invalid", INVALID_UPLOAD);

    if (!(await allowAttempt("submit", user.id))) return fail("rate_limited", TOO_MANY);

    const ineligible = await eligibilityFailure(db, user.id, productId);
    if (ineligible) return ineligible;

    if (await db.customerProject.findUnique({ where: { imageKey }, select: { id: true } })) {
      return fail("conflict", ALREADY_SUBMITTED);
    }

    const verified = await storage.verify(imageKey, user.id);
    if (!verified.ok) {
      return fail(verified.reason === "unavailable" ? "storage" : "invalid", verificationMessage(verified.reason));
    }
    const { width, height, bytes, format } = verified;
    const userId = user.id;

    const outcome = await db.$transaction(async (tx) => {
      await lockProjectSlots(tx, userId, productId);

      if (await tx.customerProject.findUnique({ where: { imageKey }, select: { id: true } })) {
        return "claimed" as const;
      }
      if ((await slotsUsed(tx, userId, productId)) >= MAX_PROJECTS_PER_PRODUCT) {
        return "limit" as const;
      }

      return tx.customerProject.create({
        data: {
          userId,
          productId,
          imageKey,
          width,
          height,
          bytes,
          format,
          caption,
          displayName,
          status: "PENDING",
        },
        select: { id: true },
      });
    });

    if (outcome === "claimed") return fail("conflict", ALREADY_SUBMITTED);
    if (outcome === "limit") {
      // Verified, owned by this user and claimed by nothing — and now unusable.
      await storage.remove(imageKey);
      return fail("limit", LIMIT);
    }

    return { ok: true, data: { id: outcome.id, status: "PENDING" } };
  } catch (error) {
    if (errorCode(error) === "P2002") return fail("conflict", ALREADY_SUBMITTED);
    logFailure("create", error);
    return fail("failed", FAILED);
  }
}

/**
 * Edit the words on one of the signed-in customer's own projects.
 *
 * Only the caption and display name can change: the strict schema has no
 * field for the product, the photo, the owner, the status or any moderation
 * data. The update is scoped by id *and* the session's user id in one
 * statement, so another customer's project is not refused so much as
 * unaddressable.
 *
 * Any edit sends the project back to PENDING and clears the previous decision
 * and any public reference: approved text must not be replaceable with
 * unreviewed text. Editing a REJECTED project re-enters the queue, so it needs
 * a free slot — checked under the same lock submissions use.
 */
export async function updateOwnProjectForSession(
  input: unknown,
  overrides?: Partial<ProjectDeps>,
): Promise<ProjectResult<{ id: string; status: "PENDING" }>> {
  const { currentUser, db, allowAttempt } = resolveDeps(overrides);

  try {
    const user = await currentUser();
    if (!user) return fail("sign_in", SIGN_IN);

    const parsed = projectUpdateSchema.safeParse(input);
    if (!parsed.success) {
      return fail("invalid", fieldMessage(parsed.error.issues, ["caption", "displayName"]) ?? INVALID_SUBMISSION);
    }
    const { projectId, caption, displayName } = parsed.data;
    const userId = user.id;

    if (!(await allowAttempt("submit", userId))) return fail("rate_limited", TOO_MANY);

    const existing = await db.customerProject.findFirst({
      where: { id: projectId, userId },
      select: { productId: true },
    });
    if (!existing) return fail("not_found", NOT_FOUND);

    const outcome = await db.$transaction(async (tx) => {
      await lockProjectSlots(tx, userId, existing.productId);

      const current = await tx.customerProject.findFirst({ where: { id: projectId, userId }, select: { status: true } });
      if (!current) return "missing" as const;
      if (current.status === "REJECTED" && (await slotsUsed(tx, userId, existing.productId)) >= MAX_PROJECTS_PER_PRODUCT) {
        return "limit" as const;
      }

      const { count } = await tx.customerProject.updateMany({
        where: { id: projectId, userId },
        data: {
          ...(caption !== undefined ? { caption: caption || null } : {}),
          ...(displayName !== undefined ? { displayName: displayName || null } : {}),
          status: "PENDING",
          rejectionReason: null,
          moderatedAt: null,
          moderatedById: null,
          imageUrl: null,
        },
      });
      return count === 0 ? ("missing" as const) : ("updated" as const);
    });

    if (outcome === "missing") return fail("not_found", NOT_FOUND);
    if (outcome === "limit") return fail("limit", LIMIT);
    return { ok: true, data: { id: projectId, status: "PENDING" } };
  } catch (error) {
    logFailure("update", error);
    return fail("failed", FAILED);
  }
}

/**
 * Delete one of the signed-in customer's own projects and its photo.
 *
 * ── Order, and why ────────────────────────────────────────────────────────
 *
 *   1. Find the row by id and session user; anyone else's reads as not found.
 *   2. The stored key must be a customer-project key under this user's prefix.
 *      If it is not, nothing is deleted anywhere and Cloudinary is not called.
 *   3. Remove the photo and confirm it is gone. If that fails, the row is kept
 *      and the customer is told — the project is still theirs to retry, and
 *      no row ever points at nothing without anyone knowing.
 *   4. Delete the row. If *this* fails after the photo is gone, a retry finds
 *      the row, confirms the photo is already absent, and completes.
 *
 * An already-missing photo counts as removed.
 */
export async function deleteOwnProjectForSession(
  input: unknown,
  overrides?: Partial<ProjectDeps>,
): Promise<ProjectResult<{ id: string }>> {
  const { currentUser, db, storage, allowAttempt } = resolveDeps(overrides);

  try {
    const user = await currentUser();
    if (!user) return fail("sign_in", SIGN_IN);

    const parsed = projectDeleteSchema.safeParse(input);
    if (!parsed.success) return fail("invalid", INVALID_SUBMISSION);
    const { projectId } = parsed.data;

    if (!(await allowAttempt("submit", user.id))) return fail("rate_limited", TOO_MANY);

    const project = await db.customerProject.findFirst({
      where: { id: projectId, userId: user.id },
      select: { imageKey: true },
    });
    if (!project) return fail("not_found", NOT_FOUND);

    if (!storage.isOwnedKey(project.imageKey, user.id)) {
      console.error("[projects] delete refused: stored key is not the owner's");
      return fail("invalid", NOT_FOUND);
    }

    const removed = await storage.removeOwned(project.imageKey, user.id);
    if (!removed.ok) return fail("storage", DELETE_STORAGE_FAILED);

    const { count } = await db.customerProject.deleteMany({ where: { id: projectId, userId: user.id } });
    if (count === 0) return fail("not_found", NOT_FOUND);

    return { ok: true, data: { id: projectId } };
  } catch (error) {
    logFailure("delete", error);
    return fail("failed", FAILED);
  }
}
