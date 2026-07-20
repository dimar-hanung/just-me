import type { Client } from "@libsql/client";
import type { Status } from "./types.js";

function rowToStatus(row: Record<string, unknown>): Status {
  return {
    id: String(row.id),
    name: String(row.name),
    sortOrder: Number(row.sort_order),
    createdAt: String(row.created_at),
  };
}

export async function listStatuses(client: Client): Promise<Status[]> {
  const result = await client.execute(
    "SELECT id, name, sort_order, created_at FROM statuses ORDER BY sort_order ASC, name ASC",
  );
  return result.rows.map((row) => rowToStatus(row as Record<string, unknown>));
}

export async function createStatus(
  client: Client,
  name: string,
  sortOrder?: number,
): Promise<Status> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  let order = sortOrder;
  if (order === undefined) {
    const max = await client.execute("SELECT MAX(sort_order) AS max_order FROM statuses");
    order = Number(max.rows[0]?.max_order ?? -1) + 1;
  }
  await client.execute({
    sql: "INSERT INTO statuses (id, name, sort_order, created_at) VALUES (?, ?, ?, ?)",
    args: [id, name, order, now],
  });
  return { id, name, sortOrder: order, createdAt: now };
}

export async function updateStatus(
  client: Client,
  id: string,
  patch: { name?: string; sortOrder?: number },
): Promise<Status | null> {
  const existing = await client.execute({
    sql: "SELECT id, name, sort_order, created_at FROM statuses WHERE id = ?",
    args: [id],
  });
  if (existing.rows.length === 0) return null;

  const current = rowToStatus(existing.rows[0] as Record<string, unknown>);
  const name = patch.name ?? current.name;
  const sortOrder = patch.sortOrder ?? current.sortOrder;

  await client.execute({
    sql: "UPDATE statuses SET name = ?, sort_order = ? WHERE id = ?",
    args: [name, sortOrder, id],
  });
  return { ...current, name, sortOrder };
}

export async function deleteStatus(client: Client, id: string): Promise<{ ok: boolean; reason?: string }> {
  const usage = await client.execute({
    sql: "SELECT COUNT(*) AS count FROM todos WHERE status_id = ? AND deleted_at IS NULL",
    args: [id],
  });
  const count = Number(usage.rows[0]?.count ?? 0);
  if (count > 0) {
    return { ok: false, reason: `${count} todo(s) still use this status` };
  }
  const trashUsage = await client.execute({
    sql: "SELECT COUNT(*) AS count FROM todos WHERE status_id = ? AND deleted_at IS NOT NULL",
    args: [id],
  });
  const trashCount = Number(trashUsage.rows[0]?.count ?? 0);
  if (trashCount > 0) {
    return { ok: false, reason: `${trashCount} trashed todo(s) still use this status` };
  }
  await client.execute({ sql: "DELETE FROM statuses WHERE id = ?", args: [id] });
  return { ok: true };
}

export async function reorderStatuses(client: Client, orderedIds: string[]): Promise<Status[]> {
  for (let i = 0; i < orderedIds.length; i++) {
    await client.execute({
      sql: "UPDATE statuses SET sort_order = ? WHERE id = ?",
      args: [i, orderedIds[i]],
    });
  }
  return listStatuses(client);
}
