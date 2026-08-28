"use client";

import { create } from "zustand";

type CartUIState = {
  /** Cart drawer visibility. */
  isOpen: boolean;
  /**
   * Item count mirrored from the server so the header badge can update the
   * instant an item is added, before the route revalidation lands.
   */
  count: number;
  open: () => void;
  close: () => void;
  setOpen: (open: boolean) => void;
  setCount: (count: number) => void;
};

export const useCartUI = create<CartUIState>((set) => ({
  isOpen: false,
  count: 0,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  setOpen: (isOpen) => set({ isOpen }),
  setCount: (count) => set({ count }),
}));
