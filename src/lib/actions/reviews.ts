"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-guards";
import {
  hasPurchasedProduct,
  syncProductRating,
} from "@/lib/queries/reviews";
import { reviewSchema, type ReviewInput } from "@/lib/validations/commerce";

/**
 * Customer review submission.
 *
 * Four guards, in order, and every one of them server-side:
 *
 *  1. A session. The user id comes from it and from nowhere else — there is no
 *     userId field on the payload for a caller to supply.
 *  2. Schema validation, so a rating is an integer 1–5 and the text is within
 *     length before it reaches the database.
 *  3. `hasPurchasedProduct`, which requires a COMPLETED order with a PAID
 *     payment containing this product. This is what stops someone reviewing a
 *     product they never bought, and it re-reads the order from the database
 *     rather than trusting anything sent with the form.
 *  4. `productId_userId` uniqueness, which the schema already enforces, so a
 *     duplicate cannot be created even under a race.
 *
 * The write is an upsert keyed on (product, user). That is what "edit your own
 * review" means here: a customer owns exactly one row per product and can
 * rewrite it. Because the key includes the session's user id, the statement
 * has no way to address anyone else's row — editing someone else's review is
 * not refused so much as unexpressible.
 */

export type ReviewResult =
  | { ok: true; message: string; rating: number }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function submitReview(input: ReviewInput): Promise<ReviewResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, error: "Sign in to write a review." };
  }

  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { ok: false, error: "Check the highlighted fields.", fieldErrors };
  }

  const { productId, rating, title, body } = parsed.data;

  // Deliberately vague: confirming that a product exists but was not bought
  // tells an unauthorised caller more than they need.
  const purchased = await hasPurchasedProduct(user.id, productId);
  if (!purchased) {
    return {
      ok: false,
      error: "Only customers who have bought this product can review it.",
    };
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { slug: true },
  });
  if (!product) {
    return { ok: false, error: "That product is no longer available." };
  }

  const existed = await prisma.review.findUnique({
    where: { productId_userId: { productId, userId: user.id } },
    select: { id: true },
  });

  await prisma.review.upsert({
    where: { productId_userId: { productId, userId: user.id } },
    create: { productId, userId: user.id, rating, title, body },
    update: { rating, title, body },
  });

  // The product's cached average and count are what the cards and JSON-LD
  // read, so they are recomputed from the live rows rather than adjusted.
  await syncProductRating(productId);

  revalidatePath(`/products/${product.slug}`);
  revalidatePath("/account/orders");
  revalidatePath("/admin/reviews");

  return {
    ok: true,
    rating,
    message: existed ? "Your review has been updated." : "Thanks — your review is live.",
  };
}
