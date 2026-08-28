/**
 * Repairs UTF-8 text that was written through a cp1252 round trip.
 *
 * Somewhere in this project's history a few files were read as cp1252 and
 * re-saved as UTF-8, so every multi-byte character became mojibake: an em dash
 * turned into the three characters U+00E2 U+20AC U+201D, curly quotes into
 * similar triples. The damage is reversible — map each character back to the
 * cp1252 byte it came from, then decode those bytes as UTF-8 again.
 *
 * Only runs beginning U+00E2 U+20AC are touched, so undamaged text cannot be
 * altered. A leading byte-order mark is stripped at the same time.
 *
 * The pattern is written with escapes rather than as literal characters, so
 * this file is never a target for its own repair pass.
 *
 *   npx tsx scripts/fix-encoding.ts          # report only
 *   npx tsx scripts/fix-encoding.ts --write  # apply
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/** The damaged prefix plus the one character carrying the original third byte. */
const MOJIBAKE_RUN = /â€[\s\S]/g;

/** Unicode code point → cp1252 byte, for the 0x80–0x9F range that differs. */
const CP1252_HIGH: Record<number, number> = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85,
  0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a,
  0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92,
  0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
  0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c,
  0x017e: 0x9e, 0x0178: 0x9f,
};

function toCp1252Byte(codePoint: number): number | null {
  if (codePoint <= 0xff) return codePoint;
  return CP1252_HIGH[codePoint] ?? null;
}

/** Turns one mojibake run back into the character it should have been. */
function repairRun(run: string): string {
  const bytes: number[] = [];
  for (const char of run) {
    const byte = toCp1252Byte(char.codePointAt(0)!);
    if (byte === null) return run; // Not recoverable — leave it alone.
    bytes.push(byte);
  }
  const decoded = Buffer.from(bytes).toString("utf8");
  // A failed decode yields U+FFFD; better to keep the mojibake than to corrupt.
  return decoded.includes("�") ? run : decoded;
}

function repair(source: string): string {
  const withoutBom = source.charCodeAt(0) === 0xfeff ? source.slice(1) : source;
  return withoutBom.replace(MOJIBAKE_RUN, repairRun);
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      // Generated Prisma output is not ours to rewrite.
      if (entry !== "generated") out.push(...walk(full));
    } else if (/\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

const write = process.argv.includes("--write");
const files = [...walk("src"), ...walk("prisma"), ...walk("scripts")];

let changed = 0;
for (const file of files) {
  const before = readFileSync(file, "utf8");
  const after = repair(before);
  if (before === after) continue;

  changed++;
  const fixes = [...before.matchAll(MOJIBAKE_RUN)].length;
  console.log(`${write ? "fixed" : "would fix"}  ${file}  (${fixes} character(s))`);
  if (write) writeFileSync(file, after, "utf8");
}

console.log(
  changed === 0
    ? "\nNothing to repair."
    : `\n${changed} file(s)${write ? " repaired" : " need repair — re-run with --write"}.`,
);
