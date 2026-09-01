"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, CornerDownLeft, Loader2 } from "lucide-react";

import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ADMIN_NAV } from "@/components/admin/admin-nav-config";
import type { AdminSearchResults } from "@/lib/queries/admin-search";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * ⌘K / Ctrl-K.
 *
 * Two modes in one list. With no query it is a keyboard route switcher over
 * the same `ADMIN_NAV` the sidebar uses. With a query it becomes real search
 * across products, orders and customers, fetched server-side and hard-limited
 * to five rows per group — the browser never receives a table.
 *
 * Every row here navigates. There are no "commands" that mutate data: an
 * action fired from a fuzzy list, one keystroke after a typo, is the wrong
 * place to delete a product.
 */

type Row = { id: string; label: string; hint?: string; href: string; group: string };

const EMPTY: AdminSearchResults = { products: [], orders: [], customers: [] };

export function AdminCommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AdminSearchResults>(EMPTY);
  const [loading, startLoading] = useTransition();
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((value) => !value);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Debounced, and skipped entirely under two characters — that query would be
  // a near-full scan for a result nobody can use.
  useEffect(() => {
    const term = query.trim();
    // Below two characters nothing is fetched and nothing is written: the
    // `searching` flag below decides whether `results` is read at all, so
    // there is no stale set to clear.
    if (term.length < 2) return;

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      startLoading(async () => {
        try {
          const response = await fetch(
            `/api/admin/search?q=${encodeURIComponent(term)}`,
            { signal: controller.signal },
          );
          if (!response.ok) return;
          setResults((await response.json()) as AdminSearchResults);
        } catch {
          // Aborted or offline — the previous rows stay until the next result.
        }
      });
    }, 200);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  const searching = query.trim().length >= 2;

  const rows: Row[] = searching
    ? [
        ...results.products.map((p) => ({
          id: `p-${p.id}`,
          group: "Products",
          label: p.name,
          hint: `${formatMoney(p.priceCents)} · ${p.isActive ? "Published" : "Hidden"}`,
          href: `/admin/products/${p.id}/edit`,
        })),
        ...results.orders.map((o) => ({
          id: `o-${o.id}`,
          group: "Orders",
          label: o.orderNumber,
          hint: `${o.customerName} · ${formatMoney(o.totalCents)} · ${o.status}`,
          href: `/admin/orders/${o.orderNumber}`,
        })),
        ...results.customers.map((c) => ({
          id: `c-${c.id}`,
          group: "Customers",
          label: c.name ?? c.email,
          hint: `${c.orders} ${c.orders === 1 ? "order" : "orders"} · ${formatMoney(c.spentCents)} spent`,
          href: `/admin/customers/${c.id}`,
        })),
      ]
    : ADMIN_NAV.flatMap((group) =>
        group.items.map((item) => ({
          id: item.href,
          group: group.label,
          label: item.label,
          href: item.href,
        })),
      );

  // Keep the cursor inside the list as it shrinks under a longer query.
  const active = Math.min(cursor, Math.max(0, rows.length - 1));

  /**
   * Closing clears the search here rather than in an effect watching `open`:
   * the close is the cause, so that is where the reset belongs, and it avoids
   * a cascading render every time the dialog toggles.
   */
  function close() {
    setOpen(false);
    setQuery("");
    setResults(EMPTY);
    setCursor(0);
  }

  function go(row: Row | undefined) {
    if (!row) return;
    close();
    router.push(row.href);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setCursor((c) => (c + 1) % Math.max(1, rows.length));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setCursor((c) => (c - 1 + rows.length) % Math.max(1, rows.length));
    } else if (event.key === "Enter") {
      event.preventDefault();
      go(rows[active]);
    }
  }

  // Group headings are derived by comparing each row with the one before it,
  // rather than by mutating a cursor variable during render — the flat list
  // stays the single source of both the headings and the keyboard index.

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 min-w-0 items-center gap-2 rounded-lg border border-border bg-surface-alt px-3 text-sm text-muted-foreground transition-colors hover:border-brand-300 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 sm:w-64"
      >
        <Search className="size-4 shrink-0" aria-hidden />
        <span className="hidden truncate sm:inline">Search…</span>
        <kbd className="ml-auto hidden shrink-0 rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[0.625rem] text-muted-foreground sm:inline">
          ⌘K
        </kbd>
        <span className="sr-only">Search products, orders and customers</span>
      </button>

      <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
        <DialogContent
          showCloseButton={false}
          className="top-[12%] max-w-xl translate-y-0 gap-0 overflow-hidden p-0"
        >
          <DialogTitle className="sr-only">Admin search</DialogTitle>
          <DialogDescription className="sr-only">
            Type to search products, orders and customers, or choose a page. Use the
            arrow keys to move and Enter to open.
          </DialogDescription>

          <div className="flex items-center gap-3 border-b border-border px-4">
            <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setCursor(0);
              }}
              onKeyDown={onKeyDown}
              autoFocus
              placeholder="Search orders, products, customers…"
              aria-label="Search"
              className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {loading && (
              <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden />
            )}
          </div>

          <div className="max-h-[55vh] overflow-y-auto p-2">
            {rows.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                {searching
                  ? `Nothing matches “${query.trim()}”.`
                  : "Start typing to search."}
              </p>
            ) : (
              <ul role="listbox" aria-label="Results">
                {rows.map((row, index) => {
                  const heading =
                    row.group !== rows[index - 1]?.group ? row.group : null;

                  return (
                    <li key={row.id}>
                      {heading && (
                        <p className="px-3 pt-3 pb-1 text-[0.6875rem] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
                          {heading}
                        </p>
                      )}
                      <button
                        type="button"
                        role="option"
                        aria-selected={index === active}
                        onMouseEnter={() => setCursor(index)}
                        onClick={() => go(row)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                          index === active
                            ? "bg-surface-alt text-foreground"
                            : "text-muted-foreground hover:bg-surface-alt/60",
                        )}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium text-foreground">
                            {row.label}
                          </span>
                          {row.hint && (
                            <span className="block truncate text-xs text-muted-foreground">
                              {row.hint}
                            </span>
                          )}
                        </span>
                        {index === active && (
                          <CornerDownLeft
                            className="size-3.5 shrink-0 text-muted-foreground"
                            aria-hidden
                          />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
