"use client";

import { useState } from "react";
import { Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useFilterParams, type CurrentParams } from "@/components/shop/use-filter-params";

type SelectFilter = {
  name: string;
  label: string;
  options: { value: string; label: string }[];
};

/**
 * Search + select filters for admin tables. Like the storefront filters, state
 * lives in the URL so a filtered view can be shared or bookmarked.
 */
export function AdminFilters({
  params,
  searchPlaceholder = "Search…",
  selects = [],
}: {
  /** The URL's current search params, already parsed on the server. */
  params: CurrentParams;
  searchPlaceholder?: string;
  selects?: SelectFilter[];
}) {
  const { get, setFilters, clearAll, pending } = useFilterParams(params);
  const [query, setQuery] = useState(get("q") ?? "");

  const hasFilters =
    Boolean(get("q")) || selects.some((select) => Boolean(get(select.name)));

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setFilters({ q: query || null });
        }}
        // Caps the search field so it does not stretch across a wide screen and
        // leave the selects stranded at the far edge.
        className="min-w-52 flex-1 sm:max-w-xs"
      >
        <Label htmlFor="admin-search" className="sr-only">
          Search
        </Label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground/70"
            aria-hidden
          />
          <Input
            id="admin-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={searchPlaceholder}
            className="h-9 rounded-md border-border pl-8 text-[0.8125rem] transition-colors duration-150 placeholder:text-muted-foreground/70 hover:border-brand-200"
          />
        </div>
      </form>

      {selects.map((select) => (
        <div key={select.name}>
          <Label htmlFor={`filter-${select.name}`} className="sr-only">
            {select.label}
          </Label>
          <select
            id={`filter-${select.name}`}
            value={get(select.name) ?? ""}
            onChange={(event) => setFilters({ [select.name]: event.target.value || null })}
            className="h-9 rounded-md border border-border bg-card px-2.5 text-[0.8125rem] text-foreground transition-colors duration-150 hover:border-brand-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            <option value="">{select.label}</option>
            {select.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      ))}

      {hasFilters && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 px-2.5 text-[0.8125rem] text-muted-foreground hover:text-foreground"
          onClick={clearAll}
          disabled={pending}
        >
          <X aria-hidden />
          Clear
        </Button>
      )}
    </div>
  );
}
