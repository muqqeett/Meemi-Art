import "server-only";

import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * A path under `public/`, or null when the file is not there yet.
 *
 * Some of this site's artwork has to be exported from Figma by hand — it is
 * artwork, not code, so it cannot be produced from the repository. Rather than
 * shipping a broken image icon, the page asks whether the file exists and lays
 * out accordingly: a component can fall back to something reasonable, and the
 * real asset appears the moment it is dropped in.
 *
 * Checked per render rather than once at module load, so adding the file shows
 * up on the next refresh instead of needing a restart. It is a single `stat`
 * on pages that already make several database round trips.
 */
export function publicAsset(path: string): string | null {
  const relative = path.startsWith("/") ? path.slice(1) : path;
  return existsSync(join(process.cwd(), "public", relative)) ? `/${relative}` : null;
}
