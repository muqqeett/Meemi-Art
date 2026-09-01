import type { Metadata } from "next";
import Link from "next/link";
import { Mail, TriangleAlert } from "lucide-react";

import {
  AdminPageHeader,
  AdminTableCard,
  AdminSection,
} from "@/components/admin/admin-page-header";
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
import { getEmailHealth, redactError } from "@/lib/queries/email-health";
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
  const [{ emails, page, pageCount, byStatus }, health] = await Promise.all([
    listAdminEmails({ page: Number(first(raw.page)) || 1, status }),
    getEmailHealth(),
  ]);

  // Live provider state, which history cannot tell you: zero skipped rows only
  // means no provider was missing when those rows were written.
  const configured = health.provider.configured;
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


      {/* ---- Operational overview -----------------------------------------
          Every figure is a count of persisted rows. Deliberately no health
          score: "6 accepted, 7 rejected, one cause" is actionable, and a
          percentage badge would only hide which of those numbers moved. */}
      <div className="admin-card admin-rise mb-4 grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-4 sm:divide-y-0">
        <div className="px-5 py-4">
          <p className="admin-eyebrow">Attempts</p>
          <p className="mt-1.5 text-xl font-semibold text-foreground tabular-nums">
            {health.attempted}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">Offered to provider</p>
        </div>

        <div className="px-5 py-4">
          <p className="admin-eyebrow">Accepted</p>
          <p className="mt-1.5 text-xl font-semibold text-success tabular-nums">
            {health.counts.SENT}
          </p>
          {/* Not "delivered". The provider accepting a request is the furthest
              this schema can see — there is no webhook, so no bounce, open or
              complaint data exists anywhere. */}
          <p className="mt-0.5 text-xs text-muted-foreground">Not confirmed delivered</p>
        </div>

        <div className="px-5 py-4">
          <p className="admin-eyebrow">Rejected</p>
          <p
            className={cn(
              "mt-1.5 text-xl font-semibold tabular-nums",
              health.counts.FAILED > 0 ? "text-destructive" : "text-foreground",
            )}
          >
            {health.counts.FAILED}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {health.failureRate === null
              ? "No attempts yet"
              : `${health.failureRate}% of attempts`}
          </p>
        </div>

        <div className="px-5 py-4">
          <p className="admin-eyebrow">Skipped</p>
          <p className="mt-1.5 text-xl font-semibold text-foreground tabular-nums">
            {health.counts.SKIPPED}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">No provider at the time</p>
        </div>
      </div>

      {/* ---- Failure causes ------------------------------------------------
          Grouped by the exact stored message, because seven failures sharing
          one cause is one fix, not seven. */}
      {health.causes.length > 0 && (
        <AdminSection
          title="Why sends are failing"
          description={`${health.causes.length} distinct ${health.causes.length === 1 ? "cause" : "causes"} across ${health.counts.FAILED} rejected ${health.counts.FAILED === 1 ? "email" : "emails"}`}
          className="admin-rise mb-4"
          bodyClassName="p-0"
        >
          <ul className="divide-y divide-border">
            {health.causes.map((cause) => (
              <li
                key={cause.reason}
                className="flex flex-wrap items-start gap-x-4 gap-y-1.5 px-5 py-3.5"
              >
                <span
                  aria-hidden
                  className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-destructive/25 bg-destructive/8 text-destructive"
                >
                  <TriangleAlert className="size-3.5" />
                </span>
                {/* Provider text, passed through the redactor. Long messages
                    wrap rather than widening the page on a phone. */}
                <p className="min-w-0 flex-1 text-sm leading-relaxed break-words text-foreground">
                  {redactError(cause.reason)}
                </p>
                <span className="shrink-0 text-sm font-medium text-destructive tabular-nums">
                  {cause.count}×
                </span>
              </li>
            ))}
          </ul>
        </AdminSection>
      )}

      {/* ---- Per template -------------------------------------------------
          The template column is written from the canonical EMAIL_TEMPLATES
          registry, so this is a real breakdown rather than subject-line
          guesswork. */}
      {health.templates.length > 0 && (
        <AdminSection
          title="By email type"
          description="Only types this store has actually sent."
          className="admin-rise mb-4"
          bodyClassName="p-0"
        >
          <div className="w-full overflow-x-auto">
            <table className="admin-table admin-table-stack sm:min-w-[560px]">
              <caption className="sr-only">Email attempts by template</caption>
              <thead>
                <tr>
                  <th scope="col">Type</th>
                  <th scope="col" className="text-right">Attempts</th>
                  <th scope="col" className="text-right">Accepted</th>
                  <th scope="col" className="text-right">Rejected</th>
                </tr>
              </thead>
              <tbody>
                {health.templates.map((row) => (
                  <tr key={row.template}>
                    <td data-label="Type">
                      <code className="rounded-sm border border-border bg-[var(--admin-raised)] px-1.5 py-0.5 font-mono text-[0.6875rem] text-muted-foreground">
                        {row.template}
                      </code>
                    </td>
                    <td data-label="Attempts" className="text-right tabular-nums text-muted-foreground">
                      {row.total}
                    </td>
                    <td data-label="Accepted" className="text-right tabular-nums text-muted-foreground">
                      {row.sent}
                    </td>
                    <td
                      data-label="Rejected"
                      className={cn(
                        "text-right tabular-nums",
                        row.failed > 0 ? "font-medium text-destructive" : "text-muted-foreground",
                      )}
                    >
                      {row.failed}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AdminSection>
      )}

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
            {health.provider.from && (
              <>
                {" "}
                The sending identity is already set to{" "}
                {/* From config, never hard-coded. The API key is reported only
                    as present or absent — never its value. */}
                <span className="break-all font-medium text-foreground">
                  {health.provider.from}
                </span>
                .
              </>
            )}
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
            <table className="admin-table admin-table-stack min-w-[880px]">
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
                    <td data-label="Template">
                      <code className="rounded-sm border border-border bg-[var(--admin-raised)] px-1.5 py-0.5 font-mono text-[0.6875rem] text-muted-foreground">
                        {email.template}
                      </code>
                    </td>

                    <td data-label="Recipient" className="max-w-56">
                      <span className="admin-cell-primary">{email.to}</span>
                    </td>

                    <td data-label="Subject" className="max-w-72">
                      <span className="block truncate text-muted-foreground">
                        {email.subject}
                      </span>
                      {email.error && (
                        <span className="block truncate text-xs text-destructive">
                          {email.error}
                        </span>
                      )}
                    </td>

                    <td data-label="Status">
                      <StatusBadge tone={tone(email.status)}>
                        {email.status.toLowerCase()}
                      </StatusBadge>
                    </td>

                    <td data-label="Attempted" className="whitespace-nowrap text-muted-foreground">
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
