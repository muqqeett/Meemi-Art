/**
 * Shared metadata for the policy pages (`/terms`, `/privacy`, `/refunds`).
 *
 * ── Note for whoever maintains these pages ──────────────────────────────────
 *
 * The policy text is written strictly from what this application actually
 * does, and is accurate on that. Some clauses a trading shop needs are facts
 * about the *business* rather than the code, and nothing in this project
 * records them, so they are absent rather than invented:
 *
 *   - the registered legal or trading entity, and its address
 *   - the country of establishment, governing law and jurisdiction
 *   - any tax or company registration number
 *   - the statutory consumer rights that apply in the customer's country
 *   - whether purchased files may be used commercially
 *
 * These gaps were previously announced to customers by an "Awaiting legal
 * review" banner on each policy page. That banner was an internal development
 * note on a public, customer-facing document — it told shoppers the terms they
 * were being asked to rely on were unfinished — so it has been removed from the
 * UI and the information kept here instead, where it is addressed to the person
 * who can act on it.
 *
 * Removing the banner does not close the gaps. Supply the details above and
 * have the wording reviewed before trading publicly.
 */

/** Shown on each policy page. Bump when the policy text itself changes. */
export const LAST_UPDATED = "28 August 2026";
