"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Page entrance.
 *
 * Keyed on the pathname so each route plays the entrance once, on arrival.
 * There is deliberately no exit animation: an exit would hold the outgoing page
 * on screen while the reader waits for the one they asked for, which makes a
 * fast site feel slow.
 *
 * This one is a CSS keyframe rather than Framer Motion. The brief's own rule
 * applies — use CSS when CSS is enough — and this is a single unorchestrated
 * fade with no stagger, no viewport trigger and no exit. Wrapping every page in
 * a motion component to do it would put a client component around the whole
 * app for no capability it does not already have.
 *
 * It also keeps the widest-reaching entrance on the platform's own timeline
 * rather than on `requestAnimationFrame`, which matters because this element
 * covers the entire page: with JavaScript disabled the keyframe still runs to
 * completion, where a JS animation would leave the storefront at `opacity: 0`.
 *
 * `children` is a prop, so pages stay server components.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  // The keyframe and its reduced-motion behaviour live in `globals.css`.
  return (
    <div key={pathname} className="page-enter">
      {children}
    </div>
  );
}
