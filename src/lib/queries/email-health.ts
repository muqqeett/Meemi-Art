import "server-only";

import { prisma } from "@/lib/prisma";
import { isEmailConfigured, emailConfig } from "@/lib/email";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Whether transactional mail is actually working.
 *
 * ── What the statuses really mean ──────────────────────────────────────────
 *
 * Read from `sendEmail` in `lib/email/email-service.ts`, not from the names:
 *
 *   SKIPPED  no provider configured (`RESEND_API_KEY` unset). Nothing left the
 *            building, and the system deliberately never reports success for
 *            mail it did not send.
 *   SENT     the provider's API **accepted the request**. That is acceptance,
 *            not delivery.
 *   FAILED   the provider rejected it.
 *
 * `DUPLICATE` exists on `SendResult` but is never persisted — a duplicate send
 * returns early and writes no row, so the table only ever holds the three
 * above.
 *
 * ── What cannot be measured ────────────────────────────────────────────────
 *
 * There is no Resend webhook and no delivery, bounce, open, click or complaint
 * data anywhere in the schema. So this module never says "delivered": the most
 * it can honestly claim is that the provider accepted the request. A mail
 * accepted here could still have bounced, and nothing in this database would
 * know.
 *
 * Read-only. Nothing here sends, retries or mutates.
 */

/**
 * The one definition of a failed email, shared with the Action Center's alert
 * so the dashboard count and this page can never disagree.
 */
export const FAILED_EMAIL = { status: "FAILED" } as const satisfies Prisma.EmailLogWhereInput;

export type EmailHealth = Awaited<ReturnType<typeof getEmailHealth>>;

export async function getEmailHealth() {
  const [total, byStatus, byTemplate, latest, lastFailure, failureRows] =
    await Promise.all([
      prisma.emailLog.count(),

      prisma.emailLog.groupBy({ by: ["status"], _count: { _all: true } }),

      // The template column is written from the canonical `EMAIL_TEMPLATES`
      // registry, so this is a real type breakdown — nothing is inferred from
      // subject text.
      prisma.emailLog.groupBy({ by: ["template", "status"], _count: { _all: true } }),

      prisma.emailLog.findFirst({
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: { createdAt: true, template: true, status: true },
      }),

      prisma.emailLog.findFirst({
        where: FAILED_EMAIL,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: { createdAt: true, template: true, error: true },
      }),

      /**
       * Failures grouped by their reason.
       *
       * Bounded to the most recent 200 so a long-running store never pulls its
       * whole failure history to build a summary. The error strings are short
       * provider messages, and grouping them is what turns "7 failures" into
       * "one unverified domain", which is the actionable form.
       */
      prisma.emailLog.findMany({
        where: FAILED_EMAIL,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 200,
        select: { error: true },
      }),
    ]);

  const counts = { SENT: 0, FAILED: 0, SKIPPED: 0 } as Record<string, number>;
  for (const row of byStatus) counts[row.status] = row._count._all;

  // Grouped by the exact stored string. Distinct causes matter more than a
  // total: seven failures with one cause is one fix.
  const causes = new Map<string, number>();
  for (const row of failureRows) {
    const key = row.error ?? "No reason recorded";
    causes.set(key, (causes.get(key) ?? 0) + 1);
  }

  // Per template, with its own failure count.
  const templates = new Map<string, { total: number; sent: number; failed: number; skipped: number }>();
  for (const row of byTemplate) {
    const entry = templates.get(row.template) ?? { total: 0, sent: 0, failed: 0, skipped: 0 };
    entry.total += row._count._all;
    if (row.status === "SENT") entry.sent += row._count._all;
    if (row.status === "FAILED") entry.failed += row._count._all;
    if (row.status === "SKIPPED") entry.skipped += row._count._all;
    templates.set(row.template, entry);
  }

  /**
   * Failure rate = FAILED ÷ (SENT + FAILED).
   *
   * SKIPPED is deliberately excluded from the denominator: those were never
   * offered to the provider, so counting them would dilute the rate with
   * attempts that never happened. `null` when nothing has been attempted —
   * a rate over zero attempts is not 0%, it is unknown.
   */
  const attempted = counts.SENT + counts.FAILED;
  const failureRate = attempted > 0 ? Math.round((counts.FAILED / attempted) * 1000) / 10 : null;
  /**
   * What has happened *since* the last failure.
   *
   * The one honest way to separate "working now" from "has failures on
   * record" without inventing a time window. It asks the database a question
   * it can actually answer — how many attempts came after the newest failure,
   * and how many of those failed — rather than assuming a rolling 7 or 30 days
   * that nothing in the schema defines.
   *
   * Null when nothing has ever failed: there is no "since" to report, and the
   * caller shows plain totals instead.
   */
  const sinceLastFailure = lastFailure
    ? await prisma.emailLog
        .groupBy({
          by: ["status"],
          where: { createdAt: { gt: lastFailure.createdAt } },
          _count: { _all: true },
        })
        .then((rows) => ({
          attempts: rows.reduce((sum, r) => sum + r._count._all, 0),
          failed: rows.find((r) => r.status === "FAILED")?._count._all ?? 0,
          since: lastFailure.createdAt,
        }))
    : null;

  return {
    sinceLastFailure,
    total,
    counts,
    attempted,
    failureRate,
    latest,
    lastFailure,
    causes: [...causes.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason)),
    templates: [...templates.entries()]
      .map(([template, stats]) => ({ template, ...stats }))
      .sort((a, b) => b.failed - a.failed || b.total - a.total || a.template.localeCompare(b.template)),
    /**
     * Live provider state, not history. Zero SKIPPED rows does not mean a
     * provider is configured now — it means none was missing when those rows
     * were written. Read fresh so the page reflects the current environment.
     *
     * The sending identity is read from config, never hard-coded here, and the
     * API key is reported only as present/absent — never its value.
     */
    provider: {
      configured: isEmailConfigured(),
      from: emailConfig.from || null,
      replyTo: emailConfig.replyTo || null,
    },
  };
}

/**
 * The failed records an admin may clear, oldest first.
 *
 * Read-only, like everything else here — it returns ids, and deleting them is
 * the deletion action's job, never this module's.
 *
 * It exists so the page can hand the delete action an explicit list rather than
 * letting the server decide for itself what "all the failures" means at the
 * moment the button is pressed. Oldest first because the historical records are
 * the ones an operator is clearing; capped so a store with a long failure
 * history never builds an unbounded payload, and the caller can tell it was
 * capped by comparing the length against the FAILED count.
 *
 * SKIPPED rows are equally deletable by policy but are deliberately not
 * gathered here: this list backs a control labelled "failed records", and it
 * should delete exactly what it says.
 */
export async function listDeletableFailedEmailIds(limit = 500): Promise<string[]> {
  const rows = await prisma.emailLog.findMany({
    where: FAILED_EMAIL,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: limit,
    select: { id: true },
  });
  return rows.map((row) => row.id);
}

/**
 * Redacts anything credential-shaped from a stored provider error before it
 * reaches the browser.
 *
 * Resend's messages are descriptive and the send path never logs tokens, so in
 * practice this finds nothing. It exists because an error string is provider
 * output rather than ours: if a future provider ever echoes a key or a signed
 * URL back in a rejection, this is the one place that would catch it.
 */
export function redactError(error: string | null): string | null {
  if (!error) return error;
  return error
    .replace(/\b(re_[A-Za-z0-9_-]{8,})\b/g, "[redacted]")
    .replace(/\b(sk|pk|key|token|secret|signature)[-_]?[A-Za-z0-9_-]{12,}\b/gi, "[redacted]")
    .replace(/\bBearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]");
}
