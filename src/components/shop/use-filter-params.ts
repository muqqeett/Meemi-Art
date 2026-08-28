"use client";

import { useCallback, useMemo, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";

export type FilterPatch = Record<string, string | number | boolean | null | undefined>;
export type CurrentParams = Record<string, string | string[] | undefined>;

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Filters live in the URL, not in component state — that keeps the server the
 * single source of truth, makes every filtered view shareable, and makes the
 * back button behave the way shoppers expect.
 *
 * The current values are passed in from the server component that already
 * parsed them, rather than read with `useSearchParams`. That hook forces the
 * whole client tree up to the nearest Suspense boundary to be client-rendered,
 * which — with a route-level `loading.tsx` — means the page never renders
 * anything but its skeleton. `useRouter` and `usePathname` have no such effect.
 */
export function useFilterParams(current: CurrentParams) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  const params = useMemo(() => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(current)) {
      const resolved = single(value);
      if (resolved) next.set(key, resolved);
    }
    return next;
  }, [current]);

  const setFilters = useCallback(
    (patch: FilterPatch, options: { resetPage?: boolean } = {}) => {
      const next = new URLSearchParams(params.toString());

      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === undefined || value === "" || value === false) {
          next.delete(key);
        } else {
          next.set(key, String(value));
        }
      }

      // Any filter change invalidates the current page number.
      if (options.resetPage !== false) next.delete("page");

      const query = next.toString();
      startTransition(() => {
        router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
      });
    },
    [params, pathname, router],
  );

  const clearAll = useCallback(() => {
    startTransition(() => router.push(pathname, { scroll: false }));
  }, [pathname, router]);

  const get = useCallback((key: string) => single(current[key]), [current]);

  return { setFilters, clearAll, get, params, pending };
}
