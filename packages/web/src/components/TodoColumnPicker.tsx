import { ChevronDown, Columns3 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Field } from "../api";
import {
  buildColumnDefinitions,
  isColumnVisible,
  resetColumnVisibility,
  toggleColumnVisibility,
  type TodoColumnId,
} from "../todo-columns";
import type { ViewColumnVisibility, ViewLayout } from "../view-types";

type TodoColumnPickerProps = {
  layout: ViewLayout;
  fields: Field[];
  columns: ViewColumnVisibility;
  onChange: (next: ViewColumnVisibility) => void;
};

export default function TodoColumnPicker({
  layout,
  fields,
  columns,
  onChange,
}: TodoColumnPickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const columnDefs = buildColumnDefinitions(fields, layout);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: Event) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function toggleColumn(id: TodoColumnId) {
    if (id === "title") return;
    onChange(toggleColumnVisibility(columns, id));
  }

  function handleReset() {
    onChange(resetColumnVisibility(layout, fields));
  }

  return (
    <div ref={rootRef} className="todo-column-picker field-dropdown">
      <button
        type="button"
        className="todo-toolbar-control todo-column-picker-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Show or hide columns"
        onClick={() => setOpen((current) => !current)}
      >
        <Columns3 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
        Columns
        <ChevronDown className="field-dropdown-chevron" strokeWidth={2} aria-hidden="true" />
      </button>

      {open && (
        <div className="todo-column-picker-menu field-dropdown-menu" role="menu" aria-label="Columns">
          {columnDefs.map((column) => {
            const checked = isColumnVisible(columns, column.id);
            return (
              <label
                key={column.id}
                className={`field-dropdown-option ${column.locked ? "todo-column-picker-option--locked" : ""}`}
                role="menuitemcheckbox"
                aria-checked={checked}
                aria-disabled={column.locked}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={column.locked}
                  onChange={() => toggleColumn(column.id)}
                />
                <span>{column.label}</span>
              </label>
            );
          })}
          <button type="button" className="todo-column-picker-reset" onClick={handleReset}>
            Reset to defaults
          </button>
        </div>
      )}
    </div>
  );
}
