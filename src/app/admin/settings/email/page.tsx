import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Mail, ScrollText } from "lucide-react";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { TestEmailForm } from "@/components/admin/test-email-form";
import { requireAdmin } from "@/lib/auth-guards";
import { describeEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Email test" };

/**
 * Deliverability diagnostics.
 *
 * Two halves, because a failed send has two separate questions behind it:
 * whether this application is configured to send at all, and what the provider
 * said when it tried. The first is answered by `describeEmail`, the second by
 * `EmailLog` — every attempt is recorded there with the provider's own error,
 * which is usually the actual diagnosis.
 *
 * No secret is rendered. `RESEND_API_KEY` is reported as present or absent and
 * never printed, not even partially: a masked key in a screenshot is still a
 * key. `describeEmail` deliberately exposes no way to read it.
 */
export default async function EmailTestPage() {
  const admin = await requireAdmin();
  const email = describeEmail();

  // The last handful of attempts, newest first. This is the panel that
  // explains an empty Resend dashboard: a rejected send never becomes an
  // email, so it appears here and nowhere in Resend.
  const log = await prisma.emailLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      createdAt: true,
      to: true,
      template: true,
      subject: true,
      status: true,
      providerId: true,
      error: true,
    },
  });

  const failures = await prisma.emailLog.count({ where: { status: "FAILED" } });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/admin/settings"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-brand-600"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to settings
      </Link>

      <AdminPageHeader
        title="Email test"
        description="Send a test message and see exactly what the provider said."
      />

      <section className="admin-card p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
          <Mail className="size-4 text-brand-600" aria-hidden />
          Configuration
        </h2>

        <dl className="mt-4 divide-y divide-border text-sm">
          <Row label="Provider" value={email.provider} />
          <Row
            label="RESEND_API_KEY"
            value={
              email.isConfigured ? (
                <span className="text-success">✓ configured</span>
              ) : (
                <span className="text-warning">✗ not set</span>
              )
            }
          />
          <Row label="EMAIL_FROM" value={<span className="font-mono text-xs">{email.from}</span>} />
          <Row
            label="EMAIL_REPLY_TO"
            value={<span className="font-mono text-xs">{email.replyTo}</span>}
          />
          <Row
            label="Admin notifications"
            value={<span className="font-mono text-xs">{email.adminEmail}</span>}
          />
          <Row label="Brand in subjects" value={email.brand} />
          <Row
            label="Link base"
            value={<span className="font-mono text-xs">{email.siteUrl}</span>}
          />
          <Row
            label="Status"
            value={
              email.isConfigured ? (
                <span className="text-success">Ready to send</span>
              ) : (
                <span className="text-warning">{email.hint}</span>
              )
            }
          />
        </dl>

        <TestEmailForm configured={email.isConfigured} defaultEmail={admin.email ?? ""} />
      </section>

      <section className="admin-card p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
          <ScrollText className="size-4 text-brand-600" aria-hidden />
          Recent attempts
        </h2>
        <p className="text-body mt-1 text-sm">
          Every send is recorded here with the provider&rsquo;s own reply. A message
          Resend <em>rejected</em> never becomes an email, so it appears in this list
          and nowhere in the Resend dashboard — which is what an empty dashboard
          alongside failures here means.
          {failures > 0 && ` ${failures} failure(s) recorded in total.`}
        </p>

        {log.length === 0 ? (
          <p className="text-body mt-4 text-sm">No email has been attempted yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {log.map((row) => (
              <li key={row.id} className="rounded-lg border border-border p-3 text-xs">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span
                    className={
                      row.status === "SENT"
                        ? "text-success font-semibold"
                        : row.status === "FAILED"
                          ? "text-destructive font-semibold"
                          : "text-warning font-semibold"
                    }
                  >
                    {row.status}
                  </span>
                  <span className="text-muted-foreground">
                    {row.createdAt.toLocaleString()}
                  </span>
                  <span className="font-mono text-muted-foreground">{row.template}</span>
                </div>
                <p className="mt-1 text-foreground">
                  <span className="text-muted-foreground">to</span> {row.to}
                </p>
                <p className="text-muted-foreground">{row.subject}</p>
                {row.providerId && (
                  <p className="mt-1">
                    <span className="text-muted-foreground">Resend id</span>{" "}
                    <span className="font-mono break-all text-foreground">
                      {row.providerId}
                    </span>
                  </p>
                )}
                {row.error && (
                  <p className="text-destructive mt-1 break-words">{row.error}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
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
