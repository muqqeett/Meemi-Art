import type { Metadata } from "next";
import Link from "next/link";
import {
  Store,
  Percent,
  ShieldCheck,
  Database,
  ImageIcon,
  Mail,
} from "lucide-react";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { TestEmailForm } from "@/components/admin/test-email-form";
import { requireAdmin } from "@/lib/auth-guards";
import { describeStorage } from "@/lib/storage";
import { describeEmail } from "@/lib/email";
import { describePayments } from "@/lib/payments";
import { PaddleSyncButton } from "@/components/admin/paddle-sync-button";
import { siteConfig, commerceConfig } from "@/lib/config";

export const metadata: Metadata = { title: "Settings" };

function Panel({
  title,
  icon: Icon,
  description,
  children,
  footer,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
  children: React.ReactNode;
  /** Controls that belong to the panel but not in its definition list. */
  footer?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6">
      <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
        <Icon className="size-4 text-brand-600" />
        {title}
      </h2>
      {description && <p className="text-body mt-1">{description}</p>}
      <dl className="mt-4 divide-y divide-border text-sm">{children}</dl>
      {footer}
    </section>
  );
}

/** Present / absent, for a value that must never be printed. */
function Flag({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={ok ? "text-success" : "text-warning"}>
      {ok ? "✓" : "✗"} <span className="font-mono">{label}</span>
    </span>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-4 py-2.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="col-span-2 font-medium text-foreground">{value}</dd>
    </div>
  );
}

export default async function AdminSettingsPage() {
  const admin = await requireAdmin();
  const storage = describeStorage();
  const email = describeEmail();
  const payments = await describePayments();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <AdminPageHeader
        title="Settings"
        description="Store configuration. These values are defined in code so they stay in version control — edit src/lib/config.ts to change them."
      />

      <Panel title="Store" icon={Store}>
        <Row label="Name" value={siteConfig.name} />
        <Row label="Tagline" value={siteConfig.tagline} />
        <Row label="Support email" value={siteConfig.email} />
        <Row label="Public URL" value={<span className="font-mono text-xs">{siteConfig.url}</span>} />
      </Panel>

      {/* No shipping panel. Meemi Art sells digital products delivered as a
          download, so there is no carrier, no rate table and no free-shipping
          threshold. No tax rate either: Paddle is the merchant of record and
          calculates tax at its own checkout. */}
      <Panel title="Catalogue limits" icon={Percent}>
        <Row label="Products per page" value={String(commerceConfig.productsPerPage)} />
        <Row
          label="Max quantity per item"
          value={String(commerceConfig.maxQuantityPerItem)}
        />
      </Panel>

      <Panel title="Payments" icon={Database} description={payments.hint}>
        <Row label="Provider" value={payments.provider} />
        <Row
          label="Environment"
          value={
            payments.environment === "production" ? (
              <span className="font-semibold">Production — live money</span>
            ) : payments.environment === "sandbox" ? (
              <span className="text-warning">Sandbox — test money only</span>
            ) : (
              "n/a"
            )
          }
        />
        <Row label="API base" value={<span className="font-mono text-xs">{payments.apiBase}</span>} />
        <Row
          label="Client token type"
          value={
            payments.clientTokenEnv === "unknown" ? (
              <span className="text-muted-foreground">Not set</span>
            ) : payments.envMismatch ? (
              <span className="text-warning">
                {payments.clientTokenEnv} token against a {payments.environment} server —
                mismatch
              </span>
            ) : (
              <span className="text-success">
                {payments.clientTokenEnv === "production" ? "live_" : "test_"} token,
                matches the server
              </span>
            )
          }
        />
        <Row label="Currency" value={payments.currency} />

        {/* Presence, never the value. A masked key in a screenshot is still a
            key, and these rows exist to answer "is it set?" and nothing more. */}
        <Row
          label="Credentials"
          value={
            <span className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
              <Flag ok={payments.credentials.apiKey} label="PADDLE_API_KEY" />
              <Flag ok={payments.credentials.webhookSecret} label="PADDLE_WEBHOOK_SECRET" />
              <Flag ok={payments.credentials.clientToken} label="CLIENT_TOKEN" />
            </span>
          }
        />
        <Row
          label="API key check"
          value={
            payments.apiCheck.ok === "skipped" ? (
              <span className="text-muted-foreground">Not checked</span>
            ) : payments.apiCheck.ok === true ? (
              <span className="text-success">Paddle accepted the key</span>
            ) : (
              <span className="text-warning">{payments.apiCheck.reason}</span>
            )
          }
        />

        <Row
          label="Webhook URL"
          value={<span className="font-mono text-xs break-all">{payments.webhookUrl}</span>}
        />
        {/* Deliveries received is the only honest evidence the destination is
            wired up — configuration can look perfect and still not be saved in
            Paddle's dashboard. */}
        <Row
          label="Webhook deliveries"
          value={
            payments.webhookEvents.total === 0 ? (
              <span className="text-warning">
                None received yet — the destination may not be registered in Paddle
              </span>
            ) : (
              `${payments.webhookEvents.total} received · last ${payments.webhookEvents.lastAt?.toLocaleString() ?? "—"}`
            )
          }
        />

        <Row
          label="Catalogue"
          value={
            <span className={payments.catalog.synced < payments.catalog.sellable ? "text-warning" : undefined}>
              {payments.catalog.synced} of {payments.catalog.sellable} sellable products synced
              {payments.catalog.drifted > 0 && ` · ${payments.catalog.drifted} price(s) out of step`}
            </span>
          }
        />

        <Row
          label="Payments"
          value={
            <span className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
              <span>Paid {payments.payments.paid}</span>
              <span>Pending {payments.payments.pending}</span>
              <span>Processing {payments.payments.processing}</span>
              <span>Failed {payments.payments.failed}</span>
              <span>Refunded {payments.payments.refunded}</span>
            </span>
          }
        />
        <Row
          label="Orders"
          value={`${payments.orders.completed} completed · ${payments.orders.pending} pending`}
        />

        <Row
          label="Required variables"
          value={<span className="font-mono text-xs">{payments.requiredVars}</span>}
        />

        {/* Blockers, named. Anything listed here means checkout will refuse
            rather than take an order it cannot charge. */}
        {payments.problems.length > 0 && (
          <div className="pt-3">
            <p className="text-warning text-sm font-semibold">
              Not ready to take payments
            </p>
            <ul className="text-body mt-1 list-disc space-y-1 pl-5 text-xs">
              {payments.problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          </div>
        )}

        {payments.driver === "paddle" && (
          <div className="pt-3">
            <PaddleSyncButton disabled={!payments.credentials.apiKey} />
          </div>
        )}

        <Row
          label="Missed a webhook?"
          value={
            <Link
              href="/admin/payments/reconcile"
              className="font-semibold text-brand-600 hover:underline"
            >
              Reconcile a Paddle transaction →
            </Link>
          }
        />

        {/* Deliberately no "mark as paid" control anywhere in this dashboard.
            An order becomes paid because Paddle said so over a signed webhook —
            or, on the reconciliation page, because Paddle's own API confirmed
            it when asked directly. Never because someone clicked a button. */}
        <p className="text-muted-foreground pt-2 text-xs">
          Payment state is set only by verified Paddle webhooks. There is no manual
          override, by design.
        </p>
      </Panel>

      <Panel
        title="Image storage"
        icon={ImageIcon}
        description={storage.hint}
      >
        <Row label="Driver" value={storage.name} />
        <Row
          label="Production ready"
          value={
            storage.isProduction ? (
              "Yes — images are stored off-server"
            ) : (
              <span className="text-warning">
                No — set the Cloudinary variables before deploying
              </span>
            )
          }
        />
        <Row
          label="Required variables"
          value={
            <span className="font-mono text-xs">
              CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
            </span>
          }
        />
      </Panel>

      <Panel
        title="Transactional email"
        icon={Mail}
        description={email.hint}
        // The key itself is never rendered — only whether one is present.
        footer={<TestEmailForm configured={email.isConfigured} defaultEmail={admin.email} />}
      >
        <Row label="Provider" value={email.provider} />
        <Row
          label="Status"
          value={
            email.isConfigured ? (
              "Live — emails are being delivered"
            ) : (
              <span className="text-warning">
                Not configured — nothing is sent, attempts logged as skipped
              </span>
            )
          }
        />
        <Row label="Brand" value={email.brand} />
        <Row label="From" value={<span className="font-mono text-xs">{email.from}</span>} />
        <Row
          label="Reply-To"
          value={<span className="font-mono text-xs">{email.replyTo}</span>}
        />
        <Row
          label="Order notifications"
          value={<span className="font-mono text-xs">{email.adminEmail}</span>}
        />
        <Row
          label="Links in emails"
          value={<span className="font-mono text-xs">{email.siteUrl}</span>}
        />
        <Row
          label="Required variables"
          value={
            <span className="font-mono text-xs">RESEND_API_KEY, EMAIL_FROM, EMAIL_REPLY_TO</span>
          }
        />
      </Panel>

      <Panel title="Your access" icon={ShieldCheck}>
        <Row label="Signed in as" value={admin.email} />
        <Row label="Role" value={admin.role} />
        <Row
          label="Enforcement"
          value="Checked server-side on every admin page and action"
        />
      </Panel>
    </div>
  );
}
