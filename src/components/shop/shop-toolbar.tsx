"use client";

import { useState } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetTrigger,
} from "@/components/ui/sheet";
import { plumButtonClass } from "@/components/ui/plum-button";
import { FilterPanel, type FilterPanelProps } from "@/components/shop/filter-panel";
import { useFilterParams } from "@/components/shop/use-filter-params";
import { SORT_OPTIONS } from "@/lib/config";

type ShopToolbarProps = FilterPanelProps & {
  total: number;
  showing: number;
};

/**
 * Results count, sort control, and — below `lg` — the button that opens the
 * filters in a bottom-anchored drawer sized for one-handed use.
 */
export function ShopToolbar({ total, showing, ...filterProps }: ShopToolbarProps) {
  const { get, setFilters } = useFilterParams(filterProps.params);
  const [open, setOpen] = useState(false);
  const sort = get("sort") ?? "newest";

  return (
    <div className="font-figtree flex flex-wrap items-center justify-between gap-3">
      <p className="pl-small text-pl-muted" aria-live="polite">
        {total === 0 ? (
          "No products"
        ) : (
          <>
            Showing <span className="font-bold text-pl-text">{showing}</span> of{" "}
            <span className="font-bold text-pl-text">{total}</span>{" "}
            {total === 1 ? "product" : "products"}
          </>
        )}
      </p>

      <div className="flex items-center gap-2">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            render={
              <button
                type="button"
                // 44px: the design's minimum touch target. Only ever rendered
                // below lg, so desktop sizing is unaffected.
                className={plumButtonClass({ style: "secondary", size: "md", className: "lg:hidden" })}
              />
            }
          >
            <SlidersHorizontal aria-hidden />
            Filters
          </SheetTrigger>

          <SheetContent
            side="bottom"
            className="font-figtree max-h-[85vh] gap-0 rounded-t-[20px] bg-pl-page p-0 sm:max-w-none"
          >
            <SheetHeader className="border-b border-pl-line px-5 py-4">
              <SheetTitle className="pl-display text-left text-2xl leading-8 tracking-[-0.02em]">
                Filters
              </SheetTitle>
              <SheetDescription className="sr-only">
                Narrow the product list by category, price, rating, brand and availability.
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto px-5 py-2">
              <FilterPanel {...filterProps} />
            </div>

            <SheetFooter className="border-t border-pl-line p-4">
              <button
                type="button"
                className={plumButtonClass({ style: "primary", size: "md", className: "w-full" })}
                onClick={() => setOpen(false)}
              >
                Show {total} {total === 1 ? "result" : "results"}
              </button>
            </SheetFooter>
          </SheetContent>
        </Sheet>

        <div className="flex items-center gap-2">
          <label htmlFor="sort" className="sr-only">
            Sort products
          </label>
          {/* The native arrow sits hard against the right edge, so it is replaced
              with a drawn one that has room: the select keeps its own text and
              keyboard behaviour, and the icon never takes a click. */}
          <div className="relative">
            <select
              id="sort"
              value={sort}
              onChange={(event) => setFilters({ sort: event.target.value })}
              className="pl-focus font-figtree h-11 appearance-none rounded-full border-[1.5px] border-pl-line-strong bg-pl-surface pr-11 pl-4 text-[14px] leading-[18px] font-bold text-pl-text transition-colors hover:bg-plum-100"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-pl-text"
              aria-hidden
            />
          </div>
        </div>
      </div>
    </div>
  );
}

