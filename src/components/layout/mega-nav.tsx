"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Menu, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import { fadeUp, panelVariants, staggerContainer } from "@/lib/motion";

export type MegaCategory = {
  id: string;
  name: string;
  slug: string;
  image: string | null;
};

export type MegaProduct = {
  id: string;
  name: string;
  slug: string;
  priceCents: number;
  imageUrl: string | null;
};

/**
 * Desktop navigation with a single "Shop" mega-panel.
 *
 * Only one item opens a panel — a shop this size does not need a menu per
 * category, and a single well-organised panel is faster to scan. The panel
 * opens on hover for pointer users and on click/Enter for keyboard users, and
 * closes on Escape or when focus leaves.
 */
export function MegaNav({
  categories,
  featured,
}: {
  categories: MegaCategory[];
  featured: MegaProduct[];
}) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<number | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // The panel is closed by the click that navigates rather than by watching the
  // pathname — the event is the cause, so that is where the state change belongs.
  const close = () => setOpen(false);

  function scheduleClose() {
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(false), 120);
  }

  function cancelClose() {
    window.clearTimeout(closeTimer.current);
  }

  return (
    // Full height so each item's hover target and underline track the header
    // as it compacts, rather than floating at a fixed 64px.
    <div
      ref={containerRef}
      className="hidden h-full lg:block"
      onMouseLeave={scheduleClose}
      onBlur={(event) => {
        if (!containerRef.current?.contains(event.relatedTarget as Node)) setOpen(false);
      }}
    >
      {/*
        The trigger is the Figma's menu button (253:7) — a 48px round control
        beside the wordmark — not the horizontal list this used to be.
        Those `mainNav` links have not been dropped: they moved to the category
        rail below, which is where the design puts them, and rendering them
        here as well would give the header two navigations saying the same
        thing. The panel underneath is unchanged.
      */}
      <nav aria-label="Main" className="flex h-full items-center">
        <button
          type="button"
          aria-expanded={open}
          aria-haspopup="true"
          aria-label={open ? "Close shop menu" : "Open shop menu"}
          onMouseEnter={() => {
            cancelClose();
            setOpen(true);
          }}
          onClick={() => setOpen((value) => !value)}
          className={cn(
            "inline-flex size-12 items-center justify-center rounded-full transition-colors",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-600",
            open
              ? "bg-near-black/8 text-royal-600"
              : "text-near-black hover:bg-near-black/5 hover:text-royal-600",
          )}
        >
          {open ? (
            <X className="size-6" aria-hidden />
          ) : (
            <Menu className="size-6" aria-hidden />
          )}
        </button>
      </nav>

      <AnimatePresence>
        {open && (
          // The panel drops fast; its three columns follow on a 40ms heel. A
          // menu the shopper is waiting on must never feel like a performance,
          // so the whole sequence is under a quarter of a second.
          <motion.div
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onMouseEnter={cancelClose}
            className="absolute inset-x-0 top-full z-40 border-t border-border bg-surface shadow-card"
          >
            <motion.div
              variants={staggerContainer(0.04, 0.04)}
              initial="hidden"
              animate="visible"
              className="container-page grid grid-cols-12 gap-10 py-10"
            >
              <motion.div variants={fadeUp} className="col-span-5">
                <h2 className="label-caps mb-5 text-muted-foreground">Categories</h2>
                <ul className="grid grid-cols-2 gap-x-6 gap-y-3">
                  {categories.map((category) => (
                    <li key={category.id}>
                      <Link
                        href={`/shop/${category.slug}`}
                        onClick={close}
                        className="group/link flex items-center gap-3 py-1 text-sm transition-colors hover:text-royal-600"
                      >
                        <span className="relative size-11 shrink-0 overflow-hidden bg-surface-alt">
                          {category.image && (
                            <Image
                              src={category.image}
                              alt=""
                              fill
                              sizes="44px"
                              className="object-cover transition-transform duration-500 group-hover/link:scale-105"
                            />
                          )}
                        </span>
                        {category.name}
                      </Link>
                    </li>
                  ))}
                </ul>

                <Link
                  href="/shop"
                  onClick={close}
                  className="label-caps mt-6 inline-flex items-center gap-2 text-brand-600 hover:underline"
                >
                  View everything
                  <ArrowRight className="size-3.5" aria-hidden />
                </Link>
              </motion.div>

              <motion.div variants={fadeUp} className="col-span-4">
                <h2 className="label-caps mb-5 text-muted-foreground">Featured</h2>
                <ul className="grid grid-cols-2 gap-5">
                  {featured.slice(0, 2).map((product) => (
                    <li key={product.id}>
                      <Link
                        href={`/products/${product.slug}`}
                        onClick={close}
                        className="group/feat block"
                      >
                        <span className="relative block aspect-[4/5] overflow-hidden bg-surface-alt">
                          {product.imageUrl && (
                            <Image
                              src={product.imageUrl}
                              alt=""
                              fill
                              sizes="160px"
                              /* A real product, so shown whole. The category
                                 thumbnails above stay cropped — those are
                                 decorative crops of scene photography. */
                              className="object-contain transition-transform duration-500 group-hover/feat:scale-[1.03]"
                            />
                          )}
                        </span>
                        <span className="mt-2.5 block text-sm font-medium">{product.name}</span>
                        <span className="block text-sm text-muted-foreground">
                          {formatMoney(product.priceCents)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </motion.div>

              <motion.div variants={fadeUp} className="col-span-3">
                <div className="flex h-full flex-col justify-between bg-brand-800 p-6 text-white">
                  <div>
                    <p className="label-caps text-royal-300">Made to order</p>
                    <p className="font-display mt-3 text-2xl leading-tight">
                      Bouquets in your colours
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-white/70">
                      Matched from a photograph before a single stitch is worked.
                    </p>
                  </div>
                  <Link
                    href="/shop/crochet-bouquets"
                    onClick={close}
                    className="label-caps mt-6 inline-flex items-center gap-2 text-white hover:text-royal-300"
                  >
                    Explore bouquets
                    <ArrowRight className="size-3.5" aria-hidden />
                  </Link>
                </div>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}



