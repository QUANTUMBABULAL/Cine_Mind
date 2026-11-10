import pg from "pg";
import { env } from "../config/env.js";

// DATE columns are returned as 'YYYY-MM-DD' strings instead of JS Date objects,
// so dates do not shift with the server's time zone.
pg.types.setTypeParser(pg.types.builtins.DATE, (value) => value);
// NUMERIC (e.g. averages, percentages) as JS numbers; values here are small.
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (value) => Number(value));
// COUNT(*) returns BIGINT; our counts always fit in a JS number.
pg.types.setTypeParser(pg.types.builtins.INT8, (value) => Number(value));

export const pool = new pg.Pool({
  ...env.db,
  max: 10,
  application_name: "cinemind-api",
});

// An idle connection can be closed by the server (restart, DROP DATABASE ...
// WITH (FORCE)). Log it instead of crashing; the pool opens a new connection.
pool.on("error", (err) => console.error("PostgreSQL idle client error:", err.message));

/** Runs one parameterized query and returns its rows. */
export async function query<T extends pg.QueryResultRow = any>(text: string, params: unknown[] = []): Promise<T[]> {
  const result = await pool.query<T>(text, params);
  return result.rows;
}

/** Returns the first row or null. */
export async function queryOne<T extends pg.QueryResultRow = any>(text: string, params: unknown[] = []): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

/**
 * Runs `work` inside BEGIN ... COMMIT on a single connection, rolling back on error.
 * When actingUserId is given, it is stored with set_config(..., true) — the
 * transaction-local equivalent of SET LOCAL — so the audit triggers record
 * which application user made the change.
 */
export async function withTransaction<T>(
  actingUserId: number | null,
  work: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (actingUserId !== null) {
      await client.query("SELECT set_config('cinemind.current_user_id', $1, true)", [String(actingUserId)]);
    }
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
