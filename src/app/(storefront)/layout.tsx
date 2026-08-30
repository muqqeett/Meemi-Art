import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { TestModeBanner } from "@/components/layout/test-mode-banner";
import { CartDrawer } from "@/components/cart/cart-drawer";
import { OrganizationSchema } from "@/components/brand/organization-schema";
import { PageTransition } from "@/components/motion/page-transition";

export default function StorefrontLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <OrganizationSchema />
      <TestModeBanner />
      <SiteHeader />
      {/*
        `flex flex-col` rather than a bare `flex-1`.

        `main` already grew to fill the space between header and footer, but its
        only child is `PageTransition`'s wrapper div, which is block-level and
        therefore sits at its own content height. On a short page that left the
        content pinned to the top of a stretched `main` with the leftover height
        — measured at 829px on a 900px viewport — as dead space above the
        footer, and no page could opt into filling or centring it.

        Making `main` a column and letting the wrapper grow (see `.page-enter`)
        hands that height down. Pages that do not ask for it render exactly as
        before: the slack just moves inside the wrapper instead of below it.
      */}
      <main id="main" className="flex flex-1 flex-col">
        <PageTransition>{children}</PageTransition>
      </main>
      <SiteFooter />
      <CartDrawer />
    </>
  );
}
