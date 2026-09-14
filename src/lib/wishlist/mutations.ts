import "server-only";

import { prisma } from "@/lib/prisma";
import { wishlistMutationSchema } from "@/lib/validations/commerce";

/**
 * Wishlist writes, for one already-identified user.
 *
 * ── Why this is not the server-action file ─────────────────────────────────
 *
 * Every export of a `"use server"` module is an endpoint the browser can call
 * with arguments of its choosing. These functions take the user as a
 * parameter, so exposing them that way would let a request name any user.
 * They live here, server-only, and `lib/actions/wishlist.ts` calls them with
 * the user taken from the session — the only place a user ever comes from.
 *
 * ── Why the writes cannot race ─────────────────────────────────────────────
 *
 * The original toggle read the row, then deleted or created it. Two requests
 * close together — a double click, a second tab, the product page's second
 * heart — could both read "not saved" and both create, and the loser hit the
 * unique constraint as an unhandled error.
 *
 * Each operation is now a single statement the database settles on its own:
 *
 *   save    INSERT … ON CONFLICT DO NOTHING (`createMany` + `skipDuplicates`).
 *           A second save of the same product is a no-op, not an error.
 *   remove  one `deleteMany` scoped to this user's wishlist. Removing
 *           something already gone deletes nothing and still succeeds.
 *
 * The `(wishlistId, productId)` unique constraint stays as the backstop. When
 * the caller says which state it wants, repeated or concurrent requests all
 * converge on it.
 */

export type WishlistFailure = { ok: false; error: string; requiresSignIn?: true };
export type WishlistResult<T = { added: boolean }> = { ok: true; data: T } | WishlistFailure;

/** The user the session identified, or null when signed out. */
export type WishlistUser = { id: string } | null;

/** The delegates these writes use; a test can supply a failing stand-in. */
export type WishlistDb = Pick<typeof prisma, "product" | "wishlist" | "wishlistItem">;

const SIGN_IN_TO_SAVE = "Sign in to save items to your wishlist.";
const SIGN_IN_TO_MANAGE = "Sign in to manage your wishlist.";
const INVALID_PRODUCT = "That product isn't valid.";
const UNAVAILABLE = "That product is no longer available.";
const FAILED = "We couldn't update your wishlist. Please try again.";

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
  console.error(`[wishlist] ${operation} failed:`, kind, errorCode(error) ?? "");
}

/**
 * The user's wishlist id, creating the wishlist on first use.
 *
 * Created the same way items are saved — `createMany` with `skipDuplicates`,
 * an INSERT … ON CONFLICT DO NOTHING — rather than `upsert`. Two first-ever
 * saves arriving together made `upsert` collide on the `userId` unique
 * constraint; that was recovered from, but the client still logged a
 * constraint error for a perfectly normal event. With ON CONFLICT neither
 * request errors, and the constraint remains as the backstop.
 */
async function wishlistIdFor(db: WishlistDb, userId: string): Promise<string> {
  const existing = await db.wishlist.findUnique({ where: { userId }, select: { id: true } });
  if (existing) return existing.id;

  await db.wishlist.createMany({ data: [{ userId }], skipDuplicates: true });

  const created = await db.wishlist.findUnique({ where: { userId }, select: { id: true } });
  if (!created) throw new Error("Wishlist could not be resolved.");
  return created.id;
}

async function save(db: WishlistDb, userId: string, productId: string): Promise<WishlistResult> {
  // Only a published product may be newly saved. Existence and publication are
  // one check with one message, so the response does not reveal whether an
  // unpublished product id exists.
  const product = await db.product.findFirst({
    where: { id: productId, isActive: true },
    select: { id: true },
  });
  if (!product) return { ok: false, error: UNAVAILABLE };

  const wishlistId = await wishlistIdFor(db, userId);
  await db.wishlistItem.createMany({
    data: [{ wishlistId, productId }],
    skipDuplicates: true,
  });

  return { ok: true, data: { added: true } };
}

/** Removes the product from this user's wishlist only; a no-op if absent. */
function deleteForUser(db: WishlistDb, userId: string, productId: string) {
  return db.wishlistItem.deleteMany({ where: { productId, wishlist: { userId } } });
}

/**
 * Save, remove or toggle a product on the user's wishlist.
 *
 * `saved` true saves, false removes, and omitted toggles — deleting if present
 * in one statement, otherwise saving. `data.added` is the resulting state.
 */
export async function toggleWishlistForUser(
  user: WishlistUser,
  productId: unknown,
  saved?: unknown,
  db: WishlistDb = prisma,
): Promise<WishlistResult> {
  if (!user) return { ok: false, error: SIGN_IN_TO_SAVE, requiresSignIn: true };

  const parsed = wishlistMutationSchema.safeParse({ productId, saved });
  if (!parsed.success) return { ok: false, error: INVALID_PRODUCT };
  const { productId: id, saved: desired } = parsed.data;

  try {
    if (desired === true) return await save(db, user.id, id);

    if (desired === false) {
      await deleteForUser(db, user.id, id);
      return { ok: true, data: { added: false } };
    }

    const { count } = await deleteForUser(db, user.id, id);
    if (count > 0) return { ok: true, data: { added: false } };
    return await save(db, user.id, id);
  } catch (error) {
    logFailure("toggle", error);
    return { ok: false, error: FAILED };
  }
}

/** Remove a product from the user's wishlist. Already-removed is a success. */
export async function removeWishlistItemForUser(
  user: WishlistUser,
  productId: unknown,
  db: WishlistDb = prisma,
): Promise<WishlistResult> {
  if (!user) return { ok: false, error: SIGN_IN_TO_MANAGE, requiresSignIn: true };

  const parsed = wishlistMutationSchema.safeParse({ productId });
  if (!parsed.success) return { ok: false, error: INVALID_PRODUCT };

  try {
    await deleteForUser(db, user.id, parsed.data.productId);
    return { ok: true, data: { added: false } };
  } catch (error) {
    logFailure("remove", error);
    return { ok: false, error: FAILED };
  }
}
