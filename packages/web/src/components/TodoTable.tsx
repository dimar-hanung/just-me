import { Trash2 } from "lucide-react";
import { useMemo } from "react";
import type { Field, Status, Todo, TodoFieldValues } from "../api";
import { FieldValueEditor } from "../components/FieldValueEditors";
import StatusDropdown from "../components/StatusDropdown";
import TicketCode from "../components/TicketCode";
import type { TodoColumnId } from "../todo-columns";
import { formatTodoDate } from "../todo-date";

type TodoTableProps = {
  statuses: Status[];
  fields: Field[];
  todos: Todo[];
  visibleColumns: Set<TodoColumnId>;
  onMove: (todoId: string, statusId: string) => void;
  onFieldChange: (todoId: string, fieldValues: TodoFieldValues) => void;
  onDelete: (todoId: string) => void;
  onSelect: (todoId: string) => void;
};

export default function TodoTable({
  statuses,
  fields,
  todos,
  visibleColumns,
  onMove,
  onFieldChange,
  onDelete,
  onSelect,
}: TodoTableProps) {
  const statusById = useMemo(() => new Map(statuses.map((s) => [s.id, s])), [statuses]);
  const visibleFields = useMemo(
    () => fields.filter((field) => visibleColumns.has(`field:${field.id}`)),
    [fields, visibleColumns],
  );

  if (todos.length === 0) {
    return <p className="todo-view-empty text-subtle text-sm">No todos yet. Add one to get started.</p>;
  }

  return (
    <div className="todo-table-wrap">
      <table className="todo-table">
        <thead>
          <tr>
            {visibleColumns.has("code") && (
              <th scope="col" className="todo-table-code">
                Code
              </th>
            )}
            <th scope="col">Title</th>
            {visibleColumns.has("status") && <th scope="col">Status</th>}
            {visibleFields.map((field) => (
              <th key={field.id} scope="col">
                {field.name}
              </th>
            ))}
            {visibleColumns.has("due") && <th scope="col">Due</th>}
            {visibleColumns.has("updated") && <th scope="col">Updated</th>}
            <th scope="col">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {todos.map((todo) => {
            const status = statusById.get(todo.statusId);
            const statusName = status?.name ?? todo.statusName ?? "Unknown";

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
                {visibleColumns.has("code") && (
                  <td className="todo-table-code">
                    {todo.code ? <TicketCode code={todo.code} variant="row" /> : "—"}
                  </td>
                )}
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
                {visibleColumns.has("status") && (
                  <td className="todo-table-status-cell">
                    <StatusDropdown
                      statuses={statuses}
                      value={todo.statusId}
                      label={statusName}
                      ariaLabel={`Status for ${todo.title}`}
                      onChange={(statusId) => onMove(todo.id, statusId)}
                    />
                  </td>
                )}
                {visibleFields.map((field) => (
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
                {visibleColumns.has("due") && (
                  <td className="todo-table-date">{formatTodoDate(todo.dueAt)}</td>
                )}
                {visibleColumns.has("updated") && (
                  <td className="todo-table-date">{formatTodoDate(todo.updatedAt)}</td>
                )}
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
                    <Trash2 className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
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
