export type ViewLayout = "kanban" | "table";

export type ViewPageSize = "10" | "30" | "50" | "100" | "all";

export type ViewBuiltinField =
  | "status"
  | "title"
  | "code"
  | "due_at"
  | "created_at"
  | "updated_at";

export type ViewFieldRef = ViewBuiltinField | `field:${string}`;

export type ViewFilterOp =
  | "is_any_of"
  | "is_none_of"
  | "is_all_of"
  | "contains"
  | "not_contains"
  | "is_empty"
  | "is_not_empty"
  | "before"
  | "after"
  | "on";

export type ViewFilterRule = {
  field: ViewFieldRef;
  op: ViewFilterOp;
  value?: string | string[];
};

export type ViewFilterGroup = {
  logic: "and" | "or";
  rules: ViewFilterRule[];
};

export type ViewFilterItem = ViewFilterRule | ViewFilterGroup;

export type ViewFilters = {
  logic: "and" | "or";
  items: ViewFilterItem[];
};

export type ViewSort = {
  field: ViewFieldRef;
  direction: "asc" | "desc";
};

export type ViewColumnId =
  | "code"
  | "title"
  | "status"
  | "content"
  | "due"
  | "updated"
  | `field:${string}`;

export type ViewColumnVisibility = Partial<Record<ViewColumnId, boolean>>;

export type TodoView = {
  id: string;
  name: string;
  layout: ViewLayout;
  filters: ViewFilters;
  sorts: ViewSort[];
  columns: ViewColumnVisibility;
  pageSize: ViewPageSize;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export function isViewFilterGroup(item: ViewFilterItem): item is ViewFilterGroup {
  return "rules" in item && Array.isArray(item.rules);
}

export function emptyViewFilters(): ViewFilters {
  return { logic: "and", items: [] };
}

export function countFilterRules(filters: ViewFilters): number {
  let count = 0;
  for (const item of filters.items) {
    if (isViewFilterGroup(item)) {
      count += item.rules.length;
    } else {
      count += 1;
    }
  }
  return count;
}

export function fieldColumnId(fieldId: string): ViewColumnId {
  return `field:${fieldId}`;
}
