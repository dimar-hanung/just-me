import { RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { api, type Todo } from "../api";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function TrashPage() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [emptying, setEmptying] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      setTodos(await api.listTrash());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load trash");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleRestore(todoId: string) {
    if (busyId) return;
    const previous = todos;
    setBusyId(todoId);
    setTodos((current) => current.filter((t) => t.id !== todoId));
    setError("");
    try {
      await api.restoreTodo(todoId);
    } catch (err) {
      setTodos(previous);
      setError(err instanceof Error ? err.message : "Failed to restore todo");
    } finally {
      setBusyId(null);
    }
  }

  async function handlePurge(todoId: string) {
    if (busyId) return;
    const todo = todos.find((t) => t.id === todoId);
    if (!todo) return;
    if (!window.confirm(`Permanently delete “${todo.title}”? This cannot be undone.`)) {
      return;
    }

    const previous = todos;
    setBusyId(todoId);
    setTodos((current) => current.filter((t) => t.id !== todoId));
    setError("");
    try {
      await api.purgeTodo(todoId);
    } catch (err) {
      setTodos(previous);
      setError(err instanceof Error ? err.message : "Failed to delete todo");
    } finally {
      setBusyId(null);
    }
  }

  async function handleEmptyTrash() {
    if (emptying || todos.length === 0) return;
    if (
      !window.confirm(
        `Permanently delete all ${todos.length} item${todos.length === 1 ? "" : "s"} in trash? This cannot be undone.`,
      )
    ) {
      return;
    }

    const previous = todos;
    setEmptying(true);
    setTodos([]);
    setError("");
    try {
      await api.emptyTrash();
    } catch (err) {
      setTodos(previous);
      setError(err instanceof Error ? err.message : "Failed to empty trash");
    } finally {
      setEmptying(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Trash</h2>
          <p className="mt-1 text-sm text-muted">
            Deleted todos stay here until you remove them permanently.
          </p>
        </div>
        {todos.length > 0 && (
          <button
            type="button"
            className="btn-secondary inline-flex items-center gap-1.5"
            onClick={() => void handleEmptyTrash()}
            disabled={emptying || Boolean(busyId)}
          >
            <Trash2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
            {emptying ? "Emptying…" : "Empty trash"}
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-900 bg-red-950/50 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-muted">Loading trash…</p>
      ) : todos.length === 0 ? (
        <p className="text-subtle text-sm">Trash is empty.</p>
      ) : (
        <div className="todo-table-wrap panel">
          <table className="todo-table">
            <thead>
              <tr>
                <th scope="col">Code</th>
                <th scope="col">Title</th>
                <th scope="col">Status</th>
                <th scope="col">Deleted</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {todos.map((todo) => (
                <tr key={todo.id} className="todo-table-row todo-table-row--static">
                  <td className="todo-table-code">{todo.code || "—"}</td>
                  <td className="todo-table-title">
                    <span className="todo-table-title-text">{todo.title}</span>
                  </td>
                  <td className="todo-table-date">{todo.statusName ?? "—"}</td>
                  <td className="todo-table-date">{formatDate(todo.deletedAt)}</td>
                  <td className="todo-table-actions todo-table-actions--wide">
                    <div className="todo-table-action-group">
                      <button
                        type="button"
                        className="todo-table-action"
                        onClick={() => void handleRestore(todo.id)}
                        disabled={busyId === todo.id || emptying}
                        aria-label={`Restore ${todo.title}`}
                        title="Restore"
                      >
                        <RotateCcw className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="todo-table-delete"
                        onClick={() => void handlePurge(todo.id)}
                        disabled={busyId === todo.id || emptying}
                        aria-label={`Permanently delete ${todo.title}`}
                        title="Delete permanently"
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
