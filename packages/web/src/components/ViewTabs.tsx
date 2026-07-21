import { LayoutGrid, Plus, Table2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { TodoView, ViewLayout } from "../view-types";

type ViewTabsProps = {
  views: TodoView[];
  activeViewId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onRename: (id: string, name: string) => void;
  onLayoutChange: (id: string, layout: ViewLayout) => void;
  onDelete: (id: string) => void;
};

type ContextMenuState = {
  viewId: string;
  x: number;
  y: number;
};

export default function ViewTabs({
  views,
  activeViewId,
  onSelect,
  onCreate,
  onRename,
  onLayoutChange,
  onDelete,
}: ViewTabsProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  useEffect(() => {
    if (!contextMenu) return;

    function closeMenu() {
      setContextMenu(null);
    }

    function onPointerDown(event: PointerEvent) {
      if (event.target instanceof Node && menuRef.current?.contains(event.target)) return;
      closeMenu();
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeMenu();
    }

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", closeMenu, true);

    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", closeMenu, true);
    };
  }, [contextMenu]);

  function startRename(view: TodoView) {
    setEditingId(view.id);
    setEditName(view.name);
  }

  function commitRename(id: string) {
    const trimmed = editName.trim();
    if (trimmed) onRename(id, trimmed);
    setEditingId(null);
  }

  function openContextMenu(event: React.MouseEvent, viewId: string) {
    event.preventDefault();
    setContextMenu({ viewId, x: event.clientX, y: event.clientY });
  }

  function handleLayoutChange(viewId: string, layout: ViewLayout) {
    setContextMenu(null);
    onLayoutChange(viewId, layout);
  }

  function handleDelete(viewId: string) {
    setContextMenu(null);
    onDelete(viewId);
  }

  const contextView = contextMenu ? views.find((view) => view.id === contextMenu.viewId) : null;

  return (
    <>
      <div className="view-tabs" role="tablist" aria-label="Saved views">
        {views.map((view) => {
          const active = view.id === activeViewId;
          const editing = editingId === view.id;

          return (
            <div key={view.id} className={`view-tab-wrap ${active ? "view-tab-wrap--active" : ""}`}>
              {editing ? (
                <input
                  ref={inputRef}
                  className="view-tab-input"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={() => commitRename(view.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename(view.id);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  aria-label="View name"
                />
              ) : (
                <button
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={`view-tab ${active ? "view-tab--active" : ""}`}
                  onClick={() => onSelect(view.id)}
                  onDoubleClick={() => startRename(view)}
                  onContextMenu={(e) => openContextMenu(e, view.id)}
                >
                  {view.name}
                </button>
              )}
            </div>
          );
        })}

        <button type="button" className="view-tab-add" onClick={onCreate} aria-label="Add view">
          <Plus className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      </div>

      {contextMenu && contextView && (
        <div
          ref={menuRef}
          className="view-tab-context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          role="menu"
          aria-label={`Actions for ${contextView.name}`}
        >
          <button
            type="button"
            role="menuitemradio"
            aria-checked={contextView.layout === "table"}
            className={`view-tab-context-menu-item ${contextView.layout === "table" ? "view-tab-context-menu-item--active" : ""}`}
            onClick={() => handleLayoutChange(contextMenu.viewId, "table")}
          >
            <Table2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
            Table
          </button>
          <button
            type="button"
            role="menuitemradio"
            aria-checked={contextView.layout === "kanban"}
            className={`view-tab-context-menu-item ${contextView.layout === "kanban" ? "view-tab-context-menu-item--active" : ""}`}
            onClick={() => handleLayoutChange(contextMenu.viewId, "kanban")}
          >
            <LayoutGrid className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
            Board
          </button>
          {views.length > 1 && (
            <>
              <div className="view-tab-context-menu-separator" role="separator" />
              <button
                type="button"
                role="menuitem"
                className="view-tab-context-menu-item view-tab-context-menu-item--danger"
                onClick={() => handleDelete(contextMenu.viewId)}
              >
                Delete
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
}
