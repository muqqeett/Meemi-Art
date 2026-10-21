"use client";

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { plumButtonClass } from "@/components/ui/plum-button";
import {
  CategoryFilters,
  type SkillOption,
} from "@/components/category/category-filters";
import { useFilterParams, type CurrentParams } from "@/components/shop/use-filter-params";
import { SORT_OPTIONS } from "@/lib/config";

/**
 * Result count, sort, and — below `lg` — the Filters button that opens the
 * same filters in a bottom sheet.
 *
 * The count line is a polite live region, so a screen reader hears the new
 * total when a filter changes. It is composed on the server, where the data
 * is, and only displayed here.
 */
export function CategoryToolbar({
  countText,
  total,
  skill,
  params,
}: {
  countText: string;
  total: number;
  skill: SkillOption[];
  params: CurrentParams;
}) {
  const { get, setFilters } = useFilterParams(params);
  const [open, setOpen] = useState(false);
  const sort = get("sort") ?? "newest";

  return (
    <div className="font-figtree flex flex-wrap items-center justify-between gap-3">
      <p className="pl-small text-pl-muted" aria-live="polite" role="status">
        {countText}
      </p>

      <div className="flex items-center gap-2">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            render={
              <button
                type="button"
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
                Narrow this category by skill level and price.
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              <CategoryFilters skill={skill} params={params} />
            </div>

            <SheetFooter className="border-t border-pl-line p-4">
              <button
                type="button"
                className={plumButtonClass({ style: "primary", size: "md", className: "w-full" })}
                onClick={() => setOpen(false)}
              >
                {total === 0 ? "Close" : `Show ${total} ${total === 1 ? "result" : "results"}`}
              </button>
            </SheetFooter>
          </SheetContent>
        </Sheet>

        <label htmlFor="category-sort" className="sr-only">
          Sort products
        </label>
        <select
          id="category-sort"
          value={sort}
          onChange={(event) => setFilters({ sort: event.target.value })}
          className="pl-focus font-figtree h-11 rounded-full border-[1.5px] border-pl-line-strong bg-pl-surface px-4 pr-8 text-[14px] leading-[18px] font-bold text-pl-text transition-colors hover:bg-plum-100"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              Sort: {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
