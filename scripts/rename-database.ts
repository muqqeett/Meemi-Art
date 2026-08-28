/**
 * Renames the PostgreSQL database in place: sebha -> meemiart.
 *
 * `ALTER DATABASE ... RENAME TO` keeps every table, row, index and migration
 * history intact and completes instantly — there is no dump, no restore, and
 * no window where the data exists in only one of two places. The catch is that
 * PostgreSQL refuses while any session is connected to the database being
 * renamed, so this connects to `postgres` instead and terminates stragglers
 * first.
 *
 * Safe to re-run: if `meemiart` already exists and `sebha` does not, it reports
 * that and changes nothing.
 */
import "dotenv/config";
import { Client } from "pg";

const OLD = "sebha";
const NEW = "meemiart";

function adminUrl(databaseUrl: string): string {
  const url = new URL(databaseUrl);
  url.pathname = "/postgres";
  url.search = "";
  return url.toString();
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not set.");

  const client = new Client({ connectionString: adminUrl(databaseUrl) });
  await client.connect();

  try {
    const { rows } = await client.query<{ datname: string }>(
      "SELECT datname FROM pg_database WHERE datname = ANY($1)",
      [[OLD, NEW]],
    );
    const present = new Set(rows.map((r) => r.datname));

    if (present.has(NEW) && !present.has(OLD)) {
      console.log(`"${NEW}" already exists and "${OLD}" is gone — nothing to do.`);
      return;
    }
    if (!present.has(OLD)) {
      throw new Error(`Database "${OLD}" not found. Nothing was changed.`);
    }
    if (present.has(NEW)) {
      throw new Error(
        `Both "${OLD}" and "${NEW}" exist. Refusing to guess which one to keep — ` +
          `drop or rename one by hand first.`,
      );
    }

    // Any live session blocks the rename. This is a development database, and
    // the app was stopped before running this.
    const { rowCount } = await client.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity
       WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [OLD],
    );
    if (rowCount) console.log(`Closed ${rowCount} open connection(s) to "${OLD}".`);

    await client.query(`ALTER DATABASE "${OLD}" RENAME TO "${NEW}"`);
    console.log(`Renamed "${OLD}" -> "${NEW}". All data and migration history preserved.`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
