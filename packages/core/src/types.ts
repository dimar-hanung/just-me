import { z } from "zod";

export const LocalStorageSchema = z.object({
  mode: z.literal("local"),
  path: z.string().optional(),
});

export const TursoStorageSchema = z.object({
  mode: z.literal("turso"),
  url: z.string().min(1),
  authToken: z.string().min(1),
});

export const StorageSchema = z.discriminatedUnion("mode", [
  LocalStorageSchema,
  TursoStorageSchema,
]);

export const GoogleConfigSchema = z.object({
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  refreshToken: z.string().optional(),
});

export const BackupConfigSchema = z.object({
  folderId: z.string().optional(),
});

export const R2ConfigSchema = z.object({
  accountId: z.string().min(1),
  bucketName: z.string().min(1),
  apiToken: z.string().optional(),
  jurisdiction: z.enum(["eu"]).optional(),
  publicUrl: z.string().url().optional(),
});

export const AppConfigSchema = z.object({
  onboardingComplete: z.boolean().default(false),
  storage: StorageSchema.optional(),
  google: GoogleConfigSchema.optional(),
  backup: BackupConfigSchema.optional(),
  r2: R2ConfigSchema.optional(),
});

export type AppConfig = z.infer<typeof AppConfigSchema>;
export type StorageConfig = z.infer<typeof StorageSchema>;

export const DEFAULT_STATUSES = [
  { name: "Not Started", sortOrder: 0 },
  { name: "In Progress", sortOrder: 1 },
  { name: "Done", sortOrder: 2 },
] as const;

export type Status = {
  id: string;
  name: string;
  sortOrder: number;
  createdAt: string;
};

export const DEFAULT_TICKET_PREFIX = "TODO";

export type FieldType = "tag_multi" | "tag_single" | "text";

export type FieldOption = {
  id: string;
  fieldId: string;
  label: string;
  sortOrder: number;
};

export type Field = {
  id: string;
  name: string;
  type: FieldType;
  sortOrder: number;
  createdAt: string;
  options: FieldOption[];
};

export type TodoFieldValues = Record<string, string | string[]>;

export type Todo = {
  id: string;
  code: string;
  title: string;
  content: string;
  statusId: string;
  statusName?: string;
  startAt: string | null;
  deadlineAt: string | null;
  doneAt: string | null;
  fieldValues: TodoFieldValues;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type ExportPayload = {
  exportedAt: string;
  statuses: Status[];
  fields: Field[];
  todos: Todo[];
};

export type ViewLayout = "kanban" | "table";

export type ViewPageSize = "10" | "30" | "50" | "100" | "all";

export type ViewBuiltinField =
  | "status"
  | "title"
  | "code"
  | "start_at"
  | "deadline_at"
  | "done_at"
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
  | "on"
  | "on_or_before_today";

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
  | "start"
  | "deadline"
  | "done"
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
