"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu, User, Heart, Package, LogIn, ShoppingBag, X, ArrowRight } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import { Logo } from "@/components/brand/logo";
import { useCartUI } from "@/lib/stores/cart-ui";
import { mainNav } from "@/lib/config";
import { cn } from "@/lib/utils";

export type MobileNavCategory = {
  id: string;
  name: string;
  slug: string;
  image: string | null;
  /** Active products in the category. Empty ones are not offered. */
  productCount: number;
};

type MobileNavProps = {
  isSignedIn: boolean;
  userName: string | null;
  categories: MobileNavCategory[];
  /** `plum` restyles the trigger for the Plum Studio header. */
  variant?: "default" | "plum";
};

/**
 * Mobile navigation drawer.
 *
 * Built for a thumb rather than as a shrunken desktop menu: a category grid
 * with real artwork, 48px rows throughout, and the account block below the
 * shopping links where it belongs.
 *
 * Two things it deliberately does not do:
 *
 *   - It does not repeat the category shortcuts that `mainNav` carries.
 *     Bags, Flowers, Plushies and Gifts are entries there *and* rows in the
 *     category grid above, so listing both printed every one of them twice.
 *     The links below the grid are the standing pages only.
 *   - It does not offer a category with nothing in it. Three of the six are
 *     currently empty, and a tile that leads to "no products" is worse than
 *     an absent tile. This matches what the homepage already does.
 *
 * Sub-categories are not rendered. The schema supports a tree, but
 * `getAllCategories` reads only roots and no category in the catalogue has
 * children — there is no data to disclose, and drawing an expander for it
 * would be inventing one.
 *
 * Scroll locking, focus trapping, the backdrop and Escape all come from the
 * Sheet primitive (Base UI dialog), which is what the cart drawer uses too.
 */
export function MobileNav({
  isSignedIn,
  userName,
  categories,
  variant = "default",
}: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const cartCount = useCartUI((state) => state.count);
  const openCart = useCartUI((state) => state.open);

  const close = () => setOpen(false);

  const stocked = categories.filter((category) => category.productCount > 0);

  /**
   * Standing pages only — anything in `mainNav` that is not a category route,
   * since the grid above already covers those.
   */
  const pages = mainNav.filter((item) => !item.href.startsWith("/shop/"));

  /**
   * Only links without a query are marked current.
   *
   * Comparing the path alone made "New In" (`/shop?sort=newest`) light up on
   * plain `/shop`, which is a different view of a different ordering. Knowing
   * whether the sort actually matches would mean reading the live search
   * params, and a filtered view is not worth a `useSearchParams` boundary in
   * the header — so a query-bearing link simply never claims to be current.
   */
  const isActive = (href: string) => !href.includes("?") && pathname === href;

  const accountRows = isSignedIn
    ? [
        {
          href: "/account",
          icon: User,
          label: userName ? `Hi, ${userName.split(" ")[0]}` : "My account",
        },
        { href: "/account/orders", icon: Package, label: "Orders" },
        { href: "/account/downloads", icon: ShoppingBag, label: "My downloads" },
        { href: "/account/wishlist", icon: Heart, label: "Wishlist" },
      ]
    : [
        { href: "/login", icon: LogIn, label: "Sign in" },
        { href: "/account/wishlist", icon: Heart, label: "Wishlist" },
      ];

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <button
            type="button"
            className={
              variant === "plum"
                ? "pl-focus inline-flex size-11 items-center justify-center rounded-full text-pl-text transition-colors hover:bg-plum-100"
                : "inline-flex size-11 items-center justify-center rounded-xs text-brand-700 transition-colors hover:bg-surface-alt focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-600"
            }
            aria-label="Open menu"
            aria-haspopup="dialog"
            aria-expanded={open}
          />
        }
      >
        <Menu className={variant === "plum" ? "size-6" : "size-5"} aria-hidden />
      </SheetTrigger>

      <SheetContent
        side="left"
        showCloseButton={false}
        // The width override has to carry the primitive's own variant. Its
        // `data-[side=left]:sm:max-w-sm` is an attribute selector, so a plain
        // `sm:max-w-[360px]` loses on specificity and the drawer silently
        // widened to 384px from `sm` up — declared one width, rendered another.
        className="font-figtree w-[88vw] max-w-[360px] gap-0 bg-pl-surface p-0 text-pl-text shadow-[0_4px_5px_rgba(36,17,63,0.06),0_24px_24px_rgba(36,17,63,0.35)] data-[side=left]:sm:max-w-[360px]"
      >
        {/* `pt-[env(safe-area-inset-top)]` so the wordmark clears a notch when
            the drawer runs the full height of the screen. */}
        <SheetHeader className="flex-row items-center gap-2 border-b border-pl-line py-4 pr-3 pl-5 pt-[calc(1rem+env(safe-area-inset-top))]">
          <SheetTitle className="flex-1 text-left">
            <Logo asLink={false} focus="plum" className="h-6" />
          </SheetTitle>
          <SheetDescription className="sr-only">
            Shop categories, pages and your account
          </SheetDescription>
          <SheetClose
            render={
              <button
                type="button"
                className="pl-focus inline-flex size-11 items-center justify-center rounded-full text-pl-text transition-colors hover:bg-plum-100"
                aria-label="Close menu"
              />
            }
          >
            <X className="size-5" aria-hidden />
          </SheetClose>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <nav aria-label="Shop" className="px-5 pt-5">
            <h2 className="text-[11px] leading-4 font-bold tracking-[0.08em] text-pl-muted uppercase">
              Shop
            </h2>

            {stocked.length > 0 ? (
              <ul className="mt-3 grid grid-cols-2 gap-3">
                {stocked.map((category) => (
                  <li key={category.id}>
                    <Link
                      href={`/shop/${category.slug}`}
                      onClick={close}
                      className="pl-focus group/tile block rounded-[14px]"
                    >
                      <span className="relative block aspect-[4/3] overflow-hidden rounded-[14px] bg-pl-tint-crochet">
                        {category.image && (
                          <Image
                            src={category.image}
                            alt=""
                            fill
                            sizes="45vw"
                            className="object-cover transition-transform duration-300 ease-out group-hover/tile:scale-[1.03]"
                          />
                        )}
                      </span>
                      {/* `break-words` so a long category name wraps inside the
                          tile instead of forcing the grid wider. */}
                      <span className="mt-2 block text-sm leading-[20px] font-bold tracking-[-0.005em] break-words">
                        {category.name}
                      </span>
                      <span className="block text-[13px] leading-[18px] font-medium text-pl-muted">
                        {category.productCount}{" "}
                        {category.productCount === 1 ? "pattern" : "patterns"}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm leading-[22px] text-pl-muted">
                New patterns are on the way.
              </p>
            )}

            <Link
              href="/shop"
              onClick={close}
              className="pl-focus mt-4 flex min-h-12 items-center justify-between gap-2 rounded-[12px] px-3 text-sm leading-[22px] font-bold text-plum-500 transition-colors hover:bg-pl-subtle"
            >
              Shop all patterns
              <ArrowRight className="size-4 shrink-0" aria-hidden />
            </Link>
          </nav>

          <nav aria-label="Pages" className="mt-5 border-t border-pl-line px-5 pt-5">
            <ul className="space-y-0.5">
              {pages.map((item) => {
                const active = isActive(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={close}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "pl-focus flex min-h-12 items-center rounded-[12px] px-3 text-sm leading-[22px] font-bold transition-colors",
                        active ? "bg-plum-100 text-plum-500" : "hover:bg-pl-subtle",
                      )}
                    >
                      {item.title}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="mt-5 border-t border-pl-line px-5 pt-5 pb-5">
            <h2 className="text-[11px] leading-4 font-bold tracking-[0.08em] text-pl-muted uppercase">
              Account
            </h2>
            <ul className="mt-2 space-y-0.5">
              {accountRows.map(({ href, icon: Icon, label }) => (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={close}
                    className="pl-focus flex min-h-12 items-center gap-3 rounded-[12px] px-3 text-sm leading-[22px] font-bold transition-colors hover:bg-pl-subtle"
                  >
                    <Icon className="size-5 shrink-0 text-pl-muted" aria-hidden />
                    <span className="truncate">{label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* The bag closes the drawer and opens the cart panel rather than
            navigating — the same control the header offers, in reach of a
            thumb. `pb-[env(safe-area-inset-bottom)]` clears the home bar. */}
        <div className="shrink-0 border-t border-pl-line bg-plum-100/40 px-5 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={() => {
              close();
              openCart();
            }}
            className="pl-focus flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-plum-900 px-5 text-sm leading-[22px] font-bold text-pl-on-dark transition-colors hover:bg-plum-800"
          >
            <ShoppingBag className="size-5 shrink-0" aria-hidden />
            View bag
            {cartCount > 0 && (
              <span className="ml-1 inline-flex min-w-6 items-center justify-center rounded-full bg-pl-on-dark px-1.5 text-[13px] leading-[18px] font-bold text-plum-900 tabular-nums">
                {cartCount > 99 ? "99+" : cartCount}
              </span>
            )}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
