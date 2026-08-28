"use client";

import { useState } from "react";
import { Star, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useFilterParams, type CurrentParams } from "@/components/shop/use-filter-params";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

export type FilterPanelProps = {
  categories: { id: string; name: string; slug: string; _count: { products: number } }[];
  brands: { name: string; count: number }[];
  priceRange: { minCents: number; maxCents: number };
  /** The URL's current search params, already parsed on the server. */
  params: CurrentParams;
  /** Hide the category group on a category page, where it is already fixed. */
  showCategories?: boolean;
  onApplied?: () => void;
};

const RATINGS = [4, 3, 2] as const;

/** URL params carry cents; the inputs are denominated in dollars. */
function centsToInput(value: string | undefined): string {
  if (!value) return "";
  const cents = Number(value);
  if (!Number.isFinite(cents)) return "";
  return String(cents / 100);
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-border py-5 first:pt-0 last:border-0">
      <h3 className="mb-3 text-sm font-semibold text-foreground">{title}</h3>
      {children}
    </section>
  );
}

/**
 * Filter controls shared by the desktop sidebar and the mobile drawer. Every
 * change writes to the URL, which re-runs the query on the server.
 */
export function FilterPanel({
  categories,
  brands,
  priceRange,
  params,
  showCategories = true,
  onApplied,
}: FilterPanelProps) {
  const { get, setFilters, clearAll, pending } = useFilterParams(params);

  const activeCategory = get("category");
  const activeBrand = get("brand");
  const activeRating = get("rating");

  // The URL is the source of truth for the committed price range. While the
  // shopper is typing we hold a draft, which is dropped once the filter is
  // applied — so there is no effect syncing state back from the URL.
  const [minDraft, setMinDraft] = useState<string | null>(null);
  const [maxDraft, setMaxDraft] = useState<string | null>(null);

  const minPrice = minDraft ?? centsToInput(get("minPrice"));
  const maxPrice = maxDraft ?? centsToInput(get("maxPrice"));

  function applyPrice(event: React.FormEvent) {
    event.preventDefault();
    setFilters({
      minPrice: minPrice ? Math.round(Number(minPrice) * 100) : null,
      maxPrice: maxPrice ? Math.round(Number(maxPrice) * 100) : null,
    });
    setMinDraft(null);
    setMaxDraft(null);
    onApplied?.();
  }

  const hasActive =
    Boolean(activeCategory || activeBrand || activeRating) ||
    Boolean(get("minPrice") || get("maxPrice"));

  return (
    <div className={cn("text-sm", pending && "opacity-70")}>
      {hasActive && (
        <div className="flex items-center justify-between pb-4">
          <span className="text-xs font-medium text-muted-foreground">Filters applied</span>
          <button
            type="button"
            onClick={() => {
              clearAll();
              onApplied?.();
            }}
            className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline"
          >
            <X className="size-3" aria-hidden />
            Clear all
          </button>
        </div>
      )}

      {showCategories && (
        <Group title="Category">
          <ul className="space-y-1">
            <li>
              <button
                type="button"
                onClick={() => {
                  setFilters({ category: null });
                  onApplied?.();
                }}
                aria-pressed={!activeCategory}
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-2 py-2 text-left transition-colors",
                  !activeCategory
                    ? "bg-brand-50 font-medium text-brand-700"
                    : "hover:bg-surface-alt",
                )}
              >
                All products
              </button>
            </li>
            {categories.map((category) => {
              const active = activeCategory === category.slug;
              return (
                <li key={category.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setFilters({ category: active ? null : category.slug });
                      onApplied?.();
                    }}
                    aria-pressed={active}
                    className={cn(
                      "flex w-full items-center justify-between rounded-md px-2 py-2 text-left transition-colors",
                      active
                        ? "bg-brand-50 font-medium text-brand-700"
                        : "hover:bg-surface-alt",
                    )}
                  >
                    <span>{category.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {category._count.products}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Group>
      )}

      <Group title="Price">
        <form onSubmit={applyPrice} className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <Label htmlFor="filter-min-price" className="sr-only">
                Minimum price
              </Label>
              <Input
                id="filter-min-price"
                inputMode="decimal"
                placeholder={String(Math.floor(priceRange.minCents / 100))}
                value={minPrice}
                onChange={(event) => setMinDraft(event.target.value)}
                className="h-10"
              />
            </div>
            <span aria-hidden className="text-muted-foreground">
              –
            </span>
            <div className="flex-1">
              <Label htmlFor="filter-max-price" className="sr-only">
                Maximum price
              </Label>
              <Input
                id="filter-max-price"
                inputMode="decimal"
                placeholder={String(Math.ceil(priceRange.maxCents / 100))}
                value={maxPrice}
                onChange={(event) => setMaxDraft(event.target.value)}
                className="h-10"
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Catalogue range {formatMoney(priceRange.minCents)} –{" "}
            {formatMoney(priceRange.maxCents)}
          </p>

          <Button type="submit" variant="outline" size="pillSm" className="w-full">
            Apply price
          </Button>
        </form>
      </Group>

      <Group title="Rating">
        <ul className="space-y-1">
          {RATINGS.map((rating) => {
            const active = activeRating === String(rating);
            return (
              <li key={rating}>
                <button
                  type="button"
                  onClick={() => {
                    setFilters({ rating: active ? null : rating });
                    onApplied?.();
                  }}
                  aria-pressed={active}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-2 transition-colors",
                    active ? "bg-brand-50 text-brand-700" : "hover:bg-surface-alt",
                  )}
                >
                  <span aria-hidden className="inline-flex">
                    {Array.from({ length: 5 }, (_, index) => (
                      <Star
                        key={index}
                        className={cn(
                          "size-3.5",
                          index < rating
                            ? "fill-star text-star"
                            : "fill-transparent text-muted-foreground/40",
                        )}
                      />
                    ))}
                  </span>
                  <span>{rating} & up</span>
                </button>
              </li>
            );
          })}
        </ul>
      </Group>

      {brands.length > 1 && (
        <Group title="Brand">
          <ul className="space-y-1">
            {brands.map((brand) => {
              const active = activeBrand === brand.name;
              return (
                <li key={brand.name}>
                  <button
                    type="button"
                    onClick={() => {
                      setFilters({ brand: active ? null : brand.name });
                      onApplied?.();
                    }}
                    aria-pressed={active}
                    className={cn(
                      "flex w-full items-center justify-between rounded-md px-2 py-2 text-left transition-colors",
                      active
                        ? "bg-brand-50 font-medium text-brand-700"
                        : "hover:bg-surface-alt",
                    )}
                  >
                    <span>{brand.name}</span>
                    <span className="text-xs text-muted-foreground">{brand.count}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Group>
      )}

      {/* No availability filter. A digital product never runs out, so "in
          stock only" would exclude nothing — and the checkbox never reached a
          query in the first place, so it was a control that did nothing on a
          concept that does not apply. */}
    </div>
  );
}
