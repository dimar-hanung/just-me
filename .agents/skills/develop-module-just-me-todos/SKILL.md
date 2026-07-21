# develop-module-just-me-todos

## When to Use

Use when working on the Just Me personal todo app: storage, API, UI, MCP, Electron desktop, or Google Drive backup.

## Key locations

- `packages/core` — config, Turso/local SQLite adapter, statuses, **fields**, todos, Drive backup
  - `src/fields.ts` — field definitions (`tag_multi`, `tag_single`, `text`), options, per-todo values
- `packages/api` — Hono REST, onboarding routes, serves `web/dist`
- `packages/web` — React UI, onboarding wizard, settings
  - Uses `lucide-react` for icons (theme toggle, nav, kanban, settings actions)
  - `src/components/Layout.tsx` — app shell: icon sidebar rail + scrollable main `<Outlet />`
  - `src/components/Sidebar.tsx` — collapsed icon rail (default) with expand toggle + nav links + theme toggle
  - `src/nav-items.ts` — sidebar nav config (Todos, Trash, Settings); Todos active on `/` and `/todos/*`
  - `src/sidebar.ts` — expand/collapse preference in localStorage (`just-me-sidebar-expanded`)
  - `src/pages/HomePage.tsx` — kanban board + table view toggle; paginated todo list with **Load more** and per-load size selector (10/30/50/100/No limit, default 30)
  - `src/pages/SettingsPage.tsx` — health check (top) + statuses + dynamic field definitions (type, tag options)
  - `src/components/HealthCheckSection.tsx` — Settings health panel: API/storage/onboarding/Drive status via `GET /api/health`, manual refresh
  - `src/pages/TodoDetailPage.tsx` — todo detail at `/todos/:id` (markdown Write/Preview; **dynamic field editors**; default Preview, Write when created from home, auto-save)
  - `src/components/FieldValueEditors.tsx` — shared text/tag field editors for detail + table
  - `src/pages/TrashPage.tsx` — trash at `/trash` (restore or permanently delete; empty trash)
  - `src/components/KanbanBoard.tsx`, `KanbanColumn.tsx`, `KanbanCard.tsx`, `TodoTable.tsx`, `MarkdownContent.tsx`, `ThemeToggle.tsx`
  - `src/todo-view.ts` — board/table view preference in localStorage (`just-me-todo-view`)
  - `src/todo-page-size.ts` — todos per load preference in localStorage (`just-me-todo-page-size`; default 30)
  - `src/theme.ts` — theme init + localStorage persistence
  - `src/status-hue.ts` — default status accent colors (red/blue/green) + fallbacks
  - `src/index.css` — theme CSS variables, kanban styles, shared UI classes; table panels use white `--surface` in light mode (not muted `.panel` bg); local Plus Jakarta Sans in `src/assets/fonts/plus-jakarta-sans/`
- `packages/mcp` — Cursor stdio MCP tools
  - `src/stdio.ts` — tools: list/get/add/update todos, `edit_todo_lines`, list statuses, **list_fields**
  - `src/line-edit.ts` — 1-based inclusive line-range replace/insert/delete for todo markdown
- `packages/desktop` — Electron main process + installer (`electron-builder` → `release/`)
  - Copies `packages/web/dist` → `packages/desktop/web-dist` before packaging (`scripts/copy-web-dist.mjs`)
  - Desktop sets `JUST_ME_WEB_DIST` via `src/env.ts` before API loads
  - Linux: `pnpm build:desktop:linux` → `.deb` + AppImage
  - Windows NSIS: `pnpm build:desktop:win` → `JustMe-*-setup.exe` (cross-build from Linux via `electronuserland/builder:wine` Docker image)
- Config dir: Linux/macOS `~/.config/just-me`, Windows `%APPDATA%\just-me` (`JUST_ME_CONFIG` / `JUST_ME_CONFIG_DIR`)
- GitHub releases: tag `vX.Y.Z`, attach `JustMe-*` AppImage + `.deb` + Windows `*-setup.exe` from `release/`

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
- Home todo list paginated via `GET /api/todos?limit=&offset=`; manual **Load more**; page size 10/30/50/100/No limit (default 30) on home toolbar; `just-me-todo-page-size`
- Todo detail loads one todo via `GET /api/todos/:id` (not full list)
- Dark mode default; light/dark toggle persisted in localStorage (`just-me-theme`)
- Icon-only sidebar rail (collapsed by default); expand toggle shows labels; state in `just-me-sidebar-expanded`
- Delete moves todos to trash (`deleted_at`); permanent remove only from Trash page (restore / purge / empty trash)

## Learned Workspace Facts

- Monorepo uses pnpm workspaces under `packages/*`
- Desktop/production API binds `127.0.0.1:7841`; dev API uses `7842` (`JUST_ME_DEV_API_PORT`) so `pnpm dev` does not collide with a running desktop app
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
- Desktop Linux build needs `author` (+ email), `homepage`, and `linux.maintainer` in `packages/desktop/package.json` (required for `.deb`)
- Windows NSIS from Linux needs Wine (local) or Docker image `electronuserland/builder:wine`
- Cross-building Windows must ship `@libsql/win32-x64-msvc` (optional native). Root `pnpm.supportedArchitectures` includes `win32`, and `@just-me/core` depends on that package explicitly. Avoid broad `asarUnpack` — it breaks packaging of `../api`/`../core` dist files outside the desktop app dir
- `/api/health` returns HTTP 503 with JSON when storage fails; web `api.health()` parses the body anyway (do not use shared `request()` for health)
