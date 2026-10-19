"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/**
 * A header nav pill. The current section gets the plum-100 fill from the
 * design ("current page gets a plum-100 pill") and `aria-current`.
 *
 * `href` may carry a query (`/shop?sort=newest`); only the path decides
 * whether it is current, and the bare `/shop` listing is not "current" for
 * its own sorted variant, which would light two pills at once.
 */
export function PlumNavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const path = href.split("?")[0];
  const isCurrent = href.includes("?") ? false : pathname === path || pathname.startsWith(`${path}/`);

  return (
    <Link
      href={href}
      aria-current={isCurrent ? "page" : undefined}
      className={cn(
        "pl-focus font-figtree inline-flex h-11 items-center rounded-full text-[15px] leading-[18px] font-bold whitespace-nowrap text-pl-text transition-colors",
        isCurrent ? "bg-plum-100 px-4" : "px-3 hover:bg-plum-100",
      )}
    >
      {children}
    </Link>
  );
}
