# Views (saved filters, sorts, layout)

Saved views replace the old board/table toggle and localStorage column prefs.

## Database

Table `views`:

| Column | Purpose |
|--------|---------|
| `layout` | `kanban` or `table` |
| `filters_json` | Filter tree with AND/OR at root and nested groups |
| `sorts_json` | Ordered sort rules |
| `columns_json` | Column visibility for this view's layout |
| `page_size` | `10`, `30`, `50`, `100`, or `all` |
| `sort_order` | Tab order |

Seeded on migration: **All todos** (table), **Today** (table), and **Board** (kanban).

**Today** view filters: `done_at` is empty AND `deadline_at` on_or_before_today (open tasks due today or overdue).

## Filter JSON

```typescript
type ViewFilters = {
  logic: "and" | "or";
  items: Array<ViewFilterRule | ViewFilterGroup>;
};

type ViewFilterRule = {
  field: "status" | "title" | "code" | "start_at" | "deadline_at" | "done_at" | "created_at" | "updated_at" | `field:${uuid}`;
  op: ViewFilterOp;
  value?: string | string[];
};

type ViewFilterGroup = {
  logic: "and" | "or";
  rules: ViewFilterRule[];
};
```

### Operators by field kind

| Field kind | Operators |
|------------|-----------|
| Status | `is_any_of`, `is_none_of` |
| tag_single / tag_multi | `is_any_of`, `is_none_of`, `is_all_of` (multi only), `is_empty`, `is_not_empty` |
| text / title / code | `contains`, `not_contains`, `is_empty`, `is_not_empty` |
| start_at / deadline_at / done_at / created_at / updated_at | `on`, `before`, `after`, `on_or_before_today`, `is_empty`, `is_not_empty` |

Groups combine their rules with the group's `logic`. Top-level `items` combine with root `logic`.

## Sort JSON

```typescript
type ViewSort = { field: ViewFieldRef; direction: "asc" | "desc" };
```

Applied in array order. Default when empty: `[{ field: "updated_at", direction: "desc" }]`.

## API

| Method | Route |
|--------|-------|
| GET | `/api/views` |
| POST | `/api/views` |
| GET | `/api/views/:id` |
| PATCH | `/api/views/:id` |
| DELETE | `/api/views/:id` |
| PUT | `/api/views/reorder` `{ ids: string[] }` |

`GET /api/todos` accepts URL-encoded JSON:

- `filters` — same shape as `filters_json`
- `sorts` — same shape as `sorts_json`

Legacy query params `status_id` and `code` still work (MCP).

## Web UI

- `ViewTabs` — switch/create/rename/delete views; right-click menu: rename, layout (table/board), delete (double-click tab also renames)
- `ViewFilterPopover` — filter builder with groups
- `ViewSortPopover` — multi-sort builder
- Layout (board/table), columns, page size, filters, sorts auto-save to active view (debounced PATCH)
- Active view id only in localStorage: `just-me-active-view-id`
- One-time migration from `just-me-todo-view`, `just-me-todo-columns`, `just-me-todo-page-size`

## Core modules

- `packages/core/src/views.ts` — CRUD
- `packages/core/src/todo-filters.ts` — SQL builder for filters/sorts
- `packages/core/src/view-schemas.ts` — Zod validation

Restart API after `@just-me/core` build so migrations run.
