import type { Metadata } from "next";

import { AdminSidebar, AdminMobileNav } from "@/components/admin/admin-sidebar";
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
 * treated as the only gate.
 */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const admin = await requireAdmin();

  return (
    <div className="min-h-screen bg-surface-alt">
      <AdminSidebar />

      <div className="lg:pl-60">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background px-4 sm:px-6">
          <AdminMobileNav />
          <div className="ml-auto flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium text-foreground">
                {admin.name ?? "Administrator"}
              </p>
              <p className="text-xs text-muted-foreground">{admin.email}</p>
            </div>
            <span
              aria-hidden
              className="inline-flex size-9 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white"
            >
              {(admin.name ?? admin.email).charAt(0).toUpperCase()}
            </span>
          </div>
        </header>

        <main id="main" className="p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
