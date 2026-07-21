import { LayoutGrid, Plus, Table2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type Field, type Status, type Todo, type TodoFieldValues } from "../api";
import KanbanBoard from "../components/KanbanBoard";
import TodoTable from "../components/TodoTable";
import {
  loadTodoPageSize,
  parseTodoPageSize,
  saveTodoPageSize,
  type TodoPageSize,
} from "../todo-page-size";
import { loadTodoViewMode, saveTodoViewMode, type TodoViewMode } from "../todo-view";

export default function HomePage() {
  const navigate = useNavigate();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [creating, setCreating] = useState(false);
  const [draggingTodoId, setDraggingTodoId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<TodoViewMode>(() => loadTodoViewMode());
  const [pageSize, setPageSize] = useState<TodoPageSize>(() => loadTodoPageSize());

  function setView(mode: TodoViewMode) {
    setViewMode(mode);
    saveTodoViewMode(mode);
  }

  const loadFirstPage = useCallback(async (size: TodoPageSize) => {
    setLoading(true);
    setError("");
    try {
      const [statusList, fieldList] = await Promise.all([api.listStatuses(), api.listFields()]);
      setStatuses(statusList);
      setFields(fieldList);

      if (size === "all") {
        const todoList = await api.listTodos();
        setTodos(todoList);
        setTotal(todoList.length);
        setHasMore(false);
        return;
      }

      const page = await api.listTodos({ limit: size, offset: 0 });
      setTodos(page.todos);
      setTotal(page.total);
      setHasMore(page.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load todos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFirstPage(pageSize);
  }, [loadFirstPage, pageSize]);

  async function loadMore() {
    if (loadingMore || !hasMore || pageSize === "all") return;

    setLoadingMore(true);
    setError("");
    try {
      const page = await api.listTodos({ limit: pageSize, offset: todos.length });
      setTodos((current) => [...current, ...page.todos]);
      setTotal(page.total);
      setHasMore(page.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load more todos");
    } finally {
      setLoadingMore(false);
    }
  }

  function handlePageSizeChange(nextRaw: string) {
    const next = parseTodoPageSize(nextRaw);
    if (!next) return;
    setPageSize(next);
    saveTodoPageSize(next);
  }

  async function handleAdd() {
    if (creating) return;
    setCreating(true);
    setError("");
    try {
      const todo = await api.addTodo({ title: "Untitled" });
      navigate(`/todos/${todo.id}`, { state: { defaultTab: "write" } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add todo");
      setCreating(false);
    }
  }

  async function handleMove(todoId: string, statusId: string) {
    const todo = todos.find((t) => t.id === todoId);
    if (!todo || todo.statusId === statusId) {
      setDraggingTodoId(null);
      return;
    }

    const previous = todos;
    setTodos((current) =>
      current.map((t) => (t.id === todoId ? { ...t, statusId, statusName: undefined } : t)),
    );
    setDraggingTodoId(null);

    try {
      await api.updateTodo(todoId, { statusId });
    } catch (err) {
      setTodos(previous);
      setError(err instanceof Error ? err.message : "Failed to move todo");
    }
  }

  async function handleDelete(todoId: string) {
    const previous = todos;
    const previousTotal = total;
    setTodos((current) => current.filter((t) => t.id !== todoId));
    setTotal((current) => Math.max(0, current - 1));

    try {
      await api.deleteTodo(todoId);
    } catch (err) {
      setTodos(previous);
      setTotal(previousTotal);
      setError(err instanceof Error ? err.message : "Failed to delete todo");
    }
  }

  async function handleFieldChange(todoId: string, fieldValues: TodoFieldValues) {
    const todo = todos.find((t) => t.id === todoId);
    if (!todo) return;

    const previous = todos;
    setTodos((current) =>
      current.map((t) =>
        t.id === todoId ? { ...t, fieldValues: { ...t.fieldValues, ...fieldValues } } : t,
      ),
    );

    try {
      await api.updateTodo(todoId, { fieldValues });
    } catch (err) {
      setTodos(previous);
      setError(err instanceof Error ? err.message : "Failed to update field");
    }
  }

  const showPaginationFooter = !loading && statuses.length > 0 && total > 0;
  const showLoadMore = showPaginationFooter && hasMore && pageSize !== "all";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => void handleAdd()}
          disabled={creating || loading || statuses.length === 0}
          className="btn-primary inline-flex items-center gap-1.5"
        >
          <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          {creating ? "Creating…" : "Add"}
        </button>

        {!loading && statuses.length > 0 && (
          <div className="flex items-center gap-2">
            <label className="todo-page-size">
              <span className="todo-page-size-label">Per load</span>
              <select
                className="todo-page-size-select"
                value={String(pageSize)}
                onChange={(e) => handlePageSizeChange(e.target.value)}
                aria-label="Todos per load"
              >
                <option value="10">10</option>
                <option value="30">30</option>
                <option value="50">50</option>
                <option value="100">100</option>
                <option value="all">No limit</option>
              </select>
            </label>

            <div className="todo-view-toggle" role="group" aria-label="View mode">
              <button
                type="button"
                className={`todo-view-toggle-btn ${viewMode === "kanban" ? "todo-view-toggle-btn--active" : ""}`}
                onClick={() => setView("kanban")}
                aria-pressed={viewMode === "kanban"}
              >
                <LayoutGrid className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                Board
              </button>
              <button
                type="button"
                className={`todo-view-toggle-btn ${viewMode === "table" ? "todo-view-toggle-btn--active" : ""}`}
                onClick={() => setView("table")}
                aria-pressed={viewMode === "table"}
              >
                <Table2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                Table
              </button>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-900 bg-red-950/50 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-muted">Loading todos…</p>
      ) : statuses.length === 0 ? (
        <p className="text-subtle">Add statuses in Settings to use the todo list.</p>
      ) : viewMode === "table" ? (
        <TodoTable
          statuses={statuses}
          fields={fields}
          todos={todos}
          onMove={handleMove}
          onFieldChange={handleFieldChange}
          onDelete={handleDelete}
          onSelect={(todoId) => navigate(`/todos/${todoId}`)}
        />
      ) : (
        <KanbanBoard
          statuses={statuses}
          todos={todos}
          draggingTodoId={draggingTodoId}
          onDragStart={setDraggingTodoId}
          onDragEnd={() => setDraggingTodoId(null)}
          onMove={handleMove}
          onDelete={handleDelete}
          onSelect={(todoId) => navigate(`/todos/${todoId}`)}
        />
      )}

      {showPaginationFooter && (
        <div className="todo-load-more">
          <p className="todo-load-more-count">
            {pageSize === "all"
              ? `Showing all ${total}`
              : `Showing ${todos.length} of ${total}`}
          </p>
          {showLoadMore && (
            <button
              type="button"
              className="btn-secondary todo-load-more-btn"
              onClick={() => void loadMore()}
              disabled={loadingMore}
            >
              {loadingMore ? "Loading…" : "Load more"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
