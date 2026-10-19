import Link from "next/link";
import { Heart } from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { MegaNav } from "@/components/layout/mega-nav";
import { MobileNav } from "@/components/layout/mobile-nav";
import { SearchDialog } from "@/components/layout/search-dialog";
import { AccountMenu } from "@/components/layout/account-menu";
import { PlumNavLink } from "@/components/layout/plum/plum-nav-link";
import { CartButton } from "@/components/cart/cart-button";
import { getCurrentUser } from "@/lib/auth-guards";
import { getCartCount } from "@/lib/cart/cart-service";
import { getAllCategories } from "@/lib/queries/categories";
import { getFeaturedProducts } from "@/lib/queries/products";
import { mainNav } from "@/lib/config";

/**
 * Plum Studio header — Figma "Header" (15:310).
 *
 * 72px, white, hairline underneath. Wordmark, nav pills, a sunken search
 * field, then account / saved / bag. On mobile it is 56px: menu, wordmark,
 * search, bag.
 *
 * Data and behaviour are the existing header's, unchanged: the same user,
 * cart count, categories and featured products feed the same mega panel,
 * search dialog, account menu and bag. Only the presentation is new.
 *
 * Where the design and the shop disagree, the shop wins:
 *   - the design's nav is Shop, New & drops, Bundles, Free, Learn, About. This
 *     shop has no bundles or free-download routes, so those two are not drawn;
 *     the pills are the real entries from `mainNav` that are not categories
 *     (categories live in the Shop panel).
 *   - the wordmark is the shop's own, not the design's.
 *   - the design shows Material Symbols; the app already ships lucide, so the
 *     glyphs are lucide at the drawn sizes.
 */

/** Standing entries rather than category shortcuts, in the order drawn. */
const NAV_HREFS = ["/shop?sort=newest", "/learn", "/about"] as const;

export async function PlumHeader() {
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

  const links = NAV_HREFS.map((href) => mainNav.find((item) => item.href === href)).filter(
    (item): item is (typeof mainNav)[number] => Boolean(item),
  );

  return (
    <>
      <a
        href="#main"
        className="font-figtree sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-100 focus:rounded-full focus:bg-plum-900 focus:px-4 focus:py-2 focus:text-pl-on-dark"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-50 border-b border-pl-line bg-pl-surface">
        <div className="mx-auto flex h-14 w-full max-w-[1280px] items-center gap-2 px-4 sm:px-6 lg:h-[72px] lg:gap-6 lg:px-8">
          <div className="lg:hidden">
            <MobileNav
              isSignedIn={Boolean(user)}
              userName={user?.name ?? null}
              categories={megaCategories}
              variant="plum"
            />
          </div>

          <div className="flex shrink-0 items-center">
            <Logo focus="plum" className="max-sm:h-6" />
          </div>

          {/* MegaNav is its own `nav` landmark ("Main"), so the plain links get a
              sibling landmark rather than being nested inside it. */}
          <div className="hidden items-center gap-0.5 lg:flex">
            <MegaNav categories={megaCategories} featured={megaFeatured} variant="plum" />
            <nav aria-label="Site" className="flex items-center gap-0.5">
              {links.map((item) => (
                <PlumNavLink key={item.href} href={item.href}>
                  {item.title}
                </PlumNavLink>
              ))}
            </nav>
          </div>

          <div className="hidden min-w-0 flex-1 lg:block">
            <SearchDialog variant="plum" />
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-1 lg:ml-0">
            <div className="lg:hidden">
              <SearchDialog variant="plum-icon" />
            </div>

            <div className="hidden sm:block">
              <AccountMenu
                user={user ? { name: user.name, email: user.email, role: user.role } : null}
                variant="plum"
              />
            </div>

            <Link
              href="/account/wishlist"
              aria-label="Wishlist"
              className="pl-focus hidden size-11 items-center justify-center rounded-full text-pl-text transition-colors hover:bg-plum-100 sm:inline-flex"
            >
              <Heart className="size-6" aria-hidden />
            </Link>

            <CartButton serverCount={cartCount} variant="plum" />
          </div>
        </div>
      </header>
    </>
  );
}
