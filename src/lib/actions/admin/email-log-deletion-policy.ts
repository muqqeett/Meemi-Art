/**
 * Which email-log records may be deleted, and why the line falls where it does.
 *
 * A plain module, not `"use server"` — the pages need this rule to decide what
 * to render, and the action needs it to decide what to allow. Keeping it in one
 * place is what stops the button and the server disagreeing.
 *
 * ── Why SENT records are protected ─────────────────────────────────────────
 *
 * This is not a retention policy invented for tidiness. It is the one place
 * where deleting a log row stops being inert and starts changing what the email
 * system does.
 *
 * `sendEmail` in `lib/email/email-service.ts` treats `EmailLog` as its
 * idempotency ledger:
 *
 *     const existing = await prisma.emailLog.findUnique({ where: { dedupeKey } });
 *     if (existing && existing.status === "SENT") return { status: "DUPLICATE" };
 *     if (existing) await prisma.emailLog.delete({ where: { id: existing.id } });
 *
 * So for a row carrying a `dedupeKey`:
 *
 *   SENT     the row *is* the guard. It is the only thing standing between a
 *            re-run of that code path and a second copy of the same email
 *            landing in a customer's inbox. Deleting it re-arms a real send.
 *   FAILED   the send path already deletes and retries these itself, so
 *            removing one by hand changes nothing about future behaviour.
 *   SKIPPED  same — never offered to the provider, never a guard.
 *
 * Deleting a FAILED or SKIPPED row is therefore purely a history operation.
 * Deleting a SENT row would be a functional change to email delivery, which is
 * precisely what this feature is required not to touch. Hence the rule.
 *
 * A SENT record can still be removed the way it was created — by the system —
 * but not from this screen.
 */

/** The statuses a stored attempt can hold. `DUPLICATE` is never persisted. */
type EmailLogShape = { status: string };

/**
 * The single reason a record cannot be deleted, or `null` when it can.
 *
 * Returns prose rather than a boolean because the caller shows it verbatim:
 * an admin who cannot delete something deserves to be told why, not left with
 * a greyed-out button.
 */
export function emailLogDeletionBlockedReason(log: EmailLogShape): string | null {
  if (log.status === "SENT") {
    return "Accepted emails are kept. This record is what stops the same email being sent to the customer twice.";
  }
  return null;
}

/** Convenience for rendering — the same rule, as a predicate. */
export function isEmailLogDeletable(log: EmailLogShape): boolean {
  return emailLogDeletionBlockedReason(log) === null;
}
