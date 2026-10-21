/**
 * Checks that the post-sign-in redirect target can never leave this site.
 *
 * Pure function, no database and no network: `safeCallback` is run over
 * hostile and legitimate inputs, and each result is also resolved with the
 * WHATWG URL parser — the algorithm browsers use for a redirect `Location` —
 * to prove the outcome stays on the origin, not just that a string looks safe.
 */
import { safeCallback } from "../src/lib/security/safe-callback";

const ORIGIN = "https://shop.example";
const FALLBACK = "/account";

let failures = 0;
function check(label: string, pass: boolean, detail?: unknown) {
  if (!pass) failures++;
  console.log(
    `  ${pass ? "PASS" : "FAIL"}  ${label}${detail === undefined ? "" : `  → ${JSON.stringify(detail)}`}`,
  );
}

function main() {
  console.log("\n=== Hostile callbacks fall back to /account ===");
  const hostile: [string, string][] = [
    ["//evil.com", "protocol-relative"],
    ["///evil.com", "triple slash"],
    ["/\\evil.com", "slash + backslash"],
    ["/\\/evil.com", "slash + backslash + slash"],
    ["/\\\\evil.com", "slash + two backslashes"],
    ["\\\\evil.com", "leading backslashes"],
    ["\\/evil.com", "backslash + slash"],
    ["/\t/evil.com", "tab between slashes"],
    ["/\n/evil.com", "line feed between slashes"],
    ["/\r/evil.com", "carriage return between slashes"],
    ["/\u0000/evil.com", "NUL between slashes"],
    ["/\u007f/evil.com", "DEL between slashes"],
    ["https://evil.com", "absolute URL"],
    ["http://evil.com/account", "absolute http URL"],
    ["javascript:alert(1)", "javascript scheme"],
    ["data:text/html,x", "data scheme"],
    [" //evil.com", "leading space"],
    ["evil.com", "bare host"],
    ["", "empty string"],
  ];
  for (const [input, label] of hostile) {
    check(label, safeCallback(input) === FALLBACK, safeCallback(input));
  }
  check("null falls back", safeCallback(null) === FALLBACK);
  check("undefined falls back", safeCallback(undefined) === FALLBACK);

  console.log("\n=== Legitimate internal callbacks are preserved exactly ===");
  const legitimate = [
    "/account",
    "/checkout",
    "/admin",
    "/shop/templates",
    "/shop/templates?sort=newest&page=2",
    "/orders/MA-1001#downloads",
    "/account?tab=orders",
    "/learn/some-guide",
    "/search?q=a%20b",
    "/%2f%2fevil.com", // percent-encoded: stays a path on this origin
    "/%5Cevil.com",
  ];
  for (const input of legitimate) {
    check(input, safeCallback(input) === input, safeCallback(input));
  }

  console.log("\n=== Every result resolves to this origin (browser URL parser) ===");
  const everything = [...hostile.map(([input]) => input), ...legitimate];
  const escaped = everything.filter((input) => {
    const out = safeCallback(input);
    try {
      return new URL(out, ORIGIN).origin !== ORIGIN;
    } catch {
      return true;
    }
  });
  check(`${everything.length} inputs, none leave the origin`, escaped.length === 0, escaped);

  // Demonstrates why the old check (leading "/" and no leading "//") was not
  // enough, so this test fails loudly if anyone loosens the guard to that again.
  console.log("\n=== The previous check, for contrast ===");
  const previous = (value: string) =>
    value.startsWith("/") && !value.startsWith("//") ? value : FALLBACK;
  const slipped = ["/\\evil.com", "/\t/evil.com", "/\n/evil.com"].filter(
    (input) => new URL(previous(input), ORIGIN).origin !== ORIGIN,
  );
  check("previous check let these escape (documented)", slipped.length === 3, slipped);

  console.log(failures === 0 ? "\nAll checks passed.\n" : `\n${failures} check(s) FAILED.\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
