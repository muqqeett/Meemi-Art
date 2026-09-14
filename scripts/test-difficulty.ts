/**
 * Project Difficulty harness.
 *
 * Proves the engine (weights, rounding, the hardest-part rule, levels, time
 * text, challenges, determinism), the validation (ratings, minutes,
 * techniques, strict payloads) and the persistence rules (no fabricated
 * difficulty, create, update, disable without deleting, re-enable, duplicate
 * as an independent row, database CHECK constraints, no stored score).
 *
 * LOCAL DATABASE ONLY, NO NETWORK — the same guards as test-projects.ts:
 *
 *   - Prisma is pointed at `LOCAL_DATABASE_URL` before anything imports it; the
 *     script refuses to start unless that is a localhost database distinct
 *     from `DATABASE_URL`, and confirms from inside the connection that the
 *     server is local.
 *   - Cloudinary, Upstash and Gemini credentials are removed from the
 *     environment, and every outbound HTTP(S) request and `fetch` is replaced
 *     with a tripwire the harness requires to stay at zero.
 *   - Fixtures are namespaced `zz-difficulty-test-<run>`, removed in `finally`,
 *     and the cleanup is verified.
 *
 * Run: npm run test:difficulty
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import http from "node:http";
import https from "node:https";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

const localUrl = process.env.LOCAL_DATABASE_URL;
if (!localUrl) {
  console.error("Refusing to run: LOCAL_DATABASE_URL is not set.");
  process.exit(1);
}
const localHost = new URL(localUrl).hostname;
const productionHost = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL).hostname : "";
if (!LOCAL_HOSTS.has(localHost) || localHost === productionHost) {
  console.error("Refusing to run: LOCAL_DATABASE_URL is not a local database.");
  process.exit(1);
}
// Must happen before `src/lib/prisma` is imported — it reads DATABASE_URL once.
process.env.DATABASE_URL = localUrl;

const REMOVED_CREDENTIALS = [
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
  "CLOUDINARY_URL",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "GEMINI_API_KEY",
];
for (const name of REMOVED_CREDENTIALS) delete process.env[name];

let outbound = 0;
const refuse = (): never => {
  outbound++;
  throw new Error("Outbound network request blocked by the difficulty harness.");
};
globalThis.fetch = (async () => refuse()) as typeof fetch;
https.request = refuse as unknown as typeof https.request;
https.get = refuse as unknown as typeof https.get;
http.request = refuse as unknown as typeof http.request;
http.get = refuse as unknown as typeof http.get;

const RUN = `zz-difficulty-test-${randomUUID().slice(0, 8)}`;

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

function throws(run: () => unknown): boolean {
  try {
    run();
    return false;
  } catch {
    return true;
  }
}

/** A small deterministic PRNG, so the property check is reproducible. */
function mulberry32(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function main() {
  const engine = await import("../src/lib/difficulty/engine");
  const vocabulary = await import("../src/lib/difficulty/techniques");
  const { productDifficultySchema, productSchema } = await import("../src/lib/validations/admin");

  type Ratings = Record<(typeof engine.DIFFICULTY_DIMENSIONS)[number], number>;
  const ratings = (overrides: Partial<Ratings> = {}): Ratings => ({
    stitches: 1,
    construction: 1,
    shaping: 1,
    colorwork: 1,
    assembly: 1,
    patternReading: 1,
    ...overrides,
  });
  const profile = (r: Ratings, extra: { minutesMin?: number; minutesMax?: number; techniques?: string[] } = {}) => ({
    ...r,
    minutesMin: extra.minutesMin ?? 120,
    minutesMax: extra.minutesMax ?? 180,
    techniques: extra.techniques ?? ["magic-ring", "increase"],
  });
  const validInput = (overrides: Record<string, unknown> = {}) => ({
    enabled: true,
    stitches: 8,
    construction: 8,
    shaping: 7,
    colorwork: 5,
    assembly: 7,
    patternReading: 7,
    minutesMin: 240,
    minutesMax: 360,
    techniques: ["increase", "magic-ring", "3d-elements"],
    ...overrides,
  });
  const score = (r: Ratings) => engine.difficultyScoreTenths(r);
  const level = (r: Ratings) => engine.difficultyLevelFor(score(r)).label;

  // ------------------------------------------------------------ the formula
  console.log("\nFormula");
  check("the weights sum to 100", Object.values(engine.DIFFICULTY_WEIGHTS).reduce((a, b) => a + b, 0) === 100);
  check(
    "the weights are the approved ones",
    JSON.stringify(engine.DIFFICULTY_WEIGHTS) === JSON.stringify({ stitches: 25, construction: 20, shaping: 20, colorwork: 10, assembly: 15, patternReading: 10 }),
  );
  check("minimum difficulty: all ones score 1.0, Beginner", score(ratings()) === 10 && level(ratings()) === "Beginner");
  const allTen = ratings({ stitches: 10, construction: 10, shaping: 10, colorwork: 10, assembly: 10, patternReading: 10 });
  check("maximum difficulty: all tens score 10.0, Expert", score(allTen) === 100 && level(allTen) === "Expert");

  const beginner = ratings({ stitches: 2, shaping: 2, patternReading: 2 });
  check("representative beginner project: 1.6 Beginner", engine.formatTenths(score(beginner)) === "1.6" && level(beginner) === "Beginner", engine.formatTenths(score(beginner)));
  const easy = ratings({ stitches: 4, construction: 3, shaping: 4, colorwork: 2, assembly: 3, patternReading: 3 });
  check("representative easy project: 3.4 Easy", engine.formatTenths(score(easy)) === "3.4" && level(easy) === "Easy", engine.formatTenths(score(easy)));
  const intermediate = ratings({ stitches: 5, construction: 6, shaping: 6, colorwork: 3, assembly: 5, patternReading: 5 });
  check("representative intermediate project: 5.2 Intermediate", engine.formatTenths(score(intermediate)) === "5.2" && level(intermediate) === "Intermediate", engine.formatTenths(score(intermediate)));
  const advanced = ratings({ stitches: 8, construction: 8, shaping: 7, colorwork: 5, assembly: 7, patternReading: 7 });
  check("representative advanced project: 7.3 Advanced", engine.formatTenths(score(advanced)) === "7.3" && level(advanced) === "Advanced", engine.formatTenths(score(advanced)));
  const expert = ratings({ stitches: 9, construction: 9, shaping: 9, colorwork: 8, assembly: 9, patternReading: 9 });
  check("representative expert project: 8.9 Expert", engine.formatTenths(score(expert)) === "8.9" && level(expert) === "Expert", engine.formatTenths(score(expert)));

  console.log("\nWeighting");
  const raised = (dimension: keyof Ratings) => engine.weightedAverageTenths(ratings({ [dimension]: 3 }));
  check("stitches at 3 adds 0.5 (25%)", raised("stitches") === 15);
  check("construction at 3 adds 0.4 (20%)", raised("construction") === 14);
  check("shaping at 3 adds 0.4 (20%)", raised("shaping") === 14);
  check("assembly at 3 adds 0.3 (15%)", raised("assembly") === 13);
  check("colorwork at 3 adds 0.2 (10%)", raised("colorwork") === 12);
  check("pattern reading at 3 adds 0.2 (10%)", raised("patternReading") === 12);
  check(
    "in the weighted average, stitches outweighs colorwork for the same rating",
    engine.weightedAverageTenths(ratings({ stitches: 4 })) === 18 && engine.weightedAverageTenths(ratings({ colorwork: 4 })) === 13,
  );
  check(
    "once the hardest-part floor applies, the same single rating scores the same whichever dimension it is in",
    score(ratings({ stitches: 4 })) === 20 && score(ratings({ colorwork: 4 })) === 20,
  );

  console.log("\nRounding (integer tenths, half up)");
  check("1.25 rounds up to 1.3", engine.weightedAverageTenths(ratings({ stitches: 2 })) === 13);
  check("1.15 rounds up to 1.2", engine.weightedAverageTenths(ratings({ assembly: 2 })) === 12);
  check("1.20 stays 1.2", engine.weightedAverageTenths(ratings({ construction: 2 })) === 12);
  check("the formatted score never shows float error", engine.formatTenths(73) === "7.3" && engine.formatTenths(10) === "1.0" && engine.formatTenths(100) === "10.0");
  check("meter segments round half up (7.4 → 7, 7.5 → 8)", engine.meterSegmentsFor(74) === 7 && engine.meterSegmentsFor(75) === 8 && engine.meterSegmentsFor(10) === 1 && engine.meterSegmentsFor(100) === 10);

  console.log("\nLevel boundaries");
  const boundaries: [number, string][] = [
    [10, "Beginner"], [29, "Beginner"], [30, "Easy"], [49, "Easy"], [50, "Intermediate"],
    [69, "Intermediate"], [70, "Advanced"], [84, "Advanced"], [85, "Expert"], [100, "Expert"],
  ];
  for (const [tenths, expected] of boundaries) {
    check(`${engine.formatTenths(tenths)} is ${expected}`, engine.difficultyLevelFor(tenths).label === expected);
  }
  check("scores outside 1.0–10.0 or not whole tenths are refused", [9, 101, 74.5, Number.NaN].every((value) => throws(() => engine.difficultyLevelFor(value))));

  console.log("\nHardest-part rule");
  const oneHardSkill = ratings({ stitches: 2, construction: 2, shaping: 2, colorwork: 10, assembly: 2, patternReading: 2 });
  check("the weighted average alone would be 2.8", engine.weightedAverageTenths(oneHardSkill) === 28);
  check("one 10/10 dimension lifts the score to 8.0 (10 − 2)", score(oneHardSkill) === 80 && level(oneHardSkill) === "Advanced");
  check("the rule never lowers a score", score(allTen) === engine.weightedAverageTenths(allTen));
  check("the floor for a hardest rating of 6 is 4.0", engine.hardestPartFloorTenths(ratings({ assembly: 6 })) === 40 && score(ratings({ assembly: 6 })) === 40);

  console.log("\nInvalid component values");
  for (const [label, value] of [["0", 0], ["11", 11], ["2.5", 2.5], ["NaN", Number.NaN], ["Infinity", Number.POSITIVE_INFINITY], ["-3", -3], ["'5'", "5"], ["null", null]] as const) {
    check(`the engine refuses a rating of ${label}`, throws(() => engine.difficultyScoreTenths(ratings({ stitches: value as unknown as number }))));
    check(`validation refuses a rating of ${label}`, !productDifficultySchema.safeParse(validInput({ shaping: value })).success);
  }
  check("a missing dimension is refused", !productDifficultySchema.safeParse({ ...validInput(), patternReading: undefined }).success);

  console.log("\nEstimated time");
  for (const [label, min, max] of [
    ["14 minutes", 14, 60], ["12,001 minutes", 60, 12_001], ["fractional minutes", 30.5, 60], ["NaN", Number.NaN, 60],
    ["Infinity", 60, Number.POSITIVE_INFINITY], ["negative", -30, 60], ["minimum above maximum", 180, 120],
  ] as const) {
    check(`validation refuses ${label}`, !productDifficultySchema.safeParse(validInput({ minutesMin: min, minutesMax: max })).success);
  }
  check("15 and 12,000 minutes are accepted", productDifficultySchema.safeParse(validInput({ minutesMin: 15, minutesMax: 12_000 })).success);
  check("an equal minimum and maximum is accepted", productDifficultySchema.safeParse(validInput({ minutesMin: 90, minutesMax: 90 })).success);
  const minAboveMax = productDifficultySchema.safeParse(validInput({ minutesMin: 180, minutesMax: 120 }));
  check("a reversed range is reported on the maximum", !minAboveMax.success && minAboveMax.error.issues.some((issue) => issue.path[0] === "minutesMax"));
  check("hours convert in half-hour steps", engine.hoursToMinutes(0.5) === 30 && engine.hoursToMinutes(2.5) === 150 && engine.hoursToMinutes(4) === 240);
  check("hours that are not half-hour steps are refused", [0.25, 0, -1, 1.2, Number.NaN, Number.POSITIVE_INFINITY, "2"].every((value) => engine.hoursToMinutes(value) === null));
  const times: [number, number, string][] = [
    [30, 30, "About 30 min"], [45, 60, "About 45 min–1 hour"], [60, 60, "About 1 hour"],
    [120, 180, "About 2–3 hours"], [90, 150, "About 1.5–2.5 hours"], [100, 130, "About 1 h 40 min–2 h 10 min"],
  ];
  for (const [min, max, expected] of times) {
    check(`${min}–${max} minutes reads "${expected}"`, engine.formatEstimatedTime(min, max) === expected, engine.formatEstimatedTime(min, max));
  }

  console.log("\nTechniques");
  check("a valid technique list is accepted", productDifficultySchema.safeParse(validInput()).success);
  check("an unknown technique slug is refused", !productDifficultySchema.safeParse(validInput({ techniques: ["magic-ring", "kinda-hard"] })).success);
  check("free text is refused", !productDifficultySchema.safeParse(validInput({ techniques: ["Magic ring"] })).success);
  check("a duplicated technique is refused", !productDifficultySchema.safeParse(validInput({ techniques: ["increase", "increase"] })).success);
  const twelve = vocabulary.TECHNIQUE_SLUGS.slice(0, 12);
  const thirteen = vocabulary.TECHNIQUE_SLUGS.slice(0, 13);
  check("12 techniques are accepted", productDifficultySchema.safeParse(validInput({ techniques: twelve })).success);
  check("13 techniques are refused", !productDifficultySchema.safeParse(validInput({ techniques: thirteen })).success);
  check("no techniques is accepted", productDifficultySchema.safeParse(validInput({ techniques: [] })).success);
  check("slugs are unique in the vocabulary", new Set(vocabulary.TECHNIQUE_SLUGS).size === vocabulary.TECHNIQUE_SLUGS.length);
  check("techniques are normalised to vocabulary order", JSON.stringify(vocabulary.normalizeTechniques(["increase", "chain", "magic-ring", "increase", "nope"])) === JSON.stringify(["chain", "magic-ring", "increase"]));

  console.log("\nChallenges");
  check(
    "the three most demanding dimensions are named, hardest and heaviest first",
    JSON.stringify(engine.difficultyChallenges(advanced)) === JSON.stringify(["Advanced stitch work", "Complex construction", "Moderate shaping"]),
    JSON.stringify(engine.difficultyChallenges(advanced)),
  );
  check("a gentle pattern names no challenges", engine.difficultyChallenges(beginner).length === 0);
  check("never more than three", engine.difficultyChallenges(allTen).length === 3);

  console.log("\nClient-supplied score");
  check("a payload carrying a score is refused", !productDifficultySchema.safeParse(validInput({ score: 99 })).success);
  check("a payload carrying a level is refused", !productDifficultySchema.safeParse(validInput({ level: "EXPERT" })).success);
  check("a payload carrying scoreTenths is refused", !productDifficultySchema.safeParse(validInput({ scoreTenths: 100 })).success);
  check("the product schema accepts no difficulty, as for existing products", productSchema.shape.difficulty.safeParse(null).success && productSchema.shape.difficulty.safeParse(undefined).success);

  console.log("\nDeterminism");
  const random = mulberry32(20260914);
  let mismatches = 0;
  let outOfRange = 0;
  for (let i = 0; i < 5000; i++) {
    const r = ratings({
      stitches: 1 + Math.floor(random() * 10),
      construction: 1 + Math.floor(random() * 10),
      shaping: 1 + Math.floor(random() * 10),
      colorwork: 1 + Math.floor(random() * 10),
      assembly: 1 + Math.floor(random() * 10),
      patternReading: 1 + Math.floor(random() * 10),
    });
    // An independent statement of the approved formula.
    const sum = r.stitches * 25 + r.construction * 20 + r.shaping * 20 + r.colorwork * 10 + r.assembly * 15 + r.patternReading * 10;
    const average = sum % 10 >= 5 ? Math.trunc(sum / 10) + 1 : Math.trunc(sum / 10);
    const hardest = Math.max(r.stitches, r.construction, r.shaping, r.colorwork, r.assembly, r.patternReading);
    const expected = Math.max(average, (hardest - 2) * 10);
    const first = engine.evaluateDifficulty(profile(r));
    const second = engine.evaluateDifficulty(profile(r));
    if (first.scoreTenths !== expected || JSON.stringify(first) !== JSON.stringify(second)) mismatches++;
    if (first.scoreTenths < 10 || first.scoreTenths > 100) outOfRange++;
  }
  check("5,000 seeded profiles match an independent formula and repeat identically", mismatches === 0, String(mismatches));
  check("every score is within 1.0–10.0", outOfRange === 0);

  console.log("\nPublic visibility");
  const stored = { ...profile(advanced), enabled: true };
  check("no row shows nothing", engine.evaluatePublicDifficulty(null) === null && engine.evaluatePublicDifficulty(undefined) === null);
  check("a disabled row shows nothing", engine.evaluatePublicDifficulty({ ...stored, enabled: false }) === null);
  check("an enabled row shows its derived score", engine.evaluatePublicDifficulty(stored)?.score === "7.3");
  check("a corrupt row shows nothing and never throws", engine.evaluatePublicDifficulty({ ...stored, stitches: 11 }) === null && engine.evaluatePublicDifficulty({ ...stored, minutesMin: 500, minutesMax: 100 }) === null);

  // ------------------------------------------------------------ database
  const { prisma } = await import("../src/lib/prisma");
  const records = await import("../src/lib/difficulty/records");
  const productIds: string[] = [];

  try {
    const [server] = await prisma.$queryRaw<{ addr: string | null }[]>`select inet_server_addr()::text as addr`;
    const addr = server?.addr?.split("/")[0] ?? null;
    if (addr !== null && !LOCAL_HOSTS.has(addr)) {
      console.error("Refusing to run: the connected database server is not local.");
      process.exitCode = 1;
      return;
    }
    const category = await prisma.category.findFirst({ where: { isActive: true }, select: { id: true } });
    if (!category) {
      console.error("Local database has no active category to attach fixtures to.");
      process.exitCode = 1;
      return;
    }

    const makeProduct = async (label: string, extra: Record<string, unknown> = {}) => {
      const product = await prisma.product.create({
        data: {
          name: `${RUN} ${label}`,
          slug: `${RUN}-${label}`,
          sku: `${RUN}-${label}`.toUpperCase(),
          brand: "Meemi Art",
          description: "Difficulty harness fixture.",
          priceCents: 100,
          categoryId: category.id,
          isActive: false,
          ...extra,
        },
        select: { id: true },
      });
      productIds.push(product.id);
      return product;
    };
    const loadDifficulty = (productId: string) =>
      prisma.product.findUnique({ where: { id: productId }, select: { difficulty: { select: records.productDifficultySelect } } });

    console.log("\nExisting products");
    const legacy = await makeProduct("legacy");
    const legacyRow = await loadDifficulty(legacy.id);
    check("a product without difficulty has no row", legacyRow?.difficulty === null);
    check("and renders no difficulty", engine.evaluatePublicDifficulty(legacyRow?.difficulty) === null);
    check("no difficulty was fabricated for it", (await prisma.productDifficulty.count({ where: { productId: legacy.id } })) === 0);

    console.log("\nCreate, update, disable, re-enable");
    const rated = await makeProduct("rated");
    const created = await records.saveProductDifficulty(prisma, rated.id, productDifficultySchema.parse(validInput()));
    const afterCreate = await loadDifficulty(rated.id);
    check("a rating is created", Boolean(afterCreate?.difficulty) && afterCreate?.difficulty?.stitches === 8);
    check("its score is derived: 7.3 Advanced", engine.evaluatePublicDifficulty(afterCreate?.difficulty)?.score === "7.3" && engine.evaluatePublicDifficulty(afterCreate?.difficulty)?.levelLabel === "Advanced");
    check("techniques are stored in vocabulary order", JSON.stringify(afterCreate?.difficulty?.techniques) === JSON.stringify(["magic-ring", "increase", "3d-elements"]), JSON.stringify(afterCreate?.difficulty?.techniques));

    const updated = await records.saveProductDifficulty(prisma, rated.id, productDifficultySchema.parse(validInput({ stitches: 10, minutesMax: 480 })));
    const afterUpdate = await loadDifficulty(rated.id);
    check("an update keeps the same row", updated.id === created.id && (await prisma.productDifficulty.count({ where: { productId: rated.id } })) === 1);
    // Stitches 10 with the rest unchanged: the weighted average is 7.8, and the
    // hardest-part rule lifts it to (10 − 2) × 10 = 8.0.
    check("and changes the derived score (hardest-part rule: 7.8 → 8.0)", engine.evaluatePublicDifficulty(afterUpdate?.difficulty)?.score === "8.0" && afterUpdate?.difficulty?.minutesMax === 480, engine.evaluatePublicDifficulty(afterUpdate?.difficulty)?.score);

    const enabledScore = engine.evaluatePublicDifficulty(afterUpdate?.difficulty)?.score;
    const disabled = await records.saveProductDifficulty(prisma, rated.id, productDifficultySchema.parse(validInput({ stitches: 10, minutesMax: 480, enabled: false })));
    const afterDisable = await loadDifficulty(rated.id);
    check("disabling keeps the row and every value", disabled.id === created.id && afterDisable?.difficulty?.enabled === false && afterDisable.difficulty.stitches === 10 && afterDisable.difficulty.minutesMax === 480);
    check("a disabled rating is not shown publicly", engine.evaluatePublicDifficulty(afterDisable?.difficulty) === null);

    const reenabled = await records.saveProductDifficulty(prisma, rated.id, productDifficultySchema.parse(validInput({ stitches: 10, minutesMax: 480, enabled: true })));
    const afterReenable = await loadDifficulty(rated.id);
    check("re-enabling restores the same rating on the same row", reenabled.id === created.id && engine.evaluatePublicDifficulty(afterReenable?.difficulty)?.score === enabledScore);

    console.log("\nClient-supplied score (persistence)");
    const smuggled = { ...productDifficultySchema.parse(validInput()), score: 99, level: "EXPERT", scoreTenths: 100 } as unknown as Parameters<typeof records.difficultyRecordData>[0];
    const data = records.difficultyRecordData(smuggled);
    check("the write data carries no score or level", !Object.keys(data).some((key) => /score|level|challenge/i.test(key)));
    const columns = Object.keys(prisma.productDifficulty.fields);
    check("the table has no score, level or challenge column", columns.length > 0 && !columns.some((key) => /score|level|challenge/i.test(key)), columns.join(","));
    const smuggledSave = await records.saveProductDifficulty(prisma, rated.id, smuggled);
    const afterSmuggle = await loadDifficulty(rated.id);
    check("saving a payload with a fake score still derives 7.3 from the ratings", smuggledSave.id === created.id && engine.evaluatePublicDifficulty(afterSmuggle?.difficulty)?.score === "7.3");

    console.log("\nDuplicate");
    const source = await prisma.product.findUnique({ where: { id: rated.id }, select: { difficulty: { select: records.productDifficultySelect } } });
    const copy = await makeProduct("copy", { difficulty: records.duplicateDifficultyCreate(source?.difficulty) });
    const sourceRow = await prisma.productDifficulty.findUnique({ where: { productId: rated.id } });
    const copyRow = await prisma.productDifficulty.findUnique({ where: { productId: copy.id } });
    check("the copy has its own difficulty row", Boolean(copyRow) && copyRow?.id !== sourceRow?.id && copyRow?.productId === copy.id);
    check("with the same inputs", JSON.stringify(engine.evaluatePublicDifficulty(copyRow)) === JSON.stringify(engine.evaluatePublicDifficulty(sourceRow)));
    await records.saveProductDifficulty(prisma, rated.id, productDifficultySchema.parse(validInput({ stitches: 2 })));
    const copyAfter = await prisma.productDifficulty.findUnique({ where: { productId: copy.id } });
    check("changing the original leaves the copy unchanged", copyAfter?.stitches === 8);
    const plainCopy = await makeProduct("plain-copy", { difficulty: records.duplicateDifficultyCreate(null) });
    check("duplicating a product without difficulty creates no row", (await prisma.productDifficulty.count({ where: { productId: plainCopy.id } })) === 0);

    console.log("\nDatabase CHECK constraints");
    const constraintFixture = await makeProduct("constraints");
    const base = records.difficultyRecordData(productDifficultySchema.parse(validInput()));
    const rejected = async (label: string, overrides: Record<string, unknown>) => {
      const original = console.error;
      console.error = () => {};
      let error: unknown = null;
      try {
        await prisma.productDifficulty.create({ data: { ...base, ...overrides, productId: constraintFixture.id } as never });
      } catch (caught) {
        error = caught;
      } finally {
        console.error = original;
      }
      const code = (error as { code?: string } | null)?.code;
      const message = String((error as Error | null)?.message ?? "");
      check(`the database refuses ${label}`, error !== null && (code === "P2004" || /check constraint|23514/i.test(message)), code ?? message.slice(0, 120));
      await prisma.productDifficulty.deleteMany({ where: { productId: constraintFixture.id } });
    };
    await rejected("a rating of 11", { shaping: 11 });
    await rejected("a rating of 0", { colorwork: 0 });
    await rejected("14 minutes", { minutesMin: 14 });
    await rejected("12,001 minutes", { minutesMax: 12_001 });
    await rejected("a minimum above the maximum", { minutesMin: 400, minutesMax: 300 });
    await rejected("13 techniques", { techniques: thirteen });

    console.log("\nCascade");
    await prisma.product.delete({ where: { id: copy.id } });
    check("deleting a product deletes its difficulty row", (await prisma.productDifficulty.count({ where: { productId: copy.id } })) === 0);

    console.log("\nSource structure");
    const schema = readFileSync("prisma/schema.prisma", "utf8");
    const model = /model ProductDifficulty \{([\s\S]*?)\n\}/.exec(schema)?.[1] ?? "";
    check("the model stores no score, level or challenge text", model.length > 0 && !/^\s*(score|level|challenge)/im.test(model));
    const engineSource = readFileSync("src/lib/difficulty/engine.ts", "utf8");
    check("the engine is pure: no database, server, network or AI imports", !/lib\/prisma|server-only|next\/|fetch\(|lib\/ai|gemini/i.test(engineSource.replace(/\/\*[\s\S]*?\*\//g, "")));
    const migrations = readdirSync("prisma/migrations").filter((name) => name.endsWith("_product_difficulty"));
    const sql = migrations.length === 1 ? readFileSync(`prisma/migrations/${migrations[0]}/migration.sql`, "utf8") : "";
    check("exactly one product-difficulty migration exists", migrations.length === 1);
    check("the migration only adds (no DROP, no change to existing tables)", !/DROP\s/i.test(sql) && !/ALTER TABLE "(?!ProductDifficulty")/i.test(sql));
    check("the migration carries the CHECK constraints", (sql.match(/CHECK\s*\(/gi) ?? []).length >= 8);
  } finally {
    await prisma.product.deleteMany({ where: { slug: { startsWith: RUN } } });
    const leftovers =
      (await prisma.product.count({ where: { slug: { startsWith: RUN } } })) +
      (await prisma.productDifficulty.count({ where: { productId: { in: productIds } } }));
    check("fixtures cleaned up", leftovers === 0, `${leftovers} left`);
    console.log("\nNetwork");
    check("zero outbound HTTP requests were attempted", outbound === 0, String(outbound));
    await prisma.$disconnect();
  }
}

main()
  .catch((error) => {
    console.error("\nHarness crashed:", error instanceof Error ? `${error.constructor.name}: ${error.message.slice(0, 300)}` : "unknown");
    process.exitCode = 1;
  })
  .finally(() => {
    console.log(`\n${passed} passed, ${failed} failed`);
    if (failed > 0) process.exitCode = 1;
  });
