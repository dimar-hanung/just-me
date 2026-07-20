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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      headers: { "Content-Type": "application/json", ...init?.headers },
      ...init,
    });
  } catch {
    throw new Error(
      "Cannot reach the API server. Start it with `pnpm dev:api` (or run `pnpm dev` to start API + web together).",
    );
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status >= 500 && !data.error) {
      throw new Error(
        "API server error. Ensure `pnpm dev:api` is running on port 7841, then try again.",
      );
    }
    throw new Error(data.error ?? `Request failed (${res.status})`);
  }
  return data as T;
}

export const api = {
  health: () => request<{ ok: boolean; onboardingComplete: boolean }>("/api/health"),
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
  listTodos: (params?: { statusId?: string; code?: string }) => {
    const query = new URLSearchParams();
    if (params?.statusId) query.set("status_id", params.statusId);
    if (params?.code) query.set("code", params.code);
    const qs = query.toString();
    return request<Todo[]>(`/api/todos${qs ? `?${qs}` : ""}`);
  },
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
