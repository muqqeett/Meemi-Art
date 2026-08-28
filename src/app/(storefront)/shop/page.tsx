import type { Metadata } from "next";

import { Breadcrumbs } from "@/components/brand/breadcrumbs";
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
      title: `Shop All Handmade Crochet | ${siteConfig.name}`,
      description: `Every handmade piece from ${siteConfig.name}.`,
      url: `${siteConfig.url}/shop`,
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
    <div className="container-page py-10 lg:py-14">
      <Breadcrumbs items={[{ label: "Shop" }]} />

      <header className="mt-6 mb-10 max-w-2xl">
        <h1 className="heading-section">Shop all</h1>
        <p className="text-body mt-3">
          Every piece we make, in one place. Filter by category, price or availability to
          narrow it down.
        </p>
      </header>

      <ShopResults
        result={result}
        categories={categories}
        params={raw}
        basePath="/shop"
        baseQuery={buildBaseQuery(raw)}
      />
    </div>
  );
}
