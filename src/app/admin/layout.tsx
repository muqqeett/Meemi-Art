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
    <div className="min-h-dvh bg-surface-alt">
      <AdminSidebar />

      <div
        className="transition-[padding] duration-200 ease-out lg:pl-[var(--admin-rail,15rem)]"
      >
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/95 px-3 backdrop-blur sm:px-6">
          <AdminMobileNav />

          {/* Breadcrumbs take the slack so the search and profile stay put as
              the path grows. Hidden below `sm`, where the space belongs to
              search. */}
          <div className="hidden min-w-0 flex-1 sm:block">
            <AdminBreadcrumbs />
          </div>

          <div className="ml-auto flex min-w-0 items-center gap-2 sm:gap-3">
            <AdminCommandPalette />

            <Link
              href="/account"
              className="flex items-center gap-2.5 rounded-lg px-1.5 py-1 transition-colors hover:bg-surface-alt focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            >
              <span className="hidden text-right md:block">
                <span className="block text-sm leading-tight font-medium text-foreground">
                  {admin.name ?? "Administrator"}
                </span>
                <span className="block text-xs leading-tight text-muted-foreground">
                  {admin.email}
                </span>
              </span>
              <span
                aria-hidden
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white"
              >
                {(admin.name ?? admin.email).charAt(0).toUpperCase()}
              </span>
              <span className="sr-only">Your account</span>
            </Link>
          </div>
        </header>

        <main id="main" className="p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
