export type Status = {
  id: string;
  name: string;
  sortOrder: number;
  createdAt: string;
};

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

export type ListTodosPage = {
  todos: Todo[];
  total: number;
  hasMore: boolean;
};

export type {
  TodoView,
  ViewColumnVisibility,
  ViewFilterGroup,
  ViewFilterItem,
  ViewFilterOp,
  ViewFilterRule,
  ViewFilters,
  ViewLayout,
  ViewPageSize,
  ViewSort,
} from "./view-types";

export type OnboardingState = {
  complete: boolean;
  storageMode: string | null;
  driveConnected: boolean;
  defaultSqlitePath: string;
};

export type DriveBackup = {
  id: string;
  name: string;
  createdTime: string;
};

export type HealthResponse = {
  app: "just-me";
  ok: boolean;
  onboardingComplete: boolean;
  storage: "local" | "turso" | null;
  driveConnected?: boolean;
  r2Configured?: boolean;
  r2Reachable?: boolean | null;
  mcpStatus?: "ready" | "missing" | "needs_onboarding";
  mcpStdioPath?: string | null;
  error?: string;
};

export type McpSetupResponse = {
  app: "just-me";
  available: boolean;
  status: "ready" | "missing" | "needs_onboarding";
  stdioPath: string | null;
  configPath: string;
  cursorConfig: {
    mcpServers: {
      "just-me-todos": {
        command: "node";
        args: [string];
        env: { JUST_ME_CONFIG: string };
      };
    };
  } | null;
  requiresNode: true;
};

export type R2Settings = {
  accountId: string;
  bucketName: string;
  apiToken?: string;
  jurisdiction?: "eu";
  publicUrl?: string;
};

export type R2SettingsPublic = {
  accountId: string;
  bucketName: string;
  jurisdiction?: "eu";
};

export type UploadResult = {
  url: string;
  key: string;
  filename: string;
  mimeType: string;
  size: number;
  isImage: boolean;
};

async function fetchHealth(): Promise<HealthResponse> {
  let res: Response;
  try {
    res = await fetch("/api/health", {
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    throw new Error(
      "Cannot reach the API server. Start it with `pnpm dev:api` (port 7842) or run `pnpm dev` to start API + web together.",
    );
  }

  const data = await res.json().catch(() => null);
  if (!data || typeof data !== "object" || (data as HealthResponse).app !== "just-me") {
    throw new Error("Invalid health response from API.");
  }

  return data as HealthResponse;
}

async function fetchMcpSetup(): Promise<McpSetupResponse> {
  const data = await request<McpSetupResponse>("/api/mcp-setup");
  if (data.app !== "just-me") {
    throw new Error("Invalid MCP setup response from API.");
  }
  return data;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      headers: { "Content-Type": "application/json", ...init?.headers },
      ...init,
    });
  } catch {
    throw new Error(
      "Cannot reach the API server. Start it with `pnpm dev:api` (port 7842) or run `pnpm dev` to start API + web together.",
    );
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status >= 500 && !data.error) {
      throw new Error(
        "API server error. Ensure `pnpm dev:api` is running (dev default port 7842), then try again.",
      );
    }
    throw new Error(data.error ?? `Request failed (${res.status})`);
  }
  return data as T;
}

async function uploadRequest(path: string, formData: FormData): Promise<UploadResult> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: "POST",
      body: formData,
    });
  } catch {
    throw new Error(
      "Cannot reach the API server. Start it with `pnpm dev:api` (port 7842) or run `pnpm dev` to start API + web together.",
    );
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error ?? `Upload failed (${res.status})`);
  }
  return data as UploadResult;
}

type ListTodosParams = {
  statusId?: string;
  code?: string;
  filters?: import("./view-types").ViewFilters;
  sorts?: import("./view-types").ViewSort[];
  limit?: number;
  offset?: number;
};

function buildTodosQuery(params?: ListTodosParams): string {
  const query = new URLSearchParams();
  if (params?.statusId) query.set("status_id", params.statusId);
  if (params?.code) query.set("code", params.code);
  if (params?.filters) query.set("filters", JSON.stringify(params.filters));
  if (params?.sorts) query.set("sorts", JSON.stringify(params.sorts));
  if (params?.limit !== undefined) query.set("limit", String(params.limit));
  if (params?.offset !== undefined) query.set("offset", String(params.offset));
  const qs = query.toString();
  return qs ? `?${qs}` : "";
}

async function listTodos(
  params: ListTodosParams & { limit: number },
): Promise<ListTodosPage>;
async function listTodos(params?: Omit<ListTodosParams, "limit" | "offset">): Promise<Todo[]>;
async function listTodos(params?: ListTodosParams): Promise<Todo[] | ListTodosPage> {
  const path = `/api/todos${buildTodosQuery(params)}`;
  if (params?.limit !== undefined) {
    return request<ListTodosPage>(path);
  }
  return request<Todo[]>(path);
}

export const api = {
  health: fetchHealth,
  mcpSetup: fetchMcpSetup,
  onboarding: () => request<OnboardingState>("/api/onboarding"),
  setStorage: (body: Record<string, unknown>) =>
    request<{ ok: boolean }>("/api/onboarding/storage", { method: "PUT", body: JSON.stringify(body) }),
  completeOnboarding: () =>
    request<{ ok: boolean }>("/api/onboarding/complete", { method: "POST" }),
  googleAuthUrl: () => request<{ url: string }>("/api/onboarding/google/auth-url"),
  settings: () =>
    request<{
      storage: unknown;
      driveConnected: boolean;
      r2Configured: boolean;
      r2: R2SettingsPublic | null;
    }>("/api/settings"),
  updateR2Settings: (body: R2Settings) =>
    request<{ ok: boolean; r2Configured: boolean }>("/api/settings/r2", {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  clearR2Settings: () =>
    request<{ ok: boolean; r2Configured: boolean }>("/api/settings/r2", {
      method: "DELETE",
    }),
  uploadFile: (file: File) => {
    const formData = new FormData();
    formData.set("file", file);
    return uploadRequest("/api/uploads", formData);
  },
  updateStorage: (body: Record<string, unknown>) =>
    request<{ ok: boolean; warning?: string }>("/api/settings/storage", {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  listStatuses: () => request<Status[]>("/api/statuses"),
  createStatus: (name: string) =>
    request<Status>("/api/statuses", { method: "POST", body: JSON.stringify({ name }) }),
  updateStatus: (id: string, patch: { name?: string; sortOrder?: number }) =>
    request<Status>(`/api/statuses/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteStatus: (id: string) =>
    request<{ ok: boolean }>(`/api/statuses/${id}`, { method: "DELETE" }),
  reorderStatuses: (orderedIds: string[]) =>
    request<Status[]>("/api/statuses/reorder", {
      method: "PUT",
      body: JSON.stringify({ orderedIds }),
    }),
  listFields: () => request<Field[]>("/api/fields"),
  createField: (name: string, type: FieldType) =>
    request<Field>("/api/fields", { method: "POST", body: JSON.stringify({ name, type }) }),
  updateField: (id: string, patch: { name?: string; sortOrder?: number }) =>
    request<Field>(`/api/fields/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteField: (id: string) =>
    request<{ ok: boolean }>(`/api/fields/${id}`, { method: "DELETE" }),
  reorderFields: (orderedIds: string[]) =>
    request<Field[]>("/api/fields/reorder", {
      method: "PUT",
      body: JSON.stringify({ orderedIds }),
    }),
  createFieldOption: (fieldId: string, label: string) =>
    request<FieldOption>(`/api/fields/${fieldId}/options`, {
      method: "POST",
      body: JSON.stringify({ label }),
    }),
  updateFieldOption: (
    fieldId: string,
    optionId: string,
    patch: { label?: string; sortOrder?: number },
  ) =>
    request<FieldOption>(`/api/fields/${fieldId}/options/${optionId}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  deleteFieldOption: (fieldId: string, optionId: string) =>
    request<{ ok: boolean }>(`/api/fields/${fieldId}/options/${optionId}`, {
      method: "DELETE",
    }),
  listTodos,
  getTodo: (id: string) => request<Todo>(`/api/todos/${id}`),
  addTodo: (body: {
    title: string;
    content?: string;
    statusId?: string;
    fieldValues?: TodoFieldValues;
  }) =>
    request<Todo>("/api/todos", { method: "POST", body: JSON.stringify(body) }),
  updateTodo: (
    id: string,
    patch: Partial<
      Pick<Todo, "title" | "content" | "statusId" | "startAt" | "deadlineAt" | "doneAt"> & {
        fieldValues?: TodoFieldValues;
      }
    >,
  ) =>
    request<Todo>(`/api/todos/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteTodo: (id: string) =>
    request<{ ok: boolean }>(`/api/todos/${id}`, { method: "DELETE" }),
  listTrash: () => request<Todo[]>("/api/todos/trash"),
  restoreTodo: (id: string) =>
    request<Todo>(`/api/todos/${id}/restore`, { method: "POST" }),
  purgeTodo: (id: string) =>
    request<{ ok: boolean }>(`/api/todos/${id}/permanent`, { method: "DELETE" }),
  emptyTrash: () =>
    request<{ ok: boolean; deleted: number }>("/api/todos/trash", { method: "DELETE" }),
  backup: () => request<{ fileId: string; fileName: string }>("/api/backup", { method: "POST" }),
  listBackups: () => request<DriveBackup[]>("/api/backups"),
  restore: (fileId: string) =>
    request<{ ok: boolean }>("/api/restore", { method: "POST", body: JSON.stringify({ fileId }) }),
  listViews: () => request<import("./view-types").TodoView[]>("/api/views"),
  createView: (body: {
    name?: string;
    layout?: import("./view-types").ViewLayout;
    filters?: import("./view-types").ViewFilters;
    sorts?: import("./view-types").ViewSort[];
    columns?: import("./view-types").ViewColumnVisibility;
    pageSize?: import("./view-types").ViewPageSize;
    copyFromId?: string;
  }) =>
    request<import("./view-types").TodoView>("/api/views", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  getView: (id: string) => request<import("./view-types").TodoView>(`/api/views/${id}`),
  updateView: (
    id: string,
    patch: Partial<
      Pick<
        import("./view-types").TodoView,
        "name" | "layout" | "filters" | "sorts" | "columns" | "pageSize"
      >
    >,
  ) =>
    request<import("./view-types").TodoView>(`/api/views/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  deleteView: (id: string) =>
    request<{ ok: boolean }>(`/api/views/${id}`, { method: "DELETE" }),
  reorderViews: (ids: string[]) =>
    request<import("./view-types").TodoView[]>("/api/views/reorder", {
      method: "PUT",
      body: JSON.stringify({ ids }),
    }),
};
