"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Package, Download, Heart, Settings, LogOut } from "lucide-react";

import { signOutAction } from "@/lib/actions/auth";
import { cn } from "@/lib/utils";

const LINKS = [
  // `/account` must match exactly, otherwise it would light up on every child.
  { href: "/account", label: "Overview", Icon: LayoutDashboard, exact: true },
  { href: "/account/orders", label: "Orders", Icon: Package, exact: false },
  { href: "/account/downloads", label: "Downloads", Icon: Download, exact: false },
  { href: "/account/wishlist", label: "Wishlist", Icon: Heart, exact: false },
  { href: "/account/settings", label: "Settings", Icon: Settings, exact: false },
] as const;

/**
 * Account navigation. A vertical rail on desktop; a horizontally scrollable
 * tab strip on mobile so it never eats the top of a small screen.
 */
export function AccountNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Account">
      <ul className="no-scrollbar flex gap-1 overflow-x-auto border-b border-border pb-px lg:flex-col lg:overflow-visible lg:border-0 lg:pb-0">
        {LINKS.map(({ href, label, Icon, exact }) => {
          const active = exact
            ? pathname === href
            : pathname === href || pathname.startsWith(`${href}/`);

          return (
            <li key={href} className="shrink-0">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-2.5 rounded-lg px-3.5 text-sm font-medium whitespace-nowrap transition-colors",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600",
                  active
                    ? "bg-brand-50 text-brand-700"
                    : "text-muted-foreground hover:bg-surface-alt hover:text-foreground",
                )}
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}

        <li className="shrink-0 lg:mt-4 lg:border-t lg:border-border lg:pt-4">
          <form action={signOutAction}>
            <button
              type="submit"
              className="flex min-h-11 w-full items-center gap-2.5 rounded-lg px-3.5 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors hover:bg-destructive/5 hover:text-destructive focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            >
              <LogOut className="size-4" aria-hidden />
              Sign out
            </button>
          </form>
        </li>
      </ul>
    </nav>
  );
}
