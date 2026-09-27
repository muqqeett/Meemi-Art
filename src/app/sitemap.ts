import type { MetadataRoute } from "next";

import { getAllProductSlugs } from "@/lib/queries/products";
import { getAllCategorySlugs } from "@/lib/queries/categories";
import { siteConfig } from "@/lib/config";
import { RESOURCES, resourcePath } from "@/lib/content/resources";
import { getPublishedArticleSlugs, getTopicSlugs } from "@/lib/queries/articles";
import { getPublishedTutorialSlugs } from "@/lib/queries/tutorials";

/**
 * Only publicly indexable routes belong here.
 *
 * Account, cart, checkout, order, auth and admin pages are all `noindex` and
 * omitted. So are faceted URLs — filter and sort combinations canonicalise back
 * to the clean category page, so listing them would work against that.
 */
/**
 * Regenerated hourly.
 *
 * Without this the sitemap is prerendered once at build time, so an article
 * published on a Tuesday would not appear in it until the next deploy — and
 * neither would a product added through the admin. An hour is frequent enough
 * for a search engine and cheap enough to be free.
 */
export const revalidate = 3600;
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteConfig.url;

  const [products, categories, articles, topics, tutorials] = await Promise.all([
    getAllProductSlugs(),
    getAllCategorySlugs(),
    // Published only. A draft has no URL to list: its page 404s.
    getPublishedArticleSlugs(),
    getTopicSlugs(),
    getPublishedTutorialSlugs(),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: "daily", priority: 1 },
    { url: `${base}/shop`, changeFrequency: "daily", priority: 0.9 },
    // The learning section. Reference pages change rarely but are the
    // pages a search result should be able to land on.
    { url: `${base}/learn`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/blog`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/tutorials`, changeFrequency: "weekly", priority: 0.8 },
    ...RESOURCES.map((resource) => ({
      url: `${base}${resourcePath(resource.slug)}`,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
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
    ...articles.map((article) => ({
      url: `${base}/blog/${article.slug}`,
      lastModified: article.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    // Published tutorials only, by the same rule. The `?topic=` filters are
    // faceted URLs and are left out for the same reason the shop's are.
    ...tutorials.map((tutorial) => ({
      url: `${base}/tutorials/${tutorial.slug}`,
      lastModified: tutorial.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    ...topics.map((topic) => ({
      url: `${base}/blog/topic/${topic.slug}`,
      lastModified: topic.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
    ...products.map((product) => ({
      url: `${base}/products/${product.slug}`,
      lastModified: product.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
