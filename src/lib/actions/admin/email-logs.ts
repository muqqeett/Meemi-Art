"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { recordActivity } from "@/lib/admin/activity";
import { adminOrDenied, type AdminResult } from "@/lib/actions/admin/guard";
import { emailLogDeletionBlockedReason } from "@/lib/actions/admin/email-log-deletion-policy";

/**
 * Removing entries from the email history.
 *
 * This deletes rows from `EmailLog` and nothing else. It does not send, resend,
 * retry or cancel any mail, does not call the provider, and does not read or
 * change the Resend configuration. `EmailLog` is a standalone model — no other
 * table has a relation to it, in either direction — so a delete here cannot
 * cascade into orders, payments, users, products or access grants.
 *
 * Which rows qualify lives in `email-log-deletion-policy.ts`, shared with the
 * page, so the button and the server enforce one rule. The short version:
 * FAILED and SKIPPED rows are inert history, while a SENT row is the guard that
 * stops a customer receiving the same email twice.
 *
 * ── Why the bulk action takes explicit ids ─────────────────────────────────
 *
 * It would be shorter to write `deleteMany({ where: { status: "FAILED" } })`.
 * That is deliberately not what this does. Such a rule would be permanent: a
 * genuine production failure recorded a minute before the admin pressed the
 * button — or a minute after the page rendered — would be swept away with the
 * old test records, unseen.
 *
 * Instead the page hands over the exact ids it displayed, and only those are
 * considered. A failure that arrives between page load and confirmation is not
 * in that list and survives untouched. The status filter is still applied
 * server-side as a second gate, so an id belonging to a SENT row is ignored
 * even if one is submitted.
 */

/** One page's worth of history at a time; also a ceiling on a single request. */
const MAX_BULK = 500;

/**
 * Permanently delete one email-log record.
 *
 * The rule is enforced here, against the row as it exists at this moment. A
 * non-admin calling this directly gets the same refusal as one who never saw
 * the button.
 */
export async function deleteEmailLog(logId: string): Promise<AdminResult> {
  const { admin, denied } = await adminOrDenied();
  if (denied) return denied;

  if (typeof logId !== "string" || logId.length === 0) {
    return { ok: false, error: "No email record was specified." };
  }

  const log = await prisma.emailLog.findUnique({
    where: { id: logId },
    select: { id: true, to: true, template: true, status: true, createdAt: true },
  });

  if (!log) return { ok: false, error: "That email record no longer exists." };

  const blocked = emailLogDeletionBlockedReason(log);
  if (blocked) return { ok: false, error: blocked };

  try {
    // Written before the delete, while the row can still be read — afterwards
    // this entry is the only remaining trace that the attempt was ever made.
    // The recipient is recorded because an audit entry naming no one is not an
    // audit entry; the provider's error text is not, as it is reproduced in the
    // log row that is about to disappear and adds nothing here.
    await recordActivity({
      actorId: admin.id,
      action: "email.log_deleted",
      entityType: "email",
      entityId: log.id,
      meta: {
        to: log.to,
        template: log.template,
        status: log.status,
        attemptedAt: log.createdAt.toISOString(),
      },
    });

    await prisma.emailLog.delete({ where: { id: log.id } });

    revalidatePath("/admin/emails");
    // The Action Center counts failed emails from the same rows.
    revalidatePath("/admin");

    return { ok: true, message: "Email record deleted." };
  } catch (error) {
    console.error("[admin] deleteEmailLog", log.id, error);
    return { ok: false, error: "Unable to delete this record. Please try again." };
  }
}

/**
 * Permanently delete a set of email-log records the admin explicitly selected.
 *
 * `ids` is the list the page rendered and the admin confirmed — never a
 * server-side re-query of "everything that failed". See the note above.
 */
export async function deleteEmailLogs(ids: string[]): Promise<AdminResult> {
  const { admin, denied } = await adminOrDenied();
  if (denied) return denied;

  if (!Array.isArray(ids) || ids.length === 0) {
    return { ok: false, error: "No email records were specified." };
  }

  // Deduplicated so a repeated id cannot inflate the reported count.
  const requested = [...new Set(ids.filter((id) => typeof id === "string" && id.length > 0))];

  if (requested.length === 0) {
    return { ok: false, error: "No email records were specified." };
  }

  if (requested.length > MAX_BULK) {
    return {
      ok: false,
      error: `Too many records at once. Select ${MAX_BULK} or fewer.`,
    };
  }

  // Re-read rather than trusting the submitted list: this decides what is
  // actually deletable now, and yields the detail the audit entry needs.
  const logs = await prisma.emailLog.findMany({
    where: { id: { in: requested } },
    select: { id: true, template: true, status: true },
  });

  const deletable = logs.filter((log) => emailLogDeletionBlockedReason(log) === null);

  if (deletable.length === 0) {
    return {
      ok: false,
      error:
        logs.length === 0
          ? "Those email records no longer exist."
          : "None of those records can be deleted.",
    };
  }

  try {
    // A per-template tally rather than a list of ids — enough to recognise the
    // batch later without copying the whole set into the audit log.
    const byTemplate: Record<string, number> = {};
    for (const log of deletable) {
      byTemplate[log.template] = (byTemplate[log.template] ?? 0) + 1;
    }

    await recordActivity({
      actorId: admin.id,
      action: "email.logs_deleted",
      entityType: "email",
      entityId: null,
      meta: {
        deleted: deletable.length,
        requested: requested.length,
        statuses: [...new Set(deletable.map((log) => log.status))],
        byTemplate,
      },
    });

    /**
     * Bounded twice over: to the ids the admin confirmed, and to the statuses
     * the policy permits. Neither alone would be enough — the id list keeps
     * unseen failures out, and the status filter keeps an accepted email from
     * being removed by a submitted id.
     */
    const result = await prisma.emailLog.deleteMany({
      where: { id: { in: deletable.map((log) => log.id) }, status: { not: "SENT" } },
    });

    revalidatePath("/admin/emails");
    revalidatePath("/admin");

    return {
      ok: true,
      message:
        result.count === 1
          ? "1 email record deleted."
          : `${result.count} email records deleted.`,
    };
  } catch (error) {
    console.error("[admin] deleteEmailLogs", deletable.length, error);
    return { ok: false, error: "Unable to delete these records. Please try again." };
  }
}
