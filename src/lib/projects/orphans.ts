import "server-only";

import type { prisma } from "@/lib/prisma";
import {
  parseProjectKey,
  PROJECT_FINALIZE_WINDOW_SECONDS,
  PROJECT_ORPHAN_GRACE_SECONDS,
  type CustomerProjectStorage,
  type StoredProjectAsset,
} from "@/lib/storage/customer-projects";

/**
 * Abandoned customer-project uploads.
 *
 * A signed upload can land in Cloudinary and never become a project: the
 * customer closed the tab, the submission was refused at the cap, or the
 * account was deleted and its projects cascaded away. This finds them.
 *
 * An asset is an orphan only if ALL of these hold:
 *
 *   · it came from the customer-projects listing (authenticated images under
 *     `meemiart/customer-projects/` — the listing cannot see anything else),
 *   · its public_id matches the server-issued key format exactly,
 *   · both its signing time and Cloudinary's creation time are older than the
 *     grace period — far longer than the window in which an upload may still
 *     be submitted, so nothing removed could still become a project,
 *   · no CustomerProject row claims it.
 *
 * Deletion never happens from a scan alone. `deleteProjectOrphans` deletes
 * only keys an operator names, only if a fresh, complete scan confirms each is
 * an orphan, and only after re-checking the database for that key immediately
 * before removing it — then confirms Cloudinary no longer holds it.
 */

export type OrphanDb = Pick<typeof prisma, "customerProject">;

export type OrphanScan = {
  /** False when a page could not be listed or the page limit was reached. */
  complete: boolean;
  pages: number;
  scanned: number;
  /** Listed, but not in the server-issued key format. Never touched. */
  notProjectKeys: number;
  /** Inside the grace period. Never touched. */
  tooRecent: number;
  /** Claimed by a project. Never touched. */
  referenced: number;
  orphans: StoredProjectAsset[];
};

export type OrphanDeletion = {
  key: string;
  outcome: "deleted" | "refused_not_an_orphan" | "refused_scan_incomplete" | "refused_referenced" | "failed";
};

const MAX_PAGES = 50;
const REFERENCE_BATCH = 500;

export async function scanProjectOrphans({
  storage,
  db,
  now = Date.now(),
  graceSeconds = PROJECT_ORPHAN_GRACE_SECONDS,
  maxPages = MAX_PAGES,
}: {
  storage: CustomerProjectStorage;
  db: OrphanDb;
  now?: number;
  graceSeconds?: number;
  maxPages?: number;
}): Promise<OrphanScan> {
  // A grace period shorter than the submission window could remove an upload
  // that is still legitimately on its way to becoming a project.
  const grace = Math.max(graceSeconds, PROJECT_FINALIZE_WINDOW_SECONDS * 2);
  const nowSeconds = Math.floor(now / 1000);

  const scan: OrphanScan = { complete: true, pages: 0, scanned: 0, notProjectKeys: 0, tooRecent: 0, referenced: 0, orphans: [] };
  const candidates: StoredProjectAsset[] = [];

  let cursor: string | undefined;
  do {
    if (scan.pages >= maxPages) {
      scan.complete = false;
      break;
    }
    const page = await storage.listPage(cursor);
    if (!page.ok) {
      scan.complete = false;
      break;
    }
    scan.pages++;

    for (const asset of page.assets) {
      scan.scanned++;
      const parsed = parseProjectKey(asset.key);
      if (!parsed) {
        scan.notProjectKeys++;
        continue;
      }
      const created = Date.parse(asset.createdAt);
      if (!Number.isFinite(created)) {
        scan.tooRecent++;
        continue;
      }
      const newest = Math.max(Math.floor(created / 1000), parsed.issuedAt);
      if (nowSeconds - newest < grace) {
        scan.tooRecent++;
        continue;
      }
      candidates.push(asset);
    }

    cursor = page.nextCursor ?? undefined;
  } while (cursor);

  for (let i = 0; i < candidates.length; i += REFERENCE_BATCH) {
    const batch = candidates.slice(i, i + REFERENCE_BATCH);
    const claimed = await db.customerProject.findMany({
      where: { imageKey: { in: batch.map((asset) => asset.key) } },
      select: { imageKey: true },
    });
    const claimedKeys = new Set(claimed.map((row) => row.imageKey));
    for (const asset of batch) {
      if (claimedKeys.has(asset.key)) scan.referenced++;
      else scan.orphans.push(asset);
    }
  }

  return scan;
}

export async function deleteProjectOrphans({
  keys,
  storage,
  db,
  now = Date.now(),
  graceSeconds = PROJECT_ORPHAN_GRACE_SECONDS,
}: {
  keys: string[];
  storage: CustomerProjectStorage;
  db: OrphanDb;
  now?: number;
  graceSeconds?: number;
}): Promise<OrphanDeletion[]> {
  const requested = [...new Set(keys)];
  if (requested.length === 0) return [];

  const scan = await scanProjectOrphans({ storage, db, now, graceSeconds });
  if (!scan.complete) return requested.map((key) => ({ key, outcome: "refused_scan_incomplete" }));

  const orphanKeys = new Set(scan.orphans.map((asset) => asset.key));
  const results: OrphanDeletion[] = [];

  for (const key of requested) {
    if (!orphanKeys.has(key)) {
      results.push({ key, outcome: "refused_not_an_orphan" });
      continue;
    }
    if (await db.customerProject.findUnique({ where: { imageKey: key }, select: { id: true } })) {
      results.push({ key, outcome: "refused_referenced" });
      continue;
    }
    const removed = await storage.removeProjectAsset(key);
    results.push({ key, outcome: removed.ok ? "deleted" : "failed" });
  }

  return results;
}
