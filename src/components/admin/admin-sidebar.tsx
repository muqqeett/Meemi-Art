"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  FolderTree,
  ShoppingCart,
  Users,
  MessageSquare,
  Ticket,
  ChartColumn,
  Settings,
  Menu,
  Store,
  LogOut,
} from "lucide-react";

import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Logo } from "@/components/brand/logo";
import { signOutAction } from "@/lib/actions/auth";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin", label: "Dashboard", Icon: LayoutDashboard, exact: true },
  { href: "/admin/products", label: "Products", Icon: Package, exact: false },
  { href: "/admin/categories", label: "Categories", Icon: FolderTree, exact: false },
  { href: "/admin/orders", label: "Orders", Icon: ShoppingCart, exact: false },
  { href: "/admin/customers", label: "Customers", Icon: Users, exact: false },
  { href: "/admin/reviews", label: "Reviews", Icon: MessageSquare, exact: false },
  { href: "/admin/coupons", label: "Coupons", Icon: Ticket, exact: false },
  { href: "/admin/analytics", label: "Analytics", Icon: ChartColumn, exact: false },
  { href: "/admin/settings", label: "Settings", Icon: Settings, exact: false },
] as const;

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Admin" className="flex h-full flex-col">
      <ul className="flex-1 space-y-1 px-3">
        {NAV.map(({ href, label, Icon, exact }) => {
          const active = exact
            ? pathname === href
            : pathname === href || pathname.startsWith(`${href}/`);

          return (
            <li key={href}>
              <Link
                href={href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500",
                  active
                    ? "bg-brand-600 text-white"
                    : "text-white/70 hover:bg-white/8 hover:text-white",
                )}
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="space-y-1 border-t border-white/10 p-3">
        <Link
          href="/"
          onClick={onNavigate}
          className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium text-white/70 transition-colors hover:bg-white/8 hover:text-white"
        >
          <Store className="size-4" aria-hidden />
          View storefront
        </Link>

        <form action={signOutAction}>
          <button
            type="submit"
            className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-white/70 transition-colors hover:bg-white/8 hover:text-white"
          >
            <LogOut className="size-4" aria-hidden />
            Sign out
          </button>
        </form>
      </div>
    </nav>
  );
}

/** Persistent dark rail, desktop only. */
export function AdminSidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col bg-brand-700 lg:flex">
      <div className="flex h-16 items-center border-b border-white/10 px-5">
        <Logo tone="light" />
      </div>
      <div className="flex-1 overflow-y-auto py-4">
        <NavList />
      </div>
    </aside>
  );
}

/** The same navigation as a drawer, for the header below `lg`. */
export function AdminMobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          render={
            <button
              type="button"
              className="inline-flex size-11 items-center justify-center rounded-lg text-ink transition-colors hover:bg-surface-alt focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 lg:hidden"
              aria-label="Open admin menu"
            />
          }
        >
          <Menu className="size-5" aria-hidden />
        </SheetTrigger>

        <SheetContent side="left" className="w-72 gap-0 border-0 bg-brand-700 p-0">
          <div className="flex h-16 items-center border-b border-white/10 px-5">
            <SheetTitle className="text-left">
              <Logo tone="light" asLink={false} />
            </SheetTitle>
            <SheetDescription className="sr-only">Admin navigation</SheetDescription>
          </div>
          <div className="flex-1 overflow-y-auto py-4">
            <NavList onNavigate={() => setOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
  );
}

