import { z } from "zod";

const ViewBuiltinFieldSchema = z.enum([
  "status",
  "title",
  "code",
  "start_at",
  "deadline_at",
  "done_at",
  "created_at",
  "updated_at",
]);

const ViewFieldRefSchema = z.union([
  ViewBuiltinFieldSchema,
  z.string().regex(/^field:[0-9a-f-]{36}$/i),
]);

const ViewFilterOpSchema = z.enum([
  "is_any_of",
  "is_none_of",
  "is_all_of",
  "contains",
  "not_contains",
  "is_empty",
  "is_not_empty",
  "before",
  "after",
  "on",
  "on_or_before_today",
]);

export const ViewFilterRuleSchema = z.object({
  field: ViewFieldRefSchema,
  op: ViewFilterOpSchema,
  value: z.union([z.string(), z.array(z.string())]).optional(),
});

export const ViewFilterGroupSchema = z.object({
  logic: z.enum(["and", "or"]),
  rules: z.array(ViewFilterRuleSchema),
});

export const ViewFilterItemSchema = z.union([ViewFilterGroupSchema, ViewFilterRuleSchema]);

export const ViewFiltersSchema = z.object({
  logic: z.enum(["and", "or"]),
  items: z.array(ViewFilterItemSchema),
});

export const ViewSortSchema = z.object({
  field: ViewFieldRefSchema,
  direction: z.enum(["asc", "desc"]),
});

export const ViewColumnIdSchema = z.union([
  z.enum(["code", "title", "status", "content", "start", "deadline", "done", "updated"]),
  z.string().regex(/^field:[0-9a-f-]{36}$/i),
]);

export const ViewColumnVisibilitySchema = z.record(ViewColumnIdSchema, z.boolean());

export const ViewLayoutSchema = z.enum(["kanban", "table"]);

export const ViewPageSizeSchema = z.enum(["10", "30", "50", "100", "all"]);

export const DEFAULT_VIEW_FILTERS = { logic: "and" as const, items: [] };

export const DEFAULT_VIEW_SORTS = [{ field: "updated_at" as const, direction: "desc" as const }];

export const TODAY_VIEW_FILTERS = {
  logic: "and" as const,
  items: [
    { field: "done_at" as const, op: "is_empty" as const },
    { field: "deadline_at" as const, op: "on_or_before_today" as const },
  ],
};

export const TODAY_VIEW_SORTS = [
  { field: "deadline_at" as const, direction: "asc" as const },
  { field: "updated_at" as const, direction: "desc" as const },
];

export function emptyViewFilters() {
  return { logic: "and" as const, items: [] };
}

export function defaultViewSorts() {
  return [...DEFAULT_VIEW_SORTS];
}

export function isViewFilterGroup(item: z.infer<typeof ViewFilterItemSchema>): item is z.infer<
  typeof ViewFilterGroupSchema
> {
  return "rules" in item && Array.isArray(item.rules);
}
