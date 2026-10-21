"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, Menu, X } from "lucide-react";

import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Logo } from "@/components/brand/logo";
import { signOutAction } from "@/lib/actions/auth";
import { SHOP_CATEGORIES, type ShopMenuCategory } from "@/lib/shop-categories";
import { cn } from "@/lib/utils";

type PlumMobileMenuProps = {
  /** What is listed in each of the five categories — see `getShopMenuCategories`. */
  categories: ShopMenuCategory[];
  user: { name: string | null; email: string } | null;
};

/** Standing pages below the Shop accordion, in the order the design draws them. */
const PAGE_LINKS = [
  { label: "New & drops", href: "/shop?sort=newest" },
  // No free-patterns page exists yet, so this goes to the whole shop rather
  // than a 404 — repoint when it does (same as the desktop menu's link).
  { label: "Free", href: "/shop" },
  { label: "Learn", href: "/learn" },
  { label: "About", href: "/about" },
  { label: "Help", href: "/faq" },
] as const;

/** Account pages that exist today; both require sign-in (`requireUser`). */
const ACCOUNT_LINKS = [
  { label: "Wishlist", href: "/account/wishlist" },
  { label: "Orders", href: "/account/orders" },
] as const;

const TOP_ROW = "pl-focus flex h-12 w-full items-center gap-2.5 px-5 text-left text-[17px] font-bold text-pl-text";
const CATEGORY_ROW = "pl-focus flex h-12 w-full items-center gap-2.5 pr-5 pl-7 text-left text-base font-bold text-pl-text";
const SUB_ROW = "pl-focus flex h-11 w-full items-center pr-5 pl-12 text-left text-[15px]";

/**
 * Mobile menu drawer — Figma "Overlay · Menu" (30:1535) and
 * "Overlay · Menu (signed in)" (150:2071).
 *
 * A 320px drawer that slides in from the left over a scrim. Shop is an
 * accordion that is open when the drawer opens; each category expands to its
 * sub-categories and ends with an "All … (n)" link, and opening one closes any
 * other. Below a divider are the standing pages, and the foot carries the
 * account: Log in and Sign up side by side when signed out, or the shopper,
 * their library and Log out when signed in.
 *
 * The dialog behaviour — focus moving to Close, Tab trapped inside, Esc, the
 * scrim, focus returning to the menu button — comes from the Sheet primitive
 * (a Base UI dialog), the same one the cart drawer uses.
 *
 * A category with nothing listed is drawn with "Soon" and is not a link; it
 * becomes one the moment a product is published into it. One with listed
 * products but no sub-categories goes straight to its page, since an
 * accordion holding only "All …" would be an extra tap for nothing.
 */
export function PlumMobileMenu({ categories, user }: PlumMobileMenuProps) {
  const [open, setOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(true);
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  // The design puts focus on Close when the drawer opens.
  const closeRef = useRef<HTMLButtonElement>(null);

  const close = () => setOpen(false);
  const byCategory = new Map(categories.map((category) => [category.slug, category]));
  const initial = (user?.name?.trim() || user?.email || "?").charAt(0).toUpperCase();
  const firstName = user?.name?.trim().split(/\s+/)[0];

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <button
            type="button"
            className="pl-focus inline-flex size-11 items-center justify-center rounded-full text-pl-text transition-colors hover:bg-plum-100"
            aria-label="Open menu"
            aria-haspopup="dialog"
            aria-expanded={open}
          />
        }
      >
        <Menu className="size-6" aria-hidden />
      </SheetTrigger>

      <SheetContent
        side="left"
        showCloseButton={false}
        aria-modal="true"
        initialFocus={closeRef}
        // 48% plum scrim, no blur — the design's own.
        overlayClassName="bg-[rgba(36,17,63,0.48)] duration-250 supports-backdrop-filter:backdrop-blur-none"
        // The width carries the primitive's own `data-[side=left]` variant:
        // its `data-[side=left]:sm:max-w-sm` is an attribute selector, so a
        // plain `sm:max-w-[...]` would lose on specificity.
        className="font-figtree w-[320px] max-w-[88vw] gap-0 bg-pl-surface p-0 text-pl-text shadow-[0_4px_5px_rgba(36,17,63,0.06),0_24px_24px_rgba(36,17,63,0.35)] duration-250 data-[side=left]:w-[320px] data-[side=left]:max-w-[88vw] data-[side=left]:border-r-0 data-[side=left]:sm:max-w-[320px] motion-reduce:transition-none"
      >
        <SheetTitle className="sr-only">Menu</SheetTitle>
        <SheetDescription className="sr-only">
          Shop categories, pages and your account
        </SheetDescription>

        {/* Head: wordmark and Close, 57px with its hairline. */}
        <div className="flex shrink-0 items-center gap-2 border-b border-pl-line py-1.5 pr-2 pl-4">
          <div className="flex min-w-0 flex-1 items-center">
            <Logo asLink={false} focus="plum" className="h-6" />
          </div>
          <SheetClose
            render={
              <button
                ref={closeRef}
                type="button"
                aria-label="Close menu"
                className="pl-focus inline-flex size-11 shrink-0 items-center justify-center rounded-full text-pl-text transition-colors hover:bg-plum-100"
              />
            }
          >
            <X className="size-6" aria-hidden />
          </SheetClose>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pt-2">
          <nav aria-label="Shop">
            <button
              type="button"
              aria-expanded={shopOpen}
              aria-controls="menu-shop"
              onClick={() => setShopOpen((value) => !value)}
              className={TOP_ROW}
            >
              <span className="flex-1">Shop</span>
              {shopOpen ? (
                <ChevronUp className="size-[22px] shrink-0" aria-hidden />
              ) : (
                <ChevronDown className="size-[22px] shrink-0" aria-hidden />
              )}
            </button>

            <div
              id="menu-shop"
              className={cn(
                "grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none",
                shopOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
              )}
            >
              <div className="overflow-hidden" inert={!shopOpen}>
                <Link href="/shop" onClick={close} className={CATEGORY_ROW}>
                  Shop all
                </Link>

                {SHOP_CATEGORIES.map((spec) => {
                  const data = byCategory.get(spec.slug);
                  const count = data?.count ?? 0;
                  const subs = data?.subs ?? [];
                  const swatch = (
                    <span
                      aria-hidden
                      className={cn("size-2.5 shrink-0 rounded-[3px]", spec.tint)}
                    />
                  );

                  // Nothing listed yet: shown, not linked, and says so.
                  if (count === 0 && subs.length === 0) {
                    return (
                      <div key={spec.slug} className={cn(CATEGORY_ROW, "font-medium text-pl-muted")}>
                        {swatch}
                        <span className="flex-1">{spec.name}</span>
                        <span className="rounded-full bg-pl-tint-templates px-2 py-0.5 text-[11px] font-bold text-pl-text">
                          Soon
                        </span>
                      </div>
                    );
                  }

                  // Listed, but nothing beneath it to open: go straight there.
                  if (subs.length === 0) {
                    return (
                      <Link
                        key={spec.slug}
                        href={`/c/${spec.slug}`}
                        onClick={close}
                        className={CATEGORY_ROW}
                      >
                        {swatch}
                        <span className="flex-1">{spec.name}</span>
                      </Link>
                    );
                  }

                  const isOpen = openCategory === spec.slug;
                  const panelId = `menu-cat-${spec.slug}`;
                  return (
                    <div key={spec.slug}>
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        aria-controls={panelId}
                        // One open at a time: opening this closes the other.
                        onClick={() => setOpenCategory(isOpen ? null : spec.slug)}
                        className={cn(CATEGORY_ROW, isOpen && "bg-pl-subtle")}
                      >
                        {swatch}
                        <span className="flex-1">{spec.name}</span>
                        {isOpen ? (
                          <ChevronUp className="size-[22px] shrink-0" aria-hidden />
                        ) : (
                          <ChevronDown className="size-[22px] shrink-0" aria-hidden />
                        )}
                      </button>
                      <div
                        id={panelId}
                        className={cn(
                          "grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none",
                          isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                        )}
                      >
                        <div className="overflow-hidden" inert={!isOpen}>
                          {subs.map((sub) => (
                            <Link
                              key={sub.slug}
                              href={`/c/${spec.slug}/${sub.slug}`}
                              onClick={close}
                              className={cn(SUB_ROW, "font-normal text-pl-muted")}
                            >
                              {sub.name}
                            </Link>
                          ))}
                          <Link
                            href={`/c/${spec.slug}`}
                            onClick={close}
                            className={cn(SUB_ROW, "font-bold text-plum-500")}
                          >
                            {spec.allLabel} ({count})
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </nav>

          <div className="px-5 py-2">
            <div className="h-px w-full bg-pl-line" />
          </div>

          <nav aria-label="Pages">
            {PAGE_LINKS.map((item) => (
              <Link key={item.label} href={item.href} onClick={close} className={TOP_ROW}>
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Signed in only. The header's wishlist icon is hidden on phones, and
              both pages sit behind sign-in, so they are offered here rather
              than to a visitor who would be sent to the login screen. */}
          {user && (
            <>
              <div className="px-5 py-2">
                <div className="h-px w-full bg-pl-line" />
              </div>
              <nav aria-label="Your account">
                {ACCOUNT_LINKS.map((item) => (
                  <Link key={item.href} href={item.href} onClick={close} className={TOP_ROW}>
                    {item.label}
                  </Link>
                ))}
              </nav>
            </>
          )}
        </div>

        {/* Account foot. */}
        {user ? (
          <div className="flex shrink-0 flex-col items-center gap-2.5 border-t border-pl-line bg-pl-surface px-5 py-3.5">
            <div className="flex w-full items-center gap-2.5">
              <span
                aria-hidden
                className="flex size-8 shrink-0 items-center justify-center rounded-full bg-plum-200 text-[13px] font-bold"
              >
                {initial}
              </span>
              <span className="flex min-w-0 flex-col leading-[normal]">
                <span className="truncate text-[15px] font-bold">{firstName ?? user.email}</span>
                <span className="truncate text-[13px] text-pl-muted">{user.email}</span>
              </span>
            </div>
            <Link
              href="/account/downloads"
              onClick={close}
              className="pl-focus flex h-14 w-full items-center justify-center rounded-full border-[1.5px] border-pl-line-strong bg-pl-surface px-7 text-[15px] leading-[18px] font-bold"
            >
              My library
            </Link>
            <form action={signOutAction}>
              <button
                type="submit"
                className="pl-focus rounded-sm px-1 text-[15px] font-bold text-plum-500 underline"
              >
                Log out
              </button>
            </form>
          </div>
        ) : (
          <div className="flex shrink-0 flex-col items-center gap-1.5 border-t border-pl-line bg-pl-surface px-5 py-3.5">
            <div className="flex w-full gap-2">
              <Link
                href="/login"
                onClick={close}
                className="pl-focus flex h-11 min-w-0 flex-1 items-center justify-center rounded-full bg-pl-inverse px-5 text-[15px] leading-[18px] font-bold text-pl-on-dark"
              >
                Log in
              </Link>
              <Link
                href="/register"
                onClick={close}
                className="pl-focus flex h-11 min-w-0 flex-1 items-center justify-center rounded-full border-[1.5px] border-pl-line-strong bg-pl-surface px-5 text-[15px] leading-[18px] font-bold whitespace-nowrap"
              >
                Sign up
              </Link>
            </div>
            <p className="text-center text-[13px] leading-[18px] text-pl-muted">
              Re-download files and keep saved items on every device.
            </p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
