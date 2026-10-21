import { PlumHeader } from "@/components/layout/plum/plum-header";
import { TestModeBanner } from "@/components/layout/test-mode-banner";
import { CartDrawer } from "@/components/cart/cart-drawer";
import { PageTransition } from "@/components/motion/page-transition";

/**
 * The shell for every account-entry screen: log in, sign up, forgot and reset
 * password, and email verification.
 *
 * They are drawn with the site header above them — the Figma frames show it at
 * 72px on desktop and 56px on mobile — and with no footer. This is a route
 * group, so it adds nothing to the URL: `/login`, `/register`,
 * `/forgot-password`, `/reset-password`, `/verify-email` and
 * `/verify-email/sent` are exactly where they always were.
 *
 * The header is a sibling of `<main>`, not a child, so it is exposed to
 * assistive technology as the page's banner. `CartDrawer` is mounted because
 * the header's bag button opens it — without it that button would do nothing.
 */
export default function EntryLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <TestModeBanner />
      <PlumHeader />
      <main id="main" className="flex flex-1 flex-col">
        <PageTransition>{children}</PageTransition>
      </main>
      <CartDrawer />
    </>
  );
}
