"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

/**
 * Chooses between the earlier chrome and the Plum Studio chrome by route.
 *
 * The homepage is protected: it keeps the header and footer it was built with,
 * byte for byte. Every other storefront route takes the Plum Studio versions.
 * Both elements are rendered on the server and the matching one is kept, so
 * neither component needs to know which page it is on.
 *
 * Only the exact root path counts as the homepage. `/` is the one route this
 * guards; anything else, including `/?utm=…` (the query is not part of the
 * pathname), is a Plum route.
 */
export function ChromeGate({ home, plum }: { home: ReactNode; plum: ReactNode }) {
  const pathname = usePathname();
  return pathname === "/" ? home : plum;
}
