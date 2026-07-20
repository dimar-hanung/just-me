import type { Client } from "@libsql/client";
import type { Field, FieldOption, FieldType, TodoFieldValues } from "./types.js";

const FIELD_TYPES: FieldType[] = ["tag_multi", "tag_single", "text"];

function isFieldType(value: string): value is FieldType {
  return FIELD_TYPES.includes(value as FieldType);
}

function rowToFieldOption(row: Record<string, unknown>): FieldOption {
  return {
    id: String(row.id),
    fieldId: String(row.field_id),
    label: String(row.label),
    sortOrder: Number(row.sort_order),
  };
}

function rowToField(row: Record<string, unknown>, options: FieldOption[] = []): Field {
  return {
    id: String(row.id),
    name: String(row.name),
    type: String(row.type) as FieldType,
    sortOrder: Number(row.sort_order),
    createdAt: String(row.created_at),
    options,
  };
}

async function listFieldOptionsForField(client: Client, fieldId: string): Promise<FieldOption[]> {
  const result = await client.execute({
    sql: "SELECT id, field_id, label, sort_order FROM field_options WHERE field_id = ? ORDER BY sort_order ASC, label ASC",
    args: [fieldId],
  });
  return result.rows.map((row) => rowToFieldOption(row as Record<string, unknown>));
}

export async function listFields(client: Client): Promise<Field[]> {
  const result = await client.execute(
    "SELECT id, name, type, sort_order, created_at FROM fields ORDER BY sort_order ASC, name ASC",
  );
  const fields: Field[] = [];
  for (const row of result.rows) {
    const field = rowToField(row as Record<string, unknown>);
    field.options = await listFieldOptionsForField(client, field.id);
    fields.push(field);
  }
  return fields;
}

export async function getField(client: Client, id: string): Promise<Field | null> {
  const result = await client.execute({
    sql: "SELECT id, name, type, sort_order, created_at FROM fields WHERE id = ?",
    args: [id],
  });
  if (result.rows.length === 0) return null;
  const field = rowToField(result.rows[0] as Record<string, unknown>);
  field.options = await listFieldOptionsForField(client, field.id);
  return field;
}

export async function createField(
  client: Client,
  name: string,
  type: FieldType,
  sortOrder?: number,
): Promise<Field> {
  if (!isFieldType(type)) {
    throw new Error(`Invalid field type: ${type}`);
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  let order = sortOrder;
  if (order === undefined) {
    const max = await client.execute("SELECT MAX(sort_order) AS max_order FROM fields");
    order = Number(max.rows[0]?.max_order ?? -1) + 1;
  }

  await client.execute({
    sql: "INSERT INTO fields (id, name, type, sort_order, created_at) VALUES (?, ?, ?, ?, ?)",
    args: [id, name, type, order, now],
  });

  return { id, name, type, sortOrder: order, createdAt: now, options: [] };
}

export async function updateField(
  client: Client,
  id: string,
  patch: { name?: string; sortOrder?: number },
): Promise<Field | null> {
  const existing = await getField(client, id);
  if (!existing) return null;

  const name = patch.name ?? existing.name;
  const sortOrder = patch.sortOrder ?? existing.sortOrder;

  await client.execute({
    sql: "UPDATE fields SET name = ?, sort_order = ? WHERE id = ?",
    args: [name, sortOrder, id],
  });

  return getField(client, id);
}

export async function deleteField(client: Client, id: string): Promise<{ ok: boolean }> {
  await client.execute({ sql: "DELETE FROM todo_field_values WHERE field_id = ?", args: [id] });
  await client.execute({ sql: "DELETE FROM field_options WHERE field_id = ?", args: [id] });
  await client.execute({ sql: "DELETE FROM fields WHERE id = ?", args: [id] });
  return { ok: true };
}

export async function reorderFields(client: Client, orderedIds: string[]): Promise<Field[]> {
  for (let i = 0; i < orderedIds.length; i++) {
    await client.execute({
      sql: "UPDATE fields SET sort_order = ? WHERE id = ?",
      args: [i, orderedIds[i]],
    });
  }
  return listFields(client);
}

export async function createFieldOption(
  client: Client,
  fieldId: string,
  label: string,
  sortOrder?: number,
): Promise<FieldOption | null> {
  const field = await getField(client, fieldId);
  if (!field) return null;
  if (field.type === "text") {
    throw new Error("Text fields do not support options");
  }

  const id = crypto.randomUUID();
  let order = sortOrder;
  if (order === undefined) {
    const max = await client.execute({
      sql: "SELECT MAX(sort_order) AS max_order FROM field_options WHERE field_id = ?",
      args: [fieldId],
    });
    order = Number(max.rows[0]?.max_order ?? -1) + 1;
  }

  await client.execute({
    sql: "INSERT INTO field_options (id, field_id, label, sort_order) VALUES (?, ?, ?, ?)",
    args: [id, fieldId, label, order],
  });

  return { id, fieldId, label, sortOrder: order };
}

export async function updateFieldOption(
  client: Client,
  fieldId: string,
  optionId: string,
  patch: { label?: string; sortOrder?: number },
): Promise<FieldOption | null> {
  const existing = await client.execute({
    sql: "SELECT id, field_id, label, sort_order FROM field_options WHERE id = ? AND field_id = ?",
    args: [optionId, fieldId],
  });
  if (existing.rows.length === 0) return null;

  const current = rowToFieldOption(existing.rows[0] as Record<string, unknown>);
  const label = patch.label ?? current.label;
  const sortOrder = patch.sortOrder ?? current.sortOrder;

  await client.execute({
    sql: "UPDATE field_options SET label = ?, sort_order = ? WHERE id = ? AND field_id = ?",
    args: [label, sortOrder, optionId, fieldId],
  });

  return { ...current, label, sortOrder };
}

export async function deleteFieldOption(
  client: Client,
  fieldId: string,
  optionId: string,
): Promise<{ ok: boolean }> {
  const field = await getField(client, fieldId);
  if (!field) return { ok: false };

  await client.execute({
    sql: "DELETE FROM field_options WHERE id = ? AND field_id = ?",
    args: [optionId, fieldId],
  });

  const values = await client.execute({
    sql: "SELECT todo_id, value FROM todo_field_values WHERE field_id = ?",
    args: [fieldId],
  });

  for (const row of values.rows) {
    const todoId = String(row.todo_id);
    const raw = String(row.value);
    if (field.type === "tag_single") {
      if (raw === optionId) {
        await client.execute({
          sql: "DELETE FROM todo_field_values WHERE todo_id = ? AND field_id = ?",
          args: [todoId, fieldId],
        });
      }
      continue;
    }

    if (field.type === "tag_multi") {
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        continue;
      }
      if (!Array.isArray(parsed)) continue;
      const next = parsed.map(String).filter((id) => id !== optionId);
      if (next.length === 0) {
        await client.execute({
          sql: "DELETE FROM todo_field_values WHERE todo_id = ? AND field_id = ?",
          args: [todoId, fieldId],
        });
      } else {
        await client.execute({
          sql: "UPDATE todo_field_values SET value = ? WHERE todo_id = ? AND field_id = ?",
          args: [JSON.stringify(next), todoId, fieldId],
        });
      }
    }
  }

  return { ok: true };
}

function parseStoredValue(raw: string, type: FieldType): string | string[] {
  if (type === "text") return raw;
  if (type === "tag_single") return raw;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function serializeStoredValue(value: string | string[], type: FieldType): string {
  if (type === "tag_multi") return JSON.stringify(Array.isArray(value) ? value : []);
  if (type === "tag_single") return typeof value === "string" ? value : "";
  return typeof value === "string" ? value : "";
}

async function validateFieldValue(
  client: Client,
  fieldId: string,
  value: string | string[],
): Promise<string> {
  const field = await getField(client, fieldId);
  if (!field) throw new Error(`Unknown field: ${fieldId}`);

  const optionIds = new Set(field.options.map((o) => o.id));

  if (field.type === "text") {
    if (typeof value !== "string") throw new Error(`Field ${field.name} expects text`);
    return serializeStoredValue(value, field.type);
  }

  if (field.type === "tag_single") {
    if (typeof value !== "string") throw new Error(`Field ${field.name} expects a single tag`);
    if (value && !optionIds.has(value)) {
      throw new Error(`Invalid option for field ${field.name}`);
    }
    return serializeStoredValue(value, field.type);
  }

  if (!Array.isArray(value)) throw new Error(`Field ${field.name} expects multiple tags`);
  for (const optionId of value) {
    if (!optionIds.has(optionId)) {
      throw new Error(`Invalid option for field ${field.name}`);
    }
  }
  return serializeStoredValue(value, field.type);
}

export async function getTodoFieldValues(
  client: Client,
  todoId: string,
): Promise<TodoFieldValues> {
  const fields = await listFields(client);
  const fieldById = new Map(fields.map((f) => [f.id, f]));

  const result = await client.execute({
    sql: "SELECT field_id, value FROM todo_field_values WHERE todo_id = ?",
    args: [todoId],
  });

  const values: TodoFieldValues = {};
  for (const row of result.rows) {
    const fieldId = String(row.field_id);
    const field = fieldById.get(fieldId);
    if (!field) continue;
    values[fieldId] = parseStoredValue(String(row.value), field.type);
  }
  return values;
}

export async function getTodoFieldValuesBatch(
  client: Client,
  todoIds: string[],
): Promise<Map<string, TodoFieldValues>> {
  const map = new Map<string, TodoFieldValues>();
  if (todoIds.length === 0) return map;

  for (const todoId of todoIds) {
    map.set(todoId, {});
  }

  const fields = await listFields(client);
  const fieldById = new Map(fields.map((f) => [f.id, f]));
  if (fields.length === 0) return map;

  const placeholders = todoIds.map(() => "?").join(", ");
  const result = await client.execute({
    sql: `SELECT todo_id, field_id, value FROM todo_field_values WHERE todo_id IN (${placeholders})`,
    args: todoIds,
  });

  for (const row of result.rows) {
    const todoId = String(row.todo_id);
    const fieldId = String(row.field_id);
    const field = fieldById.get(fieldId);
    if (!field) continue;
    const current = map.get(todoId) ?? {};
    current[fieldId] = parseStoredValue(String(row.value), field.type);
    map.set(todoId, current);
  }

  return map;
}

export async function setTodoFieldValues(
  client: Client,
  todoId: string,
  patch: TodoFieldValues,
): Promise<TodoFieldValues> {
  for (const [fieldId, value] of Object.entries(patch)) {
    const stored = await validateFieldValue(client, fieldId, value);
    const isEmpty =
      stored === "" || stored === "[]" || (Array.isArray(value) && value.length === 0);

    if (isEmpty) {
      await client.execute({
        sql: "DELETE FROM todo_field_values WHERE todo_id = ? AND field_id = ?",
        args: [todoId, fieldId],
      });
      continue;
    }

    await client.execute({
      sql: `INSERT INTO todo_field_values (todo_id, field_id, value) VALUES (?, ?, ?)
            ON CONFLICT(todo_id, field_id) DO UPDATE SET value = excluded.value`,
      args: [todoId, fieldId, stored],
    });
  }

  return getTodoFieldValues(client, todoId);
}
