import type { MetadataRoute } from "next";

import { getAllProductSlugs } from "@/lib/queries/products";
import { getAllCategorySlugs } from "@/lib/queries/categories";
import { siteConfig } from "@/lib/config";

/**
 * Only publicly indexable routes belong here.
 *
 * Account, cart, checkout, order, auth and admin pages are all `noindex` and
 * omitted. So are faceted URLs — filter and sort combinations canonicalise back
 * to the clean category page, so listing them would work against that.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteConfig.url;

  const [products, categories] = await Promise.all([
    getAllProductSlugs(),
    getAllCategorySlugs(),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: "daily", priority: 1 },
    { url: `${base}/shop`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/about`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/contact`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/faq`, changeFrequency: "monthly", priority: 0.4 },
    // The policy pages. Listed because a payment provider's verification check
    // looks for them, and because they are the pages a customer goes hunting
    // for after a purchase. `/shipping` and `/size-guide` are gone — they
    // described posting physical goods, and both now redirect.
    { url: `${base}/terms`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/refunds`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.2 },
  ];

  return [
    ...staticRoutes,
    ...categories.map((category) => ({
      url: `${base}/shop/${category.slug}`,
      lastModified: category.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...products.map((product) => ({
      url: `${base}/products/${product.slug}`,
      lastModified: product.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
