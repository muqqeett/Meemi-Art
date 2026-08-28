/**
 * Scans the built client bundle for any secret VALUE present in .env.
 *
 * Searches for values, never names: a variable name in help text is harmless,
 * a value is a leak. Anything not prefixed NEXT_PUBLIC_ must be absent from
 * `.next/static`.
 *
 * Also asserts that the Resend transport itself never reaches the browser,
 * which is the check that still means something while RESEND_API_KEY is unset.
 */
import "dotenv/config";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const STATIC_DIR = join(process.cwd(), ".next", "static");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const secrets = Object.entries(process.env)
  .filter(([key, value]) => {
    if (!value || value.length < 8) return false;
    if (key.startsWith("NEXT_PUBLIC_")) return false;
    return /SECRET|KEY|TOKEN|PASSWORD|DATABASE_URL/i.test(key);
  })
  .map(([key, value]) => ({ key, value: value! }));

const files = walk(STATIC_DIR);
const contents = new Map(files.map((f) => [f, readFileSync(f, "utf8")]));

console.log(`Scanning ${files.length} client files for ${secrets.length} secret values.\n`);

let leaks = 0;

for (const { key, value } of secrets) {
  const hits = files.filter((f) => contents.get(f)!.includes(value));
  if (hits.length > 0) {
    leaks++;
    console.log(`  LEAK  ${key} value appears in:`);
    for (const hit of hits) console.log(`          ${hit}`);
  } else {
    console.log(`  CLEAN ${key}`);
  }
}

// Server-only modules that must never be bundled for the browser, identified by
// a string each one uniquely contains.
// Markers are literals unique to each server-only module rather than domain
// names: Paddle.js legitimately ships `paddle.com` URLs to the browser, so a
// domain match would be a false positive on the one file that is meant to be
// there. These strings only exist in modules that read a secret.
const serverOnly: [string, string][] = [
  ["Resend transport", "resend.com/emails"],
  ["Cloudinary transport", "api.cloudinary.com"],
  ["Paddle server API client", "PADDLE_API_KEY is not set."],
  ["Paddle catalogue sync", "MeemiArt sells one-time products only."],
  ["Paddle webhook verification", "Malformed Paddle-Signature header."],
];

for (const [label, marker] of serverOnly) {
  const hits = files.filter((f) => /\.js$/.test(f) && contents.get(f)!.includes(marker));
  if (hits.length > 0) {
    leaks++;
    console.log(`  LEAK  ${label} reached the client: ${hits.join(", ")}`);
  } else {
    console.log(`  CLEAN ${label} absent from every client chunk`);
  }
}

console.log(leaks === 0 ? "\nNo secrets in the client bundle.\n" : `\n${leaks} LEAK(S).\n`);
if (leaks > 0) process.exitCode = 1;
