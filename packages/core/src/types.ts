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

export const AppConfigSchema = z.object({
  onboardingComplete: z.boolean().default(false),
  storage: StorageSchema.optional(),
  google: GoogleConfigSchema.optional(),
  backup: BackupConfigSchema.optional(),
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
  dueAt: string | null;
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
