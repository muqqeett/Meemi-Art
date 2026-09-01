import type { Metadata } from "next";
import Link from "next/link";
import { Mail, TriangleAlert } from "lucide-react";

import { AdminPageHeader, AdminTableCard } from "@/components/admin/admin-page-header";
import { StatusBadge } from "@/components/admin/admin-primitives";
import { EmptyState } from "@/components/brand/empty-state";
import { ButtonLink } from "@/components/ui/button-link";
import { PaginationNav } from "@/components/shop/pagination-nav";
import {
  EMAIL_STATUSES,
  listAdminEmails,
  parseEmailStatus,
} from "@/lib/queries/admin-resources";
import { buildBaseQuery, hasAnyParam } from "@/lib/shop-params";
import { isEmailConfigured } from "@/lib/email";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Email Center" };

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/** SENT is good; FAILED is a customer who did not get their download link. */
function tone(status: string) {
  if (status === "SENT") return "positive" as const;
  if (status === "FAILED") return "critical" as const;
  return "neutral" as const;
}

/**
 * Every send the application has attempted, with its real outcome.
 *
 * `EmailLog` records one row per attempt, including the provider's error text
 * on failure — so this page never has to infer delivery. SKIPPED means no
 * provider was configured and nothing was sent, which is stated plainly rather
 * than dressed up as success.
 */
export default async function AdminEmailsPage({ searchParams }: PageProps<"/admin/emails">) {
  const raw = await searchParams;
  const status = parseEmailStatus(first(raw.status));

  // `total` is the *filtered* count and is already folded into `pageCount`;
  // the heading counts every attempt, which is what `byStatus` sums to.
  const { emails, page, pageCount, byStatus } = await listAdminEmails({
    page: Number(first(raw.page)) || 1,
    status,
  });

  const configured = isEmailConfigured();
  const counts = new Map(byStatus.map((row) => [row.status, row.count]));
  const failed = counts.get("FAILED") ?? 0;
  const allTotal = byStatus.reduce((sum, row) => sum + row.count, 0);

  // Selected reads as a darker chip rather than a saturated brand pill — five
  // filled pills in a row would be the loudest thing on a page whose point is
  // the log beneath them.
  const tabClass =
    "inline-flex h-8 items-center gap-2 rounded-md border px-3 text-[0.8125rem] transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600";
  const tabOn = "border-brand-300 bg-brand-50 font-medium text-brand-700";
  const tabOff =
    "border-border text-muted-foreground hover:border-brand-200 hover:bg-[var(--admin-hover)] hover:text-foreground";

  return (
    <div>
      <AdminPageHeader
        title="Email center"
        description={`${allTotal.toLocaleString("en-US")} delivery ${allTotal === 1 ? "attempt" : "attempts"} recorded. Emails are logged, never re-sent from here.`}
      />

      {!configured && (
        <div className="mb-6 flex items-start gap-3 rounded-md border border-warning/25 bg-warning/[0.06] px-4 py-3.5 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          <p>
            <strong className="font-medium text-foreground">
              No email provider is configured.
            </strong>{" "}
            Nothing is being delivered — sends are recorded as skipped. Set{" "}
            <code className="rounded-sm border border-border bg-[var(--admin-raised)] px-1 py-0.5 font-mono text-[0.6875rem]">RESEND_API_KEY</code>{" "}
            and{" "}
            <code className="rounded-sm border border-border bg-[var(--admin-raised)] px-1 py-0.5 font-mono text-[0.6875rem]">EMAIL_FROM</code>{" "}
            before relying on order confirmations.
          </p>
        </div>
      )}

      {configured && failed > 0 && (
        <div className="mb-6 flex items-start gap-3 rounded-md border border-destructive/25 bg-destructive/[0.05] px-4 py-3.5 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
          <p>
            <strong className="font-medium text-foreground">
              {failed} {failed === 1 ? "email has" : "emails have"} failed to send.
            </strong>{" "}
            Those customers may not have received their download links. The
            provider&rsquo;s error is shown against each row.
          </p>
        </div>
      )}

      {/* Server-rendered filter tabs rather than the shared `AdminFilters`,
          which leads with a search box — `EmailLog` has no text index and a
          search field that does nothing is worse than none. */}
      <nav aria-label="Filter by status" className="mb-4 flex flex-wrap gap-2">
        <Link
          href="/admin/emails"
          aria-current={status ? undefined : "page"}
          className={cn(
            tabClass,
            status ? tabOff : tabOn,
          )}
        >
          All
          <span className="text-xs tabular-nums opacity-75">{allTotal}</span>
        </Link>

        {EMAIL_STATUSES.map((value) => (
          <Link
            key={value}
            href={`/admin/emails?status=${value}`}
            aria-current={status === value ? "page" : undefined}
            className={cn(
              tabClass,
              "capitalize",
              status === value ? tabOn : tabOff,
            )}
          >
            {value.toLowerCase()}
            <span className="text-xs tabular-nums opacity-75">{counts.get(value) ?? 0}</span>
          </Link>
        ))}
      </nav>

      {emails.length === 0 ? (
        <AdminTableCard>
          {hasAnyParam(raw, ["status"]) ? (
            <EmptyState
              variant="inline"
              icon={Mail}
              title="No emails with that status"
              description="Nothing has been recorded with this outcome. Clear the filter to see every attempt."
              action={
                <ButtonLink href="/admin/emails" variant="brand" size="pill">
                  Clear filter
                </ButtonLink>
              }
            />
          ) : (
            <EmptyState
              variant="inline"
              icon={Mail}
              title="No emails sent yet"
              description="Order confirmations, verification links and password resets appear here as they are attempted."
            />
          )}
        </AdminTableCard>
      ) : (
        <>
          <AdminTableCard>
            <table className="admin-table min-w-[880px]">
              <caption className="sr-only">Email delivery log</caption>
              <thead>
                <tr>
                  <th scope="col">
                    Template
                  </th>
                  <th scope="col">
                    Recipient
                  </th>
                  <th scope="col">
                    Subject
                  </th>
                  <th scope="col">
                    Status
                  </th>
                  <th scope="col">
                    Attempted
                  </th>
                </tr>
              </thead>

              <tbody>
                {emails.map((email) => (
                  <tr key={email.id}>
                    <td>
                      <code className="rounded-sm border border-border bg-[var(--admin-raised)] px-1.5 py-0.5 font-mono text-[0.6875rem] text-muted-foreground">
                        {email.template}
                      </code>
                    </td>

                    <td className="max-w-56">
                      <span className="block truncate text-foreground">{email.to}</span>
                    </td>

                    <td className="max-w-72">
                      <span className="block truncate text-muted-foreground">
                        {email.subject}
                      </span>
                      {email.error && (
                        <span className="block truncate text-xs text-destructive">
                          {email.error}
                        </span>
                      )}
                    </td>

                    <td>
                      <StatusBadge tone={tone(email.status)}>
                        {email.status.toLowerCase()}
                      </StatusBadge>
                    </td>

                    <td className="whitespace-nowrap text-muted-foreground">
                      <time dateTime={email.createdAt.toISOString()}>
                        {email.createdAt.toLocaleDateString("en-US", { dateStyle: "medium" })}
                      </time>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </AdminTableCard>

          <PaginationNav
            page={page}
            pageCount={pageCount}
            baseQuery={buildBaseQuery(raw)}
            basePath="/admin/emails"
          />
        </>
      )}
    </div>
  );
}
