/**
 * Human-readable file size.
 *
 * Deliberately its own module with no imports. It began life next to the
 * download queries, which are `server-only` and pull in Prisma — importing it
 * from an admin client component dragged the database driver towards the
 * browser bundle. A pure formatter has no business living behind a server
 * boundary.
 *
 * Binary units, because that is what a file manager shows for the same file.
 */
export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "—";

  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / 1024 ** exponent;

  // One decimal below 10 of a unit, whole numbers above: "1.4 MB", "230 KB".
  return `${value < 10 && exponent > 0 ? value.toFixed(1) : Math.round(value)} ${units[exponent]}`;
}
