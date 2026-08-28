"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import { commerceConfig } from "@/lib/config";

type RecentlyViewedState = {
  slugs: string[];
  /** Records a visit, moving the slug to the front and trimming the tail. */
  record: (slug: string) => void;
  clear: () => void;
};

/**
 * Recently viewed lives in localStorage rather than the database: it is a
 * browsing convenience, it should work signed-out, and it is not data we have
 * any reason to retain server-side.
 */
export const useRecentlyViewed = create<RecentlyViewedState>()(
  persist(
    (set) => ({
      slugs: [],
      record: (slug) =>
        set((state) => ({
          slugs: [slug, ...state.slugs.filter((s) => s !== slug)].slice(
            0,
            commerceConfig.recentlyViewedLimit,
          ),
        })),
      clear: () => set({ slugs: [] }),
    }),
    { name: "mh-recently-viewed", version: 1 },
  ),
);
