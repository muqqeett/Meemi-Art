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
