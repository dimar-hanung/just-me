import type { Field, ViewColumnId, ViewColumnVisibility, ViewLayout } from "./types.js";

const BUILTIN_COLUMNS: Array<{
  id: ViewColumnId;
  table: boolean;
  kanban: boolean;
}> = [
  { id: "code", table: true, kanban: true },
  { id: "title", table: true, kanban: true },
  { id: "status", table: true, kanban: false },
  { id: "content", table: false, kanban: true },
  { id: "start", table: true, kanban: true },
  { id: "deadline", table: true, kanban: true },
  { id: "done", table: true, kanban: true },
  { id: "updated", table: true, kanban: true },
];

function fieldColumnId(fieldId: string): ViewColumnId {
  return `field:${fieldId}`;
}

export function defaultViewColumns(layout: ViewLayout, fields: Field[] = []): ViewColumnVisibility {
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

export function mergeViewColumns(
  layout: ViewLayout,
  saved: ViewColumnVisibility,
  fields: Field[],
): ViewColumnVisibility {
  const defaults = defaultViewColumns(layout, fields);
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
