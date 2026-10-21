"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ChevronDown } from "lucide-react";

import { formatMoney } from "@/lib/money";
import { SHOP_CATEGORIES } from "@/lib/shop-categories";
import { cn } from "@/lib/utils";

/** Where an illustration's artwork sits inside its 40px box, as CSS `inset`. */
type Placement = { group: string; bleed: string };

type MenuCategory = {
  name: string;
  slug: string;
  tint: string;
  art: string;
  placement: Placement;
};

/** Artwork per category slug: the design's "Elements" objects, 40px in a 52px tile. */
const ART: Record<string, { art: string; placement: Placement }> = {
  "crochet-patterns": {
    art: "/menu/crochet.svg",
    placement: { group: "11.67% 12.91% 11.67% 12.83%", bleed: "-1.63% -1.68%" },
  },
  templates: { art: "/menu/templates.svg", placement: { group: "13.33%", bleed: "-1.7%" } },
  printables: {
    art: "/menu/printables.svg",
    placement: { group: "10.83% 15.58% 10.83% 16.08%", bleed: "-1.6% -1.83% -1.6% -2.44%" },
  },
  "creator-assets": {
    art: "/menu/assets.svg",
    placement: { group: "18.33% 11.67%", bleed: "-1.97% -1.63%" },
  },
  "ebooks-guides": {
    art: "/menu/ebooks.svg",
    placement: { group: "11.67% 18.33%", bleed: "-1.63% -1.97%" },
  },
};

/**
 * The shop's five top-level categories, in the order the design draws them —
 * the same five as the homepage tiles and the mobile drawer. Only these five
 * are listed; the menu is not built from whatever categories happen to exist
 * in the CMS.
 */
const CATEGORIES: readonly MenuCategory[] = SHOP_CATEGORIES.map((spec) => ({
  name: spec.name,
  slug: spec.slug,
  tint: spec.tint,
  ...ART[spec.slug],
}));

/** Where a category row goes: its page, `/c/<slug>`. */
const categoryHref = (slug: string) => `/c/${slug}`;

/**
 * The design's FEATURED links. The shop has no Bestsellers, Bundles or Free
 * pages yet, so each goes to the nearest real listing rather than a 404 —
 * repoint them here when those pages exist.
 */
const FEATURED_LINKS = [
  { key: "new", label: "New & drops", href: "/shop?sort=newest" },
  { key: "best", label: "Bestsellers", href: "/shop?sort=rating" },
  { key: "bundles", label: "Bundles", href: "/shop" },
  { key: "free", label: "Free patterns", href: "/shop" },
] as const;

export type ShopMenuFeature = {
  name: string;
  slug: string;
  shortDescription: string | null;
  priceCents: number;
  /** Added within the last 30 days — decides whether the card says "new". */
  isNew: boolean;
};

export type ShopMenuProps = {
  /** Slugs of the five categories that currently list at least one product. */
  liveSlugs: string[];
  /** Products added in the last 30 days. */
  newCount: number;
  /** The newest listed product, or null when the shop is empty. */
  feature: ShopMenuFeature | null;
};

const OPEN_DELAY_MS = 300;
const CLOSE_DELAY_MS = 500;

const LABEL = "text-xs font-bold tracking-[0.12em] text-pl-muted";
const BADGE =
  "rounded-full bg-pl-tint-templates px-2 py-0.5 text-[11px] font-bold text-pl-text";

function Thumb({ category }: { category: MenuCategory }) {
  return (
    <span
      aria-hidden
      className={cn("relative block size-[52px] shrink-0 overflow-hidden rounded-[10px]", category.tint)}
    >
      <span className="absolute top-1.5 left-1.5 block size-10 transition-transform duration-200 group-hover/row:scale-[1.06] motion-reduce:transition-none motion-reduce:group-hover/row:scale-100">
        <span className="absolute" style={{ inset: category.placement.group }}>
          <span className="absolute" style={{ inset: category.placement.bleed }}>
            <Image src={category.art} alt="" fill unoptimized className="max-w-none object-fill" />
          </span>
        </span>
      </span>
    </span>
  );
}

/**
 * Desktop "Shop" menu — Figma Components › Mega menu (147:3846).
 *
 * Behaviour, from the design's interaction notes:
 *  - hover opens after 300ms and is fully visible within 100ms (fade + 6px
 *    slide); the pointer leaving the trigger and the panel closes it after a
 *    500ms grace, so a diagonal move toward the panel is safe;
 *  - a click or tap toggles at once, and touch never depends on hover. A click
 *    on a menu the hover just opened pins it open rather than closing it;
 *  - Esc closes and returns focus to Shop; so does clicking outside, tabbing
 *    out of the menu, or following a link. ArrowDown on Shop opens the panel
 *    and moves focus to its first link.
 *
 * With reduced motion the panel simply appears — no slide, no fade.
 */
export function ShopMenu({ liveSlugs, newCount, feature }: ShopMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const openTimer = useRef<number | undefined>(undefined);
  const closeTimer = useRef<number | undefined>(undefined);
  /** How the menu was opened: a pointer hover can be pinned by a click. */
  const openedBy = useRef<"hover" | "click" | null>(null);
  const focusFirst = useRef(false);

  const clearTimers = useCallback(() => {
    window.clearTimeout(openTimer.current);
    window.clearTimeout(closeTimer.current);
  }, []);

  const close = useCallback(() => {
    clearTimers();
    openedBy.current = null;
    setOpen(false);
  }, [clearTimers]);

  useEffect(() => clearTimers, [clearTimers]);

  // Move focus into the panel only once it is no longer inert.
  useEffect(() => {
    if (open && focusFirst.current) {
      focusFirst.current = false;
      panelRef.current?.querySelector<HTMLElement>("a[href]")?.focus();
    }
  }, [open]);

  // Click or tap anywhere else closes it.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) close();
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, close]);

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape" && open) {
      event.stopPropagation();
      close();
      triggerRef.current?.focus();
    }
  }

  function onTriggerKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      clearTimers();
      openedBy.current = "click";
      if (open) panelRef.current?.querySelector<HTMLElement>("a[href]")?.focus();
      else {
        focusFirst.current = true;
        setOpen(true);
      }
    }
  }

  function onTriggerClick() {
    clearTimers();
    if (open && openedBy.current === "hover") {
      openedBy.current = "click";
      return;
    }
    if (open) {
      close();
    } else {
      openedBy.current = "click";
      setOpen(true);
    }
  }

  function onTriggerPointerEnter(event: React.PointerEvent) {
    // Touch and pen fire a synthetic enter before the click; the click alone
    // decides there, so hover timing is for a real mouse only.
    if (event.pointerType !== "mouse" || open) return;
    window.clearTimeout(openTimer.current);
    openTimer.current = window.setTimeout(() => {
      openedBy.current = "hover";
      setOpen(true);
    }, OPEN_DELAY_MS);
  }

  function onRootPointerEnter(event: React.PointerEvent) {
    if (event.pointerType === "mouse") window.clearTimeout(closeTimer.current);
  }

  function onRootPointerLeave(event: React.PointerEvent) {
    if (event.pointerType !== "mouse") return;
    window.clearTimeout(openTimer.current);
    // A menu the shopper clicked open stays until they dismiss it.
    if (!open || openedBy.current === "click") return;
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(close, CLOSE_DELAY_MS);
  }

  function onBlur(event: React.FocusEvent) {
    if (!rootRef.current?.contains(event.relatedTarget as Node | null)) {
      // Focus leaving the menu entirely. `relatedTarget` is null when the
      // window itself loses focus, which should not dismiss it.
      if (event.relatedTarget) close();
    }
  }

  const live = new Set(liveSlugs);

  return (
    <div
      ref={rootRef}
      className="hidden h-full lg:block"
      onPointerEnter={onRootPointerEnter}
      onPointerLeave={onRootPointerLeave}
      onKeyDown={onKeyDown}
      onBlur={onBlur}
    >
      <nav aria-label="Main" className="flex h-full items-center">
        <button
          ref={triggerRef}
          type="button"
          aria-expanded={open}
          aria-controls="shop-menu"
          onClick={onTriggerClick}
          onKeyDown={onTriggerKeyDown}
          onPointerEnter={onTriggerPointerEnter}
          className={cn(
            "pl-focus font-figtree inline-flex h-11 items-center justify-center gap-1 rounded-full px-3 text-[15px] leading-[18px] font-bold text-pl-text transition-colors",
            open ? "bg-plum-100" : "hover:bg-plum-100",
          )}
        >
          Shop
          <ChevronDown
            className={cn("size-5 transition-transform motion-reduce:transition-none", open && "rotate-180")}
            aria-hidden
          />
        </button>
      </nav>

      {/* Always in the DOM so the links are present for crawlers, but inert —
          out of the tab order and the accessibility tree — until it opens. */}
      <div
        ref={panelRef}
        id="shop-menu"
        role="region"
        aria-label="Shop categories"
        inert={!open}
        className={cn(
          "font-figtree absolute inset-x-0 top-full z-40 border-b border-pl-line bg-pl-surface [filter:drop-shadow(0_30px_20px_rgba(36,17,63,0.35))]",
          "transition-[opacity,transform] duration-100 ease-out motion-reduce:transition-none",
          open
            ? "visible translate-y-0 opacity-100"
            : "pointer-events-none invisible -translate-y-1.5 opacity-0 motion-reduce:translate-y-0",
        )}
      >
        <div className="mx-auto flex w-full max-w-[1280px] items-start gap-12 py-10 pr-[39px] pl-12">
          <div className="flex w-[528px] min-w-0 shrink flex-col gap-5">
            <p id="shop-menu-categories" className={LABEL}>
              CATEGORIES
            </p>
            <ul
              aria-labelledby="shop-menu-categories"
              className="grid w-full max-w-[528px] grid-cols-2 gap-x-3 gap-y-2"
            >
              {CATEGORIES.map((category) => {
                const isLive = live.has(category.slug);
                const rowClass =
                  "group/row flex w-full items-center gap-3.5 rounded-[12px] py-1.5 pr-2 pl-1.5 text-base font-medium";
                return (
                  <li key={category.slug}>
                    {isLive ? (
                      <Link
                        href={categoryHref(category.slug)}
                        onClick={close}
                        className={cn(rowClass, "pl-focus text-pl-text transition-colors hover:bg-pl-subtle")}
                      >
                        <Thumb category={category} />
                        {category.name}
                      </Link>
                    ) : (
                      // No products yet (or the category is not set up): the
                      // row is shown but is not a link — the same rule as the
                      // homepage tiles — and says so.
                      <div className={cn(rowClass, "text-pl-muted")}>
                        <Thumb category={category} />
                        <span>{category.name}</span>
                        <span className={BADGE}>Soon</span>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            <Link
              href="/shop"
              onClick={close}
              className="pl-focus -ml-1 inline-flex items-center gap-1.5 self-start rounded-md px-1 text-[13px] font-bold tracking-[0.1em] text-plum-500"
            >
              VIEW EVERYTHING
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>

          <div className="flex w-[220px] shrink-0 flex-col gap-5">
            <p id="shop-menu-featured" className={LABEL}>
              FEATURED
            </p>
            <ul aria-labelledby="shop-menu-featured" className="flex flex-col gap-1">
              {FEATURED_LINKS.map((link) => (
                <li key={link.key}>
                  <Link
                    href={link.href}
                    onClick={close}
                    className="pl-focus flex items-center gap-2 rounded-md py-[9px] text-base font-medium text-pl-text hover:underline"
                  >
                    {link.label}
                    {link.key === "new" && newCount > 0 && (
                      <span className={BADGE}>{newCount} new</span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="min-w-0 flex-1" />

          {/* Narrower desktops give the room back to the lists. */}
          <FeatureCard feature={feature} onNavigate={close} />
        </div>
      </div>
    </div>
  );
}

function FeatureCard({
  feature,
  onNavigate,
}: {
  feature: ShopMenuFeature | null;
  onNavigate: () => void;
}) {
  const href = feature ? `/products/${feature.slug}` : "/shop";
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="pl-focus hidden w-[300px] shrink-0 flex-col gap-2.5 rounded-[4px] bg-pl-inverse p-7 min-[1200px]:flex"
    >
      <span className="text-xs leading-[normal] font-bold tracking-[0.1em] text-plum-300">
        {feature ? (feature.isNew ? "NEW THIS MONTH" : "LATEST ARRIVAL") : "MEEMI ART"}
      </span>
      <span className="pl-display line-clamp-2 w-[244px] text-[26px] leading-[30px] font-bold text-pl-on-dark">
        {feature ? feature.name : "Easy patterns, made with Meemi"}
      </span>
      <span className="line-clamp-3 w-[244px] text-[15px] leading-[23px] text-plum-200">
        {feature
          ? (feature.shortDescription ?? "Just added to the shop.")
          : "Browse everything in the shop."}
      </span>
      <span aria-hidden className="h-7" />
      <span className="flex items-center justify-between text-[13px] leading-[normal] font-bold tracking-[0.1em] text-pl-on-dark">
        <span className="inline-flex items-center gap-1.5">
          {feature ? "VIEW PRODUCT" : "SHOP ALL"}
          <ArrowRight className="size-4" aria-hidden />
        </span>
        {feature && <span className="tracking-normal">{formatMoney(feature.priceCents)}</span>}
      </span>
    </Link>
  );
}
