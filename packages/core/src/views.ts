import type { Client } from "@libsql/client";
import { defaultViewColumns } from "./view-columns.js";
import {
  DEFAULT_VIEW_FILTERS,
  DEFAULT_VIEW_SORTS,
  ViewColumnVisibilitySchema,
  ViewFiltersSchema,
  ViewLayoutSchema,
  ViewPageSizeSchema,
  ViewSortSchema,
} from "./view-schemas.js";
import type {
  TodoView,
  ViewColumnVisibility,
  ViewFilters,
  ViewLayout,
  ViewPageSize,
  ViewSort,
} from "./types.js";

function rowToView(row: Record<string, unknown>): TodoView {
  const filtersRaw = row.filters_json ? JSON.parse(String(row.filters_json)) : DEFAULT_VIEW_FILTERS;
  const sortsRaw = row.sorts_json ? JSON.parse(String(row.sorts_json)) : DEFAULT_VIEW_SORTS;
  const columnsRaw = row.columns_json ? JSON.parse(String(row.columns_json)) : {};

  return {
    id: String(row.id),
    name: String(row.name),
    layout: String(row.layout) as ViewLayout,
    filters: ViewFiltersSchema.parse(filtersRaw) as ViewFilters,
    sorts: zSorts(sortsRaw),
    columns: ViewColumnVisibilitySchema.parse(columnsRaw),
    pageSize: String(row.page_size) as ViewPageSize,
    sortOrder: Number(row.sort_order),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function zSorts(raw: unknown): ViewSort[] {
  const parsed = ViewSortSchema.array().safeParse(raw);
  if (parsed.success && parsed.data.length > 0) return parsed.data as ViewSort[];
  return [...DEFAULT_VIEW_SORTS];
}

export async function listViews(client: Client): Promise<TodoView[]> {
  const result = await client.execute(
    "SELECT id, name, layout, filters_json, sorts_json, columns_json, page_size, sort_order, created_at, updated_at FROM views ORDER BY sort_order ASC, name ASC",
  );
  return result.rows.map((row) => rowToView(row as Record<string, unknown>));
}

export async function getView(client: Client, id: string): Promise<TodoView | null> {
  const result = await client.execute({
    sql: "SELECT id, name, layout, filters_json, sorts_json, columns_json, page_size, sort_order, created_at, updated_at FROM views WHERE id = ?",
    args: [id],
  });
  if (result.rows.length === 0) return null;
  return rowToView(result.rows[0] as Record<string, unknown>);
}

export async function createView(
  client: Client,
  input: {
    name: string;
    layout?: ViewLayout;
    filters?: ViewFilters;
    sorts?: ViewSort[];
    columns?: ViewColumnVisibility;
    pageSize?: ViewPageSize;
    copyFrom?: TodoView;
  },
): Promise<TodoView> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const max = await client.execute("SELECT MAX(sort_order) AS max_order FROM views");
  const sortOrder = Number(max.rows[0]?.max_order ?? -1) + 1;

  const layout = input.layout ?? input.copyFrom?.layout ?? "table";
  const filters = input.filters ?? input.copyFrom?.filters ?? DEFAULT_VIEW_FILTERS;
  const sorts =
    input.sorts ?? (input.copyFrom?.sorts.length ? input.copyFrom.sorts : [...DEFAULT_VIEW_SORTS]);
  const columns = input.columns ?? input.copyFrom?.columns ?? defaultViewColumns(layout);
  const pageSize = input.pageSize ?? input.copyFrom?.pageSize ?? "30";

  ViewLayoutSchema.parse(layout);
  ViewFiltersSchema.parse(filters);
  ViewSortSchema.array().parse(sorts);
  ViewColumnVisibilitySchema.parse(columns);
  ViewPageSizeSchema.parse(pageSize);

  await client.execute({
    sql: `INSERT INTO views (id, name, layout, filters_json, sorts_json, columns_json, page_size, sort_order, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      input.name,
      layout,
      JSON.stringify(filters),
      JSON.stringify(sorts),
      JSON.stringify(columns),
      pageSize,
      sortOrder,
      now,
      now,
    ],
  });

  return {
    id,
    name: input.name,
    layout,
    filters,
    sorts,
    columns,
    pageSize,
    sortOrder,
    createdAt: now,
    updatedAt: now,
  };
}

export async function updateView(
  client: Client,
  id: string,
  patch: {
    name?: string;
    layout?: ViewLayout;
    filters?: ViewFilters;
    sorts?: ViewSort[];
    columns?: ViewColumnVisibility;
    pageSize?: ViewPageSize;
  },
): Promise<TodoView | null> {
  const current = await getView(client, id);
  if (!current) return null;

  const name = patch.name ?? current.name;
  const layout = patch.layout ?? current.layout;
  const filters = patch.filters ?? current.filters;
  const sorts = patch.sorts ?? current.sorts;
  const columns = patch.columns ?? current.columns;
  const pageSize = patch.pageSize ?? current.pageSize;
  const updatedAt = new Date().toISOString();

  ViewLayoutSchema.parse(layout);
  ViewFiltersSchema.parse(filters);
  ViewSortSchema.array().parse(sorts);
  ViewColumnVisibilitySchema.parse(columns);
  ViewPageSizeSchema.parse(pageSize);

  await client.execute({
    sql: `UPDATE views SET name = ?, layout = ?, filters_json = ?, sorts_json = ?, columns_json = ?, page_size = ?, updated_at = ?
          WHERE id = ?`,
    args: [
      name,
      layout,
      JSON.stringify(filters),
      JSON.stringify(sorts),
      JSON.stringify(columns),
      pageSize,
      updatedAt,
      id,
    ],
  });

  return {
    ...current,
    name,
    layout,
    filters,
    sorts,
    columns,
    pageSize,
    updatedAt,
  };
}

export async function deleteView(client: Client, id: string): Promise<{ ok: boolean; reason?: string }> {
  const countResult = await client.execute("SELECT COUNT(*) AS count FROM views");
  const count = Number(countResult.rows[0]?.count ?? 0);
  if (count <= 1) {
    return { ok: false, reason: "Cannot delete the last view" };
  }

  const result = await client.execute({ sql: "DELETE FROM views WHERE id = ?", args: [id] });
  if ((result.rowsAffected ?? 0) === 0) {
    return { ok: false, reason: "View not found" };
  }
  return { ok: true };
}

export async function reorderViews(client: Client, ids: string[]): Promise<TodoView[]> {
  const existing = await listViews(client);
  const existingIds = new Set(existing.map((v) => v.id));
  for (const id of ids) {
    if (!existingIds.has(id)) {
      throw new Error(`Unknown view id: ${id}`);
    }
  }

  const now = new Date().toISOString();
  for (let i = 0; i < ids.length; i++) {
    await client.execute({
      sql: "UPDATE views SET sort_order = ?, updated_at = ? WHERE id = ?",
      args: [i, now, ids[i]],
    });
  }

  const remaining = existing.filter((v) => !ids.includes(v.id));
  for (let i = 0; i < remaining.length; i++) {
    await client.execute({
      sql: "UPDATE views SET sort_order = ?, updated_at = ? WHERE id = ?",
      args: [ids.length + i, now, remaining[i].id],
    });
  }

  return listViews(client);
}

export async function seedDefaultViews(client: Client): Promise<void> {
  const countResult = await client.execute("SELECT COUNT(*) AS count FROM views");
  const count = Number(countResult.rows[0]?.count ?? 0);
  if (count > 0) return;

  const now = new Date().toISOString();
  const tableId = crypto.randomUUID();
  const boardId = crypto.randomUUID();

  const tableColumns = defaultViewColumns("table");
  const boardColumns = defaultViewColumns("kanban");

  await client.batch([
    {
      sql: `INSERT INTO views (id, name, layout, filters_json, sorts_json, columns_json, page_size, sort_order, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        tableId,
        "All todos",
        "table",
        JSON.stringify(DEFAULT_VIEW_FILTERS),
        JSON.stringify(DEFAULT_VIEW_SORTS),
        JSON.stringify(tableColumns),
        "30",
        0,
        now,
        now,
      ],
    },
    {
      sql: `INSERT INTO views (id, name, layout, filters_json, sorts_json, columns_json, page_size, sort_order, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        boardId,
        "Board",
        "kanban",
        JSON.stringify(DEFAULT_VIEW_FILTERS),
        JSON.stringify(DEFAULT_VIEW_SORTS),
        JSON.stringify(boardColumns),
        "30",
        1,
        now,
        now,
      ],
    },
  ]);
}
