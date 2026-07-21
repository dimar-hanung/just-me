import type { Field } from "./api";
import type { TodoView, ViewColumnVisibility, ViewLayout, ViewPageSize } from "./view-types";
import { fieldColumnId } from "./view-types";

const VIEW_MODE_KEY = "just-me-todo-view";
const COLUMNS_KEY = "just-me-todo-columns";
const PAGE_SIZE_KEY = "just-me-todo-page-size";

type LegacyColumnVisibility = {
  table?: Partial<Record<string, boolean>>;
  kanban?: Partial<Record<string, boolean>>;
};

function parsePageSize(raw: string | null): ViewPageSize | null {
  if (raw === "10" || raw === "30" || raw === "50" || raw === "100" || raw === "all") {
    return raw;
  }
  return null;
}

function defaultColumnsForLayout(layout: ViewLayout, fields: Field[]): ViewColumnVisibility {
  const columns: ViewColumnVisibility = {};
  const builtins: Array<{ id: keyof ViewColumnVisibility extends infer K ? K : never; table: boolean; kanban: boolean; defaultKanban?: boolean }> = [
    { id: "code", table: true, kanban: true, defaultKanban: true },
    { id: "title", table: true, kanban: true, defaultKanban: true },
    { id: "status", table: true, kanban: false },
    { id: "content", table: false, kanban: true, defaultKanban: true },
    { id: "due", table: true, kanban: true },
    { id: "updated", table: true, kanban: true },
  ];

  for (const col of builtins) {
    if (layout === "table" && !col.table) continue;
    if (layout === "kanban" && !col.kanban) continue;
    columns[col.id as keyof ViewColumnVisibility] =
      layout === "kanban" ? Boolean(col.defaultKanban) : true;
  }

  for (const field of fields) {
    columns[fieldColumnId(field.id)] = layout === "table";
  }

  return columns;
}

export async function migrateLegacyViewPrefs(
  views: TodoView[],
  fields: Field[],
  updateView: (
    id: string,
    patch: Partial<Pick<TodoView, "layout" | "columns" | "pageSize">>,
  ) => Promise<TodoView>,
): Promise<TodoView[]> {
  let viewMode: ViewLayout | null = null;
  let columns: LegacyColumnVisibility | null = null;
  let pageSize: ViewPageSize | null = null;

  try {
    const rawMode = localStorage.getItem(VIEW_MODE_KEY);
    viewMode = rawMode === "table" ? "table" : rawMode === "kanban" ? "kanban" : null;

    const rawColumns = localStorage.getItem(COLUMNS_KEY);
    if (rawColumns) columns = JSON.parse(rawColumns) as LegacyColumnVisibility;

    pageSize = parsePageSize(localStorage.getItem(PAGE_SIZE_KEY));
  } catch {
    return views;
  }

  if (!viewMode && !columns && !pageSize) return views;

  const tableView = views.find((v) => v.layout === "table") ?? views[0];
  const boardView = views.find((v) => v.layout === "kanban") ?? views[1] ?? views[0];

  const nextViews = [...views];

  if (tableView) {
    const patch: Partial<Pick<TodoView, "columns" | "pageSize">> = {};
    if (columns?.table) patch.columns = columns.table as ViewColumnVisibility;
    if (viewMode === "table" && pageSize) patch.pageSize = pageSize;
    if (Object.keys(patch).length > 0) {
      const updated = await updateView(tableView.id, patch);
      const idx = nextViews.findIndex((v) => v.id === tableView.id);
      if (idx >= 0) nextViews[idx] = updated;
    }
  }

  if (boardView && boardView.id !== tableView?.id) {
    const patch: Partial<Pick<TodoView, "layout" | "columns" | "pageSize">> = {};
    if (columns?.kanban) patch.columns = columns.kanban as ViewColumnVisibility;
    if (viewMode === "kanban" && pageSize) patch.pageSize = pageSize;
    if (Object.keys(patch).length > 0) {
      const updated = await updateView(boardView.id, patch);
      const idx = nextViews.findIndex((v) => v.id === boardView.id);
      if (idx >= 0) nextViews[idx] = updated;
    }
  }

  localStorage.removeItem(VIEW_MODE_KEY);
  localStorage.removeItem(COLUMNS_KEY);
  localStorage.removeItem(PAGE_SIZE_KEY);

  return nextViews;
}

export { defaultColumnsForLayout };
