import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, RefreshCcw } from "lucide-react";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { ReconcileForm } from "@/components/admin/reconcile-form";
import { requireAdmin } from "@/lib/auth-guards";

export const metadata: Metadata = { title: "Reconcile a Paddle transaction" };

/**
 * Recovery for a payment Paddle captured but whose webhook never landed.
 *
 * Guarded by `requireAdmin` here and re-checked inside the server action, since
 * the action is reachable independently of this page.
 */
export default async function ReconcilePage() {
  await requireAdmin();

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/admin/settings"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-brand-600"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to settings
      </Link>

      <AdminPageHeader
        title="Paddle Transaction Reconciliation"
        description="For an order that was paid but never completed, usually because a webhook was missed."
      />

      <section className="rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6">
        <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
          <RefreshCcw className="size-4 text-brand-600" aria-hidden />
          Verify &amp; reconcile
        </h2>
        <div className="mt-5">
          <ReconcileForm />
        </div>
      </section>
    </div>
  );
}
