import { z } from "zod";

import { commerceConfig } from "@/lib/config";

// ------------------------------------------------------------------ cart

export const addToCartSchema = z.object({
  productId: z.string().min(1, "Choose a product"),
  quantity: z
    .number()
    .int()
    .min(1)
    .max(commerceConfig.maxQuantityPerItem, `Limit ${commerceConfig.maxQuantityPerItem} per item`),
});

// -------------------------------------------------------------- wishlist

/**
 * A wishlist mutation. `saved` is the state the shopper asked for; when it is
 * omitted the mutation toggles, which is the original contract.
 */
export const wishlistMutationSchema = z.object({
  productId: z.string().trim().min(1, "Choose a product").max(64, "Choose a product"),
  saved: z.boolean().optional(),
});

export const updateCartItemSchema = z.object({
  itemId: z.string().min(1),
  quantity: z.number().int().min(0).max(commerceConfig.maxQuantityPerItem),
});

export const couponCodeSchema = z
  .string()
  .trim()
  .min(3, "Enter a coupon code")
  .max(32)
  .transform((value) => value.toUpperCase());

// ------------------------------------------------------------------ checkout

/**
 * Everything checkout accepts from the browser.
 *
 * Note what is absent: no price, no quantity, no discount, no total — those
 * are recalculated from the database in `placeOrder`, so a tampered payload
 * cannot change what is charged. No card fields either: the instrument is
 * captured by the provider on its own domain, and a server with nowhere to
 * put a card number is the only kind that reliably never stores one.
 *
 * No address. A file is not posted anywhere, and Paddle collects whatever
 * location it needs for tax at its own checkout.
 */
export const checkoutSchema = z.object({
  customerName: z.string().trim().min(2, "Enter your name").max(80),
  email: z.email("Enter a valid email address"),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

// ------------------------------------------------------------------ review

export const reviewSchema = z.object({
  productId: z.string().min(1),
  rating: z.number().int().min(1, "Choose a rating").max(5),
  title: z.string().trim().min(3, "Add a short headline").max(100),
  body: z.string().trim().min(10, "Tell us a little more").max(2000),
});

// ------------------------------------------------------- customer projects

/** Photo types a project upload may declare. HEIC is deliberately absent. */
export const PROJECT_IMAGE_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

/**
 * 10 MB. The photo goes straight from the browser to storage, so no request
 * body limit applies to it; what was actually stored is re-checked on the
 * server, and the declared size here is only an early refusal.
 */
export const PROJECT_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const PROJECT_CAPTION_MAX = 500;
export const PROJECT_DISPLAY_NAME_MAX = 40;

/** C0 control characters and DEL, apart from tab, line feed and carriage return. */
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

const projectProductId = z.string().trim().min(1, "Choose a product").max(64, "Choose a product");
const projectId = z.string().trim().min(1, "Choose a project").max(64, "Choose a project");

const projectCaption = z
  .string()
  .trim()
  .max(PROJECT_CAPTION_MAX, `Keep the caption to ${PROJECT_CAPTION_MAX} characters`)
  .refine((value) => !CONTROL_CHARACTERS.test(value), "Use plain text only")
  .nullish();

const projectDisplayName = z
  .string()
  .trim()
  .max(PROJECT_DISPLAY_NAME_MAX, `Keep the display name to ${PROJECT_DISPLAY_NAME_MAX} characters`)
  .refine((value) => !CONTROL_CHARACTERS.test(value) && !/[\r\n\t]/.test(value), "Use a single line of plain text")
  // Shown publicly beside the photo, so an address typed here would publish it.
  .refine((value) => !/[^\s@]+@[^\s@]+\.[^\s@]+/.test(value), "Don't use an email address as a display name")
  .nullish();

/**
 * Asking to upload a project photo.
 *
 * The type and size are the browser's claims and serve only as an early,
 * friendly refusal — the stored file is verified on the server regardless.
 * Strict, so a payload carrying anything else (a status, a user id, a folder)
 * is refused rather than silently stripped.
 */
export const projectUploadRequestSchema = z.strictObject({
  productId: projectProductId,
  contentType: z.enum(PROJECT_IMAGE_CONTENT_TYPES, { error: "Only JPEG, PNG and WebP photos are supported" }),
  bytes: z
    .number({ error: "That file is empty" })
    .int("That file is empty")
    .positive("That file is empty")
    .max(PROJECT_IMAGE_MAX_BYTES, "Photos must be 10 MB or smaller"),
});

/**
 * Submitting an uploaded photo as a project. No status, no user id, no URL,
 * no dimensions: the owner comes from the session, the status is always
 * PENDING, and everything about the image is read back from storage.
 */
export const projectSubmissionSchema = z.strictObject({
  productId: projectProductId,
  imageKey: z.string().min(1).max(200),
  caption: projectCaption,
  displayName: projectDisplayName,
});

/** A customer editing their own project's words. The photo cannot be swapped. */
export const projectUpdateSchema = z
  .strictObject({ projectId, caption: projectCaption, displayName: projectDisplayName })
  .refine((value) => value.caption !== undefined || value.displayName !== undefined, "Nothing to update");

export const projectDeleteSchema = z.strictObject({ projectId });

export const PROJECT_REJECTION_REASON_MAX = 500;

/**
 * An admin decision about one project: the id and nothing else. The target
 * status is the action itself, so there is no status field to tamper with.
 */
export const projectModerationSchema = z.strictObject({ projectId });

/** A rejection. The reason is plain text an admin writes; markup is refused. */
export const projectRejectionSchema = z.strictObject({
  projectId,
  reason: z
    .string({ error: "Give a short reason" })
    .trim()
    .min(3, "Give a short reason")
    .max(PROJECT_REJECTION_REASON_MAX, `Keep the reason to ${PROJECT_REJECTION_REASON_MAX} characters`)
    .refine((value) => !CONTROL_CHARACTERS.test(value), "Use plain text only")
    .refine((value) => !/<\/?[a-z!]/i.test(value), "Use plain text, not HTML"),
});

// ------------------------------------------------------------------ filters

export const productFiltersSchema = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.string().trim().max(64).optional(),
  brand: z.string().trim().max(64).optional(),
  minPrice: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
  rating: z.coerce.number().min(0).max(5).optional(),
  // No `inStock`. A digital product never runs out, and the flag never reached
  // a query even when the checkbox existed.
  sort: z.enum(["newest", "price-asc", "price-desc", "rating", "name-asc"]).default("newest"),
  page: z.coerce.number().int().min(1).default(1),
});

/**
 * `CheckoutInput` is the *output* type — fields with `.default()` are required
 * once parsed. `CheckoutFormValues` is the *input* type, which is what React
 * Hook Form holds before validation, where those fields are still optional.
 */
export type CheckoutInput = z.output<typeof checkoutSchema>;
export type CheckoutFormValues = z.input<typeof checkoutSchema>;
export type ReviewInput = z.infer<typeof reviewSchema>;
export type ProductFilters = z.infer<typeof productFiltersSchema>;
