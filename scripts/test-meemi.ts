/**
 * Meemi guide harness.
 *
 * Proves the rules Meemi rests on, deterministically and with no database, no
 * network and no browser:
 *
 *   - facts come only from the product and its enabled difficulty assessment
 *   - a missing difficulty, time or technique list produces no message about it
 *   - the digital note appears only for a product with a file behind it
 *   - copy per level, list wording, and at most one emoji per message
 *   - session memory: greet once per product, "Not now" keeps Meemi quiet,
 *     nudges once, and garbage or blocked storage is harmless
 *   - product events: success-only, product-scoped, unsubscribable; the
 *     assistant-open request reaches a listener
 *   - integration wiring, checked in source: Meemi is mounted only on the
 *     product page, loads client-side only, and the wishlist and cart controls
 *     announce only after their existing success paths
 *
 * Rendered behaviour (homepage unchanged, keyboard, overlap, Concierge opening)
 * is verified separately against a running local server.
 *
 * Run: npm run test:meemi
 */
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

const EMOJI = /\p{Extended_Pictographic}/gu;

async function main() {
  const { meemiFactsFor } = await import("../src/lib/meemi/facts");
  const tips = await import("../src/lib/meemi/tips");
  const session = await import("../src/lib/meemi/session");
  const events = await import("../src/lib/product-events");
  type MeemiFacts = import("../src/lib/meemi/facts").MeemiFacts;

  const flat = (n: number) => ({ stitches: n, construction: n, shaping: n, colorwork: n, assembly: n, patternReading: n });
  const row = (ratings: ReturnType<typeof flat>, minutes: [number, number], techniques: string[], enabled = true) => ({
    ...ratings,
    minutesMin: minutes[0],
    minutesMax: minutes[1],
    techniques,
    enabled,
  });
  const asset = { filename: "p.pdf", contentType: "application/pdf", bytes: 1, version: "1" };

  // ---------------------------------------------------------------- facts
  console.log("\nFacts (server-derived)");
  const unrated = meemiFactsFor({ id: "p1", name: "Plain Scarf", difficulty: null, asset });
  check("no assessment: no difficulty, time or techniques", unrated.difficulty === null && unrated.estimatedTime === null && unrated.techniques.length === 0);
  const disabled = meemiFactsFor({ id: "p2", name: "Hidden", difficulty: row(flat(2), [60, 120], ["chain"], false), asset });
  check("disabled assessment counts as none", disabled.difficulty === null && disabled.estimatedTime === null && disabled.techniques.length === 0);
  const invalid = meemiFactsFor({ id: "p3", name: "Broken", difficulty: row(flat(99), [60, 120], ["chain"]), asset });
  check("invalid stored ratings count as none", invalid.difficulty === null);
  const bunny = meemiFactsFor({
    id: "p4",
    name: "Garden Bunny",
    difficulty: row({ ...flat(6), shaping: 8 }, [180, 300], ["magic-ring", "increase", "invisible-decrease", "stuffing", "safety-eyes"]),
    asset,
  });
  check("enabled assessment: level, score, time, techniques and challenges from the engine", bunny.difficulty?.level === "INTERMEDIATE" && bunny.estimatedTime === "About 3–5 hours" && bunny.techniques.join("|") === "Magic ring|Increase|Invisible decrease|Stuffing|Safety eyes" && (bunny.difficulty?.challenges.length ?? 0) > 0, JSON.stringify(bunny));
  check("digital only when a file is attached", bunny.isDigital && !meemiFactsFor({ id: "p5", name: "No file", difficulty: null, asset: null }).isDigital);
  check("facts are plain serialisable data", JSON.stringify(JSON.parse(JSON.stringify(bunny))) === JSON.stringify(bunny));

  // ---------------------------------------------------------------- tips
  console.log("\nTips (no fabrication)");
  const allText = (list: { text: string }[]) => list.map((t) => t.text).join(" ");

  const unratedGuide = tips.guideTips(unrated);
  check("missing difficulty: no level message", !/beginner|intermediate|advanced|expert|experience|challenging|step up/i.test(allText(unratedGuide)));
  check("missing time: no time message", !/hour|minute|expect/i.test(allText(unratedGuide)));
  check("missing techniques: no techniques message", !/using|technique/i.test(allText(unratedGuide)));
  check("unrated digital product: only the digital note", unratedGuide.length === 1 && unratedGuide[0].text === "This is a digital pattern — no shipping needed.");
  check("unrated: explain-difficulty, techniques and section nudges produce nothing", tips.explainDifficultyTip(unrated) === null && tips.techniquesTip(unrated) === null && tips.sectionTip("difficulty", unrated) === null && tips.sectionTip("techniques", unrated) === null);

  const noFile = { ...unrated, isDigital: false };
  check("not digital: no digital note, and no guide at all without facts", tips.guideTips(noFile).length === 0);

  const timeless: MeemiFacts = { ...bunny, estimatedTime: null };
  check("missing time alone removes only the time message", !/expect|hour/i.test(allText(tips.guideTips(timeless))) && tips.guideTips(timeless).length === 3);
  const noTechniques: MeemiFacts = { ...bunny, techniques: [] };
  check("empty technique list removes only the techniques message", !/using/i.test(allText(tips.guideTips(noTechniques))) && tips.techniquesTip(noTechniques) === null && tips.guideTips(noTechniques).length === 3);

  const guide = tips.guideTips(bunny);
  check("full guide: level, time, techniques, digital — in that order", guide.map((t) => t.emoji).join("") === "🧶⏱🧵📄", guide.map((t) => t.emoji).join(""));
  check("time is quoted from the engine", guide[1].text === "You can expect about 3–5 hours for this project.");
  check("techniques read naturally and cap at four", guide[2].text === "You'll be using magic ring, increase, invisible decrease, stuffing and 1 more.", guide[2].text);
  check("guide actions: Next until the last, which offers Done", guide.slice(0, -1).every((t) => t.actions.join() === "next,ask") && guide[guide.length - 1].actions.join() === "ask,done");

  const levelCopy = (level: string) => tips.guideTips({ ...bunny, difficulty: { ...bunny.difficulty!, level: level as never } })[0].text;
  check("beginner copy", levelCopy("BEGINNER") === "This one is beginner-friendly!");
  check("intermediate copy", levelCopy("INTERMEDIATE") === "This one needs a little more crochet experience.");
  check("advanced copy", levelCopy("ADVANCED") === "This is a more challenging pattern. Ready for it?");
  check("easy and expert have their own copy", /step up/.test(levelCopy("EASY")) && /experienced makers/.test(levelCopy("EXPERT")));

  const explain = tips.explainDifficultyTip(bunny)!;
  check("explain difficulty quotes the level, score and engine challenges", explain.text.startsWith(`It's rated Intermediate, ${bunny.difficulty!.score} out of 10.`) && bunny.difficulty!.challenges.every((c) => explain.text.toLowerCase().includes(c.toLowerCase())), explain.text);
  const calm = tips.explainDifficultyTip({ ...bunny, difficulty: { ...bunny.difficulty!, challenges: [] } })!;
  check("no challenges: says so, invents none", calm.text.endsWith("Nothing in it stands out as especially demanding."));
  check("3D label keeps its capitals", tips.techniquesTip({ ...bunny, techniques: ["3D elements", "Magic ring"] })!.text === "The main techniques: 3D elements and magic ring.");
  check("list joining", tips.joinList([]) === "" && tips.joinList(["a"]) === "a" && tips.joinList(["a", "b"]) === "a and b" && tips.joinList(["a", "b", "c"]) === "a, b and c");

  const every = [
    tips.greetingTip(),
    tips.menuTip(bunny),
    tips.menuTip(noFile),
    ...guide,
    explain,
    tips.techniquesTip(bunny)!,
    tips.sectionTip("difficulty", bunny)!,
    tips.sectionTip("techniques", bunny)!,
    tips.reactionTip("wishlist"),
    tips.reactionTip("cart"),
  ];
  check("no message carries more than its one leading emoji", every.every((t) => (t.text.match(EMOJI) ?? []).length === 0 && (t.emoji.match(EMOJI) ?? []).length <= 1));
  check("no message mentions a price, shipping of a physical item, or a percentage", every.every((t) => !/\$|%|ships in|delivery time/i.test(t.text)));
  check("greeting copy and actions", tips.greetingTip().text === "Hi! I'm Meemi. Want a quick guide to this pattern?" && tips.greetingTip().actions.join() === "show-guide,not-now");
  check("menu offers the guide only when there is one", tips.menuTip(noFile).actions.join() === "ask" && tips.menuTip(bunny).actions.join() === "show-guide,explain-difficulty,ask");
  check("reactions", tips.reactionTip("wishlist").text.includes("wishlist") && tips.reactionTip("cart").text === "Great choice! Your pattern is ready when you are.");
  check("every action has a label", every.every((t) => t.actions.every((a) => typeof tips.MEEMI_ACTION_LABELS[a] === "string")));

  // ---------------------------------------------------------------- session
  console.log("\nSession memory");
  let s = session.EMPTY_MEEMI_SESSION;
  check("greets a product the first time", session.shouldGreet(s, "p4"));
  s = session.markGreeted(s, "p4");
  check("never greets the same product twice in a session", !session.shouldGreet(s, "p4") && session.shouldGreet(s, "p1"));
  check("a nudge may appear once", session.mayInterrupt(s, "p4", "section-difficulty"));
  s = session.markSeen(s, "p4", "section-difficulty");
  check("…and not again for that product", !session.mayInterrupt(s, "p4", "section-difficulty") && session.mayInterrupt(s, "p1", "section-difficulty"));
  const quiet = session.setQuiet(s);
  check("'Not now' silences greetings, nudges and reactions everywhere", quiet.quiet && !session.shouldGreet(quiet, "p9") && !session.mayInterrupt(quiet, "p9", "cart"));
  check("round-trips through storage text", JSON.stringify(session.parseMeemiSession(JSON.stringify(quiet))) === JSON.stringify(quiet));
  check("garbage, wrong types and hostile values parse to the empty session", [null, "", "not json", "[]", '{"quiet":"yes","greeted":"p1","seen":[1,{}]}'].every((raw) => {
    const parsed = session.parseMeemiSession(raw);
    return parsed.quiet === false && parsed.greeted.length === 0 && parsed.seen.length === 0;
  }));
  let big = session.EMPTY_MEEMI_SESSION;
  for (let i = 0; i < 500; i++) big = session.markSeen(session.markGreeted(big, `p${i}`), `p${i}`, "cart");
  check("memory is capped", big.greeted.length === 30 && big.seen.length === 120);
  check("only ids, tip kinds and a flag are stored", Object.keys(quiet).sort().join() === "greeted,quiet,seen");
  const throwing = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("quota"); } };
  let threw = false;
  try {
    session.writeMeemiSession(throwing, quiet);
  } catch {
    threw = true;
  }
  check("blocked or full storage is harmless", !threw && session.readMeemiSession(throwing).quiet === false && session.readMeemiSession(null).quiet === false);

  // ---------------------------------------------------------------- events
  console.log("\nProduct events");
  let emittedWithoutWindow = true;
  try {
    events.emitProductEvent({ type: "cart-added", productId: "p4" });
    events.requestAssistantOpen();
  } catch {
    emittedWithoutWindow = false;
  }
  check("emitting on the server is a no-op", emittedWithoutWindow);

  (globalThis as unknown as { window: EventTarget }).window = new EventTarget();
  const received: string[] = [];
  const stop = events.onProductEvent((event) => received.push(`${event.type}:${event.productId}`));
  events.emitProductEvent({ type: "wishlist-added", productId: "p4" });
  events.emitProductEvent({ type: "cart-added", productId: "p1" });
  window.dispatchEvent(new CustomEvent("meemiart:product-event", { detail: { type: "cart-added" } }));
  stop();
  events.emitProductEvent({ type: "cart-added", productId: "p4" });
  check("listeners receive well-formed events and stop after unsubscribing", received.join() === "wishlist-added:p4,cart-added:p1", received.join());
  let opened = 0;
  const stopOpen = events.onAssistantOpenRequest(() => opened++);
  events.requestAssistantOpen();
  stopOpen();
  events.requestAssistantOpen();
  check("assistant-open request reaches the launcher's listener once", opened === 1);

  // ---------------------------------------------------------------- wiring
  console.log("\nIntegration wiring (source)");
  const src = walk(path.join(ROOT, "src"));
  const mounts = src.filter((file) => /<MeemiGuide(Loader)?\b/.test(readFileSync(file, "utf8")) && !file.includes(`${path.sep}meemi${path.sep}`));
  check("Meemi is mounted only on the product page", mounts.length === 1 && mounts[0].endsWith(path.join("products", "[slug]", "page.tsx")), mounts.map((f) => path.relative(ROOT, f)).join());
  check("the homepage does not reference Meemi", !/meemi-guide|MeemiGuide|meemi\/facts/.test(read("src/app/(storefront)/page.tsx")));
  const loader = read("src/components/product/meemi/meemi-guide-loader.tsx");
  check(
    "Meemi loads client-side only, after mount (no server HTML)",
    /useEffect\(/.test(loader) && loader.includes('import("@/components/product/meemi/meemi-guide")') && !/^import .*meemi-guide";/m.test(loader),
  );
  const clientModules = ["src/components/product/meemi/meemi-guide.tsx", "src/components/product/meemi/meemi-avatar.tsx", "src/lib/meemi/tips.ts", "src/lib/meemi/session.ts", "src/lib/meemi/facts.ts", "src/lib/product-events.ts"];
  check("Meemi's client modules read no environment and import nothing server-only", clientModules.every((file) => !/process\.env|server-only|@\/lib\/prisma|@\/lib\/ai\//.test(read(file))));
  check("Meemi adds no network calls of its own", clientModules.every((file) => !/fetch\(|XMLHttpRequest|\/api\//.test(read(file))));

  const wishlist = read("src/components/product/wishlist-button.tsx");
  check("wishlist announces only after a successful save", wishlist.indexOf("emitProductEvent({") > wishlist.indexOf("if (!result.ok)") && /if \(result\.data\.added\) emitProductEvent/.test(wishlist));
  const buy = read("src/components/product/pdp/pdp-buy-actions.tsx");
  check("add to cart announces only after the add succeeded", buy.indexOf("emitProductEvent({") > buy.indexOf("if (!result.ok)") && buy.indexOf("emitProductEvent({") > buy.indexOf("setCount(result.data.itemCount)"));
  const launcher = read("src/components/assistant/assistant-launcher.tsx");
  check("the launcher only gains a listener that opens its own panel", /onAssistantOpenRequest\(\(\) => setOpen\(true\)\)/.test(launcher));

  // ---------------------------------------------------------------- artwork
  console.log("\nMascot artwork");
  const POSES = ["wave", "guide", "happy", "thinking"] as const;
  const avatar = read("src/components/product/meemi/meemi-avatar.tsx");
  const artworkFiles = POSES.map((pose) => `public/brand/meemi/meemi-${pose}.svg`);
  const artwork = artworkFiles.map((file) => {
    try {
      return { file, svg: read(file) };
    } catch {
      return { file, svg: null };
    }
  });

  check("all four poses exist as artwork files", artwork.every((entry) => entry.svg !== null), artwork.filter((e) => !e.svg).map((e) => e.file).join());
  check(
    "each file is small enough for a 48–56px avatar",
    artwork.every((entry) => (entry.svg?.length ?? Infinity) < 8 * 1024),
    artwork.map((entry) => `${entry.file.split("/").pop()}:${Math.round((entry.svg?.length ?? 0) / 102.4) / 10}KB`).join(" "),
  );
  check("artwork carries no text", artwork.every((entry) => !/<text|<textPath|font-family/i.test(entry.svg ?? "")));
  check(
    "artwork has a transparent background (no full-canvas backdrop)",
    artwork.every((entry) => !/<rect[^>]*width="(64|100%)"[^>]*height="(64|100%)"/i.test(entry.svg ?? "")),
  );
  check("artwork shares one 64×64 canvas", artwork.every((entry) => (entry.svg ?? "").includes('viewBox="0 0 64 64"')));
  check(
    "every pose is the same character: same body, cap, cheeks and yarn",
    ["M32 9.5c7.8 0", "M18.3 22.2a13.8", 'cx="21.4" cy="33.4"', "M47.5 44.6c4 1.1"].every((mark) =>
      artwork.every((entry) => (entry.svg ?? "").includes(mark)),
    ),
  );
  check(
    "artwork uses the brand palette only",
    artwork.every((entry) => {
      const colors = new Set([...((entry.svg ?? "").match(/#[0-9a-f]{6}/gi) ?? [])].map((c) => c.toLowerCase()));
      return [...colors].every((color) => ["#24113f", "#2f1a55", "#c7b6e8", "#f6f1e9", "#c9962e", "#d9a87c"].includes(color));
    }),
  );
  check("the avatar maps every pose to its file", POSES.every((pose) => avatar.includes(`/brand/meemi/meemi-${pose}.svg`)));
  check(
    "each Meemi message has a pose, resting on the wave",
    ["greeting", "menu", "guide", "explain-difficulty", "techniques", "section-difficulty", "section-techniques", "wishlist", "cart"].every(
      (kind) => avatar.includes(`case "${kind}"`) || ["greeting", "menu"].includes(kind),
    ) && /default:\s*\n\s*return "wave"/.test(avatar),
  );
  check("artwork is decorative: empty alt, and the label stays on the button", /alt=""/.test(avatar) && !/aria-label/.test(avatar));
  check("a failed artwork load falls back to the plain mark", /onError=\{\(\) => setArtworkFailed\(true\)\}/.test(avatar) && /if \(artworkFailed\) return <MeemiMark/.test(avatar));
  // Lazily *mounted* rather than lazily loaded: by the time the guide exists
  // the avatar is on screen, and a deferred load would show an empty circle.
  check("the avatar stays out of the image optimiser and decodes off the main thread", /unoptimized/.test(avatar) && /decoding="async"/.test(avatar));
  check("the guide passes the pose from its existing state, adding none", /expressionForTip\(tip\?\.kind \?\? null\)/.test(read("src/components/product/meemi/meemi-guide.tsx")));
}

main()
  .catch((error) => {
    console.error("\nHarness crashed:", error);
    process.exitCode = 1;
  })
  .finally(() => {
    console.log(`\n${passed} passed, ${failed} failed`);
    if (failed > 0) process.exitCode = 1;
  });
