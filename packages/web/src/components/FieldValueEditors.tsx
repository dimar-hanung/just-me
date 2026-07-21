import { ChevronDown } from "lucide-react";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type MouseEvent,
} from "react";
import { createPortal } from "react-dom";
import type { Field, FieldOption, TodoFieldValues } from "../api";

type FieldValueEditorProps = {
  field: Field;
  value: string | string[] | undefined;
  onChange: (fieldId: string, value: string | string[]) => void;
  compact?: boolean;
  disabled?: boolean;
};

function stopRowClick(e: MouseEvent | ChangeEvent) {
  e.stopPropagation();
}

function optionLabel(options: FieldOption[], id: string): string {
  return options.find((option) => option.id === id)?.label ?? id;
}

function TagSingleSelect({
  field,
  value,
  onChange,
  compact,
  disabled,
}: {
  field: Field;
  value: string;
  onChange: (fieldId: string, value: string) => void;
  compact: boolean;
  disabled: boolean;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onClick={stopRowClick}
      onChange={(e) => {
        stopRowClick(e);
        onChange(field.id, e.target.value);
      }}
      className={compact ? "field-value-select field-value-select--compact" : "field-value-select"}
      aria-label={field.name}
    >
      <option value="">—</option>
      {field.options.map((option) => (
        <option key={option.id} value={option.id}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function TagMultiDropdown({
  field,
  value,
  onChange,
  compact,
  disabled,
}: {
  field: Field;
  value: string[];
  onChange: (fieldId: string, value: string[]) => void;
  compact: boolean;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties | undefined>();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: Event) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    }

    // Capture so outside-click still closes when another control stops mousedown propagation.
    document.addEventListener("mousedown", handlePointerDown, true);
    return () => document.removeEventListener("mousedown", handlePointerDown, true);
  }, [open]);

  // Portal + fixed position so bottom-row menus escape table/panel overflow clipping.
  useLayoutEffect(() => {
    if (!open || !compact) {
      setMenuStyle(undefined);
      return;
    }

    function updatePosition() {
      const trigger = triggerRef.current;
      const menu = menuRef.current;
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      const gap = 4;
      const menuHeight = menu?.offsetHeight ?? 192;
      const spaceBelow = window.innerHeight - rect.bottom - gap;
      const openUp = spaceBelow < menuHeight && rect.top > spaceBelow;

      setMenuStyle({
        position: "fixed",
        left: rect.left,
        width: Math.max(rect.width, 10 * 16),
        top: openUp ? undefined : rect.bottom + gap,
        bottom: openUp ? window.innerHeight - rect.top + gap : undefined,
        right: "auto",
        zIndex: 60,
      });
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, compact, value.length, field.options.length]);

  const labels = value.map((id) => optionLabel(field.options, id));
  const summary =
    labels.length === 0 ? "—" : compact && labels.length > 2 ? `${labels.length} selected` : labels.join(", ");

  function toggleOption(optionId: string, checked: boolean) {
    const next = checked ? [...value, optionId] : value.filter((id) => id !== optionId);
    onChange(field.id, next);
  }

  const menu = open ? (
    <div
      ref={menuRef}
      className={`field-dropdown-menu${compact ? " field-dropdown-menu--fixed" : ""}`}
      style={compact ? menuStyle : undefined}
      role="listbox"
      aria-label={field.name}
      aria-multiselectable="true"
      onClick={stopRowClick}
      onMouseDown={stopRowClick}
    >
      {field.options.map((option) => {
        const checked = value.includes(option.id);
        return (
          <label key={option.id} className="field-dropdown-option">
            <input
              type="checkbox"
              checked={checked}
              disabled={disabled}
              onChange={(e) => {
                stopRowClick(e);
                toggleOption(option.id, e.target.checked);
              }}
            />
            <span>{option.label}</span>
          </label>
        );
      })}
    </div>
  ) : null;

  return (
    <div
      ref={rootRef}
      className={`field-dropdown ${compact ? "field-dropdown--compact" : ""}`}
      onClick={stopRowClick}
      onMouseDown={stopRowClick}
    >
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        className="field-dropdown-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={field.name}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="field-dropdown-summary">{summary}</span>
        <ChevronDown className="field-dropdown-chevron" strokeWidth={2} aria-hidden="true" />
      </button>

      {compact && menu ? createPortal(menu, document.body) : menu}
    </div>
  );
}

export function FieldValueEditor({
  field,
  value,
  onChange,
  compact = false,
  disabled = false,
}: FieldValueEditorProps) {
  if (field.type === "text") {
    const textValue = typeof value === "string" ? value : "";
    return (
      <input
        type="text"
        value={textValue}
        disabled={disabled}
        onClick={stopRowClick}
        onChange={(e) => {
          stopRowClick(e);
          onChange(field.id, e.target.value);
        }}
        placeholder={compact ? "—" : `Enter ${field.name.toLowerCase()}`}
        className={compact ? "field-value-input field-value-input--compact" : "field-value-input"}
        aria-label={field.name}
      />
    );
  }

  if (field.type === "tag_single" || field.type === "tag_multi") {
    if (field.options.length === 0) {
      return <span className="text-subtle text-xs">No options</span>;
    }

    if (field.type === "tag_single") {
      const selected = typeof value === "string" ? value : "";
      return (
        <TagSingleSelect
          field={field}
          value={selected}
          onChange={onChange}
          compact={compact}
          disabled={disabled}
        />
      );
    }

    const selected = Array.isArray(value) ? value : [];
    return (
      <TagMultiDropdown
        field={field}
        value={selected}
        onChange={onChange}
        compact={compact}
        disabled={disabled}
      />
    );
  }

  return null;
}

type FieldValuesSectionProps = {
  fields: Field[];
  values: TodoFieldValues;
  onChange: (fieldId: string, value: string | string[]) => void;
  compact?: boolean;
  disabled?: boolean;
};

export function FieldValuesSection({
  fields,
  values,
  onChange,
  compact = false,
  disabled = false,
}: FieldValuesSectionProps) {
  if (fields.length === 0) return null;

  if (compact) {
    return (
      <>
        {fields.map((field) => (
          <FieldValueEditor
            key={field.id}
            field={field}
            value={values[field.id]}
            onChange={onChange}
            compact
            disabled={disabled}
          />
        ))}
      </>
    );
  }

  return (
    <div className="todo-detail-fields">
      {fields.map((field) => (
        <div key={field.id} className="todo-detail-field">
          <label className="todo-detail-field-label">{field.name}</label>
          <FieldValueEditor
            field={field}
            value={values[field.id]}
            onChange={onChange}
            disabled={disabled}
          />
        </div>
      ))}
    </div>
  );
}

export function fieldTypeLabel(type: Field["type"]): string {
  switch (type) {
    case "tag_multi":
      return "Tag (multi)";
    case "tag_single":
      return "Tag (one)";
    case "text":
      return "Text";
  }
}

export function formatFieldDisplayValue(field: Field, value: string | string[] | undefined): string {
  if (value === undefined || value === "" || (Array.isArray(value) && value.length === 0)) {
    return "—";
  }

  if (field.type === "text") {
    return typeof value === "string" ? value : "—";
  }

  if (field.type === "tag_single") {
    const option = field.options.find((o) => o.id === value);
    return option?.label ?? "—";
  }

  if (!Array.isArray(value)) return "—";
  const labels = value
    .map((id) => field.options.find((o) => o.id === id)?.label)
    .filter(Boolean);
  return labels.length > 0 ? labels.join(", ") : "—";
}
