"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Search, X, Loader2, CornerDownLeft, AlertCircle } from "lucide-react";

import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { formatMoney } from "@/lib/money";

type Suggestions = {
  products: {
    id: string;
    name: string;
    slug: string;
    brand: string;
    priceCents: number;
    imageUrl: string | null;
  }[];
  categories: { id: string; name: string; slug: string }[];
};

const EMPTY: Suggestions = { products: [], categories: [] };

/** Ids are stable per row so `aria-activedescendant` can point at one. */
const LISTBOX_ID = "search-suggestions";
const rowId = (index: number) => `${LISTBOX_ID}-option-${index}`;

/**
 * Header search.
 *
 * A dialog holding the real field, with debounced typeahead from
 * `/api/search/suggestions` and the full query handed to `/search`, where the
 * server-side filtering actually runs. Both the endpoint and that route are
 * untouched — this is the presentation and the keyboard behaviour around them.
 *
 * The panel is full-screen below `sm` and a centred sheet above it. On a phone
 * a centred dialog leaves the results squeezed between the notch and the
 * keyboard; taking the whole screen gives the list the room it needs and puts
 * the field under the thumb.
 *
 * Keyboard: Cmd/Ctrl-K toggles, Escape closes (Base UI), Enter submits or
 * opens the highlighted row, and Up/Down walk the list. Focus deliberately
 * stays in the input while the highlight moves — a combobox where the arrow
 * keys steal focus is one you cannot keep typing in — so the active row is
 * announced through `aria-activedescendant` rather than by moving the caret.
 */
export function SearchDialog({
  variant = "icon",
}: { variant?: "icon" | "pill" | "plum" | "plum-icon" } = {}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  /**
   * Suggestions tagged with the query they describe.
   *
   * Without the tag, the 220ms debounce window renders the previous query's
   * rows underneath the new query's text — "Crochet Wool Bag" sitting above
   * "See all results for 'reindeer'". That is not only contradictory to read:
   * those rows are in the keyboard list, so Arrow-then-Enter would open a
   * product the shopper never searched for. Comparing the tag to the live term
   * makes a mismatch render as "searching" and keeps the list empty until the
   * results actually belong to what was typed.
   */
  const [suggestions, setSuggestions] = useState<{ term: string; data: Suggestions }>({
    term: "",
    data: EMPTY,
  });
  /** Tagged for the same reason — a stale failure must not label a new query. */
  const [failedTerm, setFailedTerm] = useState<string | null>(null);
  /**
   * The highlighted row, tagged with the query it belongs to.
   *
   * A new query invalidates the old highlight — row three of the previous
   * results is a different product. Storing the term alongside the index lets
   * that be derived during render instead of reset from an effect, which
   * would cascade a second render on every keystroke.
   */
  const [highlight, setHighlight] = useState({ term: "", index: -1 });
  const [loading, startLoading] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  /**
   * The trigger that opened the panel.
   *
   * These are plain buttons rather than `Dialog.Trigger`, so Base UI has no
   * element to hand focus back to on close and it lands on `<body>` — a
   * keyboard user loses their place in the header. `finalFocus` points it at
   * the right button.
   */
  const triggerRef = useRef<HTMLButtonElement>(null);
  /**
   * Bumped by "Try again". The fetch effect keys off the query, so after a
   * failure a shopper retyping the same term changed nothing and sat on the
   * error forever — the one thing the copy tells them to do did not work.
   */
  const [retry, setRetry] = useState(0);

  const term = query.trim();
  const short = term.length < 2;

  // Cmd/Ctrl-K opens search, matching the convention shoppers expect.
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

  // Focus the field when the panel opens. `focus()` touches the DOM rather
  // than React state, so it does not cascade a render.
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Debounced fetch so a fast typist does not fire a request per keystroke.
  useEffect(() => {
    if (short) return;

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      startLoading(async () => {
        try {
          const response = await fetch(`/api/search/suggestions?q=${encodeURIComponent(term)}`, {
            signal: controller.signal,
          });
          if (!response.ok) throw new Error(String(response.status));
          setSuggestions({ term, data: (await response.json()) as Suggestions });
          setFailedTerm(null);
        } catch (error) {
          // An abort is this effect cleaning up after itself, not a failure —
          // surfacing it would flash an error on every other keystroke.
          if (controller.signal.aborted) return;
          if ((error as Error)?.name === "AbortError") return;
          setFailedTerm(term);
        }
      });
    }, 220);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [term, short, retry]);

  /**
   * Every row the arrow keys can reach, in visual order, so the highlight and
   * the rendering cannot disagree about what row three is.
   */
  /** Only the results that belong to the query currently in the field. */
  const results = suggestions.term === term ? suggestions.data : EMPTY;
  const failed = failedTerm === term;
  /** Either the debounce has not fired yet, or the request is in flight. */
  const searching = !short && suggestions.term !== term && !failed;

  const rows = useMemo(() => {
    if (short) return [];
    const list: { key: string; href: string }[] = [
      ...results.categories.map((c) => ({ key: `c-${c.id}`, href: `/shop/${c.slug}` })),
      ...results.products.map((p) => ({ key: `p-${p.id}`, href: `/products/${p.slug}` })),
    ];
    if (list.length > 0) {
      list.push({ key: "all", href: `/search?q=${encodeURIComponent(term)}` });
    }
    return list;
  }, [short, results, term]);

  const hasResults = results.products.length > 0 || results.categories.length > 0;
  const active = highlight.term === term ? highlight.index : -1;
  const setActive = (index: number) => setHighlight({ term, index });

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  function submit(event?: React.FormEvent) {
    event?.preventDefault();
    if (!term) return;
    go(`/search?q=${encodeURIComponent(term)}`);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (rows.length === 0) return;

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const next =
        event.key === "ArrowDown"
          ? active + 1 >= rows.length
            ? 0
            : active + 1
          : active - 1 < 0
            ? rows.length - 1
            : active - 1;
      setActive(next);
      listRef.current
        ?.querySelector(`#${CSS.escape(rowId(next))}`)
        ?.scrollIntoView({ block: "nearest" });
      return;
    }

    if (event.key === "Enter" && active >= 0) {
      event.preventDefault();
      go(rows[active].href);
    }
  }

  /** Shared by all four triggers so the expanded state is never forgotten. */
  const triggerProps = {
    ref: triggerRef,
    type: "button" as const,
    onClick: () => setOpen(true),
    "aria-haspopup": "dialog" as const,
    "aria-expanded": open,
    "aria-label": "Search products",
  };

  /** Index of a row within the flat keyboard list, for `aria-selected`. */
  const indexOf = (key: string) => rows.findIndex((row) => row.key === key);

  return (
    <>
      {/*
        Four triggers, one dialog. The Plum header draws a sunken field on
        desktop and an icon on mobile; the two legacy variants remain for the
        old header, which `/not-found` still renders.

        The field is a `button`, not an `input`: the real one lives in the
        dialog with the suggestion list attached to it, and two inputs
        competing for the same query would be two places to type and one of
        them wrong.
      */}
      {variant === "plum" ? (
        <button
          {...triggerProps}
          className="pl-focus font-figtree flex h-11 w-full items-center gap-2 rounded-full bg-pl-sunken px-4 text-left text-sm leading-[22px] text-pl-muted transition-colors hover:bg-plum-100"
        >
          <Search className="size-5 shrink-0" aria-hidden />
          <span className="truncate">Search patterns…</span>
        </button>
      ) : variant === "plum-icon" ? (
        <button
          {...triggerProps}
          className="pl-focus inline-flex size-11 items-center justify-center rounded-full text-pl-text transition-colors hover:bg-plum-100"
        >
          <Search className="size-6" aria-hidden />
        </button>
      ) : variant === "pill" ? (
        <button
          {...triggerProps}
          className="group/search flex h-12 w-full items-center gap-3 rounded-full border border-near-black/25 bg-surface px-4 text-left transition-colors hover:border-near-black/45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-600"
        >
          <Search
            className="size-5 shrink-0 text-muted-foreground transition-colors group-hover/search:text-near-black"
            aria-hidden
          />
          <span className="truncate text-base text-muted-foreground">Search…</span>
        </button>
      ) : (
        <button
          {...triggerProps}
          className="inline-flex size-11 items-center justify-center rounded-full text-brand-700 transition-colors hover:bg-surface-alt hover:text-royal-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-600"
        >
          <Search className="size-5" aria-hidden />
        </button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={false}
          finalFocus={triggerRef}
          className={[
            // `flex flex-col` overrides the primitive's `grid`: as a grid the
            // rows share the free height of a full-screen panel, which pushed
            // the field into the middle of the phone screen. A column puts the
            // field at the top and lets the list take what is left.
            "font-figtree flex flex-col gap-0 overflow-hidden bg-pl-surface p-0 text-pl-text ring-0",
            "shadow-[0_4px_5px_rgba(36,17,63,0.06),0_24px_24px_rgba(36,17,63,0.28)]",
            // Phone: the whole screen. `h-dvh` tracks the collapsing browser
            // toolbar, and the translate the primitive applies for centring is
            // undone rather than fought with.
            "top-0 left-0 h-dvh max-h-dvh w-screen max-w-none translate-x-0 translate-y-0 rounded-none",
            // Tablet up: a centred sheet, held near the top so the list grows
            // downward into space the reader is already looking at.
            "sm:top-[10%] sm:left-1/2 sm:h-auto sm:max-h-[min(34rem,80dvh)] sm:w-full sm:max-w-2xl sm:-translate-x-1/2 sm:rounded-[20px]",
          ].join(" ")}
        >
          <DialogTitle className="sr-only">Search products</DialogTitle>
          <DialogDescription className="sr-only">
            Type at least two characters to see suggestions, or press Enter for full results.
          </DialogDescription>

          <form
            onSubmit={submit}
            role="search"
            className="flex shrink-0 items-center gap-2 border-b border-pl-line px-3 pt-[env(safe-area-inset-top)] sm:px-4"
          >
            <Search className="size-5 shrink-0 text-pl-muted" aria-hidden />
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Search patterns…"
              // 16px on the field itself: anything smaller and iOS zooms the
              // page on focus, which no amount of viewport meta prevents.
              className="h-14 min-w-0 flex-1 bg-transparent text-base text-pl-text outline-none placeholder:text-pl-muted"
              aria-label="Search products"
              autoComplete="off"
              role="combobox"
              aria-expanded={rows.length > 0}
              aria-controls={LISTBOX_ID}
              aria-autocomplete="list"
              aria-activedescendant={active >= 0 ? rowId(active) : undefined}
            />

            {loading && (
              <Loader2 className="size-4 shrink-0 animate-spin text-pl-muted" aria-hidden />
            )}

            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setSuggestions({ term: "", data: EMPTY });
                  setFailedTerm(null);
                  inputRef.current?.focus();
                }}
                className="pl-focus inline-flex size-9 shrink-0 items-center justify-center rounded-full text-pl-muted transition-colors hover:bg-plum-100 hover:text-pl-text"
                aria-label="Clear search"
              >
                <X className="size-4" aria-hidden />
              </button>
            )}

            {/* A visible way out. Escape works too, but a phone keyboard
                covers that and a thumb needs a target. */}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="pl-focus inline-flex h-9 shrink-0 items-center justify-center rounded-full px-3 text-[13px] leading-[18px] font-bold text-pl-muted transition-colors hover:bg-plum-100 hover:text-pl-text"
            >
              Close
            </button>
          </form>

          {/* The panel scrolls its own results, so the field under the cursor
              never moves as suggestions arrive. */}
          <div
            ref={listRef}
            id={LISTBOX_ID}
            role="listbox"
            aria-label="Search suggestions"
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2 sm:max-h-[26rem]"
          >
            {short ? (
              <p className="px-3 py-10 text-center text-sm leading-[22px] text-pl-muted">
                Start typing to search the catalogue.
              </p>
            ) : failed && !hasResults ? (
              <div className="flex flex-col items-center gap-2 px-3 py-10 text-center">
                <AlertCircle className="size-6 text-pl-muted" aria-hidden />
                <p className="text-base leading-[22px] font-bold text-pl-text">
                  Search is unavailable
                </p>
                <p className="text-sm leading-[22px] text-pl-muted">
                  Check your connection, or press Enter to open the full shop search.
                </p>
                <button
                  type="button"
                  onClick={() => setRetry((n) => n + 1)}
                  className="pl-focus mt-1 inline-flex min-h-11 items-center rounded-full bg-plum-900 px-5 text-sm leading-[22px] font-bold text-pl-on-dark transition-colors hover:bg-plum-800"
                >
                  Try again
                </button>
              </div>
            ) : searching ? (
              // The debounce window and the request itself. Saying "searching"
              // is honest about the gap; the alternative — holding the last
              // query's rows on screen — reads as an answer to a question the
              // shopper did not ask.
              <p
                role="status"
                className="flex items-center justify-center gap-2 px-3 py-10 text-center text-sm leading-[22px] text-pl-muted"
              >
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Searching…
              </p>
            ) : !hasResults ? (
              <div className="px-3 py-10 text-center">
                <p className="text-base leading-[22px] font-bold text-pl-text">
                  No matches for “{term}”
                </p>
                <p className="mt-1 text-sm leading-[22px] text-pl-muted">
                  Try a different term, or browse everything.
                </p>
                <Link
                  href="/shop"
                  onClick={() => setOpen(false)}
                  className="pl-focus mt-4 inline-block rounded-sm text-sm leading-[22px] font-bold text-plum-500 hover:underline"
                >
                  Browse all patterns
                </Link>
              </div>
            ) : (
              <>
                {results.categories.length > 0 && (
                  <section className="mb-1">
                    <h2 className="px-3 py-2 text-[11px] leading-4 font-bold tracking-[0.08em] text-pl-muted uppercase">
                      Categories
                    </h2>
                    <ul>
                      {results.categories.map((category) => {
                        const index = indexOf(`c-${category.id}`);
                        return (
                          <li key={category.id}>
                            <Link
                              id={rowId(index)}
                              role="option"
                              aria-selected={index === active}
                              href={`/shop/${category.slug}`}
                              onClick={() => setOpen(false)}
                              onMouseEnter={() => setActive(index)}
                              className={[
                                "pl-focus flex min-h-12 items-center gap-3 rounded-[12px] px-3 text-sm leading-[22px] font-bold transition-colors",
                                index === active ? "bg-plum-100" : "hover:bg-pl-subtle",
                              ].join(" ")}
                            >
                              {category.name}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                )}

                {results.products.length > 0 && (
                  <section>
                    <h2 className="px-3 py-2 text-[11px] leading-4 font-bold tracking-[0.08em] text-pl-muted uppercase">
                      Patterns
                    </h2>
                    <ul>
                      {results.products.map((product) => {
                        const index = indexOf(`p-${product.id}`);
                        return (
                          <li key={product.id}>
                            <Link
                              id={rowId(index)}
                              role="option"
                              aria-selected={index === active}
                              href={`/products/${product.slug}`}
                              onClick={() => setOpen(false)}
                              onMouseEnter={() => setActive(index)}
                              className={[
                                "pl-focus flex items-center gap-3 rounded-[12px] p-2 transition-colors",
                                index === active ? "bg-plum-100" : "hover:bg-pl-subtle",
                              ].join(" ")}
                            >
                              <span className="relative size-12 shrink-0 overflow-hidden rounded-[10px] bg-pl-tint-crochet">
                                {product.imageUrl && (
                                  <Image
                                    src={product.imageUrl}
                                    alt=""
                                    fill
                                    sizes="48px"
                                    className="object-contain p-1"
                                  />
                                )}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm leading-[22px] font-bold tracking-[-0.005em] text-pl-text">
                                  {product.name}
                                </span>
                                <span className="block truncate text-[13px] leading-[18px] font-medium text-pl-muted">
                                  {product.brand}
                                </span>
                              </span>
                              <span className="pl-display pl-price shrink-0 text-base">
                                {formatMoney(product.priceCents)}
                              </span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                )}

                {rows.length > 0 && (
                  <button
                    id={rowId(rows.length - 1)}
                    role="option"
                    aria-selected={active === rows.length - 1}
                    type="button"
                    onClick={() => submit()}
                    onMouseEnter={() => setActive(rows.length - 1)}
                    className={[
                      "pl-focus mt-1 flex min-h-12 w-full items-center justify-between gap-2 rounded-[12px] px-3 text-sm leading-[22px] font-bold text-plum-500 transition-colors",
                      active === rows.length - 1 ? "bg-plum-100" : "hover:bg-pl-subtle",
                    ].join(" ")}
                  >
                    <span className="truncate">See all results for “{term}”</span>
                    <CornerDownLeft className="size-4 shrink-0" aria-hidden />
                  </button>
                )}

                {/* A failure that still has stale results to show says so
                    quietly rather than replacing them. */}
                {failed && (
                  <p
                    role="status"
                    className="px-3 py-2 text-[13px] leading-[18px] font-medium text-pl-muted"
                  >
                    Showing earlier results — the last search did not reach the server.
                  </p>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
