import { useMemo, useState } from "react";
import type { Status, Todo } from "../api";
import { loadCollapsedColumnIds, saveCollapsedColumnIds } from "../kanban-collapse";
import KanbanColumn from "./KanbanColumn";

type KanbanBoardProps = {
  statuses: Status[];
  todos: Todo[];
  draggingTodoId: string | null;
  onDragStart: (todoId: string) => void;
  onDragEnd: () => void;
  onMove: (todoId: string, statusId: string) => void;
  onDelete: (todoId: string) => void;
  onSelect: (todoId: string) => void;
};

export default function KanbanBoard({
  statuses,
  todos,
  draggingTodoId,
  onDragStart,
  onDragEnd,
  onMove,
  onDelete,
  onSelect,
}: KanbanBoardProps) {
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => loadCollapsedColumnIds());

  const todosByStatus = useMemo(() => {
    const grouped = new Map<string, Todo[]>();
    for (const status of statuses) {
      grouped.set(status.id, []);
    }
    for (const todo of todos) {
      const list = grouped.get(todo.statusId);
      if (list) {
        list.push(todo);
      }
    }
    return grouped;
  }, [statuses, todos]);

  function updateCollapsed(next: Set<string>) {
    setCollapsedIds(next);
    saveCollapsedColumnIds(next);
  }

  function toggleColumn(statusId: string) {
    const next = new Set(collapsedIds);
    if (next.has(statusId)) {
      next.delete(statusId);
    } else {
      next.add(statusId);
    }
    updateCollapsed(next);
  }

  function expandColumn(statusId: string) {
    if (!collapsedIds.has(statusId)) return;
    const next = new Set(collapsedIds);
    next.delete(statusId);
    updateCollapsed(next);
  }

  function handleDrop(statusId: string) {
    if (!draggingTodoId) return;
    expandColumn(statusId);
    onMove(draggingTodoId, statusId);
  }

  return (
    <div className="kanban-board" role="list" aria-label="Kanban board">
      {statuses.map((status, index) => (
        <KanbanColumn
          key={status.id}
          status={status}
          todos={todosByStatus.get(status.id) ?? []}
          columnIndex={index}
          collapsed={collapsedIds.has(status.id)}
          draggingTodoId={draggingTodoId}
          onToggle={() => toggleColumn(status.id)}
          onExpand={() => expandColumn(status.id)}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDrop={handleDrop}
          onDelete={onDelete}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
