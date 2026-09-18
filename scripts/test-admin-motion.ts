/**
 * Admin motion harness.
 *
 * The admin motion additions are CSS plus one template wrapper, so the rules
 * that make them safe are checkable in source, with no browser and no session:
 *
 *   - every selector is scoped to the admin, so nothing reaches the storefront
 *   - keyframes animate only `opacity` and `transform`
 *   - every entrance uses `backwards` fill — it styles the element only before
 *     and while it runs, so a finished (or paused-at-rest) screen is exactly
 *     the screen without motion, with no lingering transform
 *   - transitions touch no layout property
 *   - entrances are short, and reduced motion removes each one outright
 *   - the template adds one unstyled block wrapper and nothing else
 *
 * Run: npm run test:admin-motion
 */
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail = "") {
  if (condition) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const ROOT = path.resolve(__dirname, "..");
const read = (file: string) => readFileSync(path.join(ROOT, file), "utf8");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name !== "generated") walk(full, out);
    } else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

/** Split a CSS list on commas that are not inside parentheses (e.g. `cubic-bezier(…)`). */
function splitTopLevel(value: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of value) {
    if (char === "(") depth++;
    if (char === ")") depth--;
    if (char === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else current += char;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

/** Remove comments, so prose never satisfies or breaks a check. */
const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");

/** Top-level rules of a CSS fragment as { prelude, body }, descending into @media. */
function rules(css: string): { prelude: string; body: string; inMedia: string | null }[] {
  const out: { prelude: string; body: string; inMedia: string | null }[] = [];
  const walkBlock = (text: string, media: string | null) => {
    let i = 0;
    while (i < text.length) {
      const open = text.indexOf("{", i);
      if (open === -1) break;
      const prelude = text.slice(i, open).trim();
      let depth = 1;
      let j = open + 1;
      while (j < text.length && depth > 0) {
        if (text[j] === "{") depth++;
        else if (text[j] === "}") depth--;
        j++;
      }
      const body = text.slice(open + 1, j - 1);
      if (prelude.startsWith("@media")) walkBlock(body, prelude);
      else out.push({ prelude, body, inMedia: media });
      i = j;
    }
  };
  walkBlock(css, null);
  return out;
}

function main() {
  const globals = read("src/app/globals.css");
  const start = globals.indexOf("/* ---- Motion, continued");
  const end = globals.indexOf("/* Page gutter used by every section");
  check("the admin motion section exists, before the storefront utilities", start !== -1 && end > start);
  const section = stripComments(globals.slice(start, end));
  const all = rules(section);
  const keyframes = all.filter((rule) => rule.prelude.startsWith("@keyframes"));
  const styles = all.filter((rule) => !rule.prelude.startsWith("@keyframes"));

  console.log("\nScope");
  const SCOPES = [/^\.admin-root\b/, /^\.admin-page\b/, /^\.admin-kpi-row\b/, /^\.admin-card-interactive\b/, /^body:has\(\.admin-root\)/];
  const selectors = styles.flatMap((rule) => rule.prelude.split(",").map((s) => s.trim()).filter(Boolean));
  const unscoped = selectors.filter((selector) => !SCOPES.some((scope) => scope.test(selector)));
  check("every selector is scoped to the admin", unscoped.length === 0, unscoped.join(" | "));
  check("the section adds rules", selectors.length >= 10, String(selectors.length));

  const adminRootUsers = walk(path.join(ROOT, "src")).filter((file) => /["'\s]admin-root["'\s]/.test(readFileSync(file, "utf8")));
  check(
    "`.admin-root` is set only by the admin layout, so `body:has(.admin-root)` means “on an admin page”",
    adminRootUsers.length === 1 && adminRootUsers[0].endsWith(path.join("app", "admin", "layout.tsx")),
    adminRootUsers.map((f) => path.relative(ROOT, f)).join(),
  );
  const pageHookUsers = walk(path.join(ROOT, "src")).filter((file) => /["'\s]admin-page["'\s]/.test(readFileSync(file, "utf8")));
  check(
    "the `.admin-page` hook exists only in the admin template",
    pageHookUsers.length === 1 && pageHookUsers[0].endsWith(path.join("app", "admin", "template.tsx")),
    pageHookUsers.map((f) => path.relative(ROOT, f)).join(),
  );
  // The homepage source is unchanged from the last commit — the motion work
  // does not touch it at all.
  const homepageDiff = execFileSync("git", ["diff", "--name-only", "HEAD", "--", "src/app/(storefront)/page.tsx", "src/app/(storefront)/layout.tsx"], {
    cwd: ROOT,
    encoding: "utf8",
  }).trim();
  check("the homepage and storefront layout are unchanged", homepageDiff === "", homepageDiff);

  console.log("\nCompositor-only, no residue");
  const keyframeProps = keyframes.flatMap((rule) =>
    [...rule.body.matchAll(/([a-z-]+)\s*:/g)].map((match) => match[1]),
  );
  check(
    "new keyframes animate only opacity and transform",
    keyframes.length >= 2 && keyframeProps.every((prop) => prop === "opacity" || prop === "transform"),
    keyframeProps.join(),
  );
  check("new keyframes define only a start state, so they end at the element's own style", keyframes.every((rule) => !/\bto\b|100%/.test(rule.body)));

  const animations = styles.flatMap((rule) => [...rule.body.matchAll(/animation\s*:\s*([^;]+);/g)].map((m) => m[1].replace(/\s+/g, " ").trim()));
  const entrances = animations.flatMap(splitTopLevel).filter((part) => part !== "none" && !/infinite/.test(part));
  check(
    "every entrance uses `backwards` fill — nothing persists after it ends",
    entrances.length >= 5 && entrances.every((part) => /\bbackwards\b/.test(part) && !/\b(forwards|both)\b/.test(part)),
    entrances.join(" | "),
  );
  const durations = entrances.map((part) => Number((part.match(/(\d+)ms/) ?? [])[1]));
  check("entrances are short (page, rows and alerts ≤ 240ms; KPI rise matches the existing 420ms)", durations.every((ms) => ms > 0 && (ms <= 240 || ms === 420)), durations.join());
  const delays = styles.flatMap((rule) => [...rule.body.matchAll(/animation-delay\s*:\s*(\d+)ms/g)].map((m) => Number(m[1])));
  check("staggers are tight (≤ 120ms)", delays.length > 0 && delays.every((ms) => ms <= 120), delays.join());

  const transitions = styles.flatMap((rule) => [...rule.body.matchAll(/transition\s*:\s*([^;]+);/g)].map((m) => m[1]));
  const transitioned = transitions.flatMap((value) => splitTopLevel(value).map((part) => part.split(/\s+/)[0]));
  const LAYOUT = ["width", "height", "top", "left", "right", "bottom", "margin", "padding", "all"];
  check("transitions touch no layout property", transitioned.every((prop) => !LAYOUT.some((layout) => prop.startsWith(layout))), transitioned.join());

  const staticDecls = styles
    .filter((rule) => !rule.inMedia)
    .flatMap((rule) => [...rule.body.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]));
  const ALLOWED = ["animation", "animation-delay", "transition", "--tw-enter-translate-y", "--tw-exit-translate-y"];
  check(
    "no rule sets a resting visual property (colour, size, spacing, shadow, border, transform)",
    staticDecls.every((prop) => ALLOWED.includes(prop)),
    staticDecls.filter((prop) => !ALLOWED.includes(prop)).join(),
  );

  console.log("\nReduced motion");
  const reduced = styles.filter((rule) => rule.inMedia?.includes("prefers-reduced-motion: reduce"));
  const reducedSelectors = reduced.flatMap((rule) => rule.prelude.split(",").map((s) => s.trim()));
  const animatedSelectors = styles
    .filter((rule) => !rule.inMedia && /animation\s*:/.test(rule.body))
    .flatMap((rule) => rule.prelude.split(",").map((s) => s.trim()));
  check(
    "every newly animated element is handled under reduced motion",
    animatedSelectors.every((selector) => reducedSelectors.includes(selector)),
    animatedSelectors.filter((s) => !reducedSelectors.includes(s)).join(" | "),
  );
  check(
    "reduced motion removes the entrances outright, not just their duration",
    reduced.some((rule) => /animation\s*:\s*none/.test(rule.body) && rule.prelude.includes(".admin-page") && rule.prelude.includes("tbody > tr")),
  );
  check("reduced motion drops the dialog lift", reduced.some((rule) => /--tw-enter-translate-y\s*:\s*0/.test(rule.body)));
  check("reduced motion keeps the skeleton without its fade delay", reduced.some((rule) => rule.prelude.includes(".admin-shimmer") && !/backwards/.test(rule.body)));

  console.log("\nTemplate");
  const template = read("src/app/admin/template.tsx");
  const jsx = template.match(/return\s*\(?\s*(<[\s\S]*?>[\s\S]*<\/div>)/)?.[1] ?? "";
  check("the template renders one plain div around the page", jsx.replace(/\s+/g, " ").trim() === '<div className="admin-page">{children}</div>', jsx);
  check("the template is a server component with no state or effects", !/use client|useState|useEffect|framer-motion/.test(template));
  check("the admin layout is untouched by motion (no new wrapper or class there)", !/admin-page|admin-settle/.test(read("src/app/admin/layout.tsx")));

  console.log("\nExisting motion preserved");
  for (const existing of [".admin-rise {", "@keyframes admin-rise", ".admin-reveal-figure {", ".admin-shimmer {", "@keyframes admin-shimmer", ".admin-row-actions {", "transform: scale(0.985);"]) {
    check(`existing rule kept: ${existing}`, globals.includes(existing));
  }
}

try {
  main();
} catch (error) {
  console.error("\nHarness crashed:", error);
  process.exitCode = 1;
} finally {
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}
