/**
 * Lists abandoned customer-project uploads in Cloudinary.
 *
 * An upload is abandoned when no CustomerProject claims it and it is older
 * than the grace period (see `lib/projects/orphans.ts` for every condition).
 * Only authenticated images under `meemiart/customer-projects/` are listed;
 * product photography, product video and purchased files are outside what the
 * listing can see, and anything listed that is not in the server-issued key
 * format is counted and left alone.
 *
 * Listing is the default and changes nothing. Deletion follows the convention
 * of `scripts/cloudinary-orphans.ts`: each public_id must be named, and each
 * named key is deleted only if a fresh, complete scan confirms it is an orphan
 * and the database still has no project for it.
 *
 *   npm run cloudinary:project-orphans
 *   npm run cloudinary:project-orphans -- --delete <public_id> [<public_id>…]
 *
 * Keys carry a one-way digest of the owner, not a user id, so the output names
 * no customer. Errors are reported by class only.
 */
import "dotenv/config";

async function main() {
  const { prisma } = await import("../src/lib/prisma");
  const { customerProjectStorage, CUSTOMER_PROJECT_FOLDER, PROJECT_ORPHAN_GRACE_SECONDS } = await import(
    "../src/lib/storage/customer-projects"
  );
  const { scanProjectOrphans, deleteProjectOrphans } = await import("../src/lib/projects/orphans");

  try {
    if (!customerProjectStorage.isConfigured) {
      console.error("Cloudinary is not configured; nothing to scan.");
      process.exitCode = 1;
      return;
    }

    const deleteIndex = process.argv.indexOf("--delete");
    const toDelete = deleteIndex === -1 ? [] : process.argv.slice(deleteIndex + 1);

    const scan = await scanProjectOrphans({ storage: customerProjectStorage, db: prisma });

    console.log(`Folder:            ${CUSTOMER_PROJECT_FOLDER}/ (authenticated images)`);
    console.log(`Grace period:      ${PROJECT_ORPHAN_GRACE_SECONDS / 3600} hours`);
    console.log(`Scan complete:     ${scan.complete ? "yes" : "NO — listing failed or page limit reached"}`);
    console.log(`Assets listed:     ${scan.scanned}`);
    console.log(`Not project keys:  ${scan.notProjectKeys} (left alone)`);
    console.log(`Too recent:        ${scan.tooRecent} (left alone)`);
    console.log(`Claimed:           ${scan.referenced} (left alone)`);
    console.log(`Orphans:           ${scan.orphans.length}\n`);

    for (const asset of scan.orphans) {
      console.log(`  ORPHAN  ${asset.key}  ${(asset.bytes / 1024).toFixed(1)}KB  ${asset.createdAt.slice(0, 10)}`);
    }

    if (toDelete.length === 0) {
      console.log("\nNothing deleted. Pass --delete followed by the exact public_ids to remove.\n");
      return;
    }

    console.log("\nDeleting:");
    for (const result of await deleteProjectOrphans({ keys: toDelete, storage: customerProjectStorage, db: prisma })) {
      console.log(`  ${result.outcome.padEnd(24)} ${result.key}`);
    }
    console.log();
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Orphan scan failed:", error instanceof Error ? error.constructor.name : "unknown");
  process.exitCode = 1;
});
