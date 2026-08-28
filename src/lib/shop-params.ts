import { productFiltersSchema, type ProductFilters } from "@/lib/validations/commerce";

export type RawSearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

/**
 * Parse untrusted URL search params into validated filters.
 *
 * Anything malformed is dropped rather than throwing, so a hand-edited URL
 * degrades to the default listing instead of a 500.
 */
export function parseFilters(raw: RawSearchParams): ProductFilters {
  const candidate = {
    q: first(raw.q),
    category: first(raw.category),
    brand: first(raw.brand),
    minPrice: first(raw.minPrice),
    maxPrice: first(raw.maxPrice),
    rating: first(raw.rating),
    sort: first(raw.sort),
    page: first(raw.page),
  };

  const parsed = productFiltersSchema.safeParse(candidate);
  if (parsed.success) return parsed.data;

  // Retry with only the fields that validated, falling back to defaults.
  const fallback = productFiltersSchema.safeParse({});
  return fallback.success ? fallback.data : { sort: "newest", page: 1 };
}

/**
 * True when the URL carries filter, sort or page state.
 *
 * Faceted combinations multiply fast — colour × price × rating × sort would
 * generate thousands of near-duplicate URLs. Views like this keep their
 * canonical pointed at the clean category or shop page rather than competing
 * with it, and are excluded from the sitemap.
 */
export function isFacetedView(raw: RawSearchParams): boolean {
  const facets = ["q", "brand", "minPrice", "maxPrice", "rating", "sort", "page"];
  return facets.some((key) => Boolean(first(raw[key])));
}

/**
 * True when any of `keys` is set in the URL.
 *
 * Lets an empty list tell the difference between "your filters matched nothing"
 * and "there is nothing here yet" — offering to clear filters that were never
 * applied is the kind of detail that makes a new store feel broken.
 */
export function hasAnyParam(raw: RawSearchParams, keys: readonly string[]): boolean {
  return keys.some((key) => Boolean(first(raw[key])));
}

/** Rebuilds the query string minus `page`, for pagination links. */
export function buildBaseQuery(raw: RawSearchParams): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    if (key === "page") continue;
    const single = first(value);
    if (single) params.set(key, single);
  }
  return params.toString();
}
