import Link from "next/link";

import { siteConfig } from "@/lib/config";
import { cn } from "@/lib/utils";

export type Crumb = {
  label: string;
  /** Omitted on the final crumb, which represents the current page. */
  href?: string;
};

/**
 * Visible breadcrumbs plus the matching `BreadcrumbList` JSON-LD, emitted
 * together so the markup and the structured data can never disagree.
 */
export function Breadcrumbs({
  items,
  className,
}: {
  items: Crumb[];
  className?: string;
}) {
  const trail: Crumb[] = [{ label: "Home", href: "/" }, ...items];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.label,
      ...(crumb.href ? { item: `${siteConfig.url}${crumb.href}` } : {}),
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav aria-label="Breadcrumb" className={cn("text-xs", className)}>
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground">
          {trail.map((crumb, index) => {
            const last = index === trail.length - 1;

            return (
              <li key={`${crumb.label}-${index}`} className="flex items-center gap-2">
                {crumb.href && !last ? (
                  <Link href={crumb.href} className="transition-colors hover:text-brand-600">
                    {crumb.label}
                  </Link>
                ) : (
                  <span aria-current="page" className="text-ink">
                    {crumb.label}
                  </span>
                )}

                {!last && (
                  <span aria-hidden className="text-border">
                    /
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
