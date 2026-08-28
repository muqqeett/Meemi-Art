import { z } from "zod";

const slugSchema = z
  .string()
  .trim()
  .min(2, "Enter a slug")
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens");

// ------------------------------------------------------------------ product

export const productSchema = z
  .object({
    name: z.string().trim().min(2, "Enter a product name").max(120),
    slug: slugSchema,
    brand: z.string().trim().min(1, "Enter a brand").max(64),
    sku: z.string().trim().min(3, "Enter a SKU").max(48),
    description: z.string().trim().min(20, "Write at least a couple of sentences").max(5000),
    shortDescription: z.string().trim().max(160).optional().or(z.literal("")),
    categoryId: z.string().min(1, "Choose a category"),
    priceCents: z.coerce.number().int().min(1, "Price must be greater than zero").max(10_000_000),
    compareAtCents: z.coerce.number().int().min(0).max(10_000_000).nullable().optional(),

    /** Shown to buyers beside the file, e.g. "1.2" or "2026 edition". */
    fileVersion: z.string().trim().max(40).optional().or(z.literal("")),

    // Optional SEO overrides. Left blank, metadata is derived from the product
    // name, category and description.
    seoTitle: z.string().trim().max(70).optional().or(z.literal("")),
    seoDescription: z.string().trim().max(180).optional().or(z.literal("")),

    featured: z.boolean().default(false),
    isActive: z.boolean().default(true),
    images: z
      .array(
        z.object({
          url: z.string().trim().min(1, "Image URL is required"),
          alt: z.string().trim().max(160).default(""),
          /** Storage handle, retained so the object can be purged later. */
          key: z.string().trim().max(300).nullable().optional(),
        }),
      )
      .min(1, "Add at least one preview image")
      .max(8, "Up to 8 images"),
  })
  .superRefine((data, ctx) => {
    if (data.compareAtCents && data.compareAtCents > 0 && data.compareAtCents <= data.priceCents) {
      ctx.addIssue({
        code: "custom",
        path: ["compareAtCents"],
        message: "Compare-at price must be higher than the price",
      });
    }
  });

// ------------------------------------------------------------------ category

export const categorySchema = z.object({
  name: z.string().trim().min(2, "Enter a category name").max(64),
  slug: slugSchema,
  description: z.string().trim().max(500).optional().or(z.literal("")),
  image: z.string().trim().max(500).optional().or(z.literal("")),
  icon: z.string().trim().max(48).optional().or(z.literal("")),
  parentId: z.string().optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
  isActive: z.boolean().default(true),
});

// ------------------------------------------------------------------ coupon

export const couponSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(3, "Enter a code")
      .max(32)
      .regex(/^[A-Za-z0-9_-]+$/, "Letters, numbers, hyphens and underscores only")
      .transform((value) => value.toUpperCase()),
    description: z.string().trim().max(200).optional().or(z.literal("")),
    type: z.enum(["PERCENTAGE", "FIXED"]),
    value: z.coerce.number().int().min(1, "Enter a discount value"),
    minOrderCents: z.coerce.number().int().min(0).default(0),
    maxUses: z.coerce.number().int().min(1).nullable().optional(),
    startsAt: z.coerce.date(),
    expiresAt: z.coerce.date().nullable().optional(),
    isActive: z.boolean().default(true),
  })
  .superRefine((data, ctx) => {
    if (data.type === "PERCENTAGE" && data.value > 100) {
      ctx.addIssue({
        code: "custom",
        path: ["value"],
        message: "A percentage discount cannot exceed 100",
      });
    }
    if (data.expiresAt && data.expiresAt <= data.startsAt) {
      ctx.addIssue({
        code: "custom",
        path: ["expiresAt"],
        message: "Expiry must be after the start date",
      });
    }
  });

/**
 * As with checkout: the *output* type is what the server receives after
 * parsing (defaults applied), while the *input* type is what React Hook Form
 * holds beforehand, where defaulted fields are still optional.
 */
export type ProductInput = z.output<typeof productSchema>;
export type ProductFormValues = z.input<typeof productSchema>;
export type CategoryInput = z.infer<typeof categorySchema>;
export type CouponInput = z.infer<typeof couponSchema>;
