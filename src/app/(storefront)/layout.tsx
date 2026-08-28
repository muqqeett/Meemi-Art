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
      <main id="main" className="flex-1">
        <PageTransition>{children}</PageTransition>
      </main>
      <SiteFooter />
      <CartDrawer />
    </>
  );
}
