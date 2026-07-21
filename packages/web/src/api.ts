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
  dueAt: string | null;
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
  error?: string;
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

type ListTodosParams = {
  statusId?: string;
  code?: string;
  limit?: number;
  offset?: number;
};

function buildTodosQuery(params?: ListTodosParams): string {
  const query = new URLSearchParams();
  if (params?.statusId) query.set("status_id", params.statusId);
  if (params?.code) query.set("code", params.code);
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
  onboarding: () => request<OnboardingState>("/api/onboarding"),
  setStorage: (body: Record<string, unknown>) =>
    request<{ ok: boolean }>("/api/onboarding/storage", { method: "PUT", body: JSON.stringify(body) }),
  completeOnboarding: () =>
    request<{ ok: boolean }>("/api/onboarding/complete", { method: "POST" }),
  googleAuthUrl: () => request<{ url: string }>("/api/onboarding/google/auth-url"),
  settings: () => request<{ storage: unknown; driveConnected: boolean }>("/api/settings"),
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
      Pick<Todo, "title" | "content" | "statusId" | "dueAt"> & {
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
};
