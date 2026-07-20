import { Trash2 } from "lucide-react";
import { useRef } from "react";
import type { Todo } from "../api";

type KanbanCardProps = {
  todo: Todo;
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
  index,
  isDragging,
  onDragStart,
  onDragEnd,
  onDelete,
  onSelect,
}: KanbanCardProps) {
  const didDragRef = useRef(false);
  const preview = todo.content?.trim() ? contentPreview(todo.content) : "";

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
        {todo.code ? <span className="kanban-card-code">{todo.code}</span> : null}
        <p className="kanban-card-title">{todo.title}</p>
        {preview ? <p className="kanban-card-preview">{preview}</p> : null}
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
