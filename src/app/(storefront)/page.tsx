import type { Metadata } from "next";

import { PlumHero, type HeroProduct } from "@/components/home/plum/plum-hero";
import { CategoryTiles } from "@/components/home/plum/category-tiles";
import { LatestPatterns } from "@/components/home/plum/latest-patterns";
import { HowItWorks } from "@/components/home/plum/how-it-works";
import { GuidesBand } from "@/components/home/plum/guides-band";
import { getCategoriesWithListedCounts } from "@/lib/queries/categories";
import { getNewArrivals } from "@/lib/queries/products";
import { isAssistantConfigured } from "@/lib/ai/client";
import { siteConfig } from "@/lib/config";

export const metadata: Metadata = {
  // `absolute` bypasses the "%s | Meemi Art" template, which would otherwise
  // repeat the brand name twice in the homepage title.
  title: { absolute: `${siteConfig.name} — ${siteConfig.tagline}` },
  description: siteConfig.description,
  alternates: { canonical: "/" },
};

/**
 * The homepage — Plum Studio "Home" (17:96): the hero, "Shop by category", a
 * product rail, "How it works" and a closing band, between the shared header
 * and footer.
 *
 * Everything shown is read from the shop. The hero's picker and card, the
 * category counts and the rail all come from the live catalogue, so the page
 * can never name a product, count or price that the shop does not have. The
 * five category tiles are the one fixed element — they are the design's
 * required categories — and an unstocked one says so instead of being hidden.
 *
 * The metadata above is untouched, and so is the canonical: this changes what
 * the page looks like, not what it says about itself to a search engine.
 */
export default async function HomePage() {
  // The five category tiles are fixed by the design. CategoryTiles pairs each
  // with its category by slug and counts only products the category page will
  // actually list.
  const [categories, latest] = await Promise.all([
    getCategoriesWithListedCounts(),
    getNewArrivals(4),
  ]);

  // The hero's "what should Meemi make?" chips: the newest products, three at
  // most, as the design draws three.
  const heroProducts: HeroProduct[] = latest.slice(0, 3).map((product) => ({
    id: product.id,
    name: product.name,
    slug: product.slug,
    priceCents: product.priceCents,
    imageUrl: product.imageUrl,
    imageAlt: product.imageAlt,
    categoryName: product.categoryName,
  }));

  return (
    <div data-fill className="font-figtree w-full bg-pl-page text-pl-text">
      <PlumHero
        products={heroProducts}
        askMeemi={isAssistantConfigured() || process.env.NODE_ENV === "development"}
      />
      <CategoryTiles
        categories={categories.map((category) => ({
          slug: category.slug,
          productCount: category._count.products,
        }))}
      />
      <LatestPatterns products={latest} />
      <HowItWorks />
      <GuidesBand />
    </div>
  );
}
