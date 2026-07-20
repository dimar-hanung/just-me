# develop-module-just-me-todos

## When to Use

Use when working on the Just Me personal todo app: storage, API, UI, MCP, Electron desktop, or Google Drive backup.

## Key locations

- `packages/core` — config, Turso/local SQLite adapter, statuses, **fields**, todos, Drive backup
  - `src/fields.ts` — field definitions (`tag_multi`, `tag_single`, `text`), options, per-todo values
- `packages/api` — Hono REST, onboarding routes, serves `web/dist`
- `packages/web` — React UI, onboarding wizard, settings
  - Uses `lucide-react` for icons (theme toggle, nav, kanban, settings actions)
  - `src/pages/HomePage.tsx` — kanban board + table view toggle (columns per status, drag-and-drop; table shows dynamic field columns)
  - `src/pages/SettingsPage.tsx` — statuses + dynamic field definitions (type, tag options)
  - `src/pages/TodoDetailPage.tsx` — todo detail at `/todos/:id` (markdown Write/Preview; **dynamic field editors**; default Preview, Write when created from home, auto-save)
  - `src/components/FieldValueEditors.tsx` — shared text/tag field editors for detail + table
  - `src/pages/TrashPage.tsx` — trash at `/trash` (restore or permanently delete; empty trash)
  - `src/components/KanbanBoard.tsx`, `KanbanColumn.tsx`, `KanbanCard.tsx`, `TodoTable.tsx`, `MarkdownContent.tsx`, `ThemeToggle.tsx`
  - `src/todo-view.ts` — board/table view preference in localStorage (`just-me-todo-view`)
  - `src/theme.ts` — theme init + localStorage persistence
  - `src/status-hue.ts` — default status accent colors (red/blue/green) + fallbacks
  - `src/index.css` — theme CSS variables, kanban styles, shared UI classes; local Plus Jakarta Sans in `src/assets/fonts/plus-jakarta-sans/`
- `packages/mcp` — Cursor stdio MCP tools
  - `src/stdio.ts` — tools: list/get/add/update todos, `edit_todo_lines`, list statuses, **list_fields**
  - `src/line-edit.ts` — 1-based inclusive line-range replace/insert/delete for todo markdown
- `packages/desktop` — Electron main process + installer
- Config file: `~/.config/just-me/config.json` (override with `JUST_ME_CONFIG`)

## References

- (none)

## Learned user preferences

- Manual Google Drive backup only (no cron)
- Dynamic todo statuses (default: Not Started, In Progress, Done)
- **Dynamic fields** in Settings: `tag_multi`, `tag_single`, `text`; tag types use predefined options; values editable on todo detail + table columns
- Default status accent colors: red (Not Started), blue (In Progress), green (Done)
- Auto-generated ticket codes on todos (format `TODO-{num}`, e.g. `TODO-1`)
- Per-todo markdown `content` field; detail page at `/todos/:id` with Write/Preview tabs (default Preview; Write when opened right after create), Notion-like auto-save
- MCP: prefer `edit_todo_lines` (1-based inclusive range) over full `content` replace; use `get_todo` for `content_with_lines` (`N|line`); use `list_fields` before setting `field_values` on add/update
- Home Add button creates an "Untitled" todo then navigates to `/todos/:id` with `{ defaultTab: "write" }` (no inline title input on home)
- Preview tab: GFM task list checkboxes are clickable; toggling updates markdown source and auto-saves (`MarkdownContent` + `markdown-task-list.ts`)
- Storage choice: local SQLite or Turso
- Electron over Tauri for stability
- Kanban board UI with drag-and-drop between status columns; columns collapse/expand per status (persisted in `just-me-kanban-collapsed`)
- Kanban cards show a 2-line plain-text preview of markdown `content` under the title (not rendered markdown)
- Table view toggle on home page (Board / Table); preference persisted in `just-me-todo-view`
- Dark mode default; light/dark toggle persisted in localStorage (`just-me-theme`)
- Delete moves todos to trash (`deleted_at`); permanent remove only from Trash page (restore / purge / empty trash)

## Learned Workspace Facts

- Monorepo uses pnpm workspaces under `packages/*`
- API binds `127.0.0.1:7841` only
- Hono runs inside Electron main process

## External projects

- **Turso** — optional hosted libSQL database when user picks cloud storage mode
- **Google Drive** — manual off-site backup snapshots via OAuth Desktop client

## Gotchas

- Complete onboarding before MCP tools work
- Switching storage modes does not migrate data automatically
- Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` for Drive OAuth
- Existing SQLite DBs created before `code`/`content` columns: migration must add `code` without inline UNIQUE (SQLite limitation), then backfill + unique index. If API was started before migration succeeded, it runs stale logic — restart API after `pnpm --filter @just-me/core build`
- Soft delete uses `todos.deleted_at`; list/get/update ignore trashed rows. Restart API after core build so migration adds `deleted_at`
- Dynamic fields: tables `fields`, `field_options`, `todo_field_values`; tag values store option **ids**
- Restart API after core build so migration drops legacy `todos.tags` column on existing DBs
