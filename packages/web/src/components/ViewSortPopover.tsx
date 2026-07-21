import { ArrowDown, ArrowUp, ChevronDown, ListOrdered, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Field } from "../api";
import { buildFieldOptions } from "../view-filter-helpers";
import type { ViewSort } from "../view-types";

type ViewSortPopoverProps = {
  sorts: ViewSort[];
  fields: Field[];
  onChange: (next: ViewSort[]) => void;
};

const DEFAULT_SORT: ViewSort = { field: "updated_at", direction: "desc" };

export default function ViewSortPopover({ sorts, fields, onChange }: ViewSortPopoverProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const fieldOptions = buildFieldOptions(fields);
  const effectiveSorts = sorts.length > 0 ? sorts : [DEFAULT_SORT];

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: Event) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function updateSort(index: number, patch: Partial<ViewSort>) {
    const next = [...effectiveSorts];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  }

  function moveSort(index: number, direction: -1 | 1) {
    const nextIdx = index + direction;
    if (nextIdx < 0 || nextIdx >= effectiveSorts.length) return;
    const next = [...effectiveSorts];
    [next[index], next[nextIdx]] = [next[nextIdx], next[index]];
    onChange(next);
  }

  function removeSort(index: number) {
    const next = effectiveSorts.filter((_, i) => i !== index);
    onChange(next.length > 0 ? next : [DEFAULT_SORT]);
  }

  function addSort() {
    const first = fieldOptions[0]?.field ?? "title";
    onChange([...effectiveSorts, { field: first, direction: "asc" }]);
  }

  return (
    <div ref={rootRef} className="view-popover field-dropdown">
      <button
        type="button"
        className="todo-toolbar-control view-popover-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <ListOrdered className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
        Sort
        {sorts.length > 0 && <span className="view-popover-badge">{sorts.length}</span>}
        <ChevronDown className="field-dropdown-chevron" strokeWidth={2} aria-hidden="true" />
      </button>

      {open && (
        <div className="view-popover-menu view-sort-menu" role="dialog" aria-label="Sort">
          <div className="view-sort-list">
            {effectiveSorts.map((sort, index) => (
              <div key={index} className="view-sort-row">
                <span className="view-sort-priority">{index + 1}</span>
                <select
                  className="view-filter-select view-sort-field"
                  value={sort.field}
                  onChange={(e) =>
                    updateSort(index, { field: e.target.value as ViewSort["field"] })
                  }
                  aria-label="Sort field"
                >
                  {fieldOptions.map((opt) => (
                    <option key={opt.field} value={opt.field}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <select
                  className="view-filter-select view-sort-direction"
                  value={sort.direction}
                  onChange={(e) =>
                    updateSort(index, { direction: e.target.value as ViewSort["direction"] })
                  }
                  aria-label="Sort direction"
                >
                  <option value="asc">Ascending</option>
                  <option value="desc">Descending</option>
                </select>
                <div className="view-sort-row-actions">
                  <button
                    type="button"
                    className="view-sort-action"
                    onClick={() => moveSort(index, -1)}
                    disabled={index === 0}
                    aria-label="Move sort up"
                  >
                    <ArrowUp className="h-3 w-3" strokeWidth={2} />
                  </button>
                  <button
                    type="button"
                    className="view-sort-action"
                    onClick={() => moveSort(index, 1)}
                    disabled={index === effectiveSorts.length - 1}
                    aria-label="Move sort down"
                  >
                    <ArrowDown className="h-3 w-3" strokeWidth={2} />
                  </button>
                  <button
                    type="button"
                    className="view-sort-action view-sort-action--danger"
                    onClick={() => removeSort(index)}
                    aria-label="Remove sort"
                  >
                    <Trash2 className="h-3 w-3" strokeWidth={2} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="view-filter-actions">
            <button type="button" className="view-filter-add-btn" onClick={addSort}>
              + Add sort
            </button>
            {sorts.length > 0 && (
              <button
                type="button"
                className="view-filter-clear-btn"
                onClick={() => onChange([])}
              >
                Reset to default
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
