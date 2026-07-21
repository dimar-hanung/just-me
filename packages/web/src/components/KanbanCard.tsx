import { Trash2 } from "lucide-react";
import { useMemo, useRef } from "react";
import type { Field, Todo } from "../api";
import { formatFieldDisplayValue } from "../components/FieldValueEditors";
import type { TodoColumnId } from "../todo-columns";
import { formatTodoDate } from "../todo-date";

type KanbanCardProps = {
  todo: Todo;
  fields: Field[];
  visibleColumns: Set<TodoColumnId>;
  index: number;
  isDragging: boolean;
  onDragStart: (todoId: string) => void;
  onDragEnd: () => void;
  onDelete: (todoId: string) => void;
  onSelect: (todoId: string) => void;
};

/** Plain-text snippet from markdown for card previews. */
function contentPreview(markdown: string, maxLen = 140): string {
  const text = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]+`/g, " ")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/^[-*+]\s+\[[ xX]\]\s+/gm, "")
    .replace(/^[-*+]\s+/gm, "")
    .replace(/^\d+\.\s+/gm, "")
    .replace(/[*_~]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen).trimEnd()}…`;
}

export default function KanbanCard({
  todo,
  fields,
  visibleColumns,
  index,
  isDragging,
  onDragStart,
  onDragEnd,
  onDelete,
  onSelect,
}: KanbanCardProps) {
  const didDragRef = useRef(false);
  const showCode = visibleColumns.has("code");
  const showContent = visibleColumns.has("content");
  const showDue = visibleColumns.has("due");
  const showUpdated = visibleColumns.has("updated");
  const preview = showContent && todo.content?.trim() ? contentPreview(todo.content) : "";

  const visibleFields = useMemo(
    () => fields.filter((field) => visibleColumns.has(`field:${field.id}`)),
    [fields, visibleColumns],
  );

  const hasMeta = showDue || showUpdated || visibleFields.length > 0;

  return (
    <article
      draggable
      onDragStart={(e) => {
        didDragRef.current = true;
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/todo-id", todo.id);
        onDragStart(todo.id);
      }}
      onDragEnd={() => {
        onDragEnd();
        window.setTimeout(() => {
          didDragRef.current = false;
        }, 0);
      }}
      style={{ animationDelay: `${index * 40}ms` }}
      className={`kanban-card kanban-card--clickable cursor-grab active:cursor-grabbing ${isDragging ? "kanban-card--dragging" : ""}`}
    >
      <div
        className="kanban-card-main"
        onClick={() => {
          if (didDragRef.current) return;
          onSelect(todo.id);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect(todo.id);
          }
        }}
        role="button"
        tabIndex={0}
        aria-label={`Open ${todo.title}`}
      >
        {showCode && todo.code ? <span className="kanban-card-code">{todo.code}</span> : null}
        <p className="kanban-card-title">{todo.title}</p>
        {preview ? <p className="kanban-card-preview">{preview}</p> : null}
        {hasMeta ? (
          <dl className="kanban-card-meta">
            {showDue && (
              <div className="kanban-card-meta-row">
                <dt className="kanban-card-meta-label">Due</dt>
                <dd className="kanban-card-meta-value">{formatTodoDate(todo.dueAt)}</dd>
              </div>
            )}
            {showUpdated && (
              <div className="kanban-card-meta-row">
                <dt className="kanban-card-meta-label">Updated</dt>
                <dd className="kanban-card-meta-value">{formatTodoDate(todo.updatedAt)}</dd>
              </div>
            )}
            {visibleFields.map((field) => (
              <div key={field.id} className="kanban-card-meta-row">
                <dt className="kanban-card-meta-label">{field.name}</dt>
                <dd className="kanban-card-meta-value">
                  {formatFieldDisplayValue(field, todo.fieldValues?.[field.id])}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(todo.id);
        }}
        className="kanban-card-delete"
        aria-label={`Move ${todo.title} to trash`}
        title="Move to trash"
      >
        <Trash2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
      </button>
    </article>
  );
}
