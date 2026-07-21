import type { ViewFilterGroup, ViewFilterItem, ViewFilterRule, ViewFilters, ViewSort } from "./types.js";
import { isViewFilterGroup } from "./view-schemas.js";

type SqlFragment = {
  sql: string;
  args: (string | number)[];
};

type SortJoin = {
  alias: string;
  fieldId: string;
};

export type ListTodosQueryParts = {
  where: string;
  args: (string | number)[];
  orderBy: string;
  joins: string;
  joinArgs: (string | number)[];
};

function asStringArray(value: string | string[] | undefined): string[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function likePattern(value: string): string {
  return `%${value.toLowerCase()}%`;
}

function dayEnd(isoDate: string): string {
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return isoDate;
  const end = new Date(d);
  end.setUTCDate(end.getUTCDate() + 1);
  return end.toISOString();
}

function startOfTomorrowUtc(): string {
  const now = new Date();
  const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return tomorrow.toISOString();
}

function buildDateRuleClause(field: string, op: ViewFilterRule["op"], values: string[]): SqlFragment | null {
  const column = `t.${field}`;
  if (op === "is_empty") {
    return { sql: `${column} IS NULL`, args: [] };
  }
  if (op === "is_not_empty") {
    return { sql: `${column} IS NOT NULL`, args: [] };
  }
  if (op === "before" && values[0]) {
    return { sql: `${column} < ?`, args: [values[0]] };
  }
  if (op === "after" && values[0]) {
    return { sql: `${column} >= ?`, args: [values[0]] };
  }
  if (op === "on" && values[0]) {
    return { sql: `${column} >= ? AND ${column} < ?`, args: [values[0], dayEnd(values[0])] };
  }
  if (op === "on_or_before_today") {
    return { sql: `${column} IS NOT NULL AND ${column} < ?`, args: [startOfTomorrowUtc()] };
  }
  return null;
}

function buildRuleClause(rule: ViewFilterRule): SqlFragment | null {
  const { field, op } = rule;
  const values = asStringArray(rule.value);

  if (field === "status") {
    if (op === "is_any_of" && values.length > 0) {
      return {
        sql: `t.status_id IN (${values.map(() => "?").join(", ")})`,
        args: values,
      };
    }
    if (op === "is_none_of" && values.length > 0) {
      return {
        sql: `t.status_id NOT IN (${values.map(() => "?").join(", ")})`,
        args: values,
      };
    }
    if (op === "is_empty") {
      return { sql: "0", args: [] };
    }
    if (op === "is_not_empty") {
      return { sql: "1", args: [] };
    }
    return null;
  }

  if (field === "title" || field === "code") {
    const column = field === "title" ? "t.title" : "t.code";
    if (op === "contains" && values[0]) {
      return { sql: `LOWER(${column}) LIKE ?`, args: [likePattern(values[0])] };
    }
    if (op === "not_contains" && values[0]) {
      return { sql: `(LOWER(${column}) NOT LIKE ? OR ${column} IS NULL)`, args: [likePattern(values[0])] };
    }
    if (op === "is_empty") {
      return { sql: `(${column} IS NULL OR TRIM(${column}) = '')`, args: [] };
    }
    if (op === "is_not_empty") {
      return { sql: `(${column} IS NOT NULL AND TRIM(${column}) != '')`, args: [] };
    }
    return null;
  }

  if (
    field === "start_at" ||
    field === "deadline_at" ||
    field === "done_at" ||
    field === "created_at" ||
    field === "updated_at"
  ) {
    return buildDateRuleClause(field, op, values);
  }

  if (!field.startsWith("field:")) return null;
  const fieldId = field.slice("field:".length);

  if (op === "is_empty") {
    return {
      sql: `NOT EXISTS (
        SELECT 1 FROM todo_field_values v
        WHERE v.todo_id = t.id AND v.field_id = ?
          AND v.value IS NOT NULL AND TRIM(v.value) != '' AND v.value != '[]'
      )`,
      args: [fieldId],
    };
  }

  if (op === "is_not_empty") {
    return {
      sql: `EXISTS (
        SELECT 1 FROM todo_field_values v
        WHERE v.todo_id = t.id AND v.field_id = ?
          AND v.value IS NOT NULL AND TRIM(v.value) != '' AND v.value != '[]'
      )`,
      args: [fieldId],
    };
  }

  if (op === "contains" && values[0]) {
    return {
      sql: `EXISTS (
        SELECT 1 FROM todo_field_values v
        WHERE v.todo_id = t.id AND v.field_id = ? AND LOWER(v.value) LIKE ?
      )`,
      args: [fieldId, likePattern(values[0])],
    };
  }

  if (op === "not_contains" && values[0]) {
    return {
      sql: `NOT EXISTS (
        SELECT 1 FROM todo_field_values v
        WHERE v.todo_id = t.id AND v.field_id = ? AND LOWER(v.value) LIKE ?
      )`,
      args: [fieldId, likePattern(values[0])],
    };
  }

  if (op === "is_any_of" && values.length > 0) {
    const placeholders = values.map(() => "?").join(", ");
    return {
      sql: `EXISTS (
        SELECT 1 FROM todo_field_values v
        WHERE v.todo_id = t.id AND v.field_id = ?
          AND (
            v.value IN (${placeholders})
            OR EXISTS (
              SELECT 1 FROM json_each(v.value) je WHERE je.value IN (${placeholders})
            )
          )
      )`,
      args: [fieldId, ...values, ...values],
    };
  }

  if (op === "is_none_of" && values.length > 0) {
    const placeholders = values.map(() => "?").join(", ");
    return {
      sql: `NOT EXISTS (
        SELECT 1 FROM todo_field_values v
        WHERE v.todo_id = t.id AND v.field_id = ?
          AND (
            v.value IN (${placeholders})
            OR EXISTS (
              SELECT 1 FROM json_each(v.value) je WHERE je.value IN (${placeholders})
            )
          )
      )`,
      args: [fieldId, ...values, ...values],
    };
  }

  if (op === "is_all_of" && values.length > 0) {
    const placeholders = values.map(() => "?").join(", ");
    return {
      sql: `EXISTS (
        SELECT 1 FROM todo_field_values v
        WHERE v.todo_id = t.id AND v.field_id = ?
          AND (
            SELECT COUNT(DISTINCT matched.value) FROM (
              SELECT je.value AS value FROM json_each(v.value) je WHERE je.value IN (${placeholders})
              UNION
              SELECT v.value AS value WHERE v.value IN (${placeholders})
            ) matched
          ) = ?
      )`,
      args: [fieldId, ...values, ...values, values.length],
    };
  }

  return null;
}

function combineClauses(clauses: string[], logic: "and" | "or"): string | null {
  const filtered = clauses.filter(Boolean);
  if (filtered.length === 0) return null;
  if (filtered.length === 1) return filtered[0];
  const joiner = logic === "and" ? " AND " : " OR ";
  return `(${filtered.join(joiner)})`;
}

function buildItemsClause(items: ViewFilterItem[], logic: "and" | "or"): SqlFragment | null {
  if (items.length === 0) return null;

  const clauses: string[] = [];
  const args: (string | number)[] = [];

  for (const item of items) {
    if (isViewFilterGroup(item)) {
      const group = buildGroupClause(item);
      if (group) {
        clauses.push(group.sql);
        args.push(...group.args);
      }
      continue;
    }

    const rule = buildRuleClause(item);
    if (rule) {
      clauses.push(rule.sql);
      args.push(...rule.args);
    }
  }

  const combined = combineClauses(clauses, logic);
  if (!combined) return null;
  return { sql: combined, args };
}

function buildGroupClause(group: ViewFilterGroup): SqlFragment | null {
  const clauses: string[] = [];
  const args: (string | number)[] = [];

  for (const rule of group.rules) {
    const fragment = buildRuleClause(rule);
    if (fragment) {
      clauses.push(fragment.sql);
      args.push(...fragment.args);
    }
  }

  const combined = combineClauses(clauses, group.logic);
  if (!combined) return null;
  return { sql: combined, args };
}

export function buildFiltersWhere(filters?: ViewFilters): SqlFragment {
  if (!filters || filters.items.length === 0) {
    return { sql: "", args: [] };
  }

  const built = buildItemsClause(filters.items, filters.logic);
  if (!built) return { sql: "", args: [] };
  return { sql: ` AND (${built.sql})`, args: built.args };
}

function statusSortColumn(direction: "asc" | "desc"): string {
  return direction === "asc" ? "s.sort_order ASC, s.name ASC" : "s.sort_order DESC, s.name DESC";
}

function todoColumn(field: ViewSort["field"]): string | null {
  switch (field) {
    case "title":
      return "t.title";
    case "code":
      return "t.code";
    case "start_at":
      return "t.start_at";
    case "deadline_at":
      return "t.deadline_at";
    case "done_at":
      return "t.done_at";
    case "created_at":
      return "t.created_at";
    case "updated_at":
      return "t.updated_at";
    default:
      return null;
  }
}

export function buildListTodosQueryParts(
  filters?: ViewFilters,
  sorts?: ViewSort[],
): ListTodosQueryParts {
  const filterPart = buildFiltersWhere(filters);
  const effectiveSorts: ViewSort[] =
    sorts && sorts.length > 0 ? sorts : [{ field: "updated_at", direction: "desc" }];

  const joinParts: string[] = [];
  const joinArgs: (string | number)[] = [];
  const orderParts: string[] = [];
  let joinIndex = 0;

  for (const sort of effectiveSorts) {
    if (sort.field === "status") {
      orderParts.push(statusSortColumn(sort.direction));
      continue;
    }

    const column = todoColumn(sort.field);
    if (column) {
      orderParts.push(`${column} ${sort.direction.toUpperCase()}`);
      continue;
    }

    if (sort.field.startsWith("field:")) {
      const fieldId = sort.field.slice("field:".length);
      const alias = `sort_fv_${joinIndex}`;
      joinIndex += 1;
      joinParts.push(
        `LEFT JOIN todo_field_values ${alias} ON ${alias}.todo_id = t.id AND ${alias}.field_id = ?`,
      );
      joinArgs.push(fieldId);
      orderParts.push(`${alias}.value ${sort.direction.toUpperCase()}`);
    }
  }

  orderParts.push("t.id DESC");

  return {
    where: filterPart.sql,
    args: filterPart.args,
    orderBy: ` ORDER BY ${orderParts.join(", ")}`,
    joins: joinParts.length > 0 ? ` ${joinParts.join(" ")}` : "",
    joinArgs,
  };
}

export function legacyStatusFilter(statusId: string): ViewFilters {
  return {
    logic: "and",
    items: [{ field: "status", op: "is_any_of", value: [statusId] }],
  };
}

export function legacyCodeFilter(code: string): ViewFilters {
  return {
    logic: "and",
    items: [{ field: "code", op: "contains", value: code.trim() }],
  };
}

export function mergeViewFilters(base: ViewFilters, extra: ViewFilters): ViewFilters {
  if (base.items.length === 0) return extra;
  if (extra.items.length === 0) return base;
  return {
    logic: "and",
    items: [...base.items, ...extra.items],
  };
}
