import { createReadStream } from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { Pool, type PoolClient } from "pg";

type BoundStatement = { sql: string; params: unknown[] };

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.PG_POOL_SIZE || 10),
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  statement_timeout: 20000,
  idle_in_transaction_session_timeout: 30000,
  ssl: process.env.PG_SSL === "true" ? { rejectUnauthorized: true } : undefined,
});

pool.on('error', error => console.error('PostgreSQL connection error', error.message));

function pgSql(sql: string) {
  let index = 0;
  let result = "";
  let quote: "'" | '"' | null = null;
  for (let i = 0; i < sql.length; i += 1) {
    const char = sql[i];
    if (quote) {
      result += char;
      if (char === quote && sql[i + 1] === quote) result += sql[++i];
      else if (char === quote && sql[i - 1] !== "\\") quote = null;
    } else if (char === "'" || char === '"') {
      quote = char;
      result += char;
    } else if (char === "?") {
      result += `$${++index}`;
    } else {
      result += char;
    }
  }
  return result.replace(/^\s*INSERT\s+OR\s+IGNORE\s+INTO/i, "INSERT INTO");
}

async function execute(statement: BoundStatement, client: Pool | PoolClient = pool) {
  const sql = pgSql(statement.sql);
  const query = /INSERT\s+INTO/i.test(sql) && /^\s*INSERT\s+OR\s+IGNORE/i.test(statement.sql)
    ? `${sql} ON CONFLICT DO NOTHING`
    : sql;
  return client.query(query, statement.params);
}

const DB = {
  prepare(sql: string) {
    return {
      bind(...params: unknown[]) {
        const statement = { sql, params };
        return {
          async all() {
            const result = await execute(statement);
            return { results: result.rows };
          },
          async first<T = Record<string, unknown>>() {
            const result = await execute(statement);
            return (result.rows[0] as T | undefined) ?? null;
          },
          async run() {
            const result = await execute(statement);
            return { meta: { changes: result.rowCount ?? 0 } };
          },
          execute(client: PoolClient) {
            return execute(statement, client);
          },
        };
      },
    };
  },
  async batch(statements: Array<{ execute(client: PoolClient): Promise<unknown> }>) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const results = [];
      for (const statement of statements) results.push(await statement.execute(client));
      await client.query("COMMIT");
      return results;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },
  async transaction<T>(callback: (tx: {
    all: (sql: string, ...params: unknown[]) => Promise<any[]>;
    one: (sql: string, ...params: unknown[]) => Promise<any>;
    run: (sql: string, ...params: unknown[]) => Promise<{ meta: { changes: number } }>;
  }) => Promise<T>) {
    const client = await pool.connect();
    const tx = {
      async all(sql: string, ...params: unknown[]) {
        return (await execute({ sql, params }, client)).rows;
      },
      async one(sql: string, ...params: unknown[]) {
        return (await execute({ sql, params }, client)).rows[0] ?? null;
      },
      async run(sql: string, ...params: unknown[]) {
        const result = await execute({ sql, params }, client);
        return { meta: { changes: result.rowCount ?? 0 } };
      },
    };
    try {
      await client.query("BEGIN");
      const value = await callback(tx);
      await client.query("COMMIT");
      return value;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },
};

const uploadRoot = path.resolve(process.env.FILE_STORAGE_PATH || "./data/uploads");
function filePath(key: string) {
  if (!/^[a-zA-Z0-9_-]{1,200}$/.test(key)) throw new Error("Invalid file key");
  return path.join(uploadRoot, key);
}

const BUCKET = {
  async put(key: string, data: ArrayBuffer | ArrayBufferView, _options?: unknown) {
    await mkdir(uploadRoot, { recursive: true, mode: 0o750 });
    const bytes = ArrayBuffer.isView(data)
      ? Buffer.from(data.buffer, data.byteOffset, data.byteLength)
      : Buffer.from(data);
    await writeFile(filePath(key), bytes, { mode: 0o640 });
  },
  async get(key: string) {
    const file = filePath(key);
    try {
      await stat(file);
      return { body: Readable.toWeb(createReadStream(file)) as ReadableStream };
    } catch (error: any) {
      if (error?.code === "ENOENT") return null;
      throw error;
    }
  },
};

export const env = {
  DB,
  BUCKET,
  ADMIN_EMAILS: process.env.ADMIN_EMAILS || "",
  AUTH_SECRET: process.env.AUTH_SECRET || "",
  DEVELOPER_ACCESS_SECRET: process.env.DEVELOPER_ACCESS_SECRET || "",
  SMTP_HOST: process.env.SMTP_HOST || "",
  SMTP_PORT: process.env.SMTP_PORT || "465",
  SMTP_USER: process.env.SMTP_USER || "",
  SMTP_PASSWORD: process.env.SMTP_PASSWORD || "",
  AUTH_FROM: process.env.AUTH_FROM || "",
  PUBLIC_ORIGIN: process.env.PUBLIC_ORIGIN || "",
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || "",
  TELEGRAM_ADMIN_CHAT_IDS: process.env.TELEGRAM_ADMIN_CHAT_IDS || "",
  TURN_URLS: process.env.TURN_URLS || "",
  TURN_USERNAME: process.env.TURN_USERNAME || "",
  TURN_CREDENTIAL: process.env.TURN_CREDENTIAL || "",
};

export const isNodeRuntime = true;
