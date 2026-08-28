/**
 * Adds missing event subscriptions to an EXISTING Paddle notification
 * destination. Never creates, deletes, deactivates or replaces one, and never
 * touches the signing secret.
 *
 * The dangerous detail this script exists to get right: Paddle's PATCH on
 * `subscribed_events` **replaces** the list rather than appending to it. Send
 * only the new events and the existing ones are silently dropped — which for
 * this application would mean live payments stop granting downloads. So the
 * script reads the destination first, computes the union, and refuses to write
 * unless every currently-subscribed event is still present in what it is about
 * to send.
 *
 * The destination id and URL are both verified before any write. A mismatch
 * aborts rather than guessing.
 *
 *   npm run paddle:webhook-events            plan only, writes nothing
 *   npm run paddle:webhook-events -- --apply performs the PATCH
 */
import "dotenv/config";

const DESTINATION_ID = "ntfset_01m1404pnqggj1t3fv0t2tdyd7";
const EXPECTED_URL = "https://meemiart.com/api/payments/webhook";

/** The events this application actually handles. */
const REQUIRED = [
  "transaction.paid",
  "transaction.completed",
  "transaction.payment_failed",
  "transaction.canceled",
  "adjustment.created",
  "adjustment.updated",
] as const;

type Destination = {
  id?: string;
  description?: string;
  destination?: string;
  active?: boolean;
  type?: string;
  subscribed_events?: { name?: string }[];
};

function eventNames(d: Destination): string[] {
  return (d.subscribed_events ?? []).map((e) => e.name).filter((n): n is string => Boolean(n));
}

async function main() {
  const apply = process.argv.includes("--apply");
  const { paddleApi } = await import("../src/lib/payments/paddle-api");
  const { paymentConfig } = await import("../src/lib/payments/config");

  console.log(`\nendpoint: ${paymentConfig.paddle.apiBase}`);
  console.log(`target  : ${DESTINATION_ID}\n`);

  // ---- verify before touching anything ------------------------------------
  const before = await paddleApi.get<Destination>(`/notification-settings/${DESTINATION_ID}`);

  if (before.id !== DESTINATION_ID) {
    throw new Error(`Destination id mismatch: got ${before.id ?? "none"}. Aborting.`);
  }
  if (before.destination !== EXPECTED_URL) {
    throw new Error(
      `Destination URL is "${before.destination}", expected "${EXPECTED_URL}". Aborting rather than writing to the wrong endpoint.`,
    );
  }

  const existing = eventNames(before);
  console.log(`verified id  : ${before.id}`);
  console.log(`verified url : ${before.destination}`);
  console.log(`active       : ${before.active}`);
  console.log(`label        : ${before.description ?? "—"}`);
  console.log(`\ncurrently subscribed (${existing.length}):`);
  for (const e of existing.slice().sort()) console.log(`  · ${e}`);

  const missing = REQUIRED.filter((e) => !existing.includes(e));
  if (missing.length === 0) {
    console.log("\nNothing to add — every required event is already subscribed.\n");
    return;
  }

  // Union, existing first. This is what makes the write non-destructive.
  const union = [...existing, ...missing];

  console.log(`\nto add (${missing.length}):`);
  for (const e of missing) console.log(`  + ${e}`);

  // Refuse to write if the payload would lose anything. Belt and braces around
  // the replace-not-append semantics.
  const dropped = existing.filter((e) => !union.includes(e));
  if (dropped.length > 0) {
    throw new Error(`Refusing to write — would drop: ${dropped.join(", ")}`);
  }

  console.log(`\nresulting list (${union.length}):`);
  for (const e of union.slice().sort()) console.log(`  · ${e}`);

  if (!apply) {
    console.log("\nPlan only. Nothing was sent. Re-run with --apply to write.\n");
    return;
  }

  // ---- the single write ---------------------------------------------------
  // Only `subscribed_events` is sent. No `destination`, no `type`, no `active`,
  // and nothing that would cause Paddle to reissue the signing secret.
  console.log("\napplying…");
  await paddleApi.patch<Destination>(`/notification-settings/${DESTINATION_ID}`, {
    subscribed_events: union,
  });

  // ---- read back and verify ----------------------------------------------
  const after = await paddleApi.get<Destination>(`/notification-settings/${DESTINATION_ID}`);
  const now = eventNames(after);

  console.log(`\nread back (${now.length}):`);
  for (const e of now.slice().sort()) console.log(`  · ${e}`);

  const stillMissing = REQUIRED.filter((e) => !now.includes(e));
  const lost = existing.filter((e) => !now.includes(e));

  console.log("\nverification:");
  console.log(`  id unchanged      : ${after.id === DESTINATION_ID ? "yes" : "NO"}`);
  console.log(`  url unchanged     : ${after.destination === EXPECTED_URL ? "yes" : "NO"}`);
  console.log(`  still active      : ${after.active ? "yes" : "NO"}`);
  console.log(`  required present  : ${stillMissing.length === 0 ? "all" : `MISSING ${stillMissing.join(", ")}`}`);
  console.log(`  previous retained : ${lost.length === 0 ? "all" : `LOST ${lost.join(", ")}`}`);

  const ok =
    after.id === DESTINATION_ID &&
    after.destination === EXPECTED_URL &&
    Boolean(after.active) &&
    stillMissing.length === 0 &&
    lost.length === 0;

  console.log(ok ? "\nWebhook events updated successfully.\n" : "\nVERIFICATION FAILED.\n");
  process.exit(ok ? 0 : 1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
