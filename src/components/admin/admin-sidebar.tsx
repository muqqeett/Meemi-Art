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
    <nav
      aria-label="Admin"
      className={cn(
        "flex flex-1 flex-col overflow-x-hidden overflow-y-auto py-4",
        // Collapsed, the gutter is symmetric so the icons sit on the rail's
        // centre line; expanded, it aligns labels with the wordmark above.
        collapsed ? "gap-5 px-2.5" : "gap-6 px-3",
      )}
    >
      {ADMIN_NAV.map((group) => (
        <div key={group.label}>
          {/* Collapsed, the label would truncate to an unreadable stub, so the
              gap between groups carries the grouping instead. A hairline marks
              the division that the label would otherwise have made. */}
          {collapsed ? (
            <div aria-hidden className="mx-auto mb-3 h-px w-6 bg-border first:hidden" />
          ) : (
            <p className="admin-rubric px-3 pb-2.5">{group.label}</p>
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
                      "group/nav relative flex items-center rounded-md text-sm transition-colors duration-150",
                      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600",
                      // 40px expanded is comfortable without the airiness of 44
                      // across eight groups; collapsed it is a square so the
                      // icon is optically centred in the rail.
                      collapsed ? "size-11 justify-center" : "h-10 gap-3 px-3",
                      active
                        ? "font-semibold text-brand-700"
                        : "font-medium text-muted-foreground hover:bg-[var(--admin-hover)] hover:text-foreground",
                      // The active row is a lavender capsule that fades out to
                      // the right, so it reads as light coming off the edge
                      // indicator rather than as a filled block.
                      active &&
                        !collapsed &&
                        "bg-gradient-to-r from-brand-100/90 via-brand-50/60 to-transparent",
                      active && collapsed && "bg-brand-100/80",
                    )}
                  >
                    {/* The indicator: a short violet bar on the rail edge with
                        a soft bloom around it. This is the "energy" — it is the
                        only lit thing in the sidebar at any moment. */}
                    {active && !collapsed && (
                      <span
                        aria-hidden
                        className="absolute inset-y-1.5 -left-3 w-[3px] rounded-r-full bg-brand-600 shadow-[0_0_10px_1px_rgb(123_95_191/0.55)]"
                      />
                    )}
                    {active && collapsed && (
                      <span
                        aria-hidden
                        className="absolute inset-y-2 -left-2.5 w-[3px] rounded-r-full bg-brand-600 shadow-[0_0_10px_1px_rgb(123_95_191/0.55)]"
                      />
                    )}
                    <item.Icon
                      className={cn(
                        "size-[1.05rem] shrink-0 transition-all duration-200",
                        active
                          ? "text-brand-600"
                          : "text-muted-foreground/70 group-hover/nav:translate-x-px group-hover/nav:text-brand-500",
                      )}
                      aria-hidden
                    />
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
      className={cn(
        "flex h-14 shrink-0 items-center gap-2 border-b border-border transition-colors duration-150 hover:bg-[var(--admin-hover)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-600",
        collapsed ? "justify-center px-0" : "px-4",
      )}
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
        <span className="rounded-sm border border-brand-200/70 px-1.5 py-px text-[0.5625rem] font-semibold tracking-[0.12em] text-brand-600 uppercase">
          Admin
        </span>
      )}
    </Link>
  );
}

function StorefrontLink({ collapsed }: { collapsed: boolean }) {
  return (
    <div className={cn("shrink-0 pb-2", collapsed ? "px-2.5" : "px-3")}>
      <Link
        href="/"
        title={collapsed ? "View storefront" : undefined}
        className={cn(
          "flex items-center rounded-md text-sm text-muted-foreground transition-colors duration-150 hover:bg-[var(--admin-hover)] hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600",
          collapsed ? "size-11 justify-center" : "h-10 gap-3 px-3",
        )}
      >
        <ArrowUpRight className="size-4 shrink-0 text-muted-foreground/80" aria-hidden />
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
      // Must match the rail's own width classes below, or the content column
      // is offset by the wrong amount.
      collapsed ? "68px" : "16rem",
    );
  }, [collapsed]);

  const toggle = () => railStore.set(!collapsed);

  return (
    <aside
      data-collapsed={collapsed}
      className={cn(
        "fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-border bg-[var(--admin-rail-bg)] transition-[width] duration-260 ease-[cubic-bezier(0.16,1,0.3,1)] lg:flex",
        collapsed ? "w-[68px]" : "w-64",
      )}
    >
      <Wordmark collapsed={collapsed} />
      <NavList collapsed={collapsed} />
      <StorefrontLink collapsed={collapsed} />

      <div className={cn("shrink-0 border-t border-border py-2", collapsed ? "px-2.5" : "px-3")}>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : undefined}
          className={cn(
            "flex items-center rounded-md text-sm text-muted-foreground transition-colors duration-150 hover:bg-[var(--admin-hover)] hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600",
            collapsed ? "size-11 justify-center" : "h-10 w-full gap-3 px-3",
          )}
        >
          {collapsed ? (
            <PanelLeftOpen className="size-4 shrink-0" aria-hidden />
          ) : (
            <>
              <PanelLeftClose className="size-4 shrink-0 text-muted-foreground/80" aria-hidden />
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
        className="inline-flex size-11 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-[var(--admin-hover)] hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 lg:hidden"
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
            className="admin-safe-top admin-safe-bottom absolute inset-y-0 left-0 flex w-[min(17rem,86vw)] flex-col border-r border-border bg-background shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-border pr-2">
              <Wordmark collapsed={false} />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close admin menu"
                className="inline-flex size-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-[var(--admin-hover)] hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
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
