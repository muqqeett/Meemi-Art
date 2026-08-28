import type { Metadata } from "next";
import { Search } from "lucide-react";

import { ShopResults } from "@/components/shop/shop-results";
import { EmptyState } from "@/components/brand/empty-state";
import { ButtonLink } from "@/components/ui/button-link";
import { listProducts } from "@/lib/queries/products";
import { getAllCategories } from "@/lib/queries/categories";
import { parseFilters, buildBaseQuery } from "@/lib/shop-params";

export const metadata: Metadata = {
  title: "Search",
  description: "Search the Meemi Art collection of handmade crochet.",
  // Search result pages should not be indexed.
  robots: { index: false, follow: true },
};

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const raw = await searchParams;
  const filters = parseFilters(raw);
  const query = filters.q?.trim() ?? "";

  if (!query) {
    return (
      <div className="container-page py-10 lg:py-14">
        <h1 className="heading-section">Search</h1>
        <EmptyState
          icon={Search}
          title="What are you looking for?"
          description="Search by product name, brand or category — or browse the full collection."
          action={
            <ButtonLink href="/shop" variant="brand" size="pill">
              Browse the shop
            </ButtonLink>
          }
        />
      </div>
    );
  }

  const [result, categories] = await Promise.all([
    listProducts(filters),
    getAllCategories(),
  ]);

  return (
    <div className="container-page py-10 lg:py-14">
      <header className="mb-8">
        <h1 className="heading-section">
          Results for <span className="text-brand-600">“{query}”</span>
        </h1>
        <p className="text-body mt-2">
          {result.total === 0
            ? "We couldn't find a match."
            : `${result.total} ${result.total === 1 ? "product" : "products"} found.`}
        </p>
      </header>

      <ShopResults
        result={result}
        categories={categories}
        params={raw}
        basePath={`/search?q=${encodeURIComponent(query)}`}
        baseQuery={buildBaseQuery(raw)}
        emptyTitle={`No results for “${query}”`}
        emptyDescription="Check the spelling, try a broader term, or browse the categories instead."
      />
    </div>
  );
}
