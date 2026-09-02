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
import {
  getEmailHealth,
  listDeletableFailedEmailIds,
  redactError,
} from "@/lib/queries/email-health";
import { isEmailLogDeletable } from "@/lib/actions/admin/email-log-deletion-policy";
import { EmailLogDeleteButton } from "@/components/admin/email-log-delete-button";
import { EmailLogBulkDelete } from "@/components/admin/email-log-bulk-delete";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Email Center" };

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/** `purchase-ready` -> "Purchase ready". Presentation only — the stored
 *  template slug is unchanged and still shown beneath. */
function humaniseTemplate(template: string): string {
  const words = template.replace(/[-._]/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
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
  const [{ emails, page, pageCount, byStatus }, health, deletableFailedIds] =
    await Promise.all([
      listAdminEmails({ page: Number(first(raw.page)) || 1, status }),
      getEmailHealth(),
      /**
       * Gathered here, at render, so the delete control carries the exact set
       * the admin is looking at. The action never re-derives "everything that
       * failed" for itself — see `actions/admin/email-logs.ts`.
       */
      listDeletableFailedEmailIds(),
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


      {/* ---- Configuration · current · historical ------------------------
          Three separate questions, so an operator never reads a historical
          failure as a live incident:

            1. Is sending configured right now?  (live env read)
            2. Has anything failed since the last failure?  (real rows)
            3. What is on record?  (totals, unchanged)

          The middle one is the important one, and it deliberately invents no
          time window — "since the last failure" is a boundary the data
          actually defines. */}
      <div className="admin-rise mb-4 grid gap-3 lg:grid-cols-3">
        {/* 1 · Configuration — the strongest card, because a working system
            should outweigh old failures visually. */}
        <section
          className="admin-card p-5"
          aria-labelledby="email-config-heading"
        >
          <p id="email-config-heading" className="admin-eyebrow">
            Email configuration
          </p>
          <p className="mt-2.5 flex items-center gap-2">
            <span
              aria-hidden
              className={cn(
                "size-2 shrink-0 rounded-full",
                configured ? "bg-success" : "bg-warning",
              )}
            />
            <span
              className={cn(
                "text-lg font-semibold",
                configured ? "text-success" : "text-warning",
              )}
            >
              {configured ? "Configured" : "Not configured"}
            </span>
          </p>
          {health.provider.from ? (
            <dl className="mt-3 space-y-1.5 text-xs">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <dt className="text-muted-foreground">Sending as</dt>
                {/* Identity only — the API key is never read into the UI. */}
                <dd className="min-w-0 break-all text-foreground">
                  {health.provider.from}
                </dd>
              </div>
              {health.provider.replyTo && (
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <dt className="text-muted-foreground">Reply-to</dt>
                  <dd className="min-w-0 break-all text-foreground">
                    {health.provider.replyTo}
                  </dd>
                </div>
              )}
            </dl>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">
              No sending identity set.
            </p>
          )}
        </section>

        {/* 2 · Current health, bounded by a real event rather than a made-up
            window. */}
        <section className="admin-card p-5" aria-labelledby="email-current-heading">
          <p id="email-current-heading" className="admin-eyebrow">
            Since the last failure
          </p>
          {health.sinceLastFailure ? (
            <>
              <p className="mt-2.5 flex items-baseline gap-2">
                <span
                  className={cn(
                    "text-lg font-semibold tabular-nums",
                    health.sinceLastFailure.failed === 0
                      ? "text-success"
                      : "text-destructive",
                  )}
                >
                  {health.sinceLastFailure.attempts}
                </span>
                <span className="text-sm text-muted-foreground">
                  {health.sinceLastFailure.attempts === 1 ? "attempt" : "attempts"},{" "}
                  {health.sinceLastFailure.failed} failed
                </span>
              </p>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                Counted from the most recent failure on{" "}
                <time dateTime={health.sinceLastFailure.since.toISOString()}>
                  {health.sinceLastFailure.since.toLocaleDateString("en-US", {
                    dateStyle: "medium",
                  })}
                </time>
                . Not a rolling window — the boundary is that failure itself.
              </p>
            </>
          ) : (
            <>
              <p className="mt-2.5 text-lg font-semibold text-success tabular-nums">
                {health.counts.SENT}
              </p>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                No failed records. Every attempt on record was accepted by
                the provider.
              </p>
            </>
          )}
        </section>

        {/* 3 · Historical record. Muted on purpose: it is context, not an
            alarm, and the counts are never altered. */}
        <section className="admin-card p-5" aria-labelledby="email-history-heading">
          <p id="email-history-heading" className="admin-eyebrow">
            On record
          </p>
          <p className="mt-2.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-lg font-semibold text-foreground tabular-nums">
              {health.counts.SENT}
            </span>
            <span className="text-sm text-muted-foreground">accepted</span>
            <span className="text-lg font-semibold text-muted-foreground tabular-nums">
              {health.counts.FAILED}
            </span>
            <span className="text-sm text-muted-foreground">failed</span>
            {health.counts.SKIPPED > 0 && (
              <>
                <span className="text-lg font-semibold text-muted-foreground tabular-nums">
                  {health.counts.SKIPPED}
                </span>
                <span className="text-sm text-muted-foreground">skipped</span>
              </>
            )}
          </p>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            Every attempt ever made is kept, including failures. Records are
            never edited{health.failureRate !== null && <> · {health.failureRate}% of all attempts failed</>}.
          </p>
        </section>
      </div>
      {/* ---- Failure causes ------------------------------------------------
          Grouped by the exact stored message, because seven failures sharing
          one cause is one fix, not seven. */}
      {health.causes.length > 0 && (
        <AdminSection
          title="Recorded failure causes"
          description="Grouped by the provider's own wording, exactly as recorded at the time."
          action={<EmailLogBulkDelete ids={deletableFailedIds} />}
          className="admin-rise mb-4"
          bodyClassName="p-0"
        >
          <ul className="divide-y divide-border">
            {health.causes.map((cause) => (
              <li
                key={cause.reason}
                className="flex flex-wrap items-start gap-x-4 gap-y-1.5 px-5 py-3.5"
              >
                  {/* A dot, not a filled alert chip. These are records of
                      what happened, not an incident happening now. */}
                  <span
                    aria-hidden
                    className="mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground/50"
                  />
                {/* Provider text, passed through the redactor. Long messages
                    wrap rather than widening the page on a phone. */}
                <p className="min-w-0 flex-1 text-sm leading-relaxed break-words text-foreground">
                  {redactError(cause.reason)}
                </p>
                <span className="shrink-0 text-sm font-medium text-muted-foreground tabular-nums">                  {cause.count}×
                </span>
              </li>
            ))}
          </ul>

            {/* Deliberately careful wording. The application has no live
                domain-verification check, so it cannot assert that the
                domain is verified now — only quote what each record says
                and give the reader the date boundary to judge by. */}
            <p className="border-t border-border px-5 py-3.5 text-xs leading-relaxed text-muted-foreground">
              Failures are retained for operational accuracy and are never
              edited. Each entry records the provider&rsquo;s reason at the time of
              the attempt, which may no longer apply — a configuration or
              domain issue since resolved would still leave its original
              failures on record here.
            </p>
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
                    <th scope="col" className="w-12">
                      {/* Named for assistive tech; the column reads as a
                          row of icon buttons visually. */}
                      <span className="sr-only">Actions</span>
                    </th>
                </tr>
              </thead>

              <tbody>
                {emails.map((email) => (
                  <tr key={email.id}>
                    <td data-label="Template">
                        <span className="admin-cell-primary block">
                          {humaniseTemplate(email.template)}
                        </span>
                        {/* The stored slug, kept visible but secondary — it
                            is what you would grep the log for. */}
                        <span className="admin-mono mt-0.5 block">
                          {email.template}
                        </span>
                      </td>

                    <td data-label="Recipient" className="max-w-56">
                      <span className="admin-cell-primary">{email.to}</span>
                    </td>

                    <td data-label="Subject" className="max-w-72">
                      <span className="block truncate text-muted-foreground">
                        {email.subject}
                      </span>
                      {email.error && (
                          // Wrapped, not truncated — a clipped provider error
                          // is useless for debugging. Redacted on the way out,
                          // exactly as the causes list above does.
                          <span className="mt-1 block text-xs leading-relaxed break-words text-destructive/90">
                            {redactError(email.error)}
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

                    {/* No `data-label`, matching the orders table: on mobile
                        every labelled cell prints its column name, and an
                        accepted email would otherwise show an "ACTIONS" row
                        with nothing beside it. `admin-row-actions` is the
                        house pattern — hidden until the row is hovered or
                        focused, always visible on touch. */}
                    <td className="text-right">
                      {isEmailLogDeletable(email) && (
                        <div className="admin-row-actions flex justify-end">
                          <EmailLogDeleteButton
                            logId={email.id}
                            template={humaniseTemplate(email.template)}
                            status={email.status}
                            to={email.to}
                          />
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Said once here rather than as a disabled button on every
                accepted row. The reason is real and worth stating: the row
                is the send path's idempotency guard. */}
            <p className="border-t border-border px-5 py-3.5 text-xs leading-relaxed text-muted-foreground">
              Failed and skipped records can be deleted from this history.
              Accepted emails are kept — each one is what stops the same
              message being sent to a customer a second time. Deleting a
              record removes it from the admin history only; it never
              resends or affects email delivery.
            </p>
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
