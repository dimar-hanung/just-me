import type { Field } from "./api";
import type { ViewColumnId, ViewColumnVisibility, ViewLayout } from "./view-types";
import { fieldColumnId } from "./view-types";

export type TodoBuiltinColumnId = "code" | "title" | "status" | "content" | "due" | "updated";
export type TodoColumnId = ViewColumnId;

export type TodoColumnDefinition = {
  id: TodoColumnId;
  label: string;
  locked?: boolean;
};

const BUILTIN_COLUMNS: Array<{
  id: TodoBuiltinColumnId;
  label: string;
  table: boolean;
  kanban: boolean;
  locked?: boolean;
}> = [
  { id: "code", label: "Code", table: true, kanban: true },
  { id: "title", label: "Title", table: true, kanban: true, locked: true },
  { id: "status", label: "Status", table: true, kanban: false },
  { id: "content", label: "Notes preview", table: false, kanban: true },
  { id: "due", label: "Due", table: true, kanban: true },
  { id: "updated", label: "Updated", table: true, kanban: true },
];

export function defaultColumnVisibility(layout: ViewLayout, fields: Field[]): ViewColumnVisibility {
  const columns: ViewColumnVisibility = {};

  for (const col of BUILTIN_COLUMNS) {
    if (layout === "table" && !col.table) continue;
    if (layout === "kanban" && !col.kanban) continue;

    if (layout === "kanban") {
      columns[col.id] = col.id === "code" || col.id === "title" || col.id === "content";
    } else {
      columns[col.id] = true;
    }
  }

  for (const field of fields) {
    columns[fieldColumnId(field.id)] = layout === "table";
  }

  return columns;
}

export function mergeFieldColumns(
  layout: ViewLayout,
  saved: ViewColumnVisibility,
  fields: Field[],
): ViewColumnVisibility {
  const defaults = defaultColumnVisibility(layout, fields);
  const next: ViewColumnVisibility = {};

  for (const col of BUILTIN_COLUMNS) {
    if (layout === "table" && !col.table) continue;
    if (layout === "kanban" && !col.kanban) continue;
    next[col.id] = saved[col.id] ?? defaults[col.id] ?? true;
  }

  for (const field of fields) {
    const id = fieldColumnId(field.id);
    next[id] = saved[id] ?? defaults[id] ?? layout === "table";
  }

  return next;
}

export function isColumnVisible(visibility: ViewColumnVisibility, id: TodoColumnId): boolean {
  if (id === "title") return true;
  return visibility[id] ?? false;
}

export function visibleColumnSet(visibility: ViewColumnVisibility): Set<TodoColumnId> {
  const ids = new Set<TodoColumnId>();
  for (const [id, visible] of Object.entries(visibility)) {
    if (visible) ids.add(id as TodoColumnId);
  }
  ids.add("title");
  return ids;
}

export function buildColumnDefinitions(fields: Field[], layout: ViewLayout): TodoColumnDefinition[] {
  const rows: TodoColumnDefinition[] = [];

  for (const col of BUILTIN_COLUMNS) {
    if (layout === "table" && !col.table) continue;
    if (layout === "kanban" && !col.kanban) continue;
    rows.push({ id: col.id, label: col.label, locked: col.locked });
  }

  for (const field of fields) {
    rows.push({ id: fieldColumnId(field.id), label: field.name });
  }

  return rows;
}

export function toggleColumnVisibility(
  visibility: ViewColumnVisibility,
  id: TodoColumnId,
): ViewColumnVisibility {
  if (id === "title") return visibility;
  return {
    ...visibility,
    [id]: !isColumnVisible(visibility, id),
  };
}

export function resetColumnVisibility(layout: ViewLayout, fields: Field[]): ViewColumnVisibility {
  return defaultColumnVisibility(layout, fields);
}

export { fieldColumnId };

export function isFieldColumnId(id: string): id is `field:${string}` {
  return id.startsWith("field:");
}
