"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen, Menu, X, ArrowUpRight } from "lucide-react";

import { ADMIN_NAV, isActiveRoute } from "@/components/admin/admin-nav-config";
import { cn } from "@/lib/utils";

/**
 * Admin navigation.
 *
 * Two presentations of one config: a persistent rail from `lg` up that can
 * collapse to icons, and a drawer below it. Both read `ADMIN_NAV`, so the
 * ordering can never drift between them.
 */

const STORAGE_KEY = "meemi.admin.sidebar.collapsed";

/**
 * The collapse preference lives in `localStorage`, which is an external store,
 * so it is read through `useSyncExternalStore` rather than copied into state
 * by an effect. That keeps the server snapshot (`false`) and the client
 * snapshot consistent through hydration, and avoids the cascading render an
 * effect-then-setState would cause on every mount.
 */
const railStore = {
  listeners: new Set<() => void>(),
  subscribe(listener: () => void) {
    railStore.listeners.add(listener);
    return () => railStore.listeners.delete(listener);
  },
  get(): boolean {
    try {
      return window.localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      // Private mode, or storage disabled. The default is fine.
      return false;
    }
  },
  getServer(): boolean {
    return false;
  },
  set(next: boolean) {
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      // Not being able to remember the choice is not a reason to refuse it.
    }
    railStore.listeners.forEach((listener) => listener());
  },
};

function NavList({
  collapsed,
  onNavigate,
}: {
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav aria-label="Admin" className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-4">
      {ADMIN_NAV.map((group) => (
        <div key={group.label}>
          {/* The group label is decoration when collapsed — the icons carry the
              grouping through the gaps — so it is hidden rather than truncated
              into an unreadable stub. */}
          {!collapsed && (
            <p className="px-3 pb-2 text-[0.6875rem] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
              {group.label}
            </p>
          )}

          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const active = isActiveRoute(pathname, item);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    // `title` rather than a JS tooltip: when collapsed the label
                    // must still be reachable, and the platform's own tooltip
                    // costs nothing and works before hydration.
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "group/nav relative flex h-11 items-center gap-3 rounded-lg px-3 text-sm transition-colors",
                      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600",
                      collapsed && "justify-center px-0",
                      active
                        ? "bg-brand-50 font-medium text-brand-700"
                        : "text-muted-foreground hover:bg-surface-alt hover:text-foreground",
                    )}
                  >
                    {/* The active marker is a rule on the rail's edge, not a
                        filled block — it reads at a glance without shouting. */}
                    {active && !collapsed && (
                      <span
                        aria-hidden
                        className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-brand-700"
                      />
                    )}
                    <item.Icon className="size-4 shrink-0" aria-hidden />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                    {collapsed && <span className="sr-only">{item.label}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function Wordmark({ collapsed }: { collapsed: boolean }) {
  return (
    <Link
      href="/admin"
      className="flex h-16 shrink-0 items-center gap-2 border-b border-border px-4 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-600"
    >
      <span className="font-wordmark text-lg whitespace-nowrap text-near-black">
        {collapsed ? (
          <span className="font-extrabold">M</span>
        ) : (
          <>
            <span className="font-semibold tracking-[-0.5px]">Meemi</span>{" "}
            <span className="font-extrabold">Art</span>
          </>
        )}
      </span>
      {!collapsed && (
        <span className="rounded bg-brand-50 px-1.5 py-0.5 text-[0.625rem] font-semibold tracking-wider text-brand-700 uppercase">
          Admin
        </span>
      )}
    </Link>
  );
}

function StorefrontLink({ collapsed }: { collapsed: boolean }) {
  return (
    <div className="shrink-0 border-t border-border p-3">
      <Link
        href="/"
        title={collapsed ? "View storefront" : undefined}
        className={cn(
          "flex h-11 items-center gap-3 rounded-lg px-3 text-sm text-muted-foreground transition-colors hover:bg-surface-alt hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600",
          collapsed && "justify-center px-0",
        )}
      >
        <ArrowUpRight className="size-4 shrink-0" aria-hidden />
        {collapsed ? (
          <span className="sr-only">View storefront</span>
        ) : (
          "View storefront"
        )}
      </Link>
    </div>
  );
}

/** The persistent rail. Hidden below `lg`, where the drawer takes over. */
export function AdminSidebar() {
  const collapsed = useSyncExternalStore(
    railStore.subscribe,
    railStore.get,
    railStore.getServer,
  );

  // The content column is offset by the rail, but the layout is a server
  // component and cannot see this state. Writing a custom property on the root
  // is a DOM side effect on an external system, which is what an effect is for.
  useEffect(() => {
    document.documentElement.style.setProperty(
      "--admin-rail",
      collapsed ? "68px" : "15rem",
    );
  }, [collapsed]);

  const toggle = () => railStore.set(!collapsed);

  return (
    <aside
      data-collapsed={collapsed}
      className={cn(
        "fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-border bg-background transition-[width] duration-200 ease-out lg:flex",
        collapsed ? "w-[68px]" : "w-60",
      )}
    >
      <Wordmark collapsed={collapsed} />
      <NavList collapsed={collapsed} />
      <StorefrontLink collapsed={collapsed} />

      <div className="shrink-0 border-t border-border p-3">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "flex h-11 w-full items-center gap-3 rounded-lg px-3 text-sm text-muted-foreground transition-colors hover:bg-surface-alt hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600",
            collapsed && "justify-center px-0",
          )}
        >
          {collapsed ? (
            <PanelLeftOpen className="size-4 shrink-0" aria-hidden />
          ) : (
            <>
              <PanelLeftClose className="size-4 shrink-0" aria-hidden />
              Collapse
            </>
          )}
        </button>
      </div>
    </aside>
  );
}

/**
 * The drawer, below `lg`.
 *
 * Closes on route change, on Escape, and on the overlay — and locks both
 * scrolling boxes while open. `html` carries `h-full`, so locking `body` alone
 * leaves the page scrolling behind the panel.
 */
export function AdminMobileNav() {
  const [open, setOpen] = useState(false);

  // Closed by the link that navigates (see `onNavigate` below) rather than by
  // watching the pathname: the click is the cause, so that is where the state
  // change belongs, and it avoids a setState-in-effect on every route change.
  useEffect(() => {
    if (!open) return;

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);

    const root = document.documentElement;
    const prev = { root: root.style.overflow, body: document.body.style.overflow };
    root.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      root.style.overflow = prev.root;
      document.body.style.overflow = prev.body;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open admin menu"
        aria-expanded={open}
        className="inline-flex size-11 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-alt hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 lg:hidden"
      >
        <Menu className="size-5" aria-hidden />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close admin menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-ink/45 backdrop-blur-[2px]"
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-label="Admin navigation"
            className="absolute inset-y-0 left-0 flex w-[min(17rem,86vw)] flex-col border-r border-border bg-background shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-border pr-2">
              <Wordmark collapsed={false} />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close admin menu"
                className="inline-flex size-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-alt hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>

            <NavList collapsed={false} onNavigate={() => setOpen(false)} />
            <StorefrontLink collapsed={false} />
          </div>
        </div>
      )}
    </>
  );
}
