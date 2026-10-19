"use client";

import { useState } from "react";
import { Check, Star, X } from "lucide-react";

import { Label } from "@/components/ui/label";
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

/** Plum Studio group heading — Label/Strong, 16/22 bold. */
function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2 py-4 first:pt-0">
      <h3 className="pl-strong text-pl-text">{title}</h3>
      {children}
    </section>
  );
}

/**
 * The design's facet row: a 24px box, the label, a caption-size count. The
 * whole row is the button (Figma Checkbox, 7:80), `aria-pressed` carries the
 * state, and the box fills plum when it is on.
 */
function FacetRow({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="pl-focus group/facet flex min-h-11 w-full items-center gap-2.5 rounded-md py-1.5 text-left lg:min-h-0"
    >
      <span
        aria-hidden
        className={cn(
          "inline-flex size-6 shrink-0 items-center justify-center rounded-[6px] border-[1.5px] transition-colors",
          active
            ? "border-plum-900 bg-plum-900 text-pl-on-dark"
            : "border-pl-line-strong bg-pl-surface group-hover/facet:border-plum-500",
        )}
      >
        {active && <Check className="size-4" strokeWidth={3} />}
      </span>
      <span className="pl-body text-pl-text">{label}</span>
      {count !== undefined && <span className="pl-caption text-pl-muted">{count}</span>}
    </button>
  );
}

const FIELD =
  "pl-focus font-figtree h-11 w-full rounded-[12px] border-[1.5px] border-pl-line-strong bg-pl-surface px-3 text-base text-pl-text placeholder:text-pl-muted focus-visible:border-plum-500";

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
    <div className={cn("font-figtree text-sm text-pl-text", pending && "opacity-70")}>
      {hasActive && (
        <div className="flex items-center justify-between pb-4">
          <span className="pl-caption text-pl-muted">Filters applied</span>
          <button
            type="button"
            onClick={() => {
              clearAll();
              onApplied?.();
            }}
            className="pl-focus inline-flex items-center gap-1 rounded-full px-2 py-1 text-[13px] leading-[18px] font-bold text-plum-500 hover:bg-plum-100"
          >
            <X className="size-3.5" aria-hidden />
            Clear all
          </button>
        </div>
      )}

      {showCategories && (
        <Group title="Category">
          <ul>
            <li>
              <FacetRow
                active={!activeCategory}
                label="All products"
                onClick={() => {
                  setFilters({ category: null });
                  onApplied?.();
                }}
              />
            </li>
            {categories.map((category) => {
              const active = activeCategory === category.slug;
              return (
                <li key={category.id}>
                  <FacetRow
                    active={active}
                    label={category.name}
                    count={category._count.products}
                    onClick={() => {
                      setFilters({ category: active ? null : category.slug });
                      onApplied?.();
                    }}
                  />
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
              <input
                id="filter-min-price"
                inputMode="decimal"
                placeholder={String(Math.floor(priceRange.minCents / 100))}
                value={minPrice}
                onChange={(event) => setMinDraft(event.target.value)}
                className={FIELD}
              />
            </div>
            <span aria-hidden className="text-pl-muted">
              –
            </span>
            <div className="flex-1">
              <Label htmlFor="filter-max-price" className="sr-only">
                Maximum price
              </Label>
              <input
                id="filter-max-price"
                inputMode="decimal"
                placeholder={String(Math.ceil(priceRange.maxCents / 100))}
                value={maxPrice}
                onChange={(event) => setMaxDraft(event.target.value)}
                className={FIELD}
              />
            </div>
          </div>

          <p className="pl-caption text-pl-muted">
            Catalogue range {formatMoney(priceRange.minCents)} –{" "}
            {formatMoney(priceRange.maxCents)}
          </p>

          {/* Secondary button: outlined, 36px, sentence case. */}
          <button
            type="submit"
            className="pl-focus font-figtree h-10 w-full rounded-full border-[1.5px] border-pl-line-strong bg-pl-surface text-[14px] leading-[18px] font-bold text-pl-text transition-colors hover:bg-plum-100"
          >
            Apply price
          </button>
        </form>
      </Group>

      <Group title="Rating">
        <ul>
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
                    "pl-focus flex min-h-11 w-full items-center gap-2 rounded-[12px] px-2 py-1.5 transition-colors lg:min-h-0",
                    active ? "bg-plum-100" : "hover:bg-plum-100/60",
                  )}
                >
                  <span aria-hidden className="inline-flex">
                    {Array.from({ length: 5 }, (_, index) => (
                      <Star
                        key={index}
                        className={cn(
                          "size-3.5",
                          index < rating
                            ? "fill-plum-500 text-plum-500"
                            : "fill-transparent text-pl-line-strong",
                        )}
                      />
                    ))}
                  </span>
                  <span className="pl-small">{rating} & up</span>
                </button>
              </li>
            );
          })}
        </ul>
      </Group>

      {brands.length > 1 && (
        <Group title="Brand">
          <ul>
            {brands.map((brand) => {
              const active = activeBrand === brand.name;
              return (
                <li key={brand.name}>
                  <FacetRow
                    active={active}
                    label={brand.name}
                    count={brand.count}
                    onClick={() => {
                      setFilters({ brand: active ? null : brand.name });
                      onApplied?.();
                    }}
                  />
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
