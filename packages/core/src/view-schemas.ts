import { z } from "zod";

const ViewBuiltinFieldSchema = z.enum([
  "status",
  "title",
  "code",
  "due_at",
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
  z.enum(["code", "title", "status", "content", "due", "updated"]),
  z.string().regex(/^field:[0-9a-f-]{36}$/i),
]);

export const ViewColumnVisibilitySchema = z.record(ViewColumnIdSchema, z.boolean());

export const ViewLayoutSchema = z.enum(["kanban", "table"]);

export const ViewPageSizeSchema = z.enum(["10", "30", "50", "100", "all"]);

export const DEFAULT_VIEW_FILTERS = { logic: "and" as const, items: [] };

export const DEFAULT_VIEW_SORTS = [{ field: "updated_at" as const, direction: "desc" as const }];

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
