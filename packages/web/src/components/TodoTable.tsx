import { Trash2 } from "lucide-react";
import { useMemo } from "react";
import type { Field, Status, Todo, TodoFieldValues } from "../api";
import { FieldValueEditor } from "../components/FieldValueEditors";
import { getStatusHueClass } from "../status-hue";

type TodoTableProps = {
  statuses: Status[];
  fields: Field[];
  todos: Todo[];
  onMove: (todoId: string, statusId: string) => void;
  onFieldChange: (todoId: string, fieldValues: TodoFieldValues) => void;
  onDelete: (todoId: string) => void;
  onSelect: (todoId: string) => void;
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function TodoTable({
  statuses,
  fields,
  todos,
  onMove,
  onFieldChange,
  onDelete,
  onSelect,
}: TodoTableProps) {
  const statusById = useMemo(() => new Map(statuses.map((s) => [s.id, s])), [statuses]);

  if (todos.length === 0) {
    return <p className="text-subtle text-sm">No todos yet. Add one to get started.</p>;
  }

  return (
    <div className="todo-table-wrap panel">
      <table className="todo-table">
        <thead>
          <tr>
            <th scope="col">Code</th>
            <th scope="col">Title</th>
            <th scope="col">Status</th>
            {fields.map((field) => (
              <th key={field.id} scope="col">
                {field.name}
              </th>
            ))}
            <th scope="col">Due</th>
            <th scope="col">Updated</th>
            <th scope="col">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {todos.map((todo) => {
            const status = statusById.get(todo.statusId);
            const statusName = status?.name ?? todo.statusName ?? "Unknown";
            const statusIndex = status ? statuses.indexOf(status) : 0;
            const hueClass = getStatusHueClass(statusName, statusIndex);

            return (
              <tr
                key={todo.id}
                className="todo-table-row"
                onClick={() => onSelect(todo.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(todo.id);
                  }
                }}
                tabIndex={0}
                aria-label={`Open ${todo.title}`}
              >
                <td className="todo-table-code">{todo.code || "—"}</td>
                <td className="todo-table-title">
                  <span className="todo-table-title-text">
                    {todo.content?.trim() ? (
                      <span
                        className="kanban-card-notes-dot"
                        aria-label="Has notes"
                        title="Has notes"
                      />
                    ) : null}
                    {todo.title}
                  </span>
                </td>
                <td className="todo-table-status-cell">
                  <label className={`todo-table-status ${hueClass}`}>
                    <span className="hue-dot" aria-hidden="true" />
                    <select
                      value={todo.statusId}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        e.stopPropagation();
                        onMove(todo.id, e.target.value);
                      }}
                      aria-label={`Status for ${todo.title}`}
                    >
                      {statuses.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </td>
                {fields.map((field) => (
                  <td key={field.id} className="todo-table-field-cell">
                    <FieldValueEditor
                      field={field}
                      value={todo.fieldValues?.[field.id]}
                      compact
                      onChange={(fieldId, value) =>
                        onFieldChange(todo.id, { [fieldId]: value })
                      }
                    />
                  </td>
                ))}
                <td className="todo-table-date">{formatDate(todo.dueAt)}</td>
                <td className="todo-table-date">{formatDate(todo.updatedAt)}</td>
                <td className="todo-table-actions">
                  <button
                    type="button"
                    className="todo-table-delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(todo.id);
                    }}
                    aria-label={`Move ${todo.title} to trash`}
                    title="Move to trash"
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
