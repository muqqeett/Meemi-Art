"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Search, X, Loader2, CornerDownLeft } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { formatMoney } from "@/lib/money";
import { duration, ease, fadeUp, staggerContainer } from "@/lib/motion";
import { cn } from "@/lib/utils";

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

/**
 * Header search. Opens a dialog with debounced typeahead suggestions and hands
 * the full query off to `/search`, where the real server-side filtering runs.
 */
export function SearchDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestions>(EMPTY);
  const [loading, startLoading] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

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

  // Focus the field when the palette opens. `focus()` touches the DOM rather
  // than React state, so it does not cascade a render.
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Debounced fetch so a fast typist does not fire a request per keystroke.
  useEffect(() => {
    const term = query.trim();
    // Short queries simply skip the fetch. Any previous suggestions are never
    // rendered in this state, so there is nothing to clear — and clearing here
    // would set state synchronously inside the effect.
    if (term.length < 2) return;

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      startLoading(async () => {
        try {
          const response = await fetch(`/api/search/suggestions?q=${encodeURIComponent(term)}`, {
            signal: controller.signal,
          });
          if (!response.ok) return;
          setSuggestions((await response.json()) as Suggestions);
        } catch {
          // Aborted or offline — leave the previous suggestions in place.
        }
      });
    }, 220);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const term = query.trim();
    if (!term) return;
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(term)}`);
  }

  const hasResults = suggestions.products.length > 0 || suggestions.categories.length > 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex size-11 items-center justify-center rounded-full text-brand-700 transition-colors hover:bg-surface-alt hover:text-royal-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-600"
        aria-label="Search products"
      >
        <Search className="size-5" aria-hidden />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={false}
          className="top-[12%] max-w-2xl translate-y-0 gap-0 overflow-hidden p-0"
        >
          <DialogTitle className="sr-only">Search products</DialogTitle>
          <DialogDescription className="sr-only">
            Type at least two characters to see suggestions, or press Enter for full results.
          </DialogDescription>

          <form onSubmit={submit} className="flex items-center gap-3 border-b border-border px-4">
            <Search className="size-5 shrink-0 text-muted-foreground" aria-hidden />
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search for bags, bouquets, plushies…"
              className="h-14 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
              aria-label="Search products"
              autoComplete="off"
            />
            {loading && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden />}
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="rounded-full p-1 text-muted-foreground hover:bg-surface-alt hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="size-4" aria-hidden />
              </button>
            )}
          </form>

          {/* The panel scrolls its own results, so the dialog itself never
              resizes as suggestions arrive and the field under the cursor
              cannot jump. `mode="wait"` keeps two result sets from overlapping
              mid-keystroke. */}
          <div className="max-h-[60vh] min-h-[8rem] overflow-y-auto p-2">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={
                  query.trim().length < 2
                    ? "idle"
                    : !hasResults && !loading
                      ? "empty"
                      : "results"
                }
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: duration.fast, ease: ease.standard }}
              >
                {query.trim().length < 2 ? (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                Start typing to search the catalogue.
              </p>
            ) : !hasResults && !loading ? (
              <div className="px-3 py-8 text-center">
                <p className="text-sm font-medium text-foreground">
                  No matches for “{query.trim()}”
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Try a different term, or browse the full shop.
                </p>
                <Link
                  href="/shop"
                  onClick={() => setOpen(false)}
                  className="mt-4 inline-block text-sm font-semibold text-brand-600 hover:underline"
                >
                  Browse all products
                </Link>
              </div>
            ) : (
              // Staggered by block, not by row: this fires once when results
              // first appear, and a per-row cascade on every keystroke would be
              // noise in a control the shopper is typing into.
              <motion.div
                variants={staggerContainer(0.04)}
                initial="hidden"
                animate="visible"
              >
                {suggestions.categories.length > 0 && (
                  <motion.section variants={fadeUp} className="mb-2">
                    <h2 className="px-3 py-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      Categories
                    </h2>
                    <ul>
                      {suggestions.categories.map((category) => (
                        <li key={category.id}>
                          <Link
                            href={`/shop/${category.slug}`}
                            onClick={() => setOpen(false)}
                            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm hover:bg-surface-alt"
                          >
                            <span className="font-medium">{category.name}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </motion.section>
                )}

                {suggestions.products.length > 0 && (
                  <motion.section variants={fadeUp}>
                    <h2 className="px-3 py-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      Products
                    </h2>
                    <ul>
                      {suggestions.products.map((product) => (
                        <li key={product.id}>
                          <Link
                            href={`/products/${product.slug}`}
                            onClick={() => setOpen(false)}
                            className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-surface-alt"
                          >
                            <span className="relative size-12 shrink-0 overflow-hidden rounded-md bg-surface-alt">
                              {product.imageUrl && (
                                <Image
                                  src={product.imageUrl}
                                  alt=""
                                  fill
                                  sizes="48px"
                                  className="object-cover"
                                />
                              )}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-foreground">
                                {product.name}
                              </span>
                              <span className="block text-xs text-muted-foreground">
                                {product.brand}
                              </span>
                            </span>
                            <span className="text-sm font-medium text-royal-600">
                              {formatMoney(product.priceCents)}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </motion.section>
                )}

                <motion.button
                  variants={fadeUp}
                  type="button"
                  onClick={submit}
                  className={cn(
                    "mt-2 flex w-full items-center justify-between gap-2 rounded-lg px-3 py-3 text-sm",
                    "text-brand-700 hover:bg-brand-50",
                  )}
                >
                  <span className="font-semibold">
                    See all results for “{query.trim()}”
                  </span>
                  <CornerDownLeft className="size-4" aria-hidden />
                </motion.button>
              </motion.div>
            )}
              </motion.div>
            </AnimatePresence>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}


