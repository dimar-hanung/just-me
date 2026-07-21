import type { Client } from "@libsql/client";
import { getDefaultStatusId } from "./db.js";
import {
  getTodoFieldValues,
  getTodoFieldValuesBatch,
  listFields,
  setTodoFieldValues,
} from "./fields.js";
import { generateNextTicketCode } from "./ticket-code.js";
import {
  buildListTodosQueryParts,
  legacyStatusFilter,
  mergeViewFilters,
} from "./todo-filters.js";
import type { Field, Todo, TodoFieldValues, ViewFilters, ViewSort } from "./types.js";

const TODO_SELECT = `
  SELECT t.id, t.code, t.title, t.content, t.status_id, s.name AS status_name,
         t.start_at, t.deadline_at, t.done_at, t.created_at, t.updated_at, t.deleted_at
  FROM todos t
  JOIN statuses s ON s.id = t.status_id
`;

function rowToTodo(row: Record<string, unknown>, fieldValues: TodoFieldValues = {}): Todo {
  return {
    id: String(row.id),
    code: String(row.code ?? ""),
    title: String(row.title),
    content: String(row.content ?? ""),
    statusId: String(row.status_id),
    statusName: row.status_name ? String(row.status_name) : undefined,
    startAt: row.start_at ? String(row.start_at) : null,
    deadlineAt: row.deadline_at ? String(row.deadline_at) : null,
    doneAt: row.done_at ? String(row.done_at) : null,
    fieldValues,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    deletedAt: row.deleted_at ? String(row.deleted_at) : null,
  };
}

async function getStatusName(client: Client, statusId: string): Promise<string | null> {
  const result = await client.execute({
    sql: "SELECT name FROM statuses WHERE id = ?",
    args: [statusId],
  });
  const name = result.rows[0]?.name;
  return typeof name === "string" ? name : null;
}

async function attachFieldValues(client: Client, todos: Todo[]): Promise<Todo[]> {
  if (todos.length === 0) return todos;
  const valuesMap = await getTodoFieldValuesBatch(
    client,
    todos.map((t) => t.id),
  );
  return todos.map((todo) => ({
    ...todo,
    fieldValues: valuesMap.get(todo.id) ?? {},
  }));
}

export type ListTodosFilter = {
  statusId?: string;
  code?: string;
  filters?: ViewFilters;
  sorts?: ViewSort[];
  limit?: number;
  offset?: number;
};

export type ListTodosResult = {
  todos: Todo[];
  total: number;
  hasMore: boolean;
};

function resolveListFilters(filter: ListTodosFilter): { filters?: ViewFilters; sorts?: ViewSort[] } {
  let filters = filter.filters;
  const sorts = filter.sorts;

  if (filter.statusId) {
    filters = mergeViewFilters(filters ?? { logic: "and", items: [] }, legacyStatusFilter(filter.statusId));
  }

  return { filters, sorts };
}

function buildListTodosWhere(filter: ListTodosFilter): { where: string; args: (string | number)[] } {
  const { filters } = resolveListFilters(filter);
  let where = " WHERE t.deleted_at IS NULL";
  const args: (string | number)[] = [];

  if (filter.code) {
    where += " AND UPPER(t.code) = ?";
    args.push(filter.code.trim().toUpperCase());
  }

  const filterPart = buildListTodosQueryParts(filters, undefined);
  where += filterPart.where;
  args.push(...filterPart.args);

  return { where, args };
}

function buildListTodosOrder(filter: ListTodosFilter): {
  orderBy: string;
  joins: string;
  joinArgs: (string | number)[];
} {
  const { filters, sorts } = resolveListFilters(filter);
  const parts = buildListTodosQueryParts(filters, sorts);
  return { orderBy: parts.orderBy, joins: parts.joins, joinArgs: parts.joinArgs };
}

export async function listTodos(
  client: Client,
  filter: ListTodosFilter & { limit: number },
): Promise<ListTodosResult>;
export async function listTodos(client: Client, filter?: ListTodosFilter): Promise<Todo[]>;
export async function listTodos(
  client: Client,
  filter: ListTodosFilter = {},
): Promise<Todo[] | ListTodosResult> {
  const { where, args } = buildListTodosWhere(filter);
  const { orderBy, joins, joinArgs } = buildListTodosOrder(filter);
  const fromClause = `${TODO_SELECT}${joins}`;

  if (filter.limit !== undefined) {
    const offset = filter.offset ?? 0;
    const countResult = await client.execute({
      sql: `SELECT COUNT(*) AS total FROM todos t JOIN statuses s ON s.id = t.status_id${joins}${where}`,
      args: [...joinArgs, ...args],
    });
    const total = Number(countResult.rows[0]?.total ?? 0);

    const result = await client.execute({
      sql: `${fromClause}${where}${orderBy} LIMIT ? OFFSET ?`,
      args: [...joinArgs, ...args, filter.limit, offset],
    });
    const todos = result.rows.map((row) => rowToTodo(row as Record<string, unknown>));
    const withFields = await attachFieldValues(client, todos);
    return {
      todos: withFields,
      total,
      hasMore: offset + withFields.length < total,
    };
  }

  const result = await client.execute({
    sql: `${fromClause}${where}${orderBy}`,
    args: [...joinArgs, ...args],
  });
  const todos = result.rows.map((row) => rowToTodo(row as Record<string, unknown>));
  return attachFieldValues(client, todos);
}

export async function listTrash(client: Client): Promise<Todo[]> {
  const result = await client.execute(
    `${TODO_SELECT} WHERE t.deleted_at IS NOT NULL ORDER BY t.deleted_at DESC`,
  );
  const todos = result.rows.map((row) => rowToTodo(row as Record<string, unknown>));
  return attachFieldValues(client, todos);
}

export async function addTodo(
  client: Client,
  input: {
    title: string;
    content?: string;
    statusId?: string;
    startAt?: string | null;
    deadlineAt?: string | null;
    doneAt?: string | null;
    fieldValues?: TodoFieldValues;
  },
): Promise<Todo> {
  const id = crypto.randomUUID();
  const code = await generateNextTicketCode(client);
  const now = new Date().toISOString();
  const statusId = input.statusId ?? (await getDefaultStatusId(client));
  const content = input.content ?? "";
  const statusName = await getStatusName(client, statusId);
  let doneAt = input.doneAt ?? null;
  if (doneAt === null && statusName === "Done") {
    doneAt = now;
  }

  await client.execute({
    sql: `INSERT INTO todos (id, code, title, content, status_id, start_at, deadline_at, done_at, created_at, updated_at, deleted_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
    args: [
      id,
      code,
      input.title,
      content,
      statusId,
      input.startAt ?? null,
      input.deadlineAt ?? null,
      doneAt,
      now,
      now,
    ],
  });

  if (input.fieldValues && Object.keys(input.fieldValues).length > 0) {
    await setTodoFieldValues(client, id, input.fieldValues);
  }

  const todo = await getTodo(client, id);
  if (!todo) throw new Error("Failed to create todo");
  return todo;
}

export async function getTodo(client: Client, id: string): Promise<Todo | null> {
  const result = await client.execute({
    sql: `${TODO_SELECT} WHERE t.id = ? AND t.deleted_at IS NULL`,
    args: [id],
  });
  if (result.rows.length === 0) return null;
  const todo = rowToTodo(result.rows[0] as Record<string, unknown>);
  todo.fieldValues = await getTodoFieldValues(client, id);
  return todo;
}

export async function getTodoByCode(client: Client, code: string): Promise<Todo | null> {
  const todos = await listTodos(client, { code });
  return todos[0] ?? null;
}

export async function updateTodo(
  client: Client,
  id: string,
  patch: {
    title?: string;
    content?: string;
    statusId?: string;
    startAt?: string | null;
    deadlineAt?: string | null;
    doneAt?: string | null;
    fieldValues?: TodoFieldValues;
  },
): Promise<Todo | null> {
  const current = await getTodo(client, id);
  if (!current) return null;

  const title = patch.title ?? current.title;
  const content = patch.content ?? current.content;
  const statusId = patch.statusId ?? current.statusId;
  let startAt = patch.startAt !== undefined ? patch.startAt : current.startAt;
  let deadlineAt = patch.deadlineAt !== undefined ? patch.deadlineAt : current.deadlineAt;
  let doneAt = patch.doneAt !== undefined ? patch.doneAt : current.doneAt;
  const updatedAt = new Date().toISOString();

  const statusChanged = patch.statusId !== undefined && patch.statusId !== current.statusId;
  if (statusChanged && patch.doneAt === undefined) {
    const newStatusName = await getStatusName(client, statusId);
    const oldStatusName = current.statusName ?? (await getStatusName(client, current.statusId));
    if (newStatusName === "Done" && doneAt === null) {
      doneAt = updatedAt;
    } else if (oldStatusName === "Done" && newStatusName !== "Done") {
      doneAt = null;
    }
  }

  await client.execute({
    sql: "UPDATE todos SET title = ?, content = ?, status_id = ?, start_at = ?, deadline_at = ?, done_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL",
    args: [title, content, statusId, startAt, deadlineAt, doneAt, updatedAt, id],
  });

  if (patch.fieldValues) {
    await setTodoFieldValues(client, id, patch.fieldValues);
  }

  return getTodo(client, id);
}

/** Move a todo to trash (soft delete). */
export async function deleteTodo(client: Client, id: string): Promise<boolean> {
  const now = new Date().toISOString();
  const result = await client.execute({
    sql: "UPDATE todos SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL",
    args: [now, now, id],
  });
  return (result.rowsAffected ?? 0) > 0;
}

export async function restoreTodo(client: Client, id: string): Promise<Todo | null> {
  const result = await client.execute({
    sql: "UPDATE todos SET deleted_at = NULL, updated_at = ? WHERE id = ? AND deleted_at IS NOT NULL",
    args: [new Date().toISOString(), id],
  });
  if ((result.rowsAffected ?? 0) === 0) return null;
  return getTodo(client, id);
}

/** Permanently remove a trashed todo. */
export async function purgeTodo(client: Client, id: string): Promise<boolean> {
  await client.execute({
    sql: "DELETE FROM todo_field_values WHERE todo_id = ?",
    args: [id],
  });
  const result = await client.execute({
    sql: "DELETE FROM todos WHERE id = ? AND deleted_at IS NOT NULL",
    args: [id],
  });
  return (result.rowsAffected ?? 0) > 0;
}

export async function emptyTrash(client: Client): Promise<number> {
  const trashed = await client.execute("SELECT id FROM todos WHERE deleted_at IS NOT NULL");
  for (const row of trashed.rows) {
    await client.execute({
      sql: "DELETE FROM todo_field_values WHERE todo_id = ?",
      args: [String(row.id)],
    });
  }
  const result = await client.execute("DELETE FROM todos WHERE deleted_at IS NOT NULL");
  return result.rowsAffected ?? 0;
}

export async function exportTodosJson(client: Client): Promise<string> {
  const statuses = await client.execute(
    "SELECT id, name, sort_order, created_at FROM statuses ORDER BY sort_order ASC",
  );
  const fields = await listFields(client);
  const active = await listTodos(client, {});
  const trashed = await listTrash(client);
  const payload = {
    exportedAt: new Date().toISOString(),
    statuses: statuses.rows.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      sortOrder: Number(row.sort_order),
      createdAt: String(row.created_at),
    })),
    fields,
    todos: [...active, ...trashed],
  };
  return JSON.stringify(payload, null, 2);
}

export async function importTodosJson(client: Client, json: string): Promise<void> {
  const payload = JSON.parse(json) as {
    statuses: { id: string; name: string; sortOrder: number; createdAt: string }[];
    fields?: Field[];
    todos: Array<
      Todo & {
        tags?: string[];
      }
    >;
  };

  await client.execute("DELETE FROM todo_field_values");
  await client.execute("DELETE FROM field_options");
  await client.execute("DELETE FROM fields");
  await client.execute("DELETE FROM todos");
  await client.execute("DELETE FROM statuses");

  for (const status of payload.statuses) {
    await client.execute({
      sql: "INSERT INTO statuses (id, name, sort_order, created_at) VALUES (?, ?, ?, ?)",
      args: [status.id, status.name, status.sortOrder, status.createdAt],
    });
  }

  for (const field of payload.fields ?? []) {
    await client.execute({
      sql: "INSERT INTO fields (id, name, type, sort_order, created_at) VALUES (?, ?, ?, ?, ?)",
      args: [field.id, field.name, field.type, field.sortOrder, field.createdAt],
    });
    for (const option of field.options ?? []) {
      await client.execute({
        sql: "INSERT INTO field_options (id, field_id, label, sort_order) VALUES (?, ?, ?, ?)",
        args: [option.id, field.id, option.label, option.sortOrder],
      });
    }
  }

  for (const todo of payload.todos) {
    const code = todo.code?.trim() ? todo.code : await generateNextTicketCode(client);
    const legacy = todo as Todo & { dueAt?: string | null };
    await client.execute({
      sql: `INSERT INTO todos (id, code, title, content, status_id, start_at, deadline_at, done_at, created_at, updated_at, deleted_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        todo.id,
        code,
        todo.title,
        todo.content ?? "",
        todo.statusId,
        todo.startAt ?? null,
        todo.deadlineAt ?? legacy.dueAt ?? null,
        todo.doneAt ?? null,
        todo.createdAt,
        todo.updatedAt,
        todo.deletedAt ?? null,
      ],
    });

    if (todo.fieldValues && Object.keys(todo.fieldValues).length > 0) {
      await setTodoFieldValues(client, todo.id, todo.fieldValues);
    }
  }
}
