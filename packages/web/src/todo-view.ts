export type TodoViewMode = "kanban" | "table";

const STORAGE_KEY = "just-me-todo-view";

export function loadTodoViewMode(): TodoViewMode {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === "table" ? "table" : "kanban";
  } catch {
    return "kanban";
  }
}

export function saveTodoViewMode(mode: TodoViewMode) {
  localStorage.setItem(STORAGE_KEY, mode);
}
