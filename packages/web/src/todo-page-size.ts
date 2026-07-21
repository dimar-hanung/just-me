export type TodoPageSize = 10 | 30 | 50 | 100 | "all";

const STORAGE_KEY = "just-me-todo-page-size";

export function loadTodoPageSize(): TodoPageSize {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "all") return "all";
    const num = Number(raw);
    if (num === 10 || num === 30 || num === 50 || num === 100) return num;
  } catch {
    // ignore
  }
  return 30;
}

export function saveTodoPageSize(size: TodoPageSize) {
  localStorage.setItem(STORAGE_KEY, String(size));
}

export function parseTodoPageSize(value: string): TodoPageSize | null {
  if (value === "all") return "all";
  const num = Number(value);
  if (num === 10 || num === 30 || num === 50 || num === 100) return num;
  return null;
}
