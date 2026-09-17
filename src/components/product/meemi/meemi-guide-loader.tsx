"use client";

import { useEffect, useState, type ComponentType } from "react";
import { createPortal } from "react-dom";

import type { MeemiFacts } from "@/lib/meemi/facts";

type Props = { facts: MeemiFacts; assistantAvailable: boolean };

/**
 * Loads Meemi after the page has hydrated, in its own chunk.
 *
 * Nothing at all is rendered on the server — not even the bailout marker that
 * `next/dynamic` with `ssr: false` leaves — so Meemi cannot shift layout,
 * compete with the product image for LCP, or change the page's first paint.
 * The guide itself then waits a couple of seconds more before it appears.
 */
export function MeemiGuideLoader(props: Props) {
  const [Guide, setGuide] = useState<ComponentType<Props> | null>(null);

  useEffect(() => {
    let cancelled = false;
    import("@/components/product/meemi/meemi-guide")
      .then((module) => {
        if (!cancelled) setGuide(() => module.MeemiGuide);
      })
      .catch(() => {
        // A chunk that fails to load leaves the page exactly as it was.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Portalled to <body>: the page content sits inside the page-transition
  // wrapper, whose transform would otherwise make `position: fixed` relative
  // to the page instead of the viewport.
  return Guide ? createPortal(<Guide {...props} />, document.body) : null;
}
