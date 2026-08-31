import { PageTransition } from "@/components/motion/page-transition";

/**
 * The authentication shell.
 *
 * Deliberately almost empty. The two screens in the Figma file are composed
 * differently — "Log in" is a card centred on a full-bleed dark field, "Sign
 * up" is a half-and-half split — so a layout that imposed one composition
 * would force the other to fight it. Each page renders its own backdrop and
 * the shared pieces come from `auth-visuals`.
 *
 * The storefront header and footer stay out, as they are in the design: this
 * is a dedicated entry experience, and dropping the shop chrome on top of it
 * would put a cart icon next to a sign-in form.
 */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main id="main" className="flex min-h-dvh flex-col">
      <PageTransition>{children}</PageTransition>
    </main>
  );
}
