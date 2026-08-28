/**
 * Checks the webhook IP allowlist against Paddle's live list.
 *
 * Fetches the real endpoint, then asserts that each published address matches
 * its own CIDR and that neighbouring addresses do not — a /32 that accidentally
 * matched a /24 would silently allow a whole subnet.
 */
import "dotenv/config";

const ENDPOINT = "https://api.paddle.com/ips";

let failures = 0;
function check(label: string, pass: boolean, detail?: unknown) {
  if (!pass) failures++;
  console.log(
    `  ${pass ? "PASS" : "FAIL"}  ${label}${detail === undefined ? "" : `  → ${JSON.stringify(detail)}`}`,
  );
}

function toInt(address: string): number | null {
  const parts = address.trim().split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    value = value * 256 + octet;
  }
  return value;
}

function withinCidr(address: string, cidr: string): boolean {
  const [network, bitsRaw] = cidr.split("/");
  const bits = Number(bitsRaw ?? 32);
  if (!Number.isInteger(bits) || bits < 0 || bits > 32) return false;
  const target = toInt(address);
  const base = toInt(network);
  if (target === null || base === null) return false;
  if (bits === 0) return true;
  const mask = (0xffffffff << (32 - bits)) >>> 0;
  return ((target ^ base) & mask) >>> 0 === 0;
}

async function main() {
  console.log("\n=== Paddle live IP list ===");

  const response = await fetch(ENDPOINT);
  const payload = (await response.json()) as { data?: { ipv4_cidrs?: string[] } };
  const cidrs = payload.data?.ipv4_cidrs ?? [];

  check("endpoint responds", response.ok, response.status);
  check("returns at least one CIDR", cidrs.length > 0, cidrs.length);
  console.log(`  ${cidrs.join(", ")}`);

  console.log("\n=== matching ===");

  for (const cidr of cidrs) {
    const address = cidr.split("/")[0];
    check(`${address} matches its own entry`, withinCidr(address, cidr));
  }

  // A /32 must match exactly one address. Bump the last octet and it must miss.
  const first = cidrs[0];
  if (first) {
    const parts = first.split("/")[0].split(".");
    const neighbour = [...parts.slice(0, 3), String((Number(parts[3]) + 1) % 256)].join(".");
    check(
      `neighbouring ${neighbour} is NOT matched by ${first}`,
      !withinCidr(neighbour, first),
    );
  }

  check(
    "an unrelated address is rejected by every entry",
    !cidrs.some((cidr) => withinCidr("203.0.113.7", cidr)),
  );
  check("a malformed address is rejected", !withinCidr("not-an-ip", cidrs[0] ?? "0.0.0.0/32"));
  check(
    "an out-of-range octet is rejected",
    !withinCidr("999.0.0.1", cidrs[0] ?? "0.0.0.0/32"),
  );

  console.log(failures === 0 ? "\nAll allowlist checks passed.\n" : `\n${failures} FAILED.\n`);
  if (failures > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
