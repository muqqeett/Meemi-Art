import Link from "next/link";
import { Heart } from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { HeaderShell } from "@/components/layout/header-shell";
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

/**
 * Storefront header: a slim purple utility bar, then a generous white band with
 * the wordmark, navigation and account controls. Icons sit in brand purple and
 * shift to sapphire on hover. Sticky, because a shopper scrolling a long grid
 * should always be one tap from the bag.
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

  return (
    <>
      <a
        href="#main"
        className="label-caps sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-100 focus:bg-brand-700 focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>

      <PromoBar />

      <HeaderShell>
        <div className="flex items-center gap-1 lg:hidden">
          <MobileNav
            isSignedIn={Boolean(user)}
            userName={user?.name ?? null}
            categories={megaCategories}
          />
        </div>

        {/* Below lg the wordmark centres by taking the space *between* the
            menu button and the actions, rather than being absolutely centred
            on the viewport. Absolute centring ignored the action cluster, so
            on every common phone width the mark ran straight into it — 64px of
            overlap at 320, still colliding at 430. As a flex item it can never
            reach them.

            The mark also steps down to 24px below sm, because at 320 the track
            between the two clusters is 104px and the drawn 32px mark is 136px
            wide. It returns to the drawn size from sm up. */}
        <div className="flex items-center max-lg:min-w-0 max-lg:flex-1 max-lg:justify-center lg:shrink-0">
          <Logo className="max-sm:text-2xl/6" />
        </div>

        <div className="lg:ml-8">
          <MegaNav categories={megaCategories} featured={megaFeatured} />
        </div>

        <div className="ml-auto flex items-center gap-0.5">
          <SearchDialog />

          <Link
            href="/account/wishlist"
            className="hidden size-11 items-center justify-center rounded-xs text-brand-700 transition-colors hover:bg-surface-alt hover:text-royal-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-600 sm:inline-flex"
            aria-label="Wishlist"
          >
            <Heart className="size-[1.15rem]" aria-hidden />
          </Link>

          <AccountMenu
            user={user ? { name: user.name, email: user.email, role: user.role } : null}
          />

          <CartButton serverCount={cartCount} />
        </div>
      </HeaderShell>
    </>
  );
}
