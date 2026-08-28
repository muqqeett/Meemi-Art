import { AlertTriangle } from "lucide-react";

/**
 * Names what these policies cannot state without the business owner.
 *
 * The policy pages are written strictly from what this application does. Some
 * clauses a real shop needs — the legal entity, where it is established, which
 * law governs a dispute — are facts about the business, not about the code, and
 * nothing in this project records them. Inventing a registered office or a
 * governing law would be worse than leaving a gap: it would be a false
 * statement in a document customers rely on and a payment provider reads.
 *
 * So the gaps are stated openly, in one place, imported by each policy page.
 * Delete this component once the owner has supplied the details and a lawyer
 * has reviewed the wording.
 */

/** Shown on each policy page. Bump when the policy text itself changes. */
export const LAST_UPDATED = "28 August 2026";

export function LegalReviewNotice() {
  return (
    <aside
      role="note"
      className="rounded-sm border border-warning/40 bg-warning/10 p-4 text-sm"
    >
      <p className="flex items-center gap-2 font-semibold text-foreground">
        <AlertTriangle className="size-4 shrink-0" aria-hidden />
        Awaiting legal review
      </p>
      <p className="text-body mt-2">
        This policy describes how the shop actually works and is accurate on that. It is
        not a substitute for legal advice, and it is deliberately incomplete: the
        following depend on facts about the business that are not recorded in this
        project, and have been left out rather than invented.
      </p>
      <ul className="text-body mt-2 list-disc space-y-1 pl-5">
        <li>the registered legal or trading entity, and its address</li>
        <li>the country of establishment, governing law and jurisdiction</li>
        <li>any tax or company registration number</li>
        <li>statutory consumer rights that apply in the customer&rsquo;s country</li>
        <li>whether purchased files may be used commercially</li>
      </ul>
      <p className="text-body mt-2">
        Supply these and have the wording reviewed before trading publicly.
      </p>
    </aside>
  );
}
