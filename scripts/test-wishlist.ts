/**
 * Wishlist hardening harness.
 *
 * Proves the rules the wishlist mutations rest on: validation, sign-in,
 * published-only saves, no duplicates, idempotent removal, per-user ownership,
 * safe errors, and convergence under concurrent requests.
 *
 * LOCAL DATABASE ONLY. These checks write rows, so the script points Prisma at
 * `LOCAL_DATABASE_URL` before anything imports it, refuses to start unless
 * that is a localhost database distinct from `DATABASE_URL`, and confirms from
 * inside the connection that the server is local. Every fixture is namespaced
 * `zz-wishlist-test-<run>` and removed in `finally`, and the cleanup is
 * verified.
 *
 * Run: npm run test:wishlist
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

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

const RUN = `zz-wishlist-test-${randomUUID().slice(0, 8)}`;

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

async function main() {
  const { prisma } = await import("../src/lib/prisma");
  const { toggleWishlistForUser, removeWishlistItemForUser } = await import(
    "../src/lib/wishlist/mutations"
  );
  type Db = Parameters<typeof toggleWishlistForUser>[3];

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

    const makeUser = (label: string) =>
      prisma.user.create({
        data: { email: `${RUN}-${label}@example.invalid`, name: `${RUN} ${label}` },
        select: { id: true },
      });
    const makeProduct = (label: string, isActive: boolean) =>
      prisma.product.create({
        data: {
          name: `${RUN} ${label}`,
          slug: `${RUN}-${label}`,
          sku: `${RUN}-${label}`.toUpperCase(),
          brand: "Meemi Art",
          description: "Wishlist harness fixture.",
          priceCents: 100,
          categoryId: category.id,
          isActive,
        },
        select: { id: true },
      });

    const [alice, bob, carol] = await Promise.all([makeUser("alice"), makeUser("bob"), makeUser("carol")]);
    const [published, unpublished] = await Promise.all([
      makeProduct("published", true),
      makeProduct("unpublished", false),
    ]);

    const itemCount = (userId: string, productId: string) =>
      prisma.wishlistItem.count({ where: { productId, wishlist: { userId } } });

    console.log("\nValidation");
    for (const [label, value] of [
      ["empty string", ""],
      ["whitespace", "   "],
      ["over-long", "x".repeat(500)],
      ["non-string", { id: published.id }],
      ["null", null],
    ] as const) {
      const result = await toggleWishlistForUser(alice, value, true);
      check(`invalid productId (${label}) is rejected safely`, !result.ok && result.error === "That product isn't valid.");
    }
    const badIntent = await toggleWishlistForUser(alice, published.id, "yes");
    check("non-boolean saved intent is rejected", !badIntent.ok);
    check("no wishlist item was written by invalid input", (await itemCount(alice.id, published.id)) === 0);

    console.log("\nAuthentication");
    const wishlistsBefore = await prisma.wishlist.count();
    const signedOutSave = await toggleWishlistForUser(null, published.id, true);
    check("signed-out save is refused with the sign-in prompt", !signedOutSave.ok && signedOutSave.requiresSignIn === true);
    const signedOutRemove = await removeWishlistItemForUser(null, published.id);
    check("signed-out remove is refused with the sign-in prompt", !signedOutRemove.ok && signedOutRemove.requiresSignIn === true);
    check("signed-out calls create no wishlist data", (await prisma.wishlist.count()) === wishlistsBefore);

    console.log("\nProduct availability");
    const save = await toggleWishlistForUser(alice, published.id, true);
    check("authenticated user saves a published product", save.ok && save.data.added === true);
    check("the item exists on that user's wishlist", (await itemCount(alice.id, published.id)) === 1);
    const missing = await toggleWishlistForUser(alice, "cl_does_not_exist_000000000", true);
    check("nonexistent product is rejected", !missing.ok && missing.error === "That product is no longer available.");
    const hidden = await toggleWishlistForUser(alice, unpublished.id, true);
    check("unpublished product cannot be newly saved", !hidden.ok && (await itemCount(alice.id, unpublished.id)) === 0);
    check(
      "unpublished and nonexistent products get the same message",
      !hidden.ok && !missing.ok && hidden.error === missing.error,
    );

    console.log("\nDuplicates");
    const again = await toggleWishlistForUser(alice, published.id, true);
    check("saving the same product again succeeds", again.ok && again.data.added === true);
    check("no duplicate WishlistItem is created", (await itemCount(alice.id, published.id)) === 1);

    console.log("\nRemoval");
    const removed = await removeWishlistItemForUser(alice, published.id);
    check("existing item can be removed", removed.ok && (await itemCount(alice.id, published.id)) === 0);
    const removedAgain = await removeWishlistItemForUser(alice, published.id);
    check("removing an already-removed item succeeds safely", removedAgain.ok && (await itemCount(alice.id, published.id)) === 0);
    const unsaveAgain = await toggleWishlistForUser(alice, published.id, false);
    check("saved:false on an absent item succeeds safely", unsaveAgain.ok && unsaveAgain.data.added === false);

    console.log("\nOriginal toggle contract (no saved argument)");
    const t1 = await toggleWishlistForUser(alice, published.id);
    const t2 = await toggleWishlistForUser(alice, published.id);
    check("toggle adds, then removes", t1.ok && t1.data.added === true && t2.ok && t2.data.added === false && (await itemCount(alice.id, published.id)) === 0);

    console.log("\nOwnership");
    await toggleWishlistForUser(alice, published.id, true);
    await toggleWishlistForUser(bob, published.id, true);
    const bobRemoves = await removeWishlistItemForUser(bob, published.id);
    check(
      "a user's removal never touches another user's wishlist",
      bobRemoves.ok && (await itemCount(bob.id, published.id)) === 0 && (await itemCount(alice.id, published.id)) === 1,
    );
    const bobToggles = await toggleWishlistForUser(bob, published.id);
    check(
      "a user's toggle only ever affects their own wishlist",
      bobToggles.ok && (await itemCount(bob.id, published.id)) === 1 && (await itemCount(alice.id, published.id)) === 1,
    );
    const actionSource = readFileSync("src/lib/actions/wishlist.ts", "utf8");
    const actionExports = [...actionSource.matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g)].map((m) => m[1]).sort();
    check(
      "the only browser-callable endpoints take no user id",
      JSON.stringify(actionExports) === JSON.stringify(["removeFromWishlist", "toggleWishlist"]) &&
        actionSource.includes("getCurrentUser()") &&
        !/userId/.test(actionSource),
      JSON.stringify(actionExports),
    );
    const mutationSource = readFileSync("src/lib/wishlist/mutations.ts", "utf8");
    // A directive is a statement at the top of the file; the phrase may appear
    // in comments explaining why this module is not a server action.
    const firstStatement = mutationSource.replace(/^\s*(\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)\s*/g, "").trimStart();
    check(
      "the user-taking functions are server-only, not server actions",
      mutationSource.includes('import "server-only"') && !/^["']use server["']/.test(firstStatement),
    );

    console.log("\nError handling");
    const leaky = Object.assign(new Error("connect ECONNREFUSED postgresql://admin:hunter2@db.internal:5432/prod"), {
      code: "P1001",
    });
    const fail = () => {
      throw leaky;
    };
    const brokenDb = {
      product: { findFirst: fail },
      wishlist: { findUnique: fail, createMany: fail },
      wishlistItem: { createMany: fail, deleteMany: fail },
    } as unknown as Db;
    const logged: string[] = [];
    const originalError = console.error;
    console.error = (...args: unknown[]) => {
      logged.push(args.map(String).join(" "));
    };
    let brokenSave: Awaited<ReturnType<typeof toggleWishlistForUser>>;
    let brokenToggle: Awaited<ReturnType<typeof toggleWishlistForUser>>;
    let brokenRemove: Awaited<ReturnType<typeof removeWishlistItemForUser>>;
    try {
      brokenSave = await toggleWishlistForUser(alice, published.id, true, brokenDb);
      brokenToggle = await toggleWishlistForUser(alice, published.id, undefined, brokenDb);
      brokenRemove = await removeWishlistItemForUser(alice, published.id, brokenDb);
    } finally {
      console.error = originalError;
    }
    const failures = [brokenSave, brokenToggle, brokenRemove];
    check("database failures return a result instead of throwing", failures.every((r) => !r.ok));
    check(
      "the user sees only the generic message",
      failures.every((r) => !r.ok && r.error === "We couldn't update your wishlist. Please try again."),
    );
    const everything = JSON.stringify(failures) + logged.join("\n");
    check("no connection details, credentials or error message leak into the result or log", !/postgresql|hunter2|db\.internal|ECONNREFUSED/.test(everything), logged.join(" | "));
    check("the log records the operation, class and code", logged.some((l) => l.includes("[wishlist] save") || l.includes("[wishlist] toggle")) && logged.some((l) => l.includes("P1001")));

    console.log("\nConcurrency");
    const concurrentSaves = await Promise.all(
      Array.from({ length: 10 }, () => toggleWishlistForUser(carol, published.id, true)),
    );
    check("10 concurrent first-time saves all succeed", concurrentSaves.every((r) => r.ok && r.data.added === true));
    check("exactly one wishlist is created for the user", (await prisma.wishlist.count({ where: { userId: carol.id } })) === 1);
    check("exactly one item exists after concurrent saves", (await itemCount(carol.id, published.id)) === 1);

    const concurrentRemoves = await Promise.all(
      Array.from({ length: 6 }, () => removeWishlistItemForUser(carol, published.id)),
    );
    check("6 concurrent removes all succeed", concurrentRemoves.every((r) => r.ok));
    check("the item is gone after concurrent removes", (await itemCount(carol.id, published.id)) === 0);

    const mixed = await Promise.all(
      Array.from({ length: 8 }, (_, i) => toggleWishlistForUser(carol, published.id, i % 2 === 0)),
    );
    const finalCount = await itemCount(carol.id, published.id);
    check("interleaved save/remove requests never throw or error", mixed.every((r) => r.ok));
    check("interleaved requests leave at most one item", finalCount === 0 || finalCount === 1, String(finalCount));

    const barrage = await Promise.all(Array.from({ length: 8 }, () => toggleWishlistForUser(carol, published.id)));
    const afterBarrage = await itemCount(carol.id, published.id);
    check("concurrent plain toggles never hit the unique constraint", barrage.every((r) => r.ok));
    check("concurrent plain toggles leave at most one item", afterBarrage === 0 || afterBarrage === 1, String(afterBarrage));
  } finally {
    await prisma.product.deleteMany({ where: { slug: { startsWith: RUN } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: RUN } } });
    const leftovers =
      (await prisma.product.count({ where: { slug: { startsWith: RUN } } })) +
      (await prisma.user.count({ where: { email: { startsWith: RUN } } }));
    check("fixtures cleaned up", leftovers === 0, `${leftovers} left`);
    await prisma.$disconnect();
  }
}

main()
  .catch((error) => {
    console.error("\nHarness crashed:", error instanceof Error ? error.constructor.name : "unknown");
    process.exitCode = 1;
  })
  .finally(() => {
    console.log(`\n${passed} passed, ${failed} failed`);
    if (failed > 0) process.exitCode = 1;
  });
