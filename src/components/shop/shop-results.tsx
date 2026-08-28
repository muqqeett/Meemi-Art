import { SearchX, PackageOpen } from "lucide-react";

import { ProductGrid } from "@/components/product/product-grid";
import { ShopToolbar } from "@/components/shop/shop-toolbar";
import { FilterPanel } from "@/components/shop/filter-panel";
import { PaginationNav } from "@/components/shop/pagination-nav";
import { EmptyState } from "@/components/brand/empty-state";
import { ButtonLink } from "@/components/ui/button-link";
import { isFacetedView } from "@/lib/shop-params";
import type { CurrentParams } from "@/components/shop/use-filter-params";
import type { ProductListResult } from "@/lib/queries/products";

type ShopResultsProps = {
  result: ProductListResult;
  categories: { id: string; name: string; slug: string; _count: { products: number } }[];
  /** Raw search params from the page, threaded down to the filter controls. */
  params: CurrentParams;
  basePath: string;
  baseQuery: string;
  showCategoryFilter?: boolean;
  /** Message shown when nothing matches, tailored to the surrounding page. */
  emptyTitle?: string;
  emptyDescription?: string;
};

/**
 * The filtered catalogue layout shared by `/shop`, `/shop/[category]` and
 * `/search`, so those three pages cannot drift apart visually.
 *
 * A narrow filter rail on desktop, a bottom sheet below `lg`, and a four-column
 * grid at the widest breakpoint with generous gutters.
 */
export function ShopResults({
  result,
  categories,
  params,
  basePath,
  baseQuery,
  showCategoryFilter = true,
  emptyTitle = "Nothing matches those filters",
  emptyDescription = "Try widening the price range, or clear a filter or two.",
}: ShopResultsProps) {
  const filterProps = {
    categories,
    brands: result.brands,
    priceRange: result.priceRange,
    params,
    showCategories: showCategoryFilter,
  };

  // "Nothing matches those filters" is the wrong thing to say when there are no
  // products at all — offering to clear filters that were never set reads as a
  // broken page. An empty catalogue gets its own honest message.
  const catalogueIsEmpty = result.total === 0 && !isFacetedView(params);

  return (
    <div className="grid gap-10 lg:grid-cols-[220px_1fr] lg:gap-14">
      <aside className="hidden lg:block">
        <div className="sticky top-28">
          <h2 className="label-caps mb-5 text-muted-foreground">Refine</h2>
          <FilterPanel {...filterProps} />
        </div>
      </aside>

      <div className="min-w-0">
        <ShopToolbar
          {...filterProps}
          total={result.total}
          showing={result.products.length}
        />

        {catalogueIsEmpty ? (
          <EmptyState
            icon={PackageOpen}
            title="No products yet"
            description="Nothing has been published to the shop yet. New pieces will appear here as soon as they're listed."
            action={
              <ButtonLink href="/" variant="brand" size="pill">
                Back to home
              </ButtonLink>
            }
          />
        ) : result.products.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title={emptyTitle}
            description={emptyDescription}
            action={
              <ButtonLink href={basePath} variant="brand" size="pill">
                Clear filters
              </ButtonLink>
            }
            secondaryAction={
              <ButtonLink href="/shop" variant="brandOutline" size="pill">
                Browse everything
              </ButtonLink>
            }
          />
        ) : (
          <>
            <ProductGrid
              products={result.products}
              columns={4}
              priorityCount={4}
              className="mt-8"
            />
            <PaginationNav
              page={result.page}
              pageCount={result.pageCount}
              baseQuery={baseQuery}
              basePath={basePath}
            />
          </>
        )}
      </div>
    </div>
  );
}
