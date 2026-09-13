/**
 * Brand-level constants for Meemi Art.
 *
 * Anything a merchandiser would plausibly want to change lives here rather than
 * being scattered through components. Contact details are intentionally left as
 * placeholders — no invented address, phone number or social account is
 * published as if it were real.
 */

export const siteConfig = {
  /**
   * The brand as it appears on the page — wordmark, footer, Terms — and
   * therefore the name every metadata and structured-data signal uses too.
   * Google picks a site name from signals that agree; a title saying one thing
   * while the page says another is how it ends up guessing.
   */
  name: "Meemi Art",
  /**
   * The same brand run together, as in the domain. Declared as an
   * `alternateName` on the WebSite and Organization entities so a search for
   * either spelling resolves to one entity, not two.
   */
  alternateName: "MeemiArt",
  /**
   * Metadata only — the homepage title and share cards. Describes what the
   * store actually sells: the Terms page is explicit that every product is a
   * digital file, so nothing here may suggest physical goods are shipped.
   */
  tagline: "Crochet Patterns & Digital Downloads",
  shortDescription: "Crochet patterns and digital downloads.",
  description:
    "Meemi Art publishes crochet patterns and digital downloads. Every product is a digital file, ready to download the moment your payment clears.",
  /**
   * Absolute site origin. SERVER-ONLY.
   *
   * `SITE_URL` is deliberately not `NEXT_PUBLIC_`: every consumer is server
   * side (metadata, sitemap, robots, JSON-LD, email links, provider return
   * URLs), so the value has no reason to ship in the browser bundle.
   *
   * This module IS reachable from client components — they read `name`,
   * `mainNav` and friends — so in the browser `process.env.SITE_URL` is
   * undefined and this falls back to localhost. Nothing client-side reads
   * `url` today; if you ever need an absolute URL in a Client Component, pass
   * it down as a prop from a server component rather than reaching for this.
   */
  url: process.env.SITE_URL ?? "http://localhost:3000",
  /**
   * The share image for any page that has no picture of its own.
   *
   * Next replaces the `openGraph` object wholesale rather than merging it, so a
   * page that declares its own block inherits nothing from the root layout —
   * which is why every page below sets this explicitly instead of relying on
   * the root. Product and category pages override it with real photography.
   *
   * The existing homepage hero asset, not a new one. 1200x1124, so the
   * platforms trim top and bottom of the 1200x630 they crop to.
   */
  ogImage: "/home/hero-collage.png",
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
 * Stable identifiers for the site's structured-data entities.
 *
 * Every block that refers to the business or the site points at these `@id`s
 * instead of restating a name, so Google reads one Organization and one
 * WebSite no matter how many pages or blocks mention them.
 *
 * The homepage URL keeps its trailing slash: it is the form the root is served
 * and linked at, and the fragment ids hang off it.
 */
export const entityIds = {
  home: `${siteConfig.url}/`,
  organization: `${siteConfig.url}/#organization`,
  website: `${siteConfig.url}/#website`,
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
