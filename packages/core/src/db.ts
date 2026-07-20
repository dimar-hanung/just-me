import { createClient, type Client } from "@libsql/client";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { loadConfig, resolveStorageUrl, getDefaultSqlitePath } from "./config.js";
import { backfillMissingTicketCodes, migrateLegacyTicketCodes } from "./ticket-code.js";
import { DEFAULT_STATUSES } from "./types.js";
import type { AppConfig } from "./types.js";

export type DbContext = {
  client: Client;
  config: AppConfig;
};

export async function createDb(config?: AppConfig): Promise<DbContext> {
  const resolved = config ?? (await loadConfig());
  if (!resolved.storage) {
    throw new Error("Storage is not configured");
  }

  if (resolved.storage.mode === "local") {
    const filePath = resolved.storage.path ?? getDefaultSqlitePath();
    await mkdir(dirname(filePath), { recursive: true, mode: 0o700 });
  }

  const { url, authToken } = resolveStorageUrl(resolved.storage);
  const client = createClient({ url, authToken });
  await migrate(client);
  return { client, config: resolved };
}

export async function testStorageConnection(config: AppConfig): Promise<void> {
  if (!config.storage) {
    throw new Error("Storage configuration is required");
  }
  const ctx = await createDb({ ...config, onboardingComplete: config.onboardingComplete });
  await ctx.client.execute("SELECT 1");
}

async function hasColumn(client: Client, table: string, column: string): Promise<boolean> {
  const result = await client.execute(`PRAGMA table_info(${table})`);
  return result.rows.some((row) => row.name === column);
}

async function migrate(client: Client): Promise<void> {
  await client.batch([
    `CREATE TABLE IF NOT EXISTS statuses (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      sort_order INTEGER NOT NULL,
      created_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS todos (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE,
      title TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      status_id TEXT NOT NULL REFERENCES statuses(id),
      due_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    )`,
  ]);

  // SQLite cannot ADD COLUMN ... UNIQUE on a table that already has rows.
  if (!(await hasColumn(client, "todos", "code"))) {
    await client.execute("ALTER TABLE todos ADD COLUMN code TEXT");
  }

  if (!(await hasColumn(client, "todos", "content"))) {
    await client.execute("ALTER TABLE todos ADD COLUMN content TEXT NOT NULL DEFAULT ''");
  }

  if (!(await hasColumn(client, "todos", "deleted_at"))) {
    await client.execute("ALTER TABLE todos ADD COLUMN deleted_at TEXT");
  }

  if (await hasColumn(client, "todos", "tags")) {
    try {
      await client.execute("ALTER TABLE todos DROP COLUMN tags");
    } catch {
      // Some SQLite/libSQL builds may not support DROP COLUMN; column is unused.
    }
  }

  await migrateLegacyTicketCodes(client);
  await backfillMissingTicketCodes(client);

  await client.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_todos_code ON todos(code)");

  await client.batch([
    `CREATE TABLE IF NOT EXISTS fields (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      created_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS field_options (
      id TEXT PRIMARY KEY,
      field_id TEXT NOT NULL REFERENCES fields(id),
      label TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      UNIQUE(field_id, label)
    )`,
    `CREATE TABLE IF NOT EXISTS todo_field_values (
      todo_id TEXT NOT NULL REFERENCES todos(id),
      field_id TEXT NOT NULL REFERENCES fields(id),
      value TEXT NOT NULL,
      PRIMARY KEY (todo_id, field_id)
    )`,
  ]);

  const existing = await client.execute("SELECT COUNT(*) AS count FROM statuses");
  const count = Number(existing.rows[0]?.count ?? 0);
  if (count === 0) {
    const now = new Date().toISOString();
    for (const status of DEFAULT_STATUSES) {
      const id = crypto.randomUUID();
      await client.execute({
        sql: "INSERT INTO statuses (id, name, sort_order, created_at) VALUES (?, ?, ?, ?)",
        args: [id, status.name, status.sortOrder, now],
      });
    }
  }
}

export async function getDefaultStatusId(client: Client): Promise<string> {
  const result = await client.execute({
    sql: "SELECT id FROM statuses WHERE name = ? LIMIT 1",
    args: ["Not Started"],
  });
  const id = result.rows[0]?.id;
  if (typeof id !== "string") {
    throw new Error("Default status 'Not Started' not found");
  }
  return id;
}
