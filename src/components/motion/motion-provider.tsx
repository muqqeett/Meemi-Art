"use client";

import { MotionConfig } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Global motion settings.
 *
 * `reducedMotion="user"` is the whole reduced-motion story for Framer Motion:
 * when the OS asks for less motion, Framer drops every transform and layout
 * animation across the app and keeps only opacity, without a single component
 * having to check for itself. The `prefers-reduced-motion` block in
 * `globals.css` does the same job for CSS transitions — the two are
 * complementary, and neither disables functionality.
 *
 * This wraps the whole tree, so `children` stay server components.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
