import Link from "next/link";
import { Heart } from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { HeaderShell } from "@/components/layout/header-shell";
import { CategoryBar } from "@/components/layout/category-bar";
import { MegaNav } from "@/components/layout/mega-nav";
import { MobileNav } from "@/components/layout/mobile-nav";
import { PromoBar } from "@/components/layout/promo-bar";
import { SearchDialog } from "@/components/layout/search-dialog";
import { AccountMenu } from "@/components/layout/account-menu";
import { CartButton } from "@/components/cart/cart-button";
import { getCurrentUser } from "@/lib/auth-guards";
import { getCartCount } from "@/lib/cart/cart-service";
import { getAllCategories } from "@/lib/queries/categories";
import { getFeaturedProducts } from "@/lib/queries/products";
import { mainNav } from "@/lib/config";

/**
 * Storefront header — Figma "Top Bar" (253:2) + "Frame 23" (253:28).
 *
 * The design's row is: wordmark, menu button, a wide search field, then the
 * account links and a heart, over a category rail. Everything sits on the warm
 * `paper` ground rather than the white the header used before.
 *
 * Three things the Figma does not draw are kept, because removing them would
 * remove function rather than decoration:
 *
 *   the bag        — the drawn row ends at a heart, but a shop needs its cart
 *                    reachable from every page; it takes the same 48px round
 *                    treatment as the heart, immediately after it.
 *   the mega panel — the drawn menu button is a plain hamburger. It is wired to
 *                    the existing "Shop" panel so the categories and featured
 *                    products behind it survive.
 *   the account menu — the drawn state is signed-out (Login / Signup links).
 *                    Those render exactly as drawn when signed out; a signed-in
 *                    shopper gets the existing avatar menu in the same slot,
 *                    since "Login / Signup" is meaningless to them.
 */
export async function SiteHeader() {
  const [user, cartCount, categories, featured] = await Promise.all([
    getCurrentUser(),
    getCartCount(),
    getAllCategories(),
    getFeaturedProducts(2),
  ]);

  const megaCategories = categories.map((category) => ({
    id: category.id,
    name: category.name,
    slug: category.slug,
    image: category.image ?? null,
  }));

  const megaFeatured = featured.map((product) => ({
    id: product.id,
    name: product.name,
    slug: product.slug,
    priceCents: product.priceCents,
    imageUrl: product.imageUrl,
  }));

  /**
   * The rail's seven slots, filled from what the shop actually has: the real
   * categories first, then the standing nav entries. Sliced to seven so the row
   * matches the drawn rhythm and cannot wrap.
   */
  const railLinks = [
    ...megaCategories.map((category) => ({
      title: category.name,
      href: `/shop/${category.slug}`,
    })),
    ...mainNav.map((item) => ({ title: item.title, href: item.href })),
  ].slice(0, 7);

  return (
    <>
      <a
        href="#main"
        className="label-caps sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-100 focus:bg-brand-700 focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>

      <PromoBar />

      <HeaderShell belowBar={<CategoryBar links={railLinks} />}>
        {/* Wordmark. Steps down below sm, where the drawn 32px mark is wider
            than the track left between the menu button and the actions. */}
        <div className="flex shrink-0 items-center">
          <Logo className="max-sm:text-2xl/6" />
        </div>

        {/* The drawn menu button, immediately right of the mark. It opens the
            mega panel on desktop and the sheet on mobile — same affordance,
            the implementation each viewport already had. */}
        <div className="flex shrink-0 items-center lg:hidden">
          <MobileNav
            isSignedIn={Boolean(user)}
            userName={user?.name ?? null}
            categories={megaCategories}
          />
        </div>
        <div className="hidden shrink-0 lg:block">
          <MegaNav categories={megaCategories} featured={megaFeatured} />
        </div>

        {/* The search field is the centrepiece of the drawn row, so it takes
            the free space. Below `sm` it collapses to the icon trigger: a
            48px-tall field plus the mark plus three controls cannot share a
            320px line. */}
        <div className="hidden min-w-0 flex-1 sm:block">
          <SearchDialog variant="pill" />
        </div>
        <div className="ml-auto sm:hidden">
          <SearchDialog />
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:ml-2">
          {/* Drawn as text links, and only meaningful signed out. */}
          {!user && (
            <div className="hidden items-center gap-1 lg:flex">
              <Link
                href="/login"
                className="inline-flex h-11 items-center rounded-full px-3 text-base font-semibold text-near-black transition-colors hover:bg-near-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-600"
              >
                Login
              </Link>
              <Link
                href="/register"
                className="inline-flex h-11 items-center rounded-full px-3 text-base font-semibold text-near-black transition-colors hover:bg-near-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-600"
              >
                Signup
              </Link>
            </div>
          )}

          <Link
            href="/account/wishlist"
            className="hidden size-11 items-center justify-center rounded-full text-near-black transition-colors hover:bg-near-black/5 hover:text-royal-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-600 sm:inline-flex"
            aria-label="Wishlist"
          >
            <Heart className="size-[1.35rem]" aria-hidden />
          </Link>

          {/* Hidden below `sm`, where the mark, menu, search and bag already
              fill a 280px line and the bag was being clipped off the right
              edge at 320. Nothing is lost: the sheet behind the menu button
              carries the same account links, signed in or out.

              From `sm` to `lg` the icon is the way in; from `lg` the drawn
              Login / Signup links replace it, so it renders there only for a
              signed-in shopper. */}
          <div className={user ? "hidden sm:block" : "hidden sm:block lg:hidden"}>
            <AccountMenu
              user={user ? { name: user.name, email: user.email, role: user.role } : null}
            />
          </div>

          <CartButton serverCount={cartCount} />
        </div>
      </HeaderShell>
    </>
  );
}
