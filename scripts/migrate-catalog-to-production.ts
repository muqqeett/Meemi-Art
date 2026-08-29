/**
 * Copies the *catalogue* from a source database into the one `DATABASE_URL`
 * points at. Plan-only unless `--apply` is passed.
 *
 * Deliberately narrow. It copies four tables and nothing else:
 *
 *     Category → Product → ProductImage
 *                        → DigitalAsset
 *
 * It never touches users, orders, order items, payments, payment events,
 * digital access grants, reviews, carts, wishlists, coupons, sessions,
 * accounts, verification tokens or email logs. Those are either transactional
 * history that belongs to the environment that produced it, or credentials
 * that must be created fresh — the admin account is made with
 * `scripts/create-admin.ts`, which bcrypts a generated password, so no hash
 * and no plaintext ever crosses between databases.
 *
 * Ids are preserved. That keeps `custom_data.product_id` on the already-synced
 * Paddle Live product pointing at the same row, and it makes the copy
 * idempotent: re-running updates rather than duplicating.
 *
 * Paddle ids are carried across verbatim, so nothing here creates a second
 * Paddle product or price. `paddleSyncedAt` is preserved too, so the sync
 * script sees the catalogue as already in step.
 *
 *   LOCAL_DATABASE_URL=... npm run migrate:catalog          plan
 *   LOCAL_DATABASE_URL=... npm run migrate:catalog -- --apply
 */
import "dotenv/config";

/** Rows that exist only because a test or fixture created them. */
const FIXTURE_SLUGS = [/^pdp-preview/, /^dl-harness/, /^harness-/];
const FIXTURE_SKUS = [/^PDP-PREVIEW/, /^DL-HARNESS/];

function isFixture(slug: string, sku: string): boolean {
  return (
    FIXTURE_SLUGS.some((r) => r.test(slug)) || FIXTURE_SKUS.some((r) => r.test(sku))
  );
}

async function main() {
  const apply = process.argv.includes("--apply");

  const source = process.env.LOCAL_DATABASE_URL;
  const target = process.env.DATABASE_URL;

  if (!source) {
    console.error(
      "\nLOCAL_DATABASE_URL is not set.\n\n" +
        "Add it to .env alongside DATABASE_URL — it is the connection string the\n" +
        "project used before Neon, e.g. postgresql://USER:PASSWORD@localhost:5432/meemiart\n" +
        "Nothing is read from it except the catalogue tables.\n",
    );
    process.exit(1);
  }
  if (!target) {
    console.error("DATABASE_URL (the destination) is not set.");
    process.exit(1);
  }

  const { PrismaClient } = await import("../src/generated/prisma/client");
  const { PrismaPg } = await import("@prisma/adapter-pg");

  const from = new PrismaClient({ adapter: new PrismaPg({ connectionString: source }) });
  const to = new PrismaClient({ adapter: new PrismaPg({ connectionString: target }) });

  const host = (url: string) => {
    try {
      return new URL(url).hostname;
    } catch {
      return "unparseable";
    }
  };

  console.log(`\nsource : ${host(source)}`);
  console.log(`target : ${host(target)}`);
  console.log(`mode   : ${apply ? "APPLY" : "plan only, nothing will be written"}\n`);

  if (host(source) === host(target)) {
    console.error("Source and target are the same host. Aborting.");
    process.exit(1);
  }

  // ---- read the source ----------------------------------------------------
  const categories = await from.category.findMany({ orderBy: { name: "asc" } });
  const products = await from.product.findMany({
    include: { images: { orderBy: { sortOrder: "asc" } }, asset: true },
    orderBy: { createdAt: "asc" },
  });

  const keep = products.filter((p) => !isFixture(p.slug, p.sku));
  const skipped = products.filter((p) => isFixture(p.slug, p.sku));

  // ---- report -------------------------------------------------------------
  console.log(`── Categories (${categories.length}) ──`);
  for (const c of categories) {
    const bits = [
      c.isActive ? "active" : "hidden",
      c.image ? "image" : null,
      c.parentId ? `child of ${categories.find((x) => x.id === c.parentId)?.slug ?? c.parentId}` : null,
    ].filter(Boolean);
    console.log(`  ${c.slug.padEnd(24)} ${c.name.padEnd(22)} ${bits.join(", ")}`);
  }

  console.log(`\n── Products (${keep.length} to copy, ${skipped.length} skipped) ──`);
  let fileWarning = false;
  for (const p of keep) {
    const cat = categories.find((c) => c.id === p.categoryId);
    console.log(`\n  ${p.sku} — ${p.name}`);
    console.log(`    slug      : ${p.slug}`);
    console.log(`    price     : $${(p.priceCents / 100).toFixed(2)}${p.compareAtCents ? ` (was $${(p.compareAtCents / 100).toFixed(2)})` : ""}`);
    console.log(`    category  : ${cat ? `${cat.name} (${cat.slug})` : `MISSING ${p.categoryId}`}`);
    console.log(`    brand     : ${p.brand}`);
    console.log(`    published : ${p.isActive}   featured: ${p.featured}`);
    console.log(`    paddle    : ${p.paddleProductId ?? "—"} / ${p.paddlePriceId ?? "—"}`);
    console.log(`    images    : ${p.images.length}`);
    for (const img of p.images) {
      console.log(`      · ${img.url.slice(0, 78)}${img.url.length > 78 ? "…" : ""}`);
    }
    if (p.asset) {
      const looksLikePdf =
        p.asset.contentType === "application/pdf" ||
        p.asset.filename.toLowerCase().endsWith(".pdf");
      console.log(`    file      : ${p.asset.filename}`);
      console.log(`                ${p.asset.contentType}, ${p.asset.bytes.toLocaleString()} bytes, v${p.asset.version}`);
      console.log(`                storageKey preserved (Cloudinary account is shared)`);
      if (!looksLikePdf) {
        fileWarning = true;
        console.log(`                ⚠ NOT A PDF — this is what customers would download`);
      }
    } else {
      console.log(`    file      : NONE — product cannot be sold`);
    }
  }

  if (skipped.length > 0) {
    console.log(`\n  skipped as fixtures: ${skipped.map((p) => p.sku).join(", ")}`);
  }

  console.log(`\n── Deliberately NOT copied ──`);
  const excluded = {
    users: await from.user.count(),
    orders: await from.order.count(),
    payments: await from.payment.count(),
    paymentEvents: await from.paymentEvent.count(),
    digitalAccess: await from.digitalAccess.count(),
    reviews: await from.review.count(),
    coupons: await from.coupon.count(),
    emailLogs: await from.emailLog.count(),
  };
  for (const [k, v] of Object.entries(excluded)) {
    console.log(`  ${k.padEnd(16)} ${v} row(s) in source — not migrated`);
  }
  console.log(`  (admin account is created separately with scripts/create-admin.ts)`);

  if (fileWarning) {
    console.log(
      `\n⚠ At least one product's attached file does not look like a PDF.\n` +
        `  Fix it in Admin → Products before selling, or copy now and re-upload after.\n`,
    );
  }

  if (!apply) {
    console.log("Plan only. Nothing was written. Re-run with --apply to copy.\n");
    await from.$disconnect();
    await to.$disconnect();
    return;
  }

  // ---- write --------------------------------------------------------------
  console.log("applying…\n");

  // Parents before children: `Category.parentId` is a self-relation, so a child
  // written first would reference a row that does not exist yet.
  const ordered = [
    ...categories.filter((c) => !c.parentId),
    ...categories.filter((c) => c.parentId),
  ];

  for (const c of ordered) {
    const data = {
      name: c.name, slug: c.slug, description: c.description,
      image: c.image, icon: c.icon, sortOrder: c.sortOrder,
      isActive: c.isActive, parentId: c.parentId,
    };
    await to.category.upsert({ where: { id: c.id }, create: { id: c.id, ...data }, update: data });
  }
  console.log(`  categories: ${ordered.length} upserted`);

  for (const p of keep) {
    const data = {
      name: p.name, slug: p.slug, description: p.description,
      shortDescription: p.shortDescription, brand: p.brand, sku: p.sku,
      priceCents: p.priceCents, compareAtCents: p.compareAtCents,
      categoryId: p.categoryId, featured: p.featured, isActive: p.isActive,
      seoTitle: p.seoTitle, seoDescription: p.seoDescription,
      // Carried across so no duplicate Paddle entity is ever created.
      paddleProductId: p.paddleProductId, paddlePriceId: p.paddlePriceId,
      paddlePriceCents: p.paddlePriceCents, paddleSyncedAt: p.paddleSyncedAt,
    };
    await to.product.upsert({ where: { id: p.id }, create: { id: p.id, ...data }, update: data });

    // Images are replaced wholesale for this product only — simplest way to
    // stay idempotent without leaving stale rows behind.
    await to.productImage.deleteMany({ where: { productId: p.id } });
    for (const img of p.images) {
      await to.productImage.create({
        data: {
          id: img.id, productId: p.id, url: img.url, alt: img.alt,
          sortOrder: img.sortOrder, storageKey: img.storageKey,
        },
      });
    }

    if (p.asset) {
      const a = p.asset;
      const assetData = {
        storageKey: a.storageKey, filename: a.filename,
        contentType: a.contentType, bytes: a.bytes, version: a.version,
      };
      await to.digitalAsset.upsert({
        where: { productId: p.id },
        create: { productId: p.id, ...assetData },
        update: assetData,
      });
    }

    console.log(`  ${p.sku}: product + ${p.images.length} image(s)${p.asset ? " + file" : ""}`);
  }

  // ---- verify -------------------------------------------------------------
  const finalCategories = await to.category.count();
  const finalProducts = await to.product.count();
  const finalAssets = await to.digitalAsset.count();
  const finalImages = await to.productImage.count();
  const finalUsers = await to.user.count();
  const finalOrders = await to.order.count();

  console.log(`\n── Destination after copy ──`);
  console.log(`  categories ${finalCategories}  products ${finalProducts}  images ${finalImages}  assets ${finalAssets}`);
  console.log(`  users ${finalUsers}  orders ${finalOrders}  (both should be 0 — created separately / never migrated)`);
  console.log("");

  await from.$disconnect();
  await to.$disconnect();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
