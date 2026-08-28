/**
 * Lists the Cloudinary product folder and compares it against the database.
 *
 * An asset with no `ProductImage.storageKey` pointing at it is an orphan —
 * usually left behind by a smoke test or an abandoned product form. Listing is
 * the default; deletion requires naming each public_id explicitly, because a
 * blanket "delete everything unreferenced" would be one stale query away from
 * destroying real product photography.
 *
 *   npx tsx scripts/cloudinary-orphans.ts
 *   npx tsx scripts/cloudinary-orphans.ts --delete <public_id> [<public_id>…]
 */
import "dotenv/config";
import { v2 as cloudinary } from "cloudinary";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const FOLDER = process.env.CLOUDINARY_FOLDER || "meemiart/products";

async function main() {
  const deleteIndex = process.argv.indexOf("--delete");
  const toDelete = deleteIndex === -1 ? [] : process.argv.slice(deleteIndex + 1);

  const referenced = new Set(
    (
      await prisma.productImage.findMany({
        where: { storageKey: { not: null } },
        select: { storageKey: true },
      })
    ).map((image) => image.storageKey!),
  );

  const { resources } = await cloudinary.api.resources({
    type: "upload",
    prefix: FOLDER,
    max_results: 500,
  });

  console.log(`Cloudinary folder: ${FOLDER}`);
  console.log(`Assets found:      ${resources.length}`);
  console.log(`Referenced in DB:  ${referenced.size}\n`);

  for (const asset of resources as { public_id: string; bytes: number; created_at: string }[]) {
    const inUse = referenced.has(asset.public_id);
    console.log(
      `  ${(inUse ? "IN USE" : "ORPHAN").padEnd(8)} ${asset.public_id}  ${(asset.bytes / 1024).toFixed(1)}KB  ${asset.created_at.slice(0, 10)}`,
    );
  }

  if (toDelete.length === 0) {
    console.log(
      "\nNothing deleted. Pass --delete followed by the exact public_ids to remove.\n",
    );
    return;
  }

  console.log("\nDeleting:");
  for (const publicId of toDelete) {
    if (referenced.has(publicId)) {
      console.log(`  SKIPPED  ${publicId} — a product still points at this asset.`);
      continue;
    }
    const result = await cloudinary.uploader.destroy(publicId, { invalidate: true });
    console.log(`  ${String(result.result).padEnd(9)} ${publicId}`);
  }

  // Read back through the Admin API rather than the CDN URL: the CDN keeps
  // serving a deleted object from its edge cache, so a 200 there proves nothing.
  console.log("\nVerifying via the Admin API:");
  for (const publicId of toDelete) {
    try {
      await cloudinary.api.resource(publicId);
      console.log(`  STILL PRESENT  ${publicId}`);
    } catch {
      console.log(`  gone           ${publicId}`);
    }
  }
  console.log();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
