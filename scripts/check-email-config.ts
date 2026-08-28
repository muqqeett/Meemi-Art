/**
 * Renders every transactional template and asserts the identity, the links and
 * the absence of secrets in the output.
 *
 * Renders, rather than greps: what matters is what lands in the inbox, and a
 * template can reference the right variable and still emit the wrong string.
 */
import "dotenv/config";

const EXPECTED_FROM = "Meemi Art <hello@meemiart.com>";
const EXPECTED_REPLY = "hello@meemiart.com";
const EXPECTED_ORIGIN = "https://meemiart.com";

let failures = 0;
function check(label: string, pass: boolean, detail?: unknown) {
  if (!pass) failures++;
  console.log(
    `  ${pass ? "PASS" : "FAIL"}  ${label}${detail === undefined ? "" : `  -> ${String(detail)}`}`,
  );
}

async function main() {
  const { emailConfig } = await import("../src/lib/email/config");
  const auth = await import("../src/lib/email/templates/auth");
  const orders = await import("../src/lib/email/templates/orders");
  const test = await import("../src/lib/email/templates/test");

  console.log("\n=== identity ===");
  check("EMAIL_FROM", emailConfig.from === EXPECTED_FROM, emailConfig.from);
  check("EMAIL_REPLY_TO", emailConfig.replyTo === EXPECTED_REPLY, emailConfig.replyTo);
  check("brand derived from sender", emailConfig.brand === "Meemi Art", emailConfig.brand);
  check("link base", emailConfig.appUrl === EXPECTED_ORIGIN, emailConfig.appUrl);
  check(
    "admin notifications fall back to the single mailbox",
    emailConfig.adminEmail === EXPECTED_REPLY,
    emailConfig.adminEmail,
  );

  const TOKEN = "SECRETTOKEN0123456789abcdefSECRET";
  const order = {
    orderNumber: "MA-2026-000123",
    email: "customer@example.com",
    customerName: "Alex Rivera",
    placedAt: new Date(),
    lines: [
      { name: "Study in Ochre", quantity: 1, totalCents: 4500, imageUrl: null },
    ],
    subtotalCents: 4500,
    discountCents: 0,
    couponCode: null,
    totalCents: 4500,
    currency: "USD",
  };

  const messages = [
    ["verify-email", auth.verifyEmailTemplate({ to: "a@b.com", name: "Alex", token: TOKEN, expiresMinutes: 60 })],
    ["welcome", auth.welcomeTemplate({ to: "a@b.com", name: "Alex" })],
    ["reset-password", auth.resetPasswordTemplate({ to: "a@b.com", name: "Alex", token: TOKEN, expiresMinutes: 30 })],
    ["password-changed", auth.passwordChangedTemplate({ to: "a@b.com", name: "Alex" })],
    ["purchase-ready", orders.purchaseReadyTemplate(order)],
    ["order-refunded", orders.orderRefundedTemplate(order)],
    ["admin-new-order", orders.adminNewOrderTemplate(order)],
    ["test", test.testEmailTemplate({ to: "a@b.com", sentBy: "admin@example.com" })],
  ] as const;

  console.log("\n=== rendered templates ===");
  for (const [name, message] of messages) {
    const body = `${message.subject}\n${message.html}\n${message.text}`;
    const bad: string[] = [];

    if (/sebha/i.test(body)) bad.push("mentions SebHa");
    if (/localhost/i.test(body)) bad.push("localhost link");
    if (/noreply@|no-reply@|support@|orders@/i.test(body)) bad.push("stale sender address");
    // Links must be absolute and on the configured origin.
    for (const url of body.match(/href="([^"]+)"/g) ?? []) {
      const href = url.slice(6, -1);
      if (href.startsWith("mailto:")) continue;
      if (!href.startsWith(EXPECTED_ORIGIN)) bad.push(`off-origin link ${href}`);
    }
    if (!/Meemi Art/.test(body)) bad.push("brand missing");

    check(name, bad.length === 0, bad.join("; ") || undefined);
  }

  console.log("\n=== token containment ===");
  // The token belongs in the link and nowhere else conspicuous; what matters
  // is that nothing but the template ever sees it. Assert it is present in the
  // two templates that carry one, and absent from all the others.
  const carriesToken = new Set(["verify-email", "reset-password"]);
  for (const [name, message] of messages) {
    const has = `${message.html}${message.text}`.includes(TOKEN);
    check(
      `${name}: token ${carriesToken.has(name) ? "present in link" : "absent"}`,
      has === carriesToken.has(name),
    );
  }

  console.log("\n=== secret containment ===");
  const secrets = Object.entries(process.env).filter(
    ([k, v]) => v && v.length >= 8 && /SECRET|DATABASE_URL|RESEND_API_KEY|AUTH_SECRET/i.test(k),
  );
  for (const [key, value] of secrets) {
    const leaked = messages.some(([, m]) => `${m.html}${m.text}${m.subject}`.includes(value!));
    check(`${key} absent from every template`, !leaked);
  }

  console.log(failures === 0 ? "\nAll checks passed.\n" : `\n${failures} CHECK(S) FAILED.\n`);
  if (failures > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
