/**
 * Customer project harness — submission, customer management, moderation,
 * visibility and abandoned-upload cleanup.
 *
 * Proves the rules the project backend rests on: session-only identity,
 * strict payloads, published products, the COMPLETED + PAID purchase rule
 * (refunds excluded) at signing, submission and approval, the three-slot cap
 * under concurrency (REJECTED frees a slot), forced PENDING status, per-user
 * key ownership, upload verification, owner-scoped edits and deletes with
 * confirmed photo removal, the admin transition table with a database role
 * check, AdminActivity, public visibility, the orphan sweep, rate limiting,
 * same-origin checks and safe errors.
 *
 * LOCAL DATABASE ONLY, NO NETWORK.
 *
 *   - Prisma is pointed at `LOCAL_DATABASE_URL` before anything imports it; the
 *     script refuses to start unless that is a localhost database distinct
 *     from `DATABASE_URL`, and confirms from inside the connection that the
 *     server is local.
 *   - Cloudinary, Upstash and Gemini credentials are removed from the
 *     environment before any module reads them, and every outbound HTTP(S)
 *     request and `fetch` is replaced with a tripwire that counts and refuses.
 *     The harness fails unless that count is zero. Cloudinary is exercised
 *     through in-memory stand-ins only.
 *   - Every fixture is namespaced `zz-project-test-<run>` and removed in
 *     `finally`, and the cleanup is verified — database rows and mocked
 *     Cloudinary objects both.
 *
 * Run: npm run test:projects
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
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

// No real Cloudinary, Redis or model calls can be configured from here on.
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

// Tripwire: the database is reached over a plain TCP socket, so nothing this
// harness legitimately does uses HTTP. Any attempt is counted and refused.
let outbound = 0;
const refuse = (): never => {
  outbound++;
  throw new Error("Outbound network request blocked by the project harness.");
};
globalThis.fetch = (async () => refuse()) as typeof fetch;
https.request = refuse as unknown as typeof https.request;
https.get = refuse as unknown as typeof https.get;
http.request = refuse as unknown as typeof http.request;
http.get = refuse as unknown as typeof http.get;

const RUN = `zz-project-test-${randomUUID().slice(0, 8)}`;

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

const HOUR = 60 * 60;

async function main() {
  const { prisma } = await import("../src/lib/prisma");
  const mutations = await import("../src/lib/projects/mutations");
  const moderation = await import("../src/lib/projects/moderation");
  const { scanProjectOrphans, deleteProjectOrphans } = await import("../src/lib/projects/orphans");
  const { getPublicProjectsForProduct } = await import("../src/lib/queries/projects");
  const { recordActivity } = await import("../src/lib/admin/activity");
  const validations = await import("../src/lib/validations/commerce");
  const {
    createCustomerProjectStorage,
    customerProjectStorage,
    parseProjectKey,
    CUSTOMER_PROJECT_FOLDER,
    PROJECT_UPLOAD_WINDOW_SECONDS,
    PROJECT_FINALIZE_WINDOW_SECONDS,
  } = await import("../src/lib/storage/customer-projects");
  const throttle = await import("../src/lib/projects/throttle");
  const {
    createProjectForSession,
    signProjectUploadForSession,
    updateOwnProjectForSession,
    deleteOwnProjectForSession,
    isSameOriginRequest,
    MAX_PROJECTS_PER_PRODUCT,
  } = mutations;
  const { approveProjectAsAdmin, rejectProjectAsAdmin, hideProjectAsAdmin, PROJECT_MODERATION_TRANSITIONS } = moderation;
  type Deps = NonNullable<Parameters<typeof createProjectForSession>[1]>;
  type ModDeps = NonNullable<Parameters<typeof approveProjectAsAdmin>[1]>;

  // ------------------------------------------------------------ fake Cloudinary
  type Resource = Record<string, unknown>;
  const clock = Date.now();
  let offset = 0;

  function createFakeCloud(pageSize = 500) {
    const state = {
      resources: new Map<string, Resource>(),
      resourceCalls: 0,
      destroyed: [] as string[],
      signatures: 0,
      listCalls: 0,
      failLookups: false,
      failDestroy: false,
      failListAfter: -1,
    };
    const storage = createCustomerProjectStorage({
      config: { cloudName: "test-cloud", apiKey: "test-key", apiSecret: "test-secret" },
      now: () => clock + offset,
      client: {
        async resource(publicId, options) {
          state.resourceCalls++;
          if (state.failLookups) throw { error: { http_code: 500 } };
          const stored = state.resources.get(publicId);
          if (!stored || stored.resource_type !== options.resource_type || stored.type !== options.type) {
            throw { error: { http_code: 404 } };
          }
          return stored;
        },
        async destroy(publicId, options) {
          state.destroyed.push(`${options.resource_type}:${publicId}`);
          if (state.failDestroy) throw { error: { http_code: 500 } };
          const stored = state.resources.get(publicId);
          if (stored && stored.resource_type === options.resource_type && stored.type === options.type) {
            state.resources.delete(publicId);
            return { result: "ok" };
          }
          return { result: "not found" };
        },
        signRequest() {
          state.signatures++;
          return "test-signature";
        },
        signedUrl(publicId, options) {
          return `https://res.cloudinary.com/test-cloud/image/authenticated/s--sig--/${publicId}.${options.format}`;
        },
        async list(options) {
          state.listCalls++;
          if (state.failListAfter >= 0 && state.listCalls > state.failListAfter) throw { error: { http_code: 500 } };
          const all = [...state.resources.values()]
            .filter((r) => r.type === options.type && r.resource_type === options.resource_type && String(r.public_id).startsWith(options.prefix))
            .sort((a, b) => String(a.public_id).localeCompare(String(b.public_id)));
          const start = options.next_cursor ? Number(options.next_cursor) : 0;
          const slice = all.slice(start, start + Math.min(pageSize, options.max_results));
          const next = start + slice.length < all.length ? String(start + slice.length) : null;
          return { resources: slice, ...(next ? { next_cursor: next } : {}) };
        },
      },
    });
    return { state, storage };
  }

  const main = createFakeCloud();
  const cloud = main.state;
  const storage = main.storage;

  /** Simulate the browser's upload landing in Cloudinary, as Cloudinary would describe it. */
  function uploadTo(target: typeof cloud, key: string, overrides: Resource = {}) {
    target.resources.set(key, {
      public_id: key,
      resource_type: "image",
      type: "authenticated",
      format: "jpg",
      bytes: 2_400_000,
      width: 3024,
      height: 4032,
      created_at: new Date(clock + 5_000).toISOString(),
      ...overrides,
    });
    return key;
  }
  const upload = (key: string, overrides: Resource = {}) => uploadTo(cloud, key, overrides);
  const destroyedKey = (key: string) => cloud.destroyed.includes(`image:${key}`);

  const allow = async () => true;
  const as = (user: { id: string } | null, extra: Partial<Deps> = {}): Deps => ({
    currentUser: async () => (user ? { id: user.id } : null),
    db: prisma,
    storage,
    allowAttempt: allow,
    ...extra,
  });
  const asAdmin = (user: { id: string } | null, extra: Partial<ModDeps> = {}): ModDeps => ({
    currentUser: async () => (user ? { id: user.id } : null),
    db: prisma,
    storage,
    recordActivity,
    now: () => new Date(clock + offset),
    ...extra,
  });

  const uploadRequest = (productId: unknown, extra: Record<string, unknown> = {}) => ({
    productId,
    contentType: "image/jpeg",
    bytes: 2_400_000,
    ...extra,
  });

  const leaky = Object.assign(new Error("connect ECONNREFUSED postgresql://admin:hunter2@db.internal:5432/prod"), { code: "P1001" });
  const LEAK = /postgresql|hunter2|db\.internal|ECONNREFUSED/;

  async function captureErrors<T>(run: () => Promise<T>): Promise<{ value: T; logged: string[] }> {
    const logged: string[] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => {
      logged.push(args.map(String).join(" "));
    };
    try {
      return { value: await run(), logged };
    } finally {
      console.error = original;
    }
  }

  try {
    const [server] = await prisma.$queryRaw<{ addr: string | null }[]>`
      select inet_server_addr()::text as addr`;
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

    // ------------------------------------------------------------- fixtures
    const makeUser = (label: string, role: "CUSTOMER" | "ADMIN" = "CUSTOMER") =>
      prisma.user.create({
        data: { email: `${RUN}-${label}@example.invalid`, name: `${RUN} ${label}`, role },
        select: { id: true },
      });
    const makeProduct = (label: string, isActive: boolean) =>
      prisma.product.create({
        data: {
          name: `${RUN} ${label}`,
          slug: `${RUN}-${label}`,
          sku: `${RUN}-${label}`.toUpperCase(),
          brand: "Meemi Art",
          description: "Project harness fixture.",
          priceCents: 100,
          categoryId: category.id,
          isActive,
        },
        select: { id: true },
      });
    let orderSeq = 0;
    const makeOrder = (
      userId: string,
      productId: string,
      status: "PENDING" | "PROCESSING" | "COMPLETED" | "CANCELLED" | "REFUNDED",
      paymentStatus: "PENDING" | "PAID" | "FAILED" | "REFUNDED" | null,
    ) =>
      prisma.order.create({
        data: {
          orderNumber: `${RUN}-${++orderSeq}`,
          userId,
          status,
          email: `${RUN}-order@example.invalid`,
          customerName: "Project Harness",
          subtotalCents: 100,
          totalCents: 100,
          items: {
            create: [
              { productId, name: "Fixture", slug: `${RUN}-line`, sku: "FIXTURE", unitPriceCents: 100, quantity: 1, totalCents: 100 },
            ],
          },
          ...(paymentStatus ? { payment: { create: { status: paymentStatus, amountCents: 100, provider: "sandbox" } } } : {}),
        },
        select: { id: true },
      });

    const labels = ["alice", "bob", "carol", "dave", "erin", "gina", "hank", "ivan", "kate", "leo", "olga", "pat", "quin", "rita"];
    const users = Object.fromEntries(await Promise.all(labels.map(async (label) => [label, await makeUser(label)] as const)));
    const { alice, bob, carol, dave, erin, gina, hank, ivan, kate, leo, olga, pat, quin, rita } = users;
    const mona = await makeUser("mona-admin", "ADMIN");
    const nate = await makeUser("nate-demoted", "CUSTOMER");
    const [published, unpublished, second] = await Promise.all([
      makeProduct("published", true),
      makeProduct("unpublished", false),
      makeProduct("second", true),
    ]);

    await makeOrder(alice.id, published.id, "COMPLETED", "PAID");
    await makeOrder(alice.id, unpublished.id, "COMPLETED", "PAID");
    await makeOrder(alice.id, second.id, "COMPLETED", "PAID");
    await makeOrder(bob.id, published.id, "COMPLETED", "PENDING"); // completed, unpaid
    await makeOrder(carol.id, published.id, "REFUNDED", "REFUNDED"); // refunded
    await makeOrder(gina.id, published.id, "PROCESSING", "PAID"); // paid, never completed
    await makeOrder(dave.id, second.id, "PENDING", "PENDING"); // a pending order for a different product
    const leoOrder = await makeOrder(leo.id, published.id, "COMPLETED", "PAID");
    for (const buyer of [erin, hank, ivan, kate, olga, pat, quin, rita]) {
      await makeOrder(buyer.id, published.id, "COMPLETED", "PAID");
    }
    await makeOrder(pat.id, second.id, "COMPLETED", "PAID");
    await makeOrder(quin.id, second.id, "COMPLETED", "PAID");

    const projectCount = (where: { userId?: string; productId?: string } = {}) =>
      prisma.customerProject.count({ where: { ...where, user: { email: { startsWith: RUN } } } });

    async function makeProject(user: { id: string }, productId: string, overrides: Resource = {}) {
      const imageKey = upload(storage.buildKey(user.id), overrides);
      const result = await createProjectForSession({ productId, imageKey, caption: "Fixture project" }, as(user));
      if (!result.ok) throw new Error(`fixture project could not be created: ${result.code}`);
      return { id: result.data.id, key: imageKey };
    }

    // ----------------------------------------------------------- harness safety
    console.log("\nHarness safety");
    check("production credentials are absent from this process", REMOVED_CREDENTIALS.every((name) => process.env[name] === undefined));
    check("real Cloudinary storage is unconfigured in this process", customerProjectStorage.isConfigured === false);
    check("the project limiter is not using Redis", throttle.projectThrottleUsesRedis === false);
    const unconfiguredVerify = await customerProjectStorage.verify(storage.buildKey(alice.id), alice.id);
    check("the real storage instance refuses without contacting Cloudinary", !unconfiguredVerify.ok && unconfiguredVerify.reason === "unavailable");

    // ------------------------------------------------------------ validation
    console.log("\nValidation — upload signing");
    for (const [label, value] of [
      ["empty string", ""],
      ["whitespace", "   "],
      ["over-long", "x".repeat(65)],
      ["number", 123],
      ["null", null],
      ["object", { id: published.id }],
    ] as const) {
      const result = await signProjectUploadForSession(uploadRequest(value), as(alice));
      check(`invalid productId (${label}) is rejected`, !result.ok && result.code === "invalid" && result.error === "That product isn't valid.");
    }
    const heic = await signProjectUploadForSession(uploadRequest(published.id, { contentType: "image/heic" }), as(alice));
    check("HEIC is rejected", !heic.ok && heic.error === "Only JPEG, PNG and WebP photos are supported.");
    const gif = await signProjectUploadForSession(uploadRequest(published.id, { contentType: "image/gif" }), as(alice));
    check("GIF is rejected", !gif.ok && gif.code === "invalid");
    const svg = await signProjectUploadForSession(uploadRequest(published.id, { contentType: "image/svg+xml" }), as(alice));
    check("SVG is rejected", !svg.ok && svg.code === "invalid");
    const oversizedClaim = await signProjectUploadForSession(uploadRequest(published.id, { bytes: 10 * 1024 * 1024 + 1 }), as(alice));
    check("a declared size over 10 MB is rejected early", !oversizedClaim.ok && oversizedClaim.error === "Photos must be 10 MB or smaller.");
    const emptyClaim = await signProjectUploadForSession(uploadRequest(published.id, { bytes: 0 }), as(alice));
    check("a declared empty file is rejected", !emptyClaim.ok && emptyClaim.code === "invalid");
    for (const key of ["folder", "public_id", "resource_type", "type", "transformation", "upload_preset", "userId", "status"]) {
      const result = await signProjectUploadForSession(uploadRequest(published.id, { [key]: "meemiart/products" }), as(alice));
      check(`a browser-chosen "${key}" is refused, not ignored`, !result.ok && result.code === "invalid");
    }
    check("no signature was produced by any invalid request", cloud.signatures === 0, String(cloud.signatures));

    // --------------------------------------------------------- authentication
    console.log("\nAuthentication");
    const signedOut = [
      await signProjectUploadForSession(uploadRequest(published.id), as(null)),
      await createProjectForSession({ productId: published.id, imageKey: storage.buildKey(alice.id) }, as(null)),
      await updateOwnProjectForSession({ projectId: "anything", caption: "x" }, as(null)),
      await deleteOwnProjectForSession({ projectId: "anything" }, as(null)),
    ];
    check("signed-out sign/create/update/delete are all refused with the sign-in prompt", signedOut.every((r) => !r.ok && r.code === "sign_in" && r.requiresSignIn === true));
    check("signed-out calls produce no signature and no project", cloud.signatures === 0 && (await projectCount()) === 0);

    // ------------------------------------------------------ product & purchase
    console.log("\nProduct and purchase");
    const missing = await signProjectUploadForSession(uploadRequest("cl_does_not_exist_000000000"), as(alice));
    check("nonexistent product is rejected", !missing.ok && missing.code === "unavailable");
    const hidden = await signProjectUploadForSession(uploadRequest(unpublished.id), as(alice));
    check("inactive product is rejected even though it was bought", !hidden.ok && hidden.code === "unavailable");
    check("nonexistent and inactive share one message", !missing.ok && !hidden.ok && missing.error === hidden.error);
    const unbought = await signProjectUploadForSession(uploadRequest(published.id), as(dave));
    check("a customer with no purchase of the product is rejected", !unbought.ok && unbought.code === "not_purchased");
    const pendingOrder = await signProjectUploadForSession(uploadRequest(second.id), as(dave));
    check("a PENDING, unpaid order is rejected", !pendingOrder.ok && pendingOrder.code === "not_purchased");
    const unpaid = await signProjectUploadForSession(uploadRequest(published.id), as(bob));
    check("a COMPLETED order without a PAID payment is rejected", !unpaid.ok && unpaid.code === "not_purchased");
    const incomplete = await signProjectUploadForSession(uploadRequest(published.id), as(gina));
    check("a PAID payment on an order that never completed is rejected", !incomplete.ok && incomplete.code === "not_purchased");
    const refunded = await signProjectUploadForSession(uploadRequest(published.id), as(carol));
    check("a refunded purchase is rejected", !refunded.ok && refunded.code === "not_purchased");
    const refundedCreate = await createProjectForSession(
      { productId: published.id, imageKey: upload(storage.buildKey(carol.id)) },
      as(carol),
    );
    check("a refunded purchase cannot create a project either", !refundedCreate.ok && refundedCreate.code === "not_purchased" && (await projectCount({ userId: carol.id })) === 0);
    check("no signature was produced for any ineligible customer", cloud.signatures === 0, String(cloud.signatures));

    // ------------------------------------------------------- signed parameters
    console.log("\nSigned upload parameters");
    const signed = await signProjectUploadForSession(uploadRequest(published.id), as(alice));
    check("a COMPLETED + PAID purchaser gets a signature", signed.ok);
    if (signed.ok) {
      const { fields, uploadUrl } = signed.data;
      check("public_id is inside the customer-projects folder", fields.public_id.startsWith(`${CUSTOMER_PROJECT_FOLDER}/`));
      check("public_id is never under the product folder", !fields.public_id.startsWith("meemiart/products"));
      check("public_id sits under this customer's own prefix", storage.isOwnedKey(fields.public_id, alice.id));
      check("public_id is not under any other customer's prefix", !storage.isOwnedKey(fields.public_id, erin.id));
      check("the upload is authenticated (private), not public", fields.type === "authenticated");
      check("only JPEG, PNG and WebP are allowed", fields.allowed_formats === "jpg,png,webp");
      check("overwrite is disabled", fields.overwrite === "false");
      check("the timestamp is current", Math.abs(Number(fields.timestamp) - Math.floor(clock / 1000)) <= 1);
      check("the signature and public API key are present", fields.signature === "test-signature" && fields.api_key === "test-key");
      check(
        "the browser is given no folder, transformation, resource type or preset to choose",
        ["folder", "transformation", "resource_type", "upload_preset", "eager", "notification_url"].every((k) => !(k in fields)),
      );
      check("the API secret never appears in the response", !JSON.stringify(signed.data).includes("test-secret"));
      check("the upload endpoint is the image endpoint of this account", uploadUrl === "https://api.cloudinary.com/v1_1/test-cloud/image/upload");
      check("the signed field set is exactly the expected one", JSON.stringify(Object.keys(fields).sort()) === JSON.stringify(["allowed_formats", "api_key", "overwrite", "public_id", "signature", "timestamp", "type"]));
    }
    const signedAgain = await signProjectUploadForSession(uploadRequest(published.id), as(alice));
    check("every signature names a new object", signed.ok && signedAgain.ok && signed.data.fields.public_id !== signedAgain.data.fields.public_id);
    const noStorage = createCustomerProjectStorage({ config: null, client: { resource: refuse, destroy: refuse, signRequest: refuse, signedUrl: refuse, list: refuse } });
    const unconfiguredSign = await signProjectUploadForSession(uploadRequest(published.id), as(alice, { storage: noStorage }));
    check("with storage unconfigured, signing is refused cleanly", !unconfiguredSign.ok && unconfiguredSign.code === "storage");

    // ------------------------------------------------------- first submission
    console.log("\nFirst submission");
    const key1 = upload(signed.ok ? signed.data.fields.public_id : storage.buildKey(alice.id), { format: "webp", width: 1200, height: 1600, bytes: 812_345 });
    const first = await createProjectForSession(
      { productId: published.id, imageKey: key1, caption: "  My first bunny <b>hi</b>  ", displayName: "  Sam  " },
      as(alice),
    );
    check("an eligible customer creates a project", first.ok && first.data.status === "PENDING");
    const row = first.ok ? await prisma.customerProject.findUnique({ where: { id: first.data.id } }) : null;
    check("the row belongs to the session user", row?.userId === alice.id);
    check("the row starts PENDING", row?.status === "PENDING");
    check("dimensions, size and format come from storage, not the request", row?.width === 1200 && row?.height === 1600 && row?.bytes === 812_345 && row?.format === "webp");
    check("caption is trimmed and kept as plain text", row?.caption === "My first bunny <b>hi</b>");
    check("display name is trimmed", row?.displayName === "Sam");
    check("no public URL and no moderation data exist yet", row?.imageUrl === null && row?.moderatedAt === null && row?.moderatedById === null && row?.rejectionReason === null);
    check("the verified photo was not destroyed", !destroyedKey(key1));

    // --------------------------------------------- status & identity protection
    console.log("\nStatus and identity protection");
    const key2 = upload(storage.buildKey(alice.id));
    for (const [label, extra] of [
      ["status APPROVED", { status: "APPROVED" }],
      ["another user id", { userId: erin.id }],
      ["moderatedById", { moderatedById: alice.id }],
      ["moderatedAt", { moderatedAt: new Date().toISOString() }],
      ["imageUrl", { imageUrl: "https://res.cloudinary.com/evil/image/upload/x.jpg" }],
      ["public_id", { public_id: "meemiart/products/x" }],
      ["resource_type", { resource_type: "raw" }],
      ["width", { width: 1 }],
      ["bytes", { bytes: 1 }],
      ["format", { format: "png" }],
      ["rating", { rating: 5 }],
    ] as const) {
      const result = await createProjectForSession({ productId: published.id, imageKey: key2, ...extra }, as(alice));
      check(`a payload carrying ${label} is refused`, !result.ok && result.code === "invalid");
    }
    const urlAsKey = await createProjectForSession({ productId: published.id, imageKey: "https://res.cloudinary.com/test-cloud/image/upload/x.jpg" }, as(alice));
    check("an arbitrary Cloudinary URL in place of a key is refused", !urlAsKey.ok && urlAsKey.code === "invalid");
    check("none of those created a project", (await projectCount({ userId: alice.id })) === 1);
    const stolen = await createProjectForSession({ productId: published.id, imageKey: key2 }, as(erin));
    check("another customer cannot submit this customer's upload", !stolen.ok && stolen.code === "invalid");
    check("and the owner's upload is left untouched", cloud.resources.has(key2) && !destroyedKey(key2));

    console.log("\nCaption and display name");
    const bell = String.fromCharCode(7);
    for (const [label, payload] of [
      ["caption of 501 characters", { caption: "a".repeat(501) }],
      ["caption with a control character", { caption: `hello${bell}` }],
      ["display name of 41 characters", { displayName: "a".repeat(41) }],
      ["display name with a control character", { displayName: `Sam${bell}` }],
      ["display name that is an email address", { displayName: "sam@example.com" }],
      ["display name over two lines", { displayName: "Sam\nSmith" }],
    ] as const) {
      const result = await createProjectForSession({ productId: published.id, imageKey: key2, ...payload }, as(alice));
      check(`${label} is rejected`, !result.ok && result.code === "invalid", !result.ok ? result.error : "accepted");
    }

    // --------------------------------------------------- duplicates & claimed
    console.log("\nDuplicates");
    const resourceCallsBefore = cloud.resourceCalls;
    const duplicate = await createProjectForSession({ productId: published.id, imageKey: key1 }, as(alice));
    check("submitting an already-claimed photo again is refused", !duplicate.ok && duplicate.code === "conflict");
    check("an already-claimed photo is refused before Cloudinary is asked", cloud.resourceCalls === resourceCallsBefore);
    check("an already-claimed photo is never destroyed", cloud.resources.has(key1) && !destroyedKey(key1));
    check("still exactly one project", (await projectCount({ userId: alice.id })) === 1);

    // ---------------------------------------------------- upload verification
    console.log("\nUpload verification");
    const noNetworkKeys = [
      "meemiart/products/some-product-image",
      `${CUSTOMER_PROJECT_FOLDER}/../products/abc`,
      "random-string",
      `${CUSTOMER_PROJECT_FOLDER}/${"a".repeat(32)}/abc`,
      storage.buildKey(alice.id).toUpperCase(),
      `${storage.buildKey(alice.id)}/extra`,
    ];
    const callsBefore = cloud.resourceCalls;
    const destroyedBefore = cloud.destroyed.length;
    for (const imageKey of noNetworkKeys) {
      const result = await createProjectForSession({ productId: published.id, imageKey }, as(alice));
      check(`malformed key is refused: ${imageKey.slice(0, 48)}`, !result.ok && result.code === "invalid");
    }
    check("malformed keys never reach Cloudinary and destroy nothing", cloud.resourceCalls === callsBefore && cloud.destroyed.length === destroyedBefore);

    const expectRejected = async (label: string, overrides: Resource, expected: string) => {
      const key = upload(storage.buildKey(alice.id), overrides);
      const result = await createProjectForSession({ productId: published.id, imageKey: key }, as(alice));
      check(`${label} is rejected`, !result.ok && result.error === expected, !result.ok ? result.error : "accepted");
      check(`${label} is destroyed`, destroyedKey(key) && !cloud.resources.has(key));
    };
    const UNUSABLE = "That upload couldn't be used. Please upload your photo again.";
    await expectRejected("a GIF", { format: "gif" }, "Only JPEG, PNG and WebP photos are supported.");
    await expectRejected("a HEIC", { format: "heic" }, "Only JPEG, PNG and WebP photos are supported.");
    await expectRejected("a PDF reported as an image", { format: "pdf" }, "Only JPEG, PNG and WebP photos are supported.");
    await expectRejected("an asset over 10 MB", { bytes: 10 * 1024 * 1024 + 1 }, "Photos must be 10 MB or smaller.");
    await expectRejected("a zero-byte asset", { bytes: 0 }, "Photos must be 10 MB or smaller.");
    await expectRejected("a 200×200 image", { width: 200, height: 200 }, "Photos must be at least 300 pixels on each side.");
    await expectRejected("a 20000px image", { width: 20_000, height: 3000 }, "Photos must be at least 300 pixels on each side.");
    await expectRejected("an upload landing after the signing window", { created_at: new Date(clock + (PROJECT_UPLOAD_WINDOW_SECONDS + 120) * 1000).toISOString() }, UNUSABLE);
    await expectRejected("an upload claiming to predate its signature", { created_at: new Date(clock - 10 * 60 * 1000).toISOString() }, UNUSABLE);
    await expectRejected("a mismatched public_id", { public_id: "meemiart/customer-projects/other" }, UNUSABLE);

    const staleKey = upload(storage.buildKey(alice.id));
    offset = (PROJECT_FINALIZE_WINDOW_SECONDS + 60) * 1000;
    const stale = await createProjectForSession({ productId: published.id, imageKey: staleKey }, as(alice));
    offset = 0;
    check("a valid upload submitted after the finalize window is rejected", !stale.ok && stale.error === UNUSABLE);
    check("and the stale upload is destroyed", destroyedKey(staleKey) && !cloud.resources.has(staleKey));

    const rawKey = upload(storage.buildKey(alice.id), { resource_type: "raw", format: "" });
    const raw = await createProjectForSession({ productId: published.id, imageKey: rawKey }, as(alice));
    check("a file sent to the raw endpoint is rejected (wrong resource type)", !raw.ok && raw.code === "invalid");
    check("and removed from the folder", cloud.destroyed.includes(`raw:${rawKey}`) && !cloud.resources.has(rawKey));
    const publicKey = upload(storage.buildKey(alice.id), { type: "upload" });
    const publicType = await createProjectForSession({ productId: published.id, imageKey: publicKey }, as(alice));
    check("a public (upload-type) asset is rejected (wrong delivery type)", !publicType.ok && publicType.code === "invalid");
    const neverUploaded = await createProjectForSession({ productId: published.id, imageKey: storage.buildKey(alice.id) }, as(alice));
    check("a key with nothing uploaded is rejected", !neverUploaded.ok && neverUploaded.code === "invalid");
    const outageKey = upload(storage.buildKey(alice.id));
    cloud.failLookups = true;
    const outage = await createProjectForSession({ productId: published.id, imageKey: outageKey }, as(alice));
    cloud.failLookups = false;
    check("a storage outage is reported as unavailable", !outage.ok && outage.code === "storage");
    check("a storage outage destroys nothing", cloud.resources.has(outageKey) && !destroyedKey(outageKey));
    check("no rejected upload created a project", (await projectCount({ userId: alice.id })) === 1);

    // ------------------------------------------------------------- the cap
    console.log("\nThree-project limit");
    const keyC = storage.buildKey(alice.id); // signed earlier, uploaded later
    const second2 = await createProjectForSession({ productId: published.id, imageKey: key2, caption: "Second" }, as(alice));
    const third = await createProjectForSession({ productId: published.id, imageKey: upload(storage.buildKey(alice.id)) }, as(alice));
    check("second and third projects for the same product are allowed", second2.ok && third.ok);
    check("the customer now has exactly three", (await projectCount({ userId: alice.id, productId: published.id })) === MAX_PROJECTS_PER_PRODUCT);
    const signAtCap = await signProjectUploadForSession(uploadRequest(published.id), as(alice));
    check("signing a fourth upload is refused", !signAtCap.ok && signAtCap.code === "limit");
    upload(keyC);
    const fourth = await createProjectForSession({ productId: published.id, imageKey: keyC }, as(alice));
    check("a fourth active project is refused", !fourth.ok && fourth.code === "limit");
    // Refused at the cap check, before the key is compared with existing
    // projects — so nothing may be destroyed there. An unclaimed upload left
    // behind is for the abandoned-upload sweep, not for this request.
    check("a refusal at the cap check destroys nothing", !destroyedKey(keyC) && cloud.resources.has(keyC));
    const claimedAtCap = await createProjectForSession({ productId: published.id, imageKey: key2 }, as(alice));
    check("resubmitting an already-claimed photo at the cap destroys nothing", !claimedAtCap.ok && !destroyedKey(key2) && cloud.resources.has(key2));
    check("still exactly three", (await projectCount({ userId: alice.id, productId: published.id })) === 3);
    const otherProduct = await signProjectUploadForSession(uploadRequest(second.id), as(alice));
    check("the cap is per product", otherProduct.ok);

    console.log("\nCap policy — REJECTED frees a slot, HIDDEN does not");
    const r1 = await makeProject(rita, published.id);
    const r2 = await makeProject(rita, published.id);
    const r3 = await makeProject(rita, published.id);
    const ritaFull = await signProjectUploadForSession(uploadRequest(published.id), as(rita));
    check("three active projects fill the cap", !ritaFull.ok && ritaFull.code === "limit");
    const ritaReject = await rejectProjectAsAdmin({ projectId: r1.id, reason: "Photo is too dark to see the work." }, asAdmin(mona));
    check("an admin rejects one of them", ritaReject.ok);
    const afterReject = await signProjectUploadForSession(uploadRequest(published.id), as(rita));
    check("a rejected project does not consume a slot", afterReject.ok);
    const r4 = await createProjectForSession({ productId: published.id, imageKey: upload(storage.buildKey(rita.id)) }, as(rita));
    check("so a replacement project can be submitted", r4.ok);
    const r5 = await createProjectForSession({ productId: published.id, imageKey: upload(storage.buildKey(rita.id)) }, as(rita));
    check("but not a fourth active one", !r5.ok && r5.code === "limit");
    const ritaHide = await hideProjectAsAdmin({ projectId: r2.id }, asAdmin(mona));
    const afterHide = await signProjectUploadForSession(uploadRequest(published.id), as(rita));
    check("a hidden project still occupies its slot", ritaHide.ok && !afterHide.ok && afterHide.code === "limit");
    const resubmitAtCap = await updateOwnProjectForSession({ projectId: r1.id, caption: "Brighter photo" }, as(rita));
    const r1Row = await prisma.customerProject.findUnique({ where: { id: r1.id } });
    check("editing a rejected project back into the queue needs a free slot", !resubmitAtCap.ok && resubmitAtCap.code === "limit" && r1Row?.status === "REJECTED");
    const ritaDelete = await deleteOwnProjectForSession({ projectId: r3.id }, as(rita));
    const resubmit = await updateOwnProjectForSession({ projectId: r1.id, caption: "Brighter photo" }, as(rita));
    const r1After = await prisma.customerProject.findUnique({ where: { id: r1.id } });
    check("with a slot free, the rejected project re-enters the queue as PENDING", ritaDelete.ok && resubmit.ok && r1After?.status === "PENDING" && r1After.rejectionReason === null && r1After.moderatedById === null);

    // ------------------------------------------------------------ concurrency
    console.log("\nConcurrency — submissions");
    const kateKeys = Array.from({ length: 10 }, () => upload(storage.buildKey(kate.id)));
    const burst = await Promise.all(kateKeys.map((imageKey) => createProjectForSession({ productId: published.id, imageKey }, as(kate))));
    const burstOk = burst.filter((r) => r.ok).length;
    check("10 concurrent submissions at the cap boundary: exactly 3 succeed", burstOk === 3, String(burstOk));
    check("the other 7 hit the cap", burst.filter((r) => !r.ok && r.code === "limit").length === 7);
    check("the database holds exactly 3", (await projectCount({ userId: kate.id })) === 3);
    check("every surplus upload was destroyed", kateKeys.filter((k) => destroyedKey(k)).length === 7);
    const claimedKeys = await prisma.customerProject.findMany({ where: { userId: kate.id }, select: { imageKey: true } });
    check("no photo is claimed twice", new Set(claimedKeys.map((k) => k.imageKey)).size === claimedKeys.length);

    const hankKey = upload(storage.buildKey(hank.id));
    const sameKey = await Promise.all(Array.from({ length: 5 }, () => createProjectForSession({ productId: published.id, imageKey: hankKey }, as(hank))));
    check("5 concurrent submissions of one photo: exactly one succeeds", sameKey.filter((r) => r.ok).length === 1);
    check("the rest are refused as already submitted", sameKey.filter((r) => !r.ok && r.code === "conflict").length === 4);
    check("exactly one project exists for that photo", (await prisma.customerProject.count({ where: { imageKey: hankKey } })) === 1);
    check("the claimed photo was not destroyed", !destroyedKey(hankKey));

    // --------------------------------------------------- ownership & editing
    console.log("\nOwnership and customer edits");
    const aliceProject = second2.ok ? second2.data.id : "";
    const erinEdits = await updateOwnProjectForSession({ projectId: aliceProject, caption: "Hijacked" }, as(erin));
    check("customer A cannot edit customer B's project", !erinEdits.ok && erinEdits.code === "not_found");
    const erinDeletes = await deleteOwnProjectForSession({ projectId: aliceProject }, as(erin));
    check("customer A cannot delete customer B's project", !erinDeletes.ok && erinDeletes.code === "not_found");
    const untouched = await prisma.customerProject.findUnique({ where: { id: aliceProject } });
    check("the owner's project is unchanged", untouched?.caption === "Second" && untouched.userId === alice.id);
    check("the owner's photo was not destroyed", !destroyedKey(key2));

    for (const [label, extra] of [
      ["status", { status: "APPROVED" }],
      ["productId", { productId: second.id }],
      ["imageKey", { imageKey: storage.buildKey(alice.id) }],
      ["userId", { userId: erin.id }],
      ["moderatedById", { moderatedById: mona.id }],
      ["moderatedAt", { moderatedAt: new Date().toISOString() }],
      ["rejectionReason", { rejectionReason: "none" }],
      ["imageUrl", { imageUrl: "https://example.com/x.jpg" }],
    ] as const) {
      const result = await updateOwnProjectForSession({ projectId: aliceProject, caption: "x", ...extra }, as(alice));
      check(`an edit cannot change ${label}`, !result.ok && result.code === "invalid");
    }
    const stillSame = await prisma.customerProject.findUnique({ where: { id: aliceProject } });
    check("refused edits changed nothing", stillSame?.caption === "Second" && stillSame.productId === published.id && stillSame.imageKey === key2 && stillSame.userId === alice.id);
    const emptyEdit = await updateOwnProjectForSession({ projectId: aliceProject }, as(alice));
    check("an edit with nothing to change is refused", !emptyEdit.ok && emptyEdit.code === "invalid");

    await prisma.customerProject.update({
      where: { id: aliceProject },
      data: { status: "APPROVED", moderatedAt: new Date(), moderatedById: mona.id, imageUrl: "https://res.cloudinary.com/test-cloud/image/authenticated/s--x--/placeholder.jpg" },
    });
    const captionEdit = await updateOwnProjectForSession({ projectId: aliceProject, caption: "Second, re-worded" }, as(alice));
    const afterCaption = await prisma.customerProject.findUnique({ where: { id: aliceProject } });
    check("the owner can edit their caption", captionEdit.ok && afterCaption?.caption === "Second, re-worded");
    check(
      "an edit resets moderation: PENDING, no moderator, no reason, no public reference",
      afterCaption?.status === "PENDING" && afterCaption.moderatedAt === null && afterCaption.moderatedById === null && afterCaption.rejectionReason === null && afterCaption.imageUrl === null,
    );
    check("an edit keeps owner, product and photo", afterCaption?.userId === alice.id && afterCaption.productId === published.id && afterCaption.imageKey === key2);
    const nameEdit = await updateOwnProjectForSession({ projectId: aliceProject, displayName: "  Sam S.  " }, as(alice));
    const afterName = await prisma.customerProject.findUnique({ where: { id: aliceProject } });
    check("the owner can edit their display name", nameEdit.ok && afterName?.displayName === "Sam S." && afterName.caption === "Second, re-worded");
    const clearName = await updateOwnProjectForSession({ projectId: aliceProject, displayName: "" }, as(alice));
    check("an empty display name clears it", clearName.ok && (await prisma.customerProject.findUnique({ where: { id: aliceProject } }))?.displayName === null);

    // --------------------------------------------------------- customer delete
    console.log("\nCustomer delete");
    const ownDelete = await deleteOwnProjectForSession({ projectId: aliceProject }, as(alice));
    check("the owner can delete their project", ownDelete.ok && (await prisma.customerProject.count({ where: { id: aliceProject } })) === 0);
    check("deleting a project removes its photo, scoped to that key", destroyedKey(key2) && !cloud.resources.has(key2));
    const deleteAgain = await deleteOwnProjectForSession({ projectId: aliceProject }, as(alice));
    check("deleting it again reads as not found", !deleteAgain.ok && deleteAgain.code === "not_found");

    const o1 = await makeProject(olga, published.id);
    cloud.resources.delete(o1.key);
    const missingAsset = await deleteOwnProjectForSession({ projectId: o1.id }, as(olga));
    check("a project whose photo is already gone still deletes", missingAsset.ok && (await prisma.customerProject.count({ where: { id: o1.id } })) === 0);

    const o2 = await makeProject(olga, published.id);
    cloud.failDestroy = true;
    const destroyFails = await deleteOwnProjectForSession({ projectId: o2.id }, as(olga));
    cloud.failDestroy = false;
    check("if Cloudinary cannot remove the photo, the customer is told", !destroyFails.ok && destroyFails.code === "storage");
    check("and the project is kept, still pointing at its photo", (await prisma.customerProject.count({ where: { id: o2.id } })) === 1 && cloud.resources.has(o2.key));
    const retry = await deleteOwnProjectForSession({ projectId: o2.id }, as(olga));
    check("a retry after the failure completes", retry.ok && (await prisma.customerProject.count({ where: { id: o2.id } })) === 0 && !cloud.resources.has(o2.key));

    const o3 = await makeProject(olga, published.id);
    const failingRowDelete = new Proxy(prisma.customerProject, {
      get(target, prop) {
        if (prop === "deleteMany") return () => Promise.reject(leaky);
        const value = Reflect.get(target, prop);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    const dbDeleteFails = {
      product: prisma.product,
      orderItem: prisma.orderItem,
      customerProject: failingRowDelete,
      $transaction: prisma.$transaction.bind(prisma),
    } as unknown as Deps["db"];
    const { value: rowFails, logged: rowFailLog } = await captureErrors(() => deleteOwnProjectForSession({ projectId: o3.id }, as(olga, { db: dbDeleteFails })));
    check("if the row delete fails after the photo is gone, a generic failure is returned", !rowFails.ok && rowFails.code === "failed" && !LEAK.test(JSON.stringify(rowFails) + rowFailLog.join("")));
    const recovered = await deleteOwnProjectForSession({ projectId: o3.id }, as(olga));
    check("and a retry recovers: the photo is already absent, the row is removed", recovered.ok && (await prisma.customerProject.count({ where: { id: o3.id } })) === 0);

    const o4 = await makeProject(olga, published.id);
    const erinOwned = upload(storage.buildKey(erin.id));
    await prisma.customerProject.update({ where: { id: o4.id }, data: { imageKey: erinOwned } });
    let lookups = cloud.resourceCalls;
    let destroys = cloud.destroyed.length;
    const { value: foreignStored } = await captureErrors(() => deleteOwnProjectForSession({ projectId: o4.id }, as(olga)));
    check("a row carrying another customer's key is refused", !foreignStored.ok);
    check("with no Cloudinary request and no database change", cloud.resourceCalls === lookups && cloud.destroyed.length === destroys && (await prisma.customerProject.count({ where: { id: o4.id } })) === 1 && cloud.resources.has(erinOwned));
    await prisma.customerProject.update({ where: { id: o4.id }, data: { imageKey: `meemiart/products/${RUN}-not-a-project` } });
    lookups = cloud.resourceCalls;
    destroys = cloud.destroyed.length;
    const { value: malformedStored } = await captureErrors(() => deleteOwnProjectForSession({ projectId: o4.id }, as(olga)));
    check("a row carrying a malformed key is refused with no Cloudinary request and no database change", !malformedStored.ok && cloud.resourceCalls === lookups && cloud.destroyed.length === destroys && (await prisma.customerProject.count({ where: { id: o4.id } })) === 1);
    await prisma.customerProject.delete({ where: { id: o4.id } });

    const o5 = await makeProject(olga, published.id);
    const concurrentDeletes = await Promise.all(Array.from({ length: 5 }, () => deleteOwnProjectForSession({ projectId: o5.id }, as(olga))));
    check("5 concurrent deletes of one project never error", concurrentDeletes.every((r) => r.ok || r.code === "not_found"));
    check("at least one succeeds, and the project and photo are gone", concurrentDeletes.some((r) => r.ok) && (await prisma.customerProject.count({ where: { id: o5.id } })) === 0 && !cloud.resources.has(o5.key));

    // ------------------------------------------------------ admin moderation
    console.log("\nAdmin moderation — authorisation");
    const p1 = await makeProject(ivan, published.id);
    const denied = [
      await approveProjectAsAdmin({ projectId: p1.id }, asAdmin(alice)),
      await rejectProjectAsAdmin({ projectId: p1.id, reason: "Not allowed here" }, asAdmin(alice)),
      await hideProjectAsAdmin({ projectId: p1.id }, asAdmin(alice)),
      await approveProjectAsAdmin({ projectId: p1.id }, asAdmin(null)),
    ];
    check("a customer (or a signed-out caller) cannot approve, reject or hide", denied.every((r) => !r.ok && r.code === "forbidden"));
    const demoted = await approveProjectAsAdmin({ projectId: p1.id }, asAdmin(nate));
    check("a user whose database role is not ADMIN is refused", !demoted.ok && demoted.code === "forbidden");
    await prisma.user.update({ where: { id: nate.id }, data: { role: "ADMIN" } });
    const promotedHide = await hideProjectAsAdmin({ projectId: (await makeProject(pat, published.id)).id }, asAdmin(nate));
    await prisma.user.update({ where: { id: nate.id }, data: { role: "CUSTOMER" } });
    const revoked = await approveProjectAsAdmin({ projectId: p1.id }, asAdmin(nate));
    check("the role is re-read from the database on every call", promotedHide.ok && !revoked.ok && revoked.code === "forbidden");
    const brokenRole = { ...asAdmin(mona), db: { user: { findUnique: () => Promise.reject(leaky) }, customerProject: prisma.customerProject, orderItem: prisma.orderItem } as unknown as ModDeps["db"] };
    const roleFailure = await approveProjectAsAdmin({ projectId: p1.id }, brokenRole);
    check("failing to read the role is denial", !roleFailure.ok && roleFailure.code === "forbidden");
    check("the project is still PENDING after every refusal", (await prisma.customerProject.findUnique({ where: { id: p1.id } }))?.status === "PENDING");

    console.log("\nAdmin moderation — approve");
    for (const [label, payload] of [
      ["an imageUrl", { projectId: p1.id, imageUrl: "https://evil.example/x.jpg" }],
      ["a status", { projectId: p1.id, status: "APPROVED" }],
      ["a moderator id", { projectId: p1.id, moderatedById: alice.id }],
      ["a replacement key", { projectId: p1.id, imageKey: storage.buildKey(ivan.id) }],
    ] as const) {
      const result = await approveProjectAsAdmin(payload, asAdmin(mona));
      check(`an approval carrying ${label} is refused`, !result.ok && result.code === "invalid");
    }
    const approved = await approveProjectAsAdmin({ projectId: p1.id }, asAdmin(mona));
    const p1Row = await prisma.customerProject.findUnique({ where: { id: p1.id } });
    check("an admin approves a project with a successful purchase", approved.ok && approved.data.status === "APPROVED");
    check("approval records the moderator and time and clears any reason", p1Row?.status === "APPROVED" && p1Row.moderatedById === mona.id && p1Row.moderatedAt !== null && p1Row.rejectionReason === null);
    check("approval does not publish: no public reference is set", p1Row?.imageUrl === null && approved.ok && approved.data.published === false);
    check("approval keeps the original photo key and never touches Cloudinary beyond a lookup", p1Row?.imageKey === p1.key && cloud.resources.has(p1.key) && !destroyedKey(p1.key));
    const approvedLog = await prisma.adminActivity.findMany({ where: { entityType: "project", entityId: p1.id } });
    check("AdminActivity records project.approved by the admin", approvedLog.length === 1 && approvedLog[0].action === "project.approved" && approvedLog[0].actorId === mona.id);
    check("the activity meta carries no email, user id, key or signature", !/example\.invalid|@|signature|meemiart\/customer-projects/.test(JSON.stringify(approvedLog[0].meta)) && !JSON.stringify(approvedLog[0].meta).includes(ivan.id));
    const approveTwice = await approveProjectAsAdmin({ projectId: p1.id }, asAdmin(mona));
    check("approving an approved project is an invalid transition", !approveTwice.ok && approveTwice.code === "invalid_transition");

    console.log("\nAdmin moderation — hide and reject");
    const hid = await hideProjectAsAdmin({ projectId: p1.id }, asAdmin(mona));
    const hiddenRow = await prisma.customerProject.findUnique({ where: { id: p1.id } });
    check("an approved project can be hidden, with moderation metadata", hid.ok && hiddenRow?.status === "HIDDEN" && hiddenRow.moderatedById === mona.id && hiddenRow.imageUrl === null);
    check("hiding is recorded as project.hidden", (await prisma.adminActivity.count({ where: { entityId: p1.id, action: "project.hidden" } })) === 1);
    for (const [label, run] of [
      ["approve a hidden project", () => approveProjectAsAdmin({ projectId: p1.id }, asAdmin(mona))],
      ["hide a hidden project", () => hideProjectAsAdmin({ projectId: p1.id }, asAdmin(mona))],
      ["reject a hidden project", () => rejectProjectAsAdmin({ projectId: p1.id, reason: "Changed my mind" }, asAdmin(mona))],
    ] as const) {
      const result = await run();
      check(`cannot ${label}`, !result.ok && result.code === "invalid_transition");
    }
    const p2 = await makeProject(ivan, published.id);
    for (const [label, payload] of [
      ["no reason", { projectId: p2.id }],
      ["a two-character reason", { projectId: p2.id, reason: "no" }],
      ["a reason of 501 characters", { projectId: p2.id, reason: "a".repeat(501) }],
      ["an HTML reason", { projectId: p2.id, reason: "<script>alert(1)</script>" }],
      ["a reason with a control character", { projectId: p2.id, reason: `Blurry${bell}` }],
      ["a reason plus a status", { projectId: p2.id, reason: "Blurry photo", status: "APPROVED" }],
    ] as const) {
      const result = await rejectProjectAsAdmin(payload, asAdmin(mona));
      check(`a rejection with ${label} is refused`, !result.ok && result.code === "invalid");
    }
    const rejected = await rejectProjectAsAdmin({ projectId: p2.id, reason: "  The photo is too blurry to see the stitches.  " }, asAdmin(mona));
    const p2Row = await prisma.customerProject.findUnique({ where: { id: p2.id } });
    check("a pending project can be rejected with a reason", rejected.ok && p2Row?.status === "REJECTED" && p2Row.rejectionReason === "The photo is too blurry to see the stitches.");
    check("rejection records moderation metadata and keeps the photo private", p2Row?.moderatedById === mona.id && p2Row.moderatedAt !== null && p2Row.imageUrl === null && cloud.resources.has(p2.key));
    const rejectLog = await prisma.adminActivity.findFirst({ where: { entityId: p2.id, action: "project.rejected" } });
    check("rejection is recorded as project.rejected with the reason", rejectLog?.actorId === mona.id && JSON.stringify(rejectLog.meta).includes("too blurry"));
    const approveRejected = await approveProjectAsAdmin({ projectId: p2.id }, asAdmin(mona));
    check("a rejected project cannot be approved directly", !approveRejected.ok && approveRejected.code === "invalid_transition");
    const p3 = await makeProject(ivan, published.id);
    await approveProjectAsAdmin({ projectId: p3.id }, asAdmin(mona));
    const rejectApproved = await rejectProjectAsAdmin({ projectId: p3.id, reason: "Reported as not the customer's own work." }, asAdmin(mona));
    check("an approved project can be rejected", rejectApproved.ok && (await prisma.customerProject.findUnique({ where: { id: p3.id } }))?.status === "REJECTED");
    const unknown = await approveProjectAsAdmin({ projectId: "cl_does_not_exist_000000000" }, asAdmin(mona));
    check("moderating a missing project is refused", !unknown.ok && unknown.code === "not_found");
    check(
      "the transition table is exactly the documented one",
      JSON.stringify(PROJECT_MODERATION_TRANSITIONS) === JSON.stringify({ approve: ["PENDING"], reject: ["PENDING", "APPROVED"], hide: ["PENDING", "APPROVED"] }),
    );

    console.log("\nAdmin moderation — approval-time re-checks");
    const leoProject = await makeProject(leo, published.id);
    await prisma.order.update({ where: { id: leoOrder.id }, data: { status: "REFUNDED", refundedAt: new Date() } });
    await prisma.payment.update({ where: { orderId: leoOrder.id }, data: { status: "REFUNDED", refundedAt: new Date() } });
    const refundedApproval = await approveProjectAsAdmin({ projectId: leoProject.id }, asAdmin(mona));
    check("a purchase refunded since submission cannot be approved", !refundedApproval.ok && refundedApproval.code === "not_eligible");
    check("the refusal says nothing about orders, payments or refunds", !refundedApproval.ok && !/order|payment|refund|paid/i.test(refundedApproval.error));
    check("the refunded project stays PENDING with no activity", (await prisma.customerProject.findUnique({ where: { id: leoProject.id } }))?.status === "PENDING" && (await prisma.adminActivity.count({ where: { entityId: leoProject.id } })) === 0);

    const aliceSecond = await makeProject(alice, second.id);
    await prisma.product.update({ where: { id: second.id }, data: { isActive: false } });
    const inactiveApproval = await approveProjectAsAdmin({ projectId: aliceSecond.id }, asAdmin(mona));
    await prisma.product.update({ where: { id: second.id }, data: { isActive: true } });
    check("a project for an inactive product cannot be approved", !inactiveApproval.ok && inactiveApproval.code === "unavailable");

    const patMissing = await makeProject(pat, published.id);
    cloud.resources.delete(patMissing.key);
    const missingApproval = await approveProjectAsAdmin({ projectId: patMissing.id }, asAdmin(mona));
    check("a project whose photo is missing cannot be approved", !missingApproval.ok && missingApproval.code === "asset");
    const patWrongType = await makeProject(pat, published.id);
    (cloud.resources.get(patWrongType.key) as Resource).type = "upload";
    const wrongTypeApproval = await approveProjectAsAdmin({ projectId: patWrongType.id }, asAdmin(mona));
    check("a photo that is no longer an authenticated asset cannot be approved", !wrongTypeApproval.ok && wrongTypeApproval.code === "asset");
    (cloud.resources.get(patWrongType.key) as Resource).type = "authenticated";
    (cloud.resources.get(patWrongType.key) as Resource).resource_type = "raw";
    const wrongResourceApproval = await approveProjectAsAdmin({ projectId: patWrongType.id }, asAdmin(mona));
    check("a photo stored as the wrong resource type cannot be approved", !wrongResourceApproval.ok && wrongResourceApproval.code === "asset");
    (cloud.resources.get(patWrongType.key) as Resource).resource_type = "image";
    (cloud.resources.get(patWrongType.key) as Resource).format = "gif";
    const wrongFormatApproval = await approveProjectAsAdmin({ projectId: patWrongType.id }, asAdmin(mona));
    check("a photo in a disallowed format cannot be approved", !wrongFormatApproval.ok && wrongFormatApproval.code === "asset");

    const foreignApprovalProject = await makeProject(quin, published.id);
    await prisma.customerProject.update({ where: { id: foreignApprovalProject.id }, data: { imageKey: upload(storage.buildKey(erin.id)) } });
    lookups = cloud.resourceCalls;
    const foreignApproval = await approveProjectAsAdmin({ projectId: foreignApprovalProject.id }, asAdmin(mona));
    check("a project whose key belongs to another customer cannot be approved", !foreignApproval.ok && foreignApproval.code === "asset" && cloud.resourceCalls === lookups);
    const patOutage = await makeProject(pat, second.id);
    cloud.failLookups = true;
    const outageApproval = await approveProjectAsAdmin({ projectId: patOutage.id }, asAdmin(mona));
    cloud.failLookups = false;
    check(
      "a storage outage blocks approval without changing the project",
      !outageApproval.ok && outageApproval.code === "storage" && (await prisma.customerProject.findUnique({ where: { id: patOutage.id } }))?.status === "PENDING",
    );

    console.log("\nAdmin moderation — concurrency and errors");
    const q1 = await makeProject(quin, published.id);
    const racing = await Promise.all([
      approveProjectAsAdmin({ projectId: q1.id }, asAdmin(mona)),
      approveProjectAsAdmin({ projectId: q1.id }, asAdmin(mona)),
      approveProjectAsAdmin({ projectId: q1.id }, asAdmin(mona)),
      hideProjectAsAdmin({ projectId: q1.id }, asAdmin(mona)),
      hideProjectAsAdmin({ projectId: q1.id }, asAdmin(mona)),
      rejectProjectAsAdmin({ projectId: q1.id, reason: "Concurrent rejection" }, asAdmin(mona)),
      rejectProjectAsAdmin({ projectId: q1.id, reason: "Concurrent rejection" }, asAdmin(mona)),
    ]);
    const raceSuccesses = racing.filter((r) => r.ok).length;
    const q1Row = await prisma.customerProject.findUnique({ where: { id: q1.id } });
    check("concurrent moderation only fails as conflict or invalid transition", racing.every((r) => r.ok || r.code === "conflict" || r.code === "invalid_transition"));
    check("the final state is a valid moderated state with a moderator", ["APPROVED", "HIDDEN", "REJECTED"].includes(String(q1Row?.status)) && q1Row?.moderatedById === mona.id);
    check("exactly one approval can have succeeded", racing.slice(0, 3).filter((r) => r.ok).length <= 1);
    check("every successful decision has exactly one activity entry", (await prisma.adminActivity.count({ where: { entityId: q1.id } })) === raceSuccesses && raceSuccesses >= 1);

    const brokenModerationDb = {
      user: prisma.user,
      orderItem: { findFirst: () => Promise.reject(leaky) },
      customerProject: { findUnique: () => Promise.reject(leaky), updateMany: () => Promise.reject(leaky) },
    } as unknown as ModDeps["db"];
    const { value: brokenModeration, logged: moderationLog } = await captureErrors(() =>
      Promise.all([
        approveProjectAsAdmin({ projectId: q1.id }, asAdmin(mona, { db: brokenModerationDb })),
        rejectProjectAsAdmin({ projectId: q1.id, reason: "Broken database" }, asAdmin(mona, { db: brokenModerationDb })),
        hideProjectAsAdmin({ projectId: q1.id }, asAdmin(mona, { db: brokenModerationDb })),
      ]),
    );
    check("moderation database failures return a generic result", brokenModeration.every((r) => !r.ok && r.code === "failed" && r.error === "Couldn't update that project."));
    check("and leak nothing into the result or log", !LEAK.test(JSON.stringify(brokenModeration) + moderationLog.join("\n")) && moderationLog.some((l) => l.includes("[projects] moderation") && l.includes("P1001")));

    // -------------------------------------------------------- public visibility
    console.log("\nPublic visibility");
    const v1 = await makeProject(quin, second.id);
    await approveProjectAsAdmin({ projectId: v1.id }, asAdmin(mona));
    check("approved projects are not public until an image is published", (await getPublicProjectsForProduct(second.id)).length === 0);
    await prisma.customerProject.update({ where: { id: v1.id }, data: { imageUrl: "https://res.cloudinary.com/test-cloud/image/authenticated/s--sig--/derived.jpg" } });
    const visible = await getPublicProjectsForProduct(second.id);
    check("an approved project with a published reference is public", visible.length === 1 && visible[0].id === v1.id);
    check("the public read selects only gallery fields — no user, email, key or moderation data", visible.length === 1 && JSON.stringify(Object.keys(visible[0]).sort()) === JSON.stringify(["caption", "createdAt", "displayName", "height", "id", "imageUrl", "width"]));
    await prisma.product.update({ where: { id: second.id }, data: { isActive: false } });
    check("projects of an inactive product are not public", (await getPublicProjectsForProduct(second.id)).length === 0);
    await prisma.product.update({ where: { id: second.id }, data: { isActive: true } });
    await hideProjectAsAdmin({ projectId: v1.id }, asAdmin(mona));
    const hiddenV1 = await prisma.customerProject.findUnique({ where: { id: v1.id } });
    check("hiding removes the public reference and the project from public reads", hiddenV1?.imageUrl === null && (await getPublicProjectsForProduct(second.id)).length === 0);
    check("pending, rejected and hidden projects are never public", (await getPublicProjectsForProduct(published.id)).length === 0);

    // ------------------------------------------------------------ rate limits
    console.log("\nRate limiting");
    const signaturesBefore = cloud.signatures;
    const limited = as(hank, { allowAttempt: async () => false });
    const limitedSign = await signProjectUploadForSession(uploadRequest(published.id), limited);
    const limitedCreate = await createProjectForSession({ productId: published.id, imageKey: upload(storage.buildKey(hank.id)) }, limited);
    check("a rate-limited customer is refused at signing and submission", !limitedSign.ok && limitedSign.code === "rate_limited" && !limitedCreate.ok && limitedCreate.code === "rate_limited");
    check("a refused attempt signs nothing and creates nothing", cloud.signatures === signaturesBefore && (await projectCount({ userId: hank.id })) === 1);

    const limiterUser = `${RUN}-limiter`;
    const signVerdicts = [];
    for (let i = 0; i < throttle.PROJECT_ATTEMPT_LIMITS.sign.limit + 1; i++) {
      signVerdicts.push(await throttle.allowProjectAttempt("sign", limiterUser));
    }
    check("the real limiter allows 20 signatures an hour, then refuses", signVerdicts.slice(0, 20).every(Boolean) && signVerdicts[20] === false);
    const submitVerdicts = [];
    for (let i = 0; i < throttle.PROJECT_ATTEMPT_LIMITS.submit.limit + 1; i++) {
      submitVerdicts.push(await throttle.allowProjectAttempt("submit", limiterUser));
    }
    check("the real limiter allows 10 submissions an hour, then refuses", submitVerdicts.slice(0, 10).every(Boolean) && submitVerdicts[10] === false);
    check("one customer's budget does not affect another's", await throttle.allowProjectAttempt("sign", `${limiterUser}-other`));
    const throttleSource = readFileSync("src/lib/projects/throttle.ts", "utf8");
    check("the limiter uses its own meemiart:projects keys only", throttleSource.includes("meemiart:projects:") && !throttleSource.includes("meemiart:assistant") && !throttleSource.includes("meemiart:login"));
    const assistantThrottle = readFileSync("src/lib/assistant/throttle.ts", "utf8");
    check(
      "the assistant limits are untouched (20 per 10 min, 600 per hour)",
      assistantThrottle.includes("const CLIENT_LIMIT = 20;") && assistantThrottle.includes("const CLIENT_WINDOW_SECONDS = 10 * 60;") && assistantThrottle.includes("const GLOBAL_LIMIT = 600;") && assistantThrottle.includes("const GLOBAL_WINDOW_SECONDS = 60 * 60;"),
    );

    // ------------------------------------------------------------ key safety
    console.log("\nStorage key safety");
    const destroyedBeforeRemove = cloud.destroyed.length;
    const lookupsBeforeRemove = cloud.resourceCalls;
    await storage.remove("meemiart/products/some-product-image");
    await storage.remove("meemiart/digital-files/some-pattern");
    await storage.remove("");
    const foreignOwned = await storage.removeOwned(storage.buildKey(erin.id), alice.id);
    const malformedOrphan = await storage.removeProjectAsset("meemiart/products/videos/some-video");
    check("remove, removeOwned and removeProjectAsset refuse foreign and malformed keys", !foreignOwned.ok && foreignOwned.reason === "not_owner" && !malformedOrphan.ok && malformedOrphan.reason === "invalid_key");
    check("and none of them called Cloudinary", cloud.destroyed.length === destroyedBeforeRemove && cloud.resourceCalls === lookupsBeforeRemove);
    const foreignInspect = await storage.inspect(storage.buildKey(erin.id), alice.id);
    check("inspect refuses another owner's key without a lookup", !foreignInspect.ok && foreignInspect.reason === "not_owner" && cloud.resourceCalls === lookupsBeforeRemove);
    check("a private preview URL is refused for a foreign key", storage.privatePreviewUrl("meemiart/products/x", "jpg") === null);
    const preview = storage.privatePreviewUrl(key1, "webp");
    check("a private preview URL is signed and authenticated", preview !== null && preview.includes("/image/authenticated/s--"));
    check("the folder constant is not the product folder", CUSTOMER_PROJECT_FOLDER === "meemiart/customer-projects");

    // ------------------------------------------------------ abandoned uploads
    console.log("\nAbandoned uploads");
    const sweep = createFakeCloud(2); // two per page, to exercise paging
    const nowSeconds = Math.floor(clock / 1000);
    const keyAged = (userId: string, secondsAgo: number) => {
      const fresh = sweep.storage.buildKey(userId);
      const parts = fresh.split("/");
      const nonce = parts[3].split("-")[1];
      return `${parts[0]}/${parts[1]}/${parts[2]}/${(nowSeconds - secondsAgo).toString(36)}-${nonce}`;
    };
    const aged = (key: string, secondsAgo: number, overrides: Resource = {}) =>
      uploadTo(sweep.state, key, { created_at: new Date(clock - secondsAgo * 1000 + 5_000).toISOString(), ...overrides });
    const orphanOld = aged(keyAged(ivan.id, 30 * HOUR), 30 * HOUR);
    const orphanOld2 = aged(keyAged(kate.id, 50 * HOUR), 50 * HOUR);
    const claimedOld = aged(keyAged(ivan.id, 40 * HOUR), 40 * HOUR);
    await prisma.customerProject.create({
      data: { userId: ivan.id, productId: second.id, imageKey: claimedOld, width: 1000, height: 1000, bytes: 1000, format: "jpg", status: "REJECTED" },
    });
    const recent = aged(keyAged(ivan.id, HOUR), HOUR);
    const oldKeyNewUpload = aged(keyAged(ivan.id, 30 * HOUR), 0);
    const notAProjectKey = aged(`${CUSTOMER_PROJECT_FOLDER}/readme`, 90 * HOUR);
    const productImage = uploadTo(sweep.state, "meemiart/products/some-product-image", { type: "upload", created_at: new Date(clock - 90 * HOUR * 1000).toISOString() });
    const productVideo = uploadTo(sweep.state, "meemiart/products/videos/some-video", { resource_type: "video", type: "upload", created_at: new Date(clock - 90 * HOUR * 1000).toISOString() });

    const scan = await scanProjectOrphans({ storage: sweep.storage, db: prisma, now: clock });
    check("the scan pages through the whole folder", scan.complete && scan.pages >= 3, `pages ${scan.pages}`);
    check("it lists only authenticated images under the customer-projects folder", scan.scanned === 6, String(scan.scanned));
    check("it finds exactly the two old, unclaimed, well-formed uploads", JSON.stringify(scan.orphans.map((o) => o.key).sort()) === JSON.stringify([orphanOld, orphanOld2].sort()));
    check("it leaves claimed, recent and malformed keys alone", scan.referenced === 1 && scan.tooRecent === 2 && scan.notProjectKeys === 1);
    const shortGrace = await scanProjectOrphans({ storage: sweep.storage, db: prisma, now: clock, graceSeconds: 60 });
    check("a grace period shorter than the submission window is not honoured", !shortGrace.orphans.some((o) => o.key === recent));

    const listingsBefore = sweep.state.listCalls;
    sweep.state.failListAfter = listingsBefore + 1;
    const brokenScan = await scanProjectOrphans({ storage: sweep.storage, db: prisma, now: clock });
    const refusedIncomplete = await deleteProjectOrphans({ keys: [orphanOld], storage: sweep.storage, db: prisma, now: clock });
    sweep.state.failListAfter = -1;
    check("a listing failure marks the scan incomplete", !brokenScan.complete);
    check("and an incomplete scan deletes nothing", refusedIncomplete.every((r) => r.outcome === "refused_scan_incomplete") && sweep.state.resources.has(orphanOld));

    const destroyedBeforeSweep = sweep.state.destroyed.length;
    const namedResults = await deleteProjectOrphans({
      keys: [orphanOld, claimedOld, recent, oldKeyNewUpload, notAProjectKey, "meemiart/products/some-product-image", "meemiart/products/videos/some-video"],
      storage: sweep.storage,
      db: prisma,
      now: clock,
    });
    const outcome = (key: string) => namedResults.find((r) => r.key === key)?.outcome;
    check("a named orphan is deleted and confirmed gone", outcome(orphanOld) === "deleted" && !sweep.state.resources.has(orphanOld));
    check(
      "claimed, recent, malformed, product and video keys are refused even when named",
      [claimedOld, recent, oldKeyNewUpload, notAProjectKey, "meemiart/products/some-product-image", "meemiart/products/videos/some-video"].every((k) => outcome(k) === "refused_not_an_orphan"),
    );
    check("only the orphan was destroyed", sweep.state.destroyed.length === destroyedBeforeSweep + 1 && sweep.state.destroyed.every((d) => !d.includes("meemiart/products")));
    check("product image, product video and claimed upload are still stored", sweep.state.resources.has(productImage) && sweep.state.resources.has(productVideo) && sweep.state.resources.has(claimedOld));
    check("an unnamed orphan is left alone", sweep.state.resources.has(orphanOld2));

    const racedDb = {
      customerProject: {
        findMany: () => Promise.resolve([]),
        findUnique: () => Promise.resolve({ id: "claimed-after-scan" }),
      },
    } as unknown as Parameters<typeof deleteProjectOrphans>[0]["db"];
    const raced = await deleteProjectOrphans({ keys: [orphanOld2], storage: sweep.storage, db: racedDb, now: clock });
    check("a key claimed between the scan and the delete is refused", raced[0]?.outcome === "refused_referenced" && sweep.state.resources.has(orphanOld2));
    sweep.state.failDestroy = true;
    const failedSweep = await deleteProjectOrphans({ keys: [orphanOld2], storage: sweep.storage, db: prisma, now: clock });
    sweep.state.failDestroy = false;
    check("a Cloudinary failure during the sweep is reported, not hidden", failedSweep[0]?.outcome === "failed" && sweep.state.resources.has(orphanOld2));
    const finishSweep = await deleteProjectOrphans({ keys: [orphanOld2], storage: sweep.storage, db: prisma, now: clock });
    check("a retry deletes it", finishSweep[0]?.outcome === "deleted" && !sweep.state.resources.has(orphanOld2));

    // ----------------------------------------------------------------- origin
    console.log("\nOrigin");
    check("a missing Origin is refused", !isSameOriginRequest(null, "www.meemiart.com"));
    check("a cross-site Origin is refused", !isSameOriginRequest("https://evil.example", "www.meemiart.com"));
    check("a look-alike Origin is refused", !isSameOriginRequest("https://www.meemiart.com.evil.example", "www.meemiart.com"));
    check("a malformed Origin is refused", !isSameOriginRequest("not a url", "www.meemiart.com"));
    check("a non-web scheme is refused", !isSameOriginRequest("file://www.meemiart.com", "www.meemiart.com"));
    check("a missing Host is refused", !isSameOriginRequest("https://www.meemiart.com", null));
    check("the site's own Origin is accepted", isSameOriginRequest("https://www.meemiart.com", "www.meemiart.com"));

    // ------------------------------------------------------ source structure
    console.log("\nSource structure");
    const stripComments = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    const firstStatementOf = (source: string) => source.replace(/^\s*(\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)\s*/g, "").trimStart();
    const exportedFunctions = (source: string) => [...source.matchAll(/export\s+(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/g)].map((m) => ({ name: m[1], params: m[2] }));

    for (const file of ["src/lib/projects/mutations.ts", "src/lib/projects/moderation.ts", "src/lib/projects/orphans.ts", "src/lib/projects/purchase.ts", "src/lib/storage/customer-projects.ts"]) {
      const source = readFileSync(file, "utf8");
      check(`${file} is server-only, not a server action`, source.includes('import "server-only"') && !/^["']use server["']/.test(firstStatementOf(source)));
    }
    const mutationExports = exportedFunctions(readFileSync("src/lib/projects/mutations.ts", "utf8"));
    const moderationExports = exportedFunctions(readFileSync("src/lib/projects/moderation.ts", "utf8"));
    check("no exported mutation or moderation function takes a user id", [...mutationExports, ...moderationExports].every((f) => !/userId/i.test(f.params)), [...mutationExports, ...moderationExports].map((f) => f.name).join(","));
    const paramNames = (params: string) =>
      params
        .split(",")
        .map((param) => param.trim().split(/[?:=\s]/)[0])
        .filter(Boolean);
    check(
      "no exported mutation or moderation function takes a status or moderator parameter",
      [...mutationExports, ...moderationExports].every((f) => paramNames(f.params).every((name) => !/status|moderat|userId/i.test(name))),
      [...mutationExports, ...moderationExports].map((f) => `${f.name}(${paramNames(f.params).join(",")})`).join(" "),
    );

    const customerActions = readFileSync("src/lib/actions/projects.ts", "utf8");
    const adminActions = readFileSync("src/lib/actions/admin/projects.ts", "utf8");
    check("customer actions are a server-action file exporting only update and delete", /^["']use server["']/.test(firstStatementOf(customerActions)) && JSON.stringify(exportedFunctions(customerActions).map((f) => f.name).sort()) === JSON.stringify(["deleteMyProject", "updateMyProject"]));
    check("customer actions accept no user id, status or moderator", !/userId|status|moderat|imageUrl|imageKey|productId/.test(stripComments(customerActions).replace(/status: "PENDING"/g, "")));
    check("admin actions export only approve, reject and hide", /^["']use server["']/.test(firstStatementOf(adminActions)) && JSON.stringify(exportedFunctions(adminActions).map((f) => f.name).sort()) === JSON.stringify(["approveProject", "hideProject", "rejectProject"]));
    check("admin actions pass no status, moderator or URL and never revalidate the homepage", !/status:|moderatedById|imageUrl/.test(stripComments(adminActions)) && !/revalidatePath\(\s*["']\/["']/.test(adminActions));

    check("the submission schema holds only product, key, caption and display name", JSON.stringify(Object.keys(validations.projectSubmissionSchema.shape).sort()) === JSON.stringify(["caption", "displayName", "imageKey", "productId"]));
    check("the edit schema holds only project id, caption and display name", JSON.stringify(Object.keys(validations.projectUpdateSchema.shape).sort()) === JSON.stringify(["caption", "displayName", "projectId"]));
    check("the moderation schemas hold only the project id (and a rejection reason)", JSON.stringify(Object.keys(validations.projectModerationSchema.shape)) === JSON.stringify(["projectId"]) && JSON.stringify(Object.keys(validations.projectRejectionSchema.shape).sort()) === JSON.stringify(["projectId", "reason"]));

    const routeSource = readFileSync("src/app/api/projects/upload/route.ts", "utf8");
    const routeExports = [...routeSource.matchAll(/export\s+(?:async\s+function|const)\s+(\w+)/g)].map((m) => m[1]).sort();
    check("the route exports only POST, runtime and dynamic", JSON.stringify(routeExports) === JSON.stringify(["POST", "dynamic", "runtime"]), routeExports.join(","));
    check("the route reads no user id and checks the origin first", !/userId/.test(routeSource) && routeSource.indexOf("isSameOriginRequest(") < routeSource.indexOf("request.text("));
    const storageCode = stripComments(readFileSync("src/lib/storage/customer-projects.ts", "utf8"));
    check("storage has no relay upload, unsigned preset or local-disk fallback", !/upload_stream|upload_preset|storage\/local|localProvider|public\/uploads/.test(storageCode));
    check("storage signs no folder parameter and never names the product folder", !/\bfolder:\s/.test(storageCode) && !storageCode.includes("meemiart/products"));
    const moderationCode = stripComments(readFileSync("src/lib/projects/moderation.ts", "utf8"));
    check("nothing publishes: no rename, to_type, access_mode or public upload type in project code", ![storageCode, moderationCode].some((code) => /\.rename\(|to_type|access_mode|type:\s*"upload"/.test(code)));
    const imageUrlWrites = [...moderationCode.matchAll(/imageUrl:\s*([^,\n}]+)/g)].map((m) => m[1].trim());
    check("moderation never writes a public reference", imageUrlWrites.length > 0 && imageUrlWrites.every((value) => value === "null"), imageUrlWrites.join(" | "));
    const orphanCode = stripComments(readFileSync("src/lib/projects/orphans.ts", "utf8"));
    check("the orphan sweep deletes only through the pattern-checked storage remover", orphanCode.includes("storage.removeProjectAsset(") && !/cloudinary|\.destroy\(/.test(orphanCode));
    const orphanScript = readFileSync("scripts/cloudinary-project-orphans.ts", "utf8");
    check("the orphan script lists by default and deletes only named keys", orphanScript.includes('indexOf("--delete")') && orphanScript.includes("deleteProjectOrphans({ keys: toDelete") && !/\.destroy\(|delete_resources/.test(orphanScript));

    // --------------------------------------------------------- database errors
    console.log("\nError handling");
    const explode = () => {
      throw leaky;
    };
    const brokenDb = {
      product: { findUnique: explode },
      orderItem: { findFirst: explode },
      customerProject: { count: explode, findUnique: explode, findFirst: explode, updateMany: explode, deleteMany: explode, create: explode },
      $transaction: explode,
    } as unknown as Deps["db"];
    const { value: broken, logged } = await captureErrors(async () => [
      await signProjectUploadForSession(uploadRequest(published.id), as(alice, { db: brokenDb })),
      await createProjectForSession({ productId: published.id, imageKey: storage.buildKey(alice.id) }, as(alice, { db: brokenDb })),
      await updateOwnProjectForSession({ projectId: "x", caption: "y" }, as(alice, { db: brokenDb })),
      await deleteOwnProjectForSession({ projectId: "x" }, as(alice, { db: brokenDb })),
    ]);
    check("database failures return a result instead of throwing", broken.length === 4 && broken.every((r) => !r.ok && r.code === "failed"));
    check("the customer sees only the generic message", broken.every((r) => !r.ok && r.error === "We couldn't save your project. Please try again."));
    check("no connection details or credentials leak into the result or log", !LEAK.test(JSON.stringify(broken) + logged.join("\n")), logged.join(" | "));
    check("the log records the operation, class and code", logged.some((l) => l.includes("[projects] sign failed")) && logged.every((l) => l.includes("P1001")));

    // ---------------------------------------------------------- product FK
    console.log("\nProduct foreign key");
    let deleteBlocked = false;
    const { value: fkError } = await captureErrors(async () => {
      try {
        await prisma.product.delete({ where: { id: published.id } });
        return null;
      } catch (error) {
        return error;
      }
    });
    deleteBlocked = (fkError as { code?: string } | null)?.code === "P2003" || /foreign key|P2003/i.test(String((fkError as Error | null)?.message));
    check("a product with customer projects cannot be hard-deleted (RESTRICT)", deleteBlocked);
    check("its customers' projects survive the attempt", (await projectCount({ productId: published.id })) > 0);
  } finally {
    await prisma.customerProject.deleteMany({
      where: { OR: [{ user: { email: { startsWith: RUN } } }, { product: { slug: { startsWith: RUN } } }] },
    });
    await prisma.user.deleteMany({ where: { email: { startsWith: RUN } } });
    await prisma.product.deleteMany({ where: { slug: { startsWith: RUN } } });
    const leftovers =
      (await prisma.customerProject.count({ where: { OR: [{ user: { email: { startsWith: RUN } } }, { product: { slug: { startsWith: RUN } } }] } })) +
      (await prisma.product.count({ where: { slug: { startsWith: RUN } } })) +
      (await prisma.user.count({ where: { email: { startsWith: RUN } } })) +
      (await prisma.order.count({ where: { orderNumber: { startsWith: RUN } } })) +
      (await prisma.adminActivity.count({ where: { entityType: "project", meta: { path: ["product"], string_starts_with: RUN } } }));
    check("fixture rows cleaned up (projects, users, orders, products, activity)", leftovers === 0, `${leftovers} left`);

    // Every mocked upload is now unclaimed. Sweep them as the operator would,
    // two days on, and confirm the mock holds no project image at all.
    const late = clock + 48 * HOUR * 1000;
    const lateScan = await scanProjectOrphans({ storage, db: prisma, now: late });
    const lateRemoval = await deleteProjectOrphans({ keys: lateScan.orphans.map((o) => o.key), storage, db: prisma, now: late });
    for (const [key, resource] of cloud.resources) {
      // Stand-ins that were never authenticated images (the wrong-type cases)
      // are outside what the sweep may list; remove them from the mock by hand.
      if (resource.type !== "authenticated" || resource.resource_type !== "image") cloud.resources.delete(key);
    }
    const leftoverMock = [...cloud.resources.keys()].filter((key) => parseProjectKey(key) !== null).length;
    check("zero mocked orphan resources remain", lateScan.complete && lateRemoval.every((r) => r.outcome === "deleted") && leftoverMock === 0, `${leftoverMock} left`);

    console.log("\nNetwork");
    check("zero outbound HTTP requests were attempted (no Cloudinary, Redis or Gemini)", outbound === 0, String(outbound));
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
