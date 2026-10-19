import type { Metadata } from "next";

import { PlumPage, PlumPageHead } from "@/components/shop/plum-page-head";
import { ShopResults } from "@/components/shop/shop-results";
import { listProducts } from "@/lib/queries/products";
import { getAllCategories } from "@/lib/queries/categories";
import { parseFilters, buildBaseQuery, isFacetedView } from "@/lib/shop-params";
import { siteConfig } from "@/lib/config";

export async function generateMetadata({
  searchParams,
}: PageProps<"/shop">): Promise<Metadata> {
  const raw = await searchParams;
  const faceted = isFacetedView(raw);

  return {
    title: "Shop All Handmade Crochet",
    description: `Browse every handmade piece from ${siteConfig.name} — crochet bags, flowers, bouquets, plushies, accessories and gifts, all worked by hand.`,
    // The canonical is always the clean URL, so filter and sort permutations
    // consolidate here instead of competing with it.
    alternates: { canonical: "/shop" },
    // Faceted permutations add no crawlable value of their own; links out of
    // them are still followed.
    robots: faceted ? { index: false, follow: true } : { index: true, follow: true },
    openGraph: {
      siteName: siteConfig.name,
      title: `Shop All Handmade Crochet | ${siteConfig.name}`,
      description: `Every handmade piece from ${siteConfig.name}.`,
      url: `${siteConfig.url}/shop`,
      images: [siteConfig.ogImage],
    },
  };
}

export default async function ShopPage({ searchParams }: PageProps<"/shop">) {
  const raw = await searchParams;
  const filters = parseFilters(raw);

  const [result, categories] = await Promise.all([
    listProducts(filters),
    getAllCategories(),
  ]);

  return (
    <PlumPage>
      <PlumPageHead
        crumbs={[{ label: "Shop" }]}
        title="Shop all"
        lead="Every piece we make, in one place. Filter by category, price or availability to narrow it down."
      />

      <ShopResults
        result={result}
        categories={categories}
        params={raw}
        basePath="/shop"
        baseQuery={buildBaseQuery(raw)}
      />
    </PlumPage>
  );
}
