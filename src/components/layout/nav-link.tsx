"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Desktop nav item with an underline that grows from the centre on hover and
 * stays put on the active route.
 */
export function NavLink({ href, children }: { href: string; children: ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative inline-flex h-11 items-center rounded-md px-3.5 text-[0.9375rem] font-medium transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600",
        active ? "text-brand-600" : "text-ink hover:text-brand-600",
      )}
    >
      {children}
      <span
        aria-hidden
        className={cn(
          "absolute inset-x-3.5 bottom-2 h-0.5 origin-center rounded-full bg-brand-600 transition-transform duration-200",
          active ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100",
        )}
      />
    </Link>
  );
}
