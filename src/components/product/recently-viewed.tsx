"use client";

import { useEffect, useMemo, useState } from "react";

import { ProductGrid } from "@/components/product/product-grid";
import { ProductGridSkeleton } from "@/components/product/product-grid";
import { useRecentlyViewed } from "@/lib/stores/recently-viewed";
import type { ProductCardData } from "@/lib/queries/products";

/**
 * Recently viewed rail.
 *
 * The list of slugs is client-side (localStorage), so the products themselves
 * are fetched after mount. Renders nothing at all when there is no history,
 * rather than leaving an empty heading on the page.
 */
export function RecentlyViewed({ currentSlug }: { currentSlug: string }) {
  const { slugs, record } = useRecentlyViewed();
  const [products, setProducts] = useState<ProductCardData[] | null>(null);

  // Record this visit once, after the initial paint.
  useEffect(() => {
    record(currentSlug);
  }, [currentSlug, record]);

  // Derived during render, so the "nothing to show" case never has to be
  // written back into state from inside an effect.
  const others = useMemo(
    () => slugs.filter((slug) => slug !== currentSlug).slice(0, 4),
    [slugs, currentSlug],
  );

  // Frozen on mount: the rail should not reshuffle while the shopper is still
  // reading the page they just landed on.
  const [initialOthers] = useState(others);

  useEffect(() => {
    if (initialOthers.length === 0) return;

    const controller = new AbortController();
    fetch(`/api/products/by-slug?slugs=${initialOthers.map(encodeURIComponent).join(",")}`, {
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : []))
      .then((data: ProductCardData[]) => setProducts(data))
      .catch(() => {
        // Aborted or offline — the rail is a nicety, so it just stays hidden.
      });

    return () => controller.abort();
  }, [initialOthers]);

  if (initialOthers.length === 0) return null;
  if (products !== null && products.length === 0) return null;

  return (
    <section className="section-y border-t border-border">
      <div className="container-page">
        <h2 className="heading-section mb-8">Recently viewed</h2>
        {products === null ? (
          <ProductGridSkeleton count={4} columns={4} />
        ) : (
          <ProductGrid products={products} columns={4} />
        )}
      </div>
    </section>
  );
}
