import type { Metadata } from "next";
import Link from "next/link";

import { AdminSidebar, AdminMobileNav } from "@/components/admin/admin-sidebar";
import { AdminBreadcrumbs } from "@/components/admin/admin-breadcrumbs";
import { AdminCommandPalette } from "@/components/admin/admin-command-palette";
import { requireAdmin } from "@/lib/auth-guards";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s | Meemi Art Admin" },
  robots: { index: false, follow: false },
};

/**
 * Admin shell.
 *
 * `requireAdmin` runs on every request to every admin page — a non-admin gets a
 * 404 rather than a 403, so the area's existence is not confirmed. Individual
 * admin server actions re-check the role independently; this layout is not
 * treated as the only gate, and the search route re-checks it too.
 *
 * The content column is offset by `--admin-rail`, which the sidebar writes when
 * it collapses. It is declared with a fallback here so the very first paint —
 * before any client JS — is already correct rather than jumping once hydration
 * lands.
 */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const admin = await requireAdmin();

  return (
    // `admin-root` scopes the admin's quieter hairlines and surface ladder —
    // see the block in globals.css. It is set once, here, so every admin page
    // inherits it and no storefront token is touched.
    <div className="admin-root min-h-dvh bg-[var(--admin-canvas)]">
      <AdminSidebar />

      <div
        className="transition-[padding] duration-200 ease-out lg:pl-[var(--admin-rail,15rem)]"
      >
        {/* 56px to match the sidebar's wordmark block, so the two rules meet
            in one continuous line across the top of the screen. */}
        <header className="admin-safe-top sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-card/90 px-3 backdrop-blur-md sm:gap-3 sm:px-6">
          <AdminMobileNav />

          {/* Breadcrumbs take the slack so the search and profile stay put as
              the path grows. Hidden below `sm`, where the space belongs to
              search. */}
          <div className="hidden min-w-0 flex-1 sm:block">
            <AdminBreadcrumbs />
          </div>

          <div className="ml-auto flex min-w-0 items-center gap-2 sm:gap-3">
            <AdminCommandPalette />

            <span aria-hidden className="hidden h-5 w-px bg-border sm:block" />

            <Link
              href="/account"
              className="flex items-center gap-2.5 rounded-md py-1 pr-1 pl-1.5 transition-colors duration-150 hover:bg-[var(--admin-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            >
              <span className="hidden max-w-40 text-right lg:block">
                <span className="block truncate text-[0.8125rem] leading-tight font-medium text-foreground">
                  {admin.name ?? "Administrator"}
                </span>
                <span className="block truncate text-[0.6875rem] leading-tight text-muted-foreground">
                  {admin.email}
                </span>
              </span>
              {/* Hairline ring rather than a solid brand disc: at 32px a filled
                  circle is the loudest thing in the bar, which the account
                  link is not. */}
              <span
                aria-hidden
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-brand-200 bg-brand-50 text-xs font-semibold text-brand-700"
              >
                {(admin.name ?? admin.email).charAt(0).toUpperCase()}
              </span>
              <span className="sr-only">Your account</span>
            </Link>
          </div>
        </header>

        {/* Capped so tables do not stretch to absurd measures on a 1920 screen
            while still using the width a dense admin needs. */}
        <main id="main" className="admin-safe-x mx-auto w-full max-w-[1600px] p-4 sm:p-6 lg:px-8 lg:py-7">
          {children}
        </main>
      </div>
    </div>
  );
}
