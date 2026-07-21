import { ChevronDown, Filter } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Field, Status } from "../api";
import {
  buildFieldOptions,
  defaultRule,
  labelForField,
  labelForOp,
  needsValue,
  newFilterGroup,
  newFilterRule,
  operatorsForField,
  removeFilterItem,
} from "../view-filter-helpers";
import type { ViewFilterRule, ViewFilters } from "../view-types";
import { isViewFilterGroup } from "../view-types";

type ViewFilterPopoverProps = {
  filters: ViewFilters;
  statuses: Status[];
  fields: Field[];
  onChange: (next: ViewFilters) => void;
};

function RuleEditor({
  rule,
  path,
  statuses,
  fields,
  onChange,
  onRemove,
}: {
  rule: ViewFilterRule;
  path: number[];
  statuses: Status[];
  fields: Field[];
  onChange: (path: number[], rule: ViewFilterRule) => void;
  onRemove: (path: number[]) => void;
}) {
  const fieldOptions = buildFieldOptions(fields);
  const ops = operatorsForField(rule.field, fields);
  const kind =
    rule.field === "status"
      ? "status"
      : rule.field === "start_at" ||
          rule.field === "deadline_at" ||
          rule.field === "done_at" ||
          rule.field === "created_at" ||
          rule.field === "updated_at"
        ? "date"
        : rule.field.startsWith("field:")
          ? fields.find((f) => f.id === rule.field.slice("field:".length))?.type ?? "text"
          : "text";

  const showValue = needsValue(rule.op);
  const multiValue = rule.op === "is_any_of" || rule.op === "is_none_of" || rule.op === "is_all_of";
  const selectedValues = Array.isArray(rule.value) ? rule.value : rule.value ? [rule.value] : [];

  function updateRule(patch: Partial<ViewFilterRule>) {
    onChange(path, { ...rule, ...patch });
  }

  function setField(field: ViewFilterRule["field"]) {
    onChange(path, defaultRule(field, fields));
  }

  function toggleMultiValue(id: string) {
    const next = selectedValues.includes(id)
      ? selectedValues.filter((v) => v !== id)
      : [...selectedValues, id];
    updateRule({ value: next });
  }

  const tagField =
    kind === "tag_single" || kind === "tag_multi"
      ? fields.find((f) => f.id === rule.field.slice("field:".length))
      : undefined;

  return (
    <div className="view-filter-rule">
      <select
        className="view-filter-select"
        value={rule.field}
        onChange={(e) => setField(e.target.value as ViewFilterRule["field"])}
        aria-label="Filter field"
      >
        {fieldOptions.map((opt) => (
          <option key={opt.field} value={opt.field}>
            {opt.label}
          </option>
        ))}
      </select>

      <select
        className="view-filter-select"
        value={rule.op}
        onChange={(e) => {
          const op = e.target.value as ViewFilterRule["op"];
          updateRule({
            op,
            value: needsValue(op) ? (multiValue ? [] : "") : undefined,
          });
        }}
        aria-label="Filter operator"
      >
        {ops.map((opt) => (
          <option key={opt.op} value={opt.op}>
            {opt.label}
          </option>
        ))}
      </select>

      {showValue && kind === "status" && (
        <div className="view-filter-multi">
          {statuses.map((status) => (
            <label key={status.id} className="view-filter-chip">
              <input
                type="checkbox"
                checked={selectedValues.includes(status.id)}
                onChange={() => toggleMultiValue(status.id)}
              />
              <span>{status.name}</span>
            </label>
          ))}
        </div>
      )}

      {showValue && tagField && multiValue && (
        <div className="view-filter-multi">
          {tagField.options.map((option) => (
            <label key={option.id} className="view-filter-chip">
              <input
                type="checkbox"
                checked={selectedValues.includes(option.id)}
                onChange={() => toggleMultiValue(option.id)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      )}

      {showValue && kind === "date" && (
        <input
          type="date"
          className="view-filter-input"
          value={typeof rule.value === "string" ? rule.value.slice(0, 10) : ""}
          onChange={(e) => updateRule({ value: e.target.value ? `${e.target.value}T00:00:00.000Z` : "" })}
          aria-label="Filter date"
        />
      )}

      {showValue && kind === "text" && !multiValue && (
        <input
          type="text"
          className="view-filter-input"
          value={typeof rule.value === "string" ? rule.value : ""}
          onChange={(e) => updateRule({ value: e.target.value })}
          placeholder="Value"
          aria-label="Filter value"
        />
      )}

      <button type="button" className="view-filter-remove" onClick={() => onRemove(path)} aria-label="Remove filter">
        ×
      </button>
    </div>
  );
}

export default function ViewFilterPopover({
  filters,
  statuses,
  fields,
  onChange,
}: ViewFilterPopoverProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const ruleCount = filters.items.reduce((count, item) => {
    if (isViewFilterGroup(item)) return count + item.rules.length;
    return count + 1;
  }, 0);

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

  function updateRuleAtPath(path: number[], rule: ViewFilterRule) {
    if (path.length === 1) {
      const items = [...filters.items];
      items[path[0]] = rule;
      onChange({ ...filters, items });
      return;
    }

    const [groupIndex, ruleIndex] = path;
    const item = filters.items[groupIndex];
    if (!item || !isViewFilterGroup(item)) return;
    const rules = [...item.rules];
    rules[ruleIndex] = rule;
    const items = [...filters.items];
    items[groupIndex] = { ...item, rules };
    onChange({ ...filters, items });
  }

  function updateGroupLogic(groupIndex: number, logic: "and" | "or") {
    const item = filters.items[groupIndex];
    if (!item || !isViewFilterGroup(item)) return;
    const items = [...filters.items];
    items[groupIndex] = { ...item, logic };
    onChange({ ...filters, items });
  }

  function handleRemove(path: number[]) {
    onChange(removeFilterItem(filters, path));
  }

  function renderItem(item: ViewFilters["items"][number], index: number) {
    if (isViewFilterGroup(item)) {
      return (
        <div key={`group-${index}`} className="view-filter-group">
          <div className="view-filter-group-header">
            <span className="view-filter-group-label">Group</span>
            {item.rules.length > 1 && (
              <select
                className="view-filter-logic-select"
                value={item.logic}
                onChange={(e) => updateGroupLogic(index, e.target.value as "and" | "or")}
                aria-label="Group logic"
              >
                <option value="and">All (AND)</option>
                <option value="or">Any (OR)</option>
              </select>
            )}
            <button
              type="button"
              className="view-filter-remove"
              onClick={() => handleRemove([index])}
              aria-label="Remove group"
            >
              ×
            </button>
          </div>
          {item.rules.map((rule, ruleIndex) => (
            <RuleEditor
              key={`${index}-${ruleIndex}`}
              rule={rule}
              path={[index, ruleIndex]}
              statuses={statuses}
              fields={fields}
              onChange={updateRuleAtPath}
              onRemove={handleRemove}
            />
          ))}
          <button
            type="button"
            className="view-filter-add-inline"
            onClick={() => {
              const current = filters.items[index];
              if (!current || !isViewFilterGroup(current)) return;
              const items = [...filters.items];
              items[index] = { ...current, rules: [...current.rules, newFilterRule(fields)] };
              onChange({ ...filters, items });
            }}
          >
            + Add rule to group
          </button>
        </div>
      );
    }

    return (
      <RuleEditor
        key={`rule-${index}`}
        rule={item}
        path={[index]}
        statuses={statuses}
        fields={fields}
        onChange={updateRuleAtPath}
        onRemove={handleRemove}
      />
    );
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
        <Filter className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
        Filter
        {ruleCount > 0 && <span className="view-popover-badge">{ruleCount}</span>}
        <ChevronDown className="field-dropdown-chevron" strokeWidth={2} aria-hidden="true" />
      </button>

      {open && (
        <div className="view-popover-menu view-filter-menu" role="dialog" aria-label="Filters">
          {filters.items.length > 1 && (
            <div className="view-filter-top-logic">
              <span>Match</span>
              <select
                className="view-filter-logic-select"
                value={filters.logic}
                onChange={(e) => onChange({ ...filters, logic: e.target.value as "and" | "or" })}
                aria-label="Top-level filter logic"
              >
                <option value="and">All filters (AND)</option>
                <option value="or">Any filter (OR)</option>
              </select>
            </div>
          )}

          <div className="view-filter-list">{filters.items.map(renderItem)}</div>

          <div className="view-filter-actions">
            <button
              type="button"
              className="view-filter-add-btn"
              onClick={() => onChange({ ...filters, items: [...filters.items, newFilterRule(fields)] })}
            >
              + Add filter
            </button>
            <button
              type="button"
              className="view-filter-add-btn"
              onClick={() => onChange({ ...filters, items: [...filters.items, newFilterGroup(fields)] })}
            >
              + Add group
            </button>
            {ruleCount > 0 && (
              <button
                type="button"
                className="view-filter-clear-btn"
                onClick={() => onChange({ logic: "and", items: [] })}
              >
                Clear all
              </button>
            )}
          </div>

          {ruleCount > 0 && (
            <div className="view-filter-summary">
              {filters.items.map((item, index) => {
                if (isViewFilterGroup(item)) {
                  return (
                    <div key={index} className="view-filter-summary-group">
                      Group ({item.logic.toUpperCase()}):{" "}
                      {item.rules
                        .map(
                          (r) =>
                            `${labelForField(r.field, fields)} ${labelForOp(r.op)}`,
                        )
                        .join(` ${item.logic} `)}
                    </div>
                  );
                }
                return (
                  <div key={index}>
                    {labelForField(item.field, fields)} {labelForOp(item.op)}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
