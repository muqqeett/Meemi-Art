"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";

import { ADMIN_NAV_FLAT } from "@/components/admin/admin-nav-config";

/**
 * Where the reader is, derived from the path.
 *
 * Segments are resolved against `ADMIN_NAV_FLAT` so a known route shows its
 * real label ("Digital Files", not "files"). Unknown segments — an order
 * number, a product id — are shown as they are, because inventing a friendly
 * name for an id the crumb cannot resolve would be a guess.
 *
 * The last crumb is plain text with `aria-current`, not a link to the page you
 * are already on.
 */
export function AdminBreadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean); // ["admin", ...]

  if (segments.length <= 1) return null;

  const crumbs = segments.map((segment, index) => {
    const href = `/${segments.slice(0, index + 1).join("/")}`;
    const known = ADMIN_NAV_FLAT.find((item) => item.href === href);
    return {
      href,
      // Fall back to the raw segment, de-slugged. Ids stay recognisable.
      label:
        known?.label ??
        (index === 0
          ? "Admin"
          : segment.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase())),
      last: index === segments.length - 1,
    };
  });

  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex items-center gap-1.5 text-sm">
        {crumbs.map((crumb) => (
          <li key={crumb.href} className="flex min-w-0 items-center gap-1.5">
            {crumb.last ? (
              <span
                aria-current="page"
                className="truncate font-medium text-foreground"
              >
                {crumb.label}
              </span>
            ) : (
              <>
                <Link
                  href={crumb.href}
                  className="truncate text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                >
                  {crumb.label}
                </Link>
                <ChevronRight
                  className="size-3.5 shrink-0 text-muted-foreground/50"
                  aria-hidden
                />
              </>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
