import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { pool } from "./db/pool.js";

// Fail fast with a clear message if PostgreSQL is unreachable.
try {
  const { rows } = await pool.query("SELECT current_database() AS db, current_user AS usr");
  console.log(`Connected to PostgreSQL database "${rows[0].db}" as "${rows[0].usr}"`);
} catch (err) {
  console.error("Cannot connect to PostgreSQL. Check apps/api/.env and that database/setup.ps1 has been run.");
  console.error((err as Error).message);
  process.exit(1);
}

const server = createApp().listen(env.port, () => {
  console.log(`CineMind API listening on http://localhost:${env.port}/api`);
});

const shutdown = () => server.close(() => pool.end().then(() => process.exit(0)));
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
