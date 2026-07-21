import type { Field, Status } from "./api";
import type {
  ViewFieldRef,
  ViewFilterGroup,
  ViewFilterItem,
  ViewFilterOp,
  ViewFilterRule,
  ViewFilters,
} from "./view-types";
import { fieldColumnId, isViewFilterGroup } from "./view-types";

const BUILTIN_FIELDS: Array<{ field: ViewFieldRef; label: string; kind: "status" | "text" | "date" }> = [
  { field: "status", label: "Status", kind: "status" },
  { field: "title", label: "Title", kind: "text" },
  { field: "code", label: "Code", kind: "text" },
  { field: "due_at", label: "Due", kind: "date" },
  { field: "created_at", label: "Created", kind: "date" },
  { field: "updated_at", label: "Updated", kind: "date" },
];

export function buildFieldOptions(
  fields: Field[],
): Array<{ field: ViewFieldRef; label: string; fieldDef?: Field }> {
  const options: Array<{ field: ViewFieldRef; label: string; fieldDef?: Field }> = BUILTIN_FIELDS.map(
    (row) => ({ field: row.field, label: row.label }),
  );
  for (const field of fields) {
    options.push({
      field: fieldColumnId(field.id) as ViewFieldRef,
      label: field.name,
      fieldDef: field,
    });
  }
  return options;
}

export function getFieldKind(
  fieldRef: ViewFieldRef,
  fields: Field[],
): "status" | "text" | "date" | "tag_single" | "tag_multi" {
  if (fieldRef === "status") return "status";
  if (fieldRef === "due_at" || fieldRef === "created_at" || fieldRef === "updated_at") return "date";
  if (fieldRef === "title" || fieldRef === "code") return "text";

  if (fieldRef.startsWith("field:")) {
    const fieldId = fieldRef.slice("field:".length);
    const field = fields.find((f) => f.id === fieldId);
    if (field?.type === "tag_single") return "tag_single";
    if (field?.type === "tag_multi") return "tag_multi";
    return "text";
  }

  return "text";
}

export function operatorsForField(
  fieldRef: ViewFieldRef,
  fields: Field[],
): Array<{ op: ViewFilterOp; label: string }> {
  const kind = getFieldKind(fieldRef, fields);

  if (kind === "status") {
    return [
      { op: "is_any_of", label: "Is any of" },
      { op: "is_none_of", label: "Is none of" },
    ];
  }

  if (kind === "date") {
    return [
      { op: "on", label: "Is on" },
      { op: "before", label: "Is before" },
      { op: "after", label: "Is after" },
      { op: "is_empty", label: "Is empty" },
      { op: "is_not_empty", label: "Is not empty" },
    ];
  }

  if (kind === "tag_single" || kind === "tag_multi") {
    const ops: Array<{ op: ViewFilterOp; label: string }> = [
      { op: "is_any_of", label: "Has any of" },
      { op: "is_none_of", label: "Has none of" },
      { op: "is_empty", label: "Is empty" },
      { op: "is_not_empty", label: "Is not empty" },
    ];
    if (kind === "tag_multi") {
      ops.splice(2, 0, { op: "is_all_of", label: "Has all of" });
    }
    return ops;
  }

  return [
    { op: "contains", label: "Contains" },
    { op: "not_contains", label: "Does not contain" },
    { op: "is_empty", label: "Is empty" },
    { op: "is_not_empty", label: "Is not empty" },
  ];
}

export function defaultRule(field: ViewFieldRef, fields: Field[]): ViewFilterRule {
  const ops = operatorsForField(field, fields);
  return { field, op: ops[0]?.op ?? "contains", value: needsValue(ops[0]?.op ?? "contains") ? "" : undefined };
}

function needsValue(op: ViewFilterOp): boolean {
  return op !== "is_empty" && op !== "is_not_empty";
}

export function newFilterRule(fields: Field[]): ViewFilterRule {
  const first = buildFieldOptions(fields)[0];
  return defaultRule(first?.field ?? "title", fields);
}

export function newFilterGroup(fields: Field[]): ViewFilterGroup {
  return { logic: "and", rules: [newFilterRule(fields)] };
}

export function updateFilterItem(
  filters: ViewFilters,
  path: number[],
  updater: (item: ViewFilterItem) => ViewFilterItem,
): ViewFilters {
  if (path.length === 0) return filters;

  const [index, ...rest] = path;
  const items = [...filters.items];
  const current = items[index];
  if (!current) return filters;

  if (rest.length === 0) {
    items[index] = updater(current);
    return { ...filters, items };
  }

  if (!isViewFilterGroup(current)) return filters;

  const rules = [...current.rules];
  const ruleIndex = rest[0];
  if (ruleIndex === undefined) return filters;

  if (rest.length === 1) {
    rules[ruleIndex] = updater(rules[ruleIndex]) as ViewFilterRule;
  }

  items[index] = { ...current, rules };
  return { ...filters, items };
}

export function removeFilterItem(filters: ViewFilters, path: number[]): ViewFilters {
  if (path.length === 0) return filters;

  const [index, ...rest] = path;
  if (rest.length === 0) {
    return { ...filters, items: filters.items.filter((_, i) => i !== index) };
  }

  const items = [...filters.items];
  const group = items[index];
  if (!group || !isViewFilterGroup(group)) return filters;

  const ruleIndex = rest[0];
  if (ruleIndex === undefined) return filters;

  const rules = group.rules.filter((_, i) => i !== ruleIndex);
  if (rules.length === 0) {
    return { ...filters, items: items.filter((_, i) => i !== index) };
  }

  items[index] = { ...group, rules };
  return { ...filters, items };
}

export function labelForField(fieldRef: ViewFieldRef, fields: Field[]): string {
  const builtin = BUILTIN_FIELDS.find((f) => f.field === fieldRef);
  if (builtin) return builtin.label;
  if (fieldRef.startsWith("field:")) {
    const fieldId = fieldRef.slice("field:".length);
    return fields.find((f) => f.id === fieldId)?.name ?? fieldRef;
  }
  return fieldRef;
}

export function labelForOp(op: ViewFilterOp): string {
  const map: Record<ViewFilterOp, string> = {
    is_any_of: "is any of",
    is_none_of: "is none of",
    is_all_of: "has all of",
    contains: "contains",
    not_contains: "does not contain",
    is_empty: "is empty",
    is_not_empty: "is not empty",
    before: "is before",
    after: "is after",
    on: "is on",
  };
  return map[op];
}

export function formatRuleValue(
  rule: ViewFilterRule,
  statuses: Status[],
  fields: Field[],
): string {
  if (!rule.value) return "";
  const values = Array.isArray(rule.value) ? rule.value : [rule.value];

  if (rule.field === "status") {
    return values
      .map((id) => statuses.find((s) => s.id === id)?.name ?? id)
      .join(", ");
  }

  if (rule.field.startsWith("field:")) {
    const fieldId = rule.field.slice("field:".length);
    const field = fields.find((f) => f.id === fieldId);
    if (field && (field.type === "tag_single" || field.type === "tag_multi")) {
      return values
        .map((id) => field.options.find((o) => o.id === id)?.label ?? id)
        .join(", ");
    }
  }

  return values.join(", ");
}

export { needsValue };
