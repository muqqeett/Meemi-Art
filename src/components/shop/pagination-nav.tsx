import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

type PaginationNavProps = {
  page: number;
  pageCount: number;
  /** Current query string without `page`, e.g. "category=mens&sort=rating". */
  baseQuery: string;
  basePath: string;
};

/** Compact page list with ellipses: 1 … 4 5 6 … 12 */
function pageWindow(page: number, pageCount: number): (number | "gap")[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  const pages = new Set<number>([1, pageCount, page]);
  if (page - 1 > 1) pages.add(page - 1);
  if (page + 1 < pageCount) pages.add(page + 1);
  if (page <= 3) [2, 3, 4].forEach((p) => p < pageCount && pages.add(p));
  if (page >= pageCount - 2) {
    [pageCount - 1, pageCount - 2, pageCount - 3].forEach((p) => p > 1 && pages.add(p));
  }

  const sorted = [...pages].sort((a, b) => a - b);
  const result: (number | "gap")[] = [];
  let previous = 0;
  for (const value of sorted) {
    if (previous && value - previous > 1) result.push("gap");
    result.push(value);
    previous = value;
  }
  return result;
}

export function PaginationNav({ page, pageCount, baseQuery, basePath }: PaginationNavProps) {
  if (pageCount <= 1) return null;

  const href = (target: number) => {
    const params = new URLSearchParams(baseQuery);
    if (target > 1) params.set("page", String(target));
    else params.delete("page");
    const query = params.toString();
    return query ? `${basePath}?${query}` : basePath;
  };

  const itemClass =
    "pl-focus font-figtree inline-flex h-11 min-w-11 items-center justify-center rounded-full px-3 text-[14px] font-bold text-pl-text transition-colors";

  return (
    <nav aria-label="Pagination" className="mt-10 flex justify-center">
      <ul className="flex items-center gap-1">
        <li>
          {page > 1 ? (
            <Link
              href={href(page - 1)}
              rel="prev"
              aria-label="Previous page"
              className={cn(itemClass, "border-[1.5px] border-pl-line hover:bg-plum-100")}
            >
              <ChevronLeft className="size-4" aria-hidden />
            </Link>
          ) : (
            <span
              aria-hidden
              className={cn(itemClass, "border-[1.5px] border-pl-line text-pl-line-strong")}
            >
              <ChevronLeft className="size-4" />
            </span>
          )}
        </li>

        {pageWindow(page, pageCount).map((entry, index) =>
          entry === "gap" ? (
            <li key={`gap-${index}`}>
              <span className={cn(itemClass, "text-pl-muted")} aria-hidden>
                …
              </span>
            </li>
          ) : (
            <li key={entry}>
              <Link
                href={href(entry)}
                aria-label={`Page ${entry}`}
                aria-current={entry === page ? "page" : undefined}
                className={cn(
                  itemClass,
                  entry === page
                    ? "bg-plum-900 text-pl-on-dark"
                    : "border-[1.5px] border-pl-line hover:bg-plum-100",
                )}
              >
                {entry}
              </Link>
            </li>
          ),
        )}

        <li>
          {page < pageCount ? (
            <Link
              href={href(page + 1)}
              rel="next"
              aria-label="Next page"
              className={cn(itemClass, "border-[1.5px] border-pl-line hover:bg-plum-100")}
            >
              <ChevronRight className="size-4" aria-hidden />
            </Link>
          ) : (
            <span
              aria-hidden
              className={cn(itemClass, "border-[1.5px] border-pl-line text-pl-line-strong")}
            >
              <ChevronRight className="size-4" />
            </span>
          )}
        </li>
      </ul>
    </nav>
  );
}
