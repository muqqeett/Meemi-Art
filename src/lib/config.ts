/**
 * Brand-level constants for Meemi Art.
 *
 * Anything a merchandiser would plausibly want to change lives here rather than
 * being scattered through components. Contact details are intentionally left as
 * placeholders — no invented address, phone number or social account is
 * published as if it were real.
 */

export const siteConfig = {
  name: "Meemi Art",
  tagline: "Handmade Crochet. Beautifully Crafted.",
  shortDescription: "Premium handmade crochet.",
  description:
    "Meemi Art makes handmade crochet pieces — bags, flowers, plushies and gifts — worked stitch by stitch in small batches, designed to bring texture and warmth to everyday life.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  /** The single mailbox for the whole business — see lib/email/config.ts. */
  email: "hello@meemiart.com",
  /**
   * Social profiles are only rendered when a URL is set, so the footer never
   * links to accounts that do not exist.
   */
  social: {
    instagram: "",
    pinterest: "",
    facebook: "",
  },
} as const;

/**
 * Storefront pricing rules. Kept server-authoritative — see lib/cart/totals.ts.
 *
 * There is deliberately no shipping, free-shipping threshold or tax rate here.
 * Meemi Art sells digital products delivered as a download, so nothing is
 * posted and no carrier is involved; and Paddle is the merchant of record, so
 * it calculates and remits sales tax at its own checkout rather than this
 * application applying a flat rate.
 */
export const commerceConfig = {
  productsPerPage: 12,
  maxQuantityPerItem: 10,
  recentlyViewedLimit: 8,
} as const;

/**
 * Account security timings. Lives here rather than beside the server actions
 * because pages quote these numbers to the shopper, and a server-action module
 * may only export async functions.
 */
export const authConfig = {
  /** Lifetime of an email-verification link. */
  verificationTtlMinutes: 60,
  /** Verification emails one address may request per hour. */
  verificationResendPerHour: 3,
} as const;

export const PRICE_BOUNDS = { min: 0, max: 30_000 } as const;

export const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
  { value: "rating", label: "Top Rated" },
  { value: "name-asc", label: "Name: A–Z" },
] as const;

export type SortOption = (typeof SORT_OPTIONS)[number]["value"];

/**
 * Primary navigation. Category entries mirror real catalogue slugs so the
 * header can never link somewhere that returns a 404.
 */
export const mainNav = [
  { title: "New In", href: "/shop?sort=newest" },
  { title: "Bags", href: "/shop/crochet-bags" },
  { title: "Flowers", href: "/shop/crochet-flowers" },
  { title: "Plushies", href: "/shop/crochet-plushies" },
  { title: "Gifts", href: "/shop/crochet-gifts" },
  { title: "About", href: "/about" },
] as const;

/**
 * The policy pages a customer — and a payment provider reviewing the site —
 * must be able to reach from anywhere. Rendered by the footer.
 *
 * Every entry resolves. A footer that links to a missing policy is one of the
 * first things Paddle's verification check fails a site on.
 */
export const legalNav = [
  { title: "Terms & Conditions", href: "/terms" },
  { title: "Refund Policy", href: "/refunds" },
  { title: "Privacy Policy", href: "/privacy" },
  { title: "Contact", href: "/contact" },
] as const;

/** Slim rotating promises shown in the utility bar. */
export const promoMessages = [
  "Instant download after payment",
  "Every piece crocheted by hand",
  "Made in small batches",
] as const;
