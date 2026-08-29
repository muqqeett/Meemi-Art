"use client";

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
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
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {total === 0 ? (
          "No products"
        ) : (
          <>
            Showing <span className="font-medium text-foreground">{showing}</span> of{" "}
            <span className="font-medium text-foreground">{total}</span>{" "}
            {total === 1 ? "product" : "products"}
          </>
        )}
      </p>

      <div className="flex items-center gap-2">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            render={
              <Button
                variant="brandOutline"
                size="pillSm"
                // 36px is below a comfortable thumb target. Only ever rendered
                // below lg, so desktop sizing is unaffected.
                className="h-11 lg:hidden"
              />
            }
          >
            <SlidersHorizontal aria-hidden />
            Filters
          </SheetTrigger>

          <SheetContent
            side="bottom"
            className="max-h-[85vh] gap-0 rounded-t-2xl p-0 sm:max-w-none"
          >
            <SheetHeader className="border-b border-border px-5 py-4">
              <SheetTitle className="text-left">Filters</SheetTitle>
              <SheetDescription className="sr-only">
                Narrow the product list by category, price, rating, brand and availability.
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto px-5 py-2">
              <FilterPanel {...filterProps} />
            </div>

            <SheetFooter className="border-t border-border p-4">
              <Button
                variant="brand"
                size="pill"
                className="w-full"
                onClick={() => setOpen(false)}
              >
                Show {total} {total === 1 ? "result" : "results"}
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>

        <div className="flex items-center gap-2">
          <label htmlFor="sort" className="sr-only">
            Sort products
          </label>
          <select
            id="sort"
            value={sort}
            onChange={(event) => setFilters({ sort: event.target.value })}
            className="h-9 rounded-full border border-border bg-background px-3.5 pr-8 text-[0.8125rem] text-foreground transition-colors hover:border-brand-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

