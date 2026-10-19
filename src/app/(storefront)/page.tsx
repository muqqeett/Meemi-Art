import type { Metadata } from "next";

import { PlumHero, type HeroProduct } from "@/components/home/plum/plum-hero";
import { CategoryTiles } from "@/components/home/plum/category-tiles";
import { LatestPatterns } from "@/components/home/plum/latest-patterns";
import { HowItWorks } from "@/components/home/plum/how-it-works";
import { GuidesBand } from "@/components/home/plum/guides-band";
import { getAllCategories } from "@/lib/queries/categories";
import { getNewArrivals } from "@/lib/queries/products";
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
 * category tiles and the rail all come from the live catalogue, so the page
 * can never name a product, count or price that the shop does not have. Where
 * the catalogue is empty a section is simply not drawn.
 *
 * The metadata above is untouched, and so is the canonical: this changes what
 * the page looks like, not what it says about itself to a search engine.
 */
export default async function HomePage() {
  const [categories, latest] = await Promise.all([getAllCategories(), getNewArrivals(4)]);

  // Only categories with something in them: a tile that opens an empty page is
  // a worse promise than a shorter row.
  const tiles = categories
    .filter((category) => category._count.products > 0)
    .map((category) => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
      image: category.image ?? null,
      productCount: category._count.products,
    }));

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
      <PlumHero products={heroProducts} />
      <CategoryTiles tiles={tiles} />
      <LatestPatterns products={latest} />
      <HowItWorks />
      <GuidesBand />
    </div>
  );
}
