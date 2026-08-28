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
    <div className="mb-4 flex flex-wrap items-end gap-3">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setFilters({ q: query || null });
        }}
        className="min-w-56 flex-1"
      >
        <Label htmlFor="admin-search" className="sr-only">
          Search
        </Label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            id="admin-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={searchPlaceholder}
            className="h-10 pl-9"
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
            className="h-10 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
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
          size="pillSm"
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
