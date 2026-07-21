import { Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  api,
  type Field,
  type Status,
  type Todo,
  type TodoFieldValues,
  type TodoView,
  type ViewColumnVisibility,
  type ViewLayout,
  type ViewPageSize,
} from "../api";
import { clearActiveViewId, loadActiveViewId, saveActiveViewId } from "../active-view";
import KanbanBoard from "../components/KanbanBoard";
import TodoColumnPicker from "../components/TodoColumnPicker";
import TodoTable from "../components/TodoTable";
import ViewFilterPopover from "../components/ViewFilterPopover";
import ViewSortPopover from "../components/ViewSortPopover";
import ViewTabs from "../components/ViewTabs";
import { mergeFieldColumns, visibleColumnSet, type TodoColumnId } from "../todo-columns";
import { migrateLegacyViewPrefs } from "../view-migration";

function parseViewPageSize(value: string): ViewPageSize | null {
  if (value === "10" || value === "30" || value === "50" || value === "100" || value === "all") {
    return value;
  }
  return null;
}

function pageSizeToLimit(pageSize: ViewPageSize): number | null {
  if (pageSize === "all") return null;
  return Number(pageSize);
}

export default function HomePage() {
  const navigate = useNavigate();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [views, setViews] = useState<TodoView[]>([]);
  const [activeViewId, setActiveViewId] = useState<string | null>(() => loadActiveViewId());
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [creating, setCreating] = useState(false);
  const [draggingTodoId, setDraggingTodoId] = useState<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const migrationDoneRef = useRef(false);

  const activeView = useMemo(
    () => views.find((v) => v.id === activeViewId) ?? views[0] ?? null,
    [views, activeViewId],
  );

  const visibleColumns = useMemo((): Set<TodoColumnId> => {
    if (!activeView) return new Set<TodoColumnId>();
    const merged = mergeFieldColumns(activeView.layout, activeView.columns, fields);
    return visibleColumnSet(merged);
  }, [activeView, fields]);

  const fetchTodos = useCallback(
    async (view: TodoView, offset = 0, append = false) => {
      const limit = pageSizeToLimit(view.pageSize);

      if (limit === null) {
        const todoList = await api.listTodos({
          filters: view.filters,
          sorts: view.sorts,
        });
        if (append) {
          setTodos((current) => [...current, ...todoList]);
        } else {
          setTodos(todoList);
        }
        setTotal(todoList.length);
        setHasMore(false);
        return;
      }

      const page = await api.listTodos({
        filters: view.filters,
        sorts: view.sorts,
        limit,
        offset,
      });

      if (append) {
        setTodos((current) => [...current, ...page.todos]);
      } else {
        setTodos(page.todos);
      }
      setTotal(page.total);
      setHasMore(page.hasMore);
    },
    [],
  );

  const loadInitial = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [statusList, fieldList, viewList] = await Promise.all([
        api.listStatuses(),
        api.listFields(),
        api.listViews(),
      ]);
      setStatuses(statusList);
      setFields(fieldList);

      let resolvedViews = viewList;
      if (!migrationDoneRef.current) {
        migrationDoneRef.current = true;
        resolvedViews = await migrateLegacyViewPrefs(viewList, fieldList, api.updateView);
      }
      setViews(resolvedViews);

      const storedId = loadActiveViewId();
      const view =
        resolvedViews.find((v) => v.id === storedId) ?? resolvedViews[0] ?? null;

      if (view) {
        setActiveViewId(view.id);
        saveActiveViewId(view.id);
        await fetchTodos(view, 0, false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load todos");
    } finally {
      setLoading(false);
    }
  }, [fetchTodos]);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  const patchView = useCallback(
    (patch: Partial<Pick<TodoView, "name" | "layout" | "filters" | "sorts" | "columns" | "pageSize">>) => {
      if (!activeView) return;

      const optimistic = { ...activeView, ...patch };
      setViews((current) => current.map((v) => (v.id === activeView.id ? optimistic : v)));

      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        void (async () => {
          try {
            const updated = await api.updateView(activeView.id, patch);
            setViews((current) => current.map((v) => (v.id === updated.id ? updated : v)));
            await fetchTodos(updated, 0, false);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save view");
            setViews((current) => current.map((v) => (v.id === activeView.id ? activeView : v)));
          }
        })();
      }, 400);
    },
    [activeView, fetchTodos],
  );

  async function selectView(id: string) {
    const view = views.find((v) => v.id === id);
    if (!view || view.id === activeViewId) return;

    setActiveViewId(id);
    saveActiveViewId(id);
    setLoading(true);
    setError("");
    try {
      await fetchTodos(view, 0, false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load view");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateView() {
    try {
      const created = await api.createView({
        name: "New view",
        copyFromId: activeView?.id,
      });
      setViews((current) => [...current, created]);
      setActiveViewId(created.id);
      saveActiveViewId(created.id);
      setLoading(true);
      await fetchTodos(created, 0, false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create view");
    } finally {
      setLoading(false);
    }
  }

  function handleRenameView(id: string, name: string) {
    setViews((current) => current.map((v) => (v.id === id ? { ...v, name } : v)));
    void api.updateView(id, { name }).catch((err) => {
      setError(err instanceof Error ? err.message : "Failed to rename view");
    });
  }

  async function handleDeleteView(id: string) {
    try {
      await api.deleteView(id);
      const nextViews = views.filter((v) => v.id !== id);
      setViews(nextViews);
      if (activeViewId === id) {
        const next = nextViews[0];
        if (next) {
          setActiveViewId(next.id);
          saveActiveViewId(next.id);
          setLoading(true);
          await fetchTodos(next, 0, false);
          setLoading(false);
        } else {
          clearActiveViewId();
          setActiveViewId(null);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete view");
    }
  }

  async function loadMore() {
    if (!activeView || loadingMore || !hasMore || activeView.pageSize === "all") return;

    setLoadingMore(true);
    setError("");
    try {
      await fetchTodos(activeView, todos.length, true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load more todos");
    } finally {
      setLoadingMore(false);
    }
  }

  function handlePageSizeChange(nextRaw: string) {
    const next = parseViewPageSize(nextRaw);
    if (!next) return;
    patchView({ pageSize: next });
  }

  function handleColumnsChange(columns: ViewColumnVisibility) {
    patchView({ columns });
  }

  function handleViewLayoutChange(id: string, layout: ViewLayout) {
    const view = views.find((v) => v.id === id);
    if (!view || view.layout === layout) return;

    const columns = mergeFieldColumns(layout, view.columns, fields);

    if (id === activeViewId) {
      patchView({ layout, columns });
      return;
    }

    setViews((current) =>
      current.map((v) => (v.id === id ? { ...v, layout, columns } : v)),
    );
    void api.updateView(id, { layout, columns }).catch((err) => {
      setError(err instanceof Error ? err.message : "Failed to update view layout");
      setViews((current) => current.map((v) => (v.id === id ? view : v)));
    });
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

  const pageSize = activeView?.pageSize ?? "30";
  const layout = activeView?.layout ?? "table";
  const showPaginationFooter = !loading && statuses.length > 0 && total > 0;
  const showLoadMore = showPaginationFooter && hasMore && pageSize !== "all";

  const viewTabs =
    !loading && statuses.length > 0 && views.length > 0 ? (
      <ViewTabs
        views={views}
        activeViewId={activeViewId}
        onSelect={(id) => void selectView(id)}
        onCreate={() => void handleCreateView()}
        onRename={handleRenameView}
        onLayoutChange={handleViewLayoutChange}
        onDelete={(id) => void handleDeleteView(id)}
      />
    ) : null;

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

        {!loading && statuses.length > 0 && activeView && (
          <div className="todo-list-toolbar">
            <ViewFilterPopover
              filters={activeView.filters}
              statuses={statuses}
              fields={fields}
              onChange={(filters) => patchView({ filters })}
            />

            <ViewSortPopover
              sorts={activeView.sorts}
              fields={fields}
              onChange={(sorts) => patchView({ sorts })}
            />

            <TodoColumnPicker
              layout={layout}
              fields={fields}
              columns={mergeFieldColumns(layout, activeView.columns, fields)}
              onChange={handleColumnsChange}
            />

            <label className="todo-toolbar-item todo-page-size">
              <span className="todo-page-size-label">Per load</span>
              <select
                className="todo-toolbar-control todo-page-size-select"
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
      ) : (
        <div className="todo-view-panel panel">
          {viewTabs && <div className="todo-view-panel-tabs">{viewTabs}</div>}
          {layout === "table" ? (
            <TodoTable
              statuses={statuses}
              fields={fields}
              todos={todos}
              visibleColumns={visibleColumns}
              onMove={handleMove}
              onFieldChange={handleFieldChange}
              onDelete={handleDelete}
              onSelect={(todoId) => navigate(`/todos/${todoId}`)}
            />
          ) : (
            <KanbanBoard
              statuses={statuses}
              fields={fields}
              todos={todos}
              visibleColumns={visibleColumns}
              draggingTodoId={draggingTodoId}
              onDragStart={setDraggingTodoId}
              onDragEnd={() => setDraggingTodoId(null)}
              onMove={handleMove}
              onDelete={handleDelete}
              onSelect={(todoId) => navigate(`/todos/${todoId}`)}
            />
          )}
        </div>
      )}

      {showPaginationFooter && (
        <div className="todo-load-more">
          <p className="todo-load-more-count">
            {pageSize === "all" ? `Showing all ${total}` : `Showing ${todos.length} of ${total}`}
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
