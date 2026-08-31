"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/**
 * The category rail — Figma "Frame 23" (253:28).
 *
 * A 56px band under the top bar: plain 16px labels spread edge to edge across
 * the 1200px column, no pills, no dividers. The drawn labels are the template's
 * own taxonomy (Weddings, Sell Your Art…); the links here are MeemiArt's real
 * navigation and real category slugs, because the Figma supplies the treatment
 * and the codebase supplies the destinations.
 *
 * Hidden below `lg`. Seven labels cannot spread across a phone without either
 * wrapping into a second band or scrolling sideways, and both are worse than
 * the menu sheet those links already live in.
 */
export type BarLink = { title: string; href: string };

export function CategoryBar({ links }: { links: BarLink[] }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Categories"
      className="hidden border-t border-near-black/8 lg:block"
    >
      <div className="container-page flex h-14 items-center justify-between gap-2">
        {links.map((link) => {
          const active =
            pathname === link.href.split("?")[0] ||
            (link.href !== "/" && pathname.startsWith(`${link.href.split("?")[0]}/`));

          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group/cat relative rounded-xs px-1.5 py-1.5 text-base whitespace-nowrap transition-colors",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-600",
                active ? "text-near-black" : "text-near-black/75 hover:text-near-black",
              )}
            >
              {link.title}
              {/* The rule grows from the centre on hover. A scaled
                  pseudo-element rather than an animated width, so it
                  composites instead of triggering layout every frame. */}
              <span
                aria-hidden
                className={cn(
                  "absolute inset-x-1.5 -bottom-0.5 h-px origin-center bg-royal-600 transition-transform duration-200 ease-out",
                  active ? "scale-x-100" : "scale-x-0 group-hover/cat:scale-x-100",
                )}
              />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
