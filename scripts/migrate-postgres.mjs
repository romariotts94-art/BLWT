import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Client } = pg;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../db/postgres");
const baseTables = ["members", "invitations", "teams", "orders", "notices", "messages", "audit", "settings", "channels", "media"];
const baseColumns = {
  members: ["id", "email", "name", "role", "team_id", "active", "created"],
  invitations: ["email", "name", "role", "team_id"],
  teams: ["id", "name", "leader_id"],
  orders: ["id", "client_id", "status", "details", "crew", "target", "revision", "created", "updated"],
  notices: ["id", "user_id", "order_id", "text", "read", "created"],
  messages: ["id", "order_id", "user_id", "name", "text", "created"],
  audit: ["id", "order_id", "actor", "action", "created"],
  settings: ["key", "value", "updated"],
  channels: ["id", "order_id", "worker_id", "viewer_id", "offer", "answer", "updated", "state"],
  media: ["id", "order_id", "user_id", "name", "mime", "created"],
};
const lockKeys = [1263943507, 1431198772];

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PG_SSL === "true" ? { rejectUnauthorized: true } : undefined,
  connectionTimeoutMillis: 10_000,
  statement_timeout: 60_000,
});

function stripTransactionWrappers(sql) {
  return sql.replace(/^\s*(?:BEGIN|COMMIT)\s*;\s*$/gim, "");
}

async function tableExists(name) {
  const result = await client.query("SELECT to_regclass($1) IS NOT NULL AS present", [`public.${name}`]);
  return result.rows[0]?.present === true;
}

async function markApplied(name) {
  await client.query(
    "INSERT INTO schema_migrations(name, applied_at) VALUES($1, now()) ON CONFLICT(name) DO NOTHING",
    [name],
  );
}

await client.connect();
try {
  await client.query("SELECT pg_advisory_lock($1, $2)", lockKeys);
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);

  const migrations = (await readdir(root))
    .filter((name) => /^\d{4}_.+\.sql$/.test(name))
    .sort();
  const existing = new Set((await client.query("SELECT name FROM schema_migrations")).rows.map((row) => row.name));

  for (const name of migrations) {
    if (existing.has(name)) continue;

    if (name === "0001_initial.sql") {
      const present = [];
      for (const table of baseTables) present.push(await tableExists(table));
      if (present.some(Boolean) && !present.every(Boolean)) {
        throw new Error("PostgreSQL has a partial base schema; migration stopped without changing it.");
      }
      if (present.every(Boolean)) {
        const columns = await client.query(
          "SELECT table_name, column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=ANY($1::text[])",
          [baseTables],
        );
        const actual = new Map();
        for (const row of columns.rows) actual.set(row.table_name, (actual.get(row.table_name) || new Set()).add(row.column_name));
        const missing = Object.entries(baseColumns).flatMap(([table, expected]) =>
          expected.filter((column) => !actual.get(table)?.has(column)).map((column) => `${table}.${column}`),
        );
        if (missing.length) {
          throw new Error(`PostgreSQL base schema is incomplete; missing columns: ${missing.join(", ")}`);
        }
        await markApplied(name);
        console.log(`Baseline recorded for existing schema: ${name}`);
        continue;
      }
    }

    const sql = stripTransactionWrappers(await readFile(path.join(root, name), "utf8"));
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await markApplied(name);
      await client.query("COMMIT");
      console.log(`Applied ${name}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }

  const required = [
    ...baseTables,
    "auth_codes", "auth_sessions", "documents", "contracts", "cities", "customer_profiles",
    "customer_cities", "worker_profiles", "worker_availability", "order_skips", "worker_agreements",
    "quality_attempts", "wallet_ledger", "withdrawal_requests", "order_incidents", "cleaner_cards",
    "staff_messages", "support_tickets", "support_messages", "support_delivery",
  ];
  const missing = [];
  for (const table of required) if (!(await tableExists(table))) missing.push(table);
  if (missing.length) throw new Error(`PostgreSQL schema is incomplete; missing tables: ${missing.join(", ")}`);
  console.log(`PostgreSQL schema ready: ${required.length} required tables verified.`);
} finally {
  try { await client.query("SELECT pg_advisory_unlock($1, $2)", lockKeys); } catch {}
  await client.end();
}
