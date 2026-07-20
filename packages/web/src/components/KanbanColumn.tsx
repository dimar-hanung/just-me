import { ChevronLeft } from "lucide-react";
import type { Status, Todo } from "../api";
import { getStatusHueClass } from "../status-hue";
import KanbanCard from "./KanbanCard";

type KanbanColumnProps = {
  status: Status;
  todos: Todo[];
  columnIndex: number;
  collapsed: boolean;
  draggingTodoId: string | null;
  onToggle: () => void;
  onExpand: () => void;
  onDragStart: (todoId: string) => void;
  onDragEnd: () => void;
  onDrop: (statusId: string) => void;
  onDelete: (todoId: string) => void;
  onSelect: (todoId: string) => void;
};

export default function KanbanColumn({
  status,
  todos,
  columnIndex,
  collapsed,
  draggingTodoId,
  onToggle,
  onExpand,
  onDragStart,
  onDragEnd,
  onDrop,
  onDelete,
  onSelect,
}: KanbanColumnProps) {
  const isDragTarget = draggingTodoId !== null;
  const hueClass = getStatusHueClass(status.name, columnIndex);

  return (
    <section
      className={`kanban-column ${hueClass} ${collapsed ? "kanban-column--collapsed" : ""} ${isDragTarget ? "kanban-column--active" : ""}`}
      style={{ animationDelay: `${columnIndex * 60}ms` }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        e.currentTarget.classList.add("kanban-column--over");
        if (collapsed) {
          onExpand();
        }
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          e.currentTarget.classList.remove("kanban-column--over");
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.currentTarget.classList.remove("kanban-column--over");
        onDrop(status.id);
      }}
    >
      <button
        type="button"
        className="kanban-column-header"
        onClick={onToggle}
        aria-expanded={!collapsed}
        aria-label={collapsed ? `Expand ${status.name}` : `Collapse ${status.name}`}
        title={collapsed ? "Expand column" : "Collapse column"}
      >
        <div className="kanban-column-title">
          <span className="hue-dot" aria-hidden="true" />
          <span className="kanban-column-name truncate" title={status.name}>
            {status.name}
          </span>
        </div>
        <div className="kanban-column-actions">
          <span className="kanban-column-count">{todos.length}</span>
          <ChevronLeft
            className={`kanban-column-toggle-icon ${collapsed ? "kanban-column-toggle-icon--collapsed" : ""}`}
            strokeWidth={2}
            aria-hidden="true"
          />
        </div>
      </button>

      {!collapsed && (
        <div className="kanban-column-body">
          {todos.length === 0 ? (
            <p className="kanban-column-empty">Drop tasks here</p>
          ) : (
            todos.map((todo, index) => (
              <KanbanCard
                key={todo.id}
                todo={todo}
                index={index}
                isDragging={draggingTodoId === todo.id}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
                onDelete={onDelete}
                onSelect={onSelect}
              />
            ))
          )}
        </div>
      )}
    </section>
  );
}
