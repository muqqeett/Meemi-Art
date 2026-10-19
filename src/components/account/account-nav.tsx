"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Package, Download, Images, Heart, Settings, LogOut } from "lucide-react";

import { signOutAction } from "@/lib/actions/auth";
import { cn } from "@/lib/utils";

const LINKS = [
  // `/account` must match exactly, otherwise it would light up on every child.
  { href: "/account", label: "Overview", Icon: LayoutDashboard, exact: true },
  { href: "/account/orders", label: "Orders", Icon: Package, exact: false },
  { href: "/account/downloads", label: "Downloads", Icon: Download, exact: false },
  { href: "/account/projects", label: "Projects", Icon: Images, exact: false },
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
      <ul className="no-scrollbar font-figtree flex gap-1 overflow-x-auto border-b border-pl-line pb-px lg:flex-col lg:overflow-visible lg:border-0 lg:pb-0">
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
                  "pl-focus flex min-h-11 items-center gap-2.5 rounded-full px-4 text-[15px] leading-[18px] font-bold whitespace-nowrap transition-colors",
                  active
                    ? "bg-plum-100 text-pl-text"
                    : "text-pl-muted hover:bg-plum-100 hover:text-pl-text",
                )}
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}

        <li className="shrink-0 lg:mt-4 lg:border-t lg:border-pl-line lg:pt-4">
          <form action={signOutAction}>
            <button
              type="submit"
              className="pl-focus flex min-h-11 w-full items-center gap-2.5 rounded-full px-4 text-[15px] leading-[18px] font-bold whitespace-nowrap text-pl-muted transition-colors hover:bg-destructive/5 hover:text-destructive"
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
