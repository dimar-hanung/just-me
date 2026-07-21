# develop-module-just-me-todos

## When to Use

Use when working on the Just Me personal todo app: storage, API, UI, MCP, Electron desktop, or Google Drive backup.

## Key locations

- `packages/core` — config, Turso/local SQLite adapter, statuses, **fields**, todos, Drive backup, **R2 attachments**
  - `src/r2.ts` — Cloudflare R2 upload/get via REST API with an Admin Read & Write token; config in `config.json` under `r2`
  - `src/fields.ts` — field definitions (`tag_multi`, `tag_single`, `text`), options, per-todo values
  - `src/views.ts`, `src/todo-filters.ts`, `src/view-schemas.ts` — saved views CRUD + filter/sort SQL builder
- `packages/api` — Hono REST, onboarding routes, serves `web/dist`; `GET /api/mcp-setup`, MCP fields on `GET /api/health` (`src/mcp-status.ts`)
- `packages/web` — React UI, onboarding wizard, settings
  - Uses `lucide-react` for icons (theme toggle, nav, kanban, settings actions)
  - `src/components/Layout.tsx` — app shell: icon sidebar rail + scrollable main `<Outlet />`
  - `src/components/Sidebar.tsx` — collapsed icon rail (default) with expand toggle + nav links + theme toggle
  - `src/nav-items.ts` — sidebar nav config (Todos, Trash, Docs, Settings); Todos active on `/` and `/todos/*`
  - `src/sidebar.ts` — expand/collapse preference in localStorage (`just-me-sidebar-expanded`)
  - `src/pages/HomePage.tsx` — **saved views** (tabs inside `todo-view-panel` above table/board), filter/sort popovers, layout (board/table per view), columns picker, paginated todo list with Load more and per-view page size
  - `src/pages/SettingsPage.tsx` — health check (top) + statuses + dynamic field definitions (type, tag options)
  - `src/components/HealthCheckSection.tsx` — Settings health panel: API/storage/onboarding/MCP/Drive status via `GET /api/health`, manual refresh
  - `src/pages/TodoDetailPage.tsx` — todo detail at `/todos/:id` (markdown Write/Preview kept mounted and toggled with `hidden`; **Ctrl/Cmd+E** restores caret + page scroll; **MarkdownTextarea** with R2 paste/drop upload; dynamic field editors; default Preview, Write when created from home, auto-save; **Save to PDF** opens system print dialog via `window.print()` with `@media print` styles for full detail export)
  - `src/components/MarkdownTextarea.tsx` — markdown textarea with Ctrl+V paste and drag-and-drop upload to R2; auto-grows via offscreen mirror measure (no live height:0); `active` skips resize while Write panel hidden; imperative cursor/focus helpers for tab toggle
  - `src/markdown-insert.ts` — cursor insertion + markdown snippet for uploaded files/images; line/column ↔ offset helpers
  - `src/components/FieldValueEditors.tsx` — shared text/tag field editors for detail + table
  - `src/pages/TrashPage.tsx` — trash at `/trash` (restore or permanently delete; empty trash)
  - `src/pages/DocsPage.tsx` — in-app docs at `/docs` (MCP Cursor setup; **Copy Cursor MCP config** via `GET /api/mcp-setup`)
  - `src/components/DocsMcpSetupSection.tsx` — live MCP JSON copy block on Docs
  - `src/docs-content.ts` — static Docs section copy and JSON examples
  - `src/components/KanbanBoard.tsx`, `KanbanColumn.tsx`, `KanbanCard.tsx`, `TodoTable.tsx`, `StatusDropdown.tsx`, `TodoColumnPicker.tsx`, `TicketCode.tsx`, `ViewTabs.tsx`, `ViewFilterPopover.tsx`, `ViewSortPopover.tsx`, `MarkdownContent.tsx`, `ThemeToggle.tsx`
  - `src/view-types.ts`, `src/active-view.ts`, `src/view-migration.ts`, `src/view-filter-helpers.ts`
  - `src/todo-columns.ts` — column visibility per saved view (stored in DB via `views.columns_json`)
  - `src/todo-date.ts` — shared date formatting + date input helpers for table, kanban, and detail pickers
  - `src/theme.ts` — theme init + localStorage persistence
  - `src/status-hue.ts` — default status accent colors (red/blue/green) + fallbacks
  - `src/index.css` — theme CSS variables, kanban styles, shared UI classes; table panels use white `--surface` in light mode (not muted `.panel` bg); local Plus Jakarta Sans in `src/assets/fonts/plus-jakarta-sans/`
- `packages/mcp` — Cursor stdio MCP tools
  - `src/stdio.ts` — tools: list/get/add/update todos, `edit_todo_lines`, list statuses, **list_fields**
  - `scripts/bundle.mjs` — esbuild bundle → `dist/bundle/stdio.js` + libsql sidecars for installer
  - `src/line-edit.ts` — 1-based inclusive line-range replace/insert/delete for todo markdown
- `packages/desktop` — Electron main process + installer (`electron-builder` → `release/`)
  - Copies `packages/web/dist` → `packages/desktop/web-dist` before packaging (`scripts/copy-web-dist.mjs`)
  - Stages MCP bundle → `resources/mcp` (`scripts/stage-mcp.mjs`); ships via `extraResources`
  - `src/mcp.ts` — mirrors packaged MCP to config dir (`~/.config/just-me/mcp/`); sets `JUST_ME_MCP_STDIO`
  - Desktop sets `JUST_ME_WEB_DIST` via `src/env.ts` before API loads
  - Linux: `pnpm build:desktop:linux` → `.deb` + AppImage
  - Windows NSIS: `pnpm build:desktop:win` → `JustMe-*-setup.exe` (cross-build from Linux via `electronuserland/builder:wine` Docker image)
- Config dir: Linux/macOS `~/.config/just-me`, Windows `%APPDATA%\just-me` (`JUST_ME_CONFIG` / `JUST_ME_CONFIG_DIR`)
- GitHub releases: tag `vX.Y.Z`, attach `JustMe-*` AppImage + `.deb` + Windows `*-setup.exe` from `release/`

## References

- [views.md](references/views.md) — when changing saved views, filters, sorts, or `/api/views`
- [release-just-me](../release-just-me/SKILL.md) — when committing, pushing, tagging, or publishing GitHub releases with desktop installers

## Learned user preferences

- Manual Google Drive backup only (no cron)
- Dynamic todo statuses (default: Not Started, In Progress, Done)
- **Dynamic fields** in Settings: `tag_multi`, `tag_single`, `text`; tag types use predefined options; values editable on todo detail + table columns
- Default status accent colors: red (Not Started), blue (In Progress), green (Done)
- Auto-generated ticket codes on todos (format `TODO-{num}`, e.g. `TODO-1`); click code badge on board/detail to copy; table shows copy icon on row hover (`TicketCode`)
- Per-todo markdown `content` field; detail page at `/todos/:id` with Write/Preview tabs (default Preview; Write when opened right after create), Notion-like auto-save; **Ctrl/Cmd+E** toggles Write/Preview and restores caret line/column + page scroll position
- **Save to PDF** on todo detail: `Save to PDF` button opens the system print dialog (`window.print()`); user picks “Save as PDF”. Print CSS exports full detail (code, status, title, custom fields, rendered preview markdown) without new PDF libraries; temporary `document.title` sets default filename
- Optional **Cloudflare R2** attachments: configure in Settings; paste (Ctrl+V) or drag files into Write tab; images inline in Preview, other files as links
- MCP: prefer `edit_todo_lines` (1-based inclusive range) over full `content` replace; use `get_todo` for `content_with_lines` (`N|line`); use `list_fields` before setting `field_values` on add/update; user-facing MCP setup lives in-app **Docs** (`/docs`) with **Copy Cursor MCP config**; Settings health shows `mcpStatus`
- Home Add button creates an "Untitled" todo then navigates to `/todos/:id` with `{ defaultTab: "write" }` (no inline title input on home)
- Preview tab: GFM task list checkboxes are clickable; toggling updates markdown source and auto-saves (`MarkdownContent` + `markdown-task-list.ts`)
- Markdown list markers use absolute positioning in `.markdown-prose` (not CSS grid) so mixed inline nodes like `text **bold**` stay on one line
- Storage choice: local SQLite or Turso
- Electron over Tauri for stability
- Kanban board UI with drag-and-drop between status columns; columns collapse/expand per status (persisted in `just-me-kanban-collapsed`)
- Kanban cards show a 2-line plain-text preview of markdown `content` under the title (not rendered markdown); optional read-only Start, Deadline, Done, Updated, and dynamic field rows when enabled via Columns picker
- **Saved views** (Notion-like): named views with layout (board/table), filters (AND/OR + nested groups), multi-sort, column visibility, and page size — all persisted in `views` table; active view id in `just-me-active-view-id`
- Home todo list uses view filters/sorts server-side via `GET /api/todos?filters=&sorts=`; paginated with Load more; page size per view (10/30/50/100/No limit, default 30)
- Table view: status and tag/field cells use zero cell padding; controls fill the cell for a larger click target (styles in `index.css` under `.todo-table-status-cell` / `.todo-table-field-cell`)
- Table status cell uses custom `StatusDropdown` (not native `<select>`): hue-colored trigger matching the cell, menu options with hue dots + status colors + checkmark; portals to `document.body` with fixed positioning (same overflow escape pattern as compact tag-multi)
- Table Code column stays narrow (`width: 1%` + nowrap on `.todo-table-code` for th/td) so it hugs ticket codes instead of stretching
- Tag multi dropdown (`TagMultiDropdown` in `FieldValueEditors`) closes on outside click via capture-phase `mousedown` — needed because the control stops mousedown propagation to avoid table row navigation
- Table compact tag-multi menus portal to `document.body` with fixed positioning (flip up near bottom) so they are not clipped by `.todo-view-panel` / `.todo-table-wrap` overflow
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
- **Cloudflare R2** — optional object storage for todo note attachments (images/files pasted or dropped in markdown editor)

## Gotchas

- Complete onboarding before MCP tools work
- Desktop installer mirrors MCP to config dir (stable path for AppImage); Cursor still needs system Node 20+
- Switching storage modes does not migrate data automatically
- Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` for Drive OAuth
- R2 credentials live in `config.json` (`r2` block), not env vars; configure via Settings → Cloudflare R2 attachments
- Restart API after core build when adding/changing R2 or other core modules
- Existing SQLite DBs created before `code`/`content` columns: migration must add `code` without inline UNIQUE (SQLite limitation), then backfill + unique index. If API was started before migration succeeded, it runs stale logic — restart API after `pnpm --filter @just-me/core build`
- Soft delete uses `todos.deleted_at`; list/get/update ignore trashed rows. Restart API after core build so migration adds `deleted_at`
- Dynamic fields: tables `fields`, `field_options`, `todo_field_values`; tag values store option **ids**
- Todo detail: Start At, Deadline At, Done At date pickers (auto-save); Done At auto-sets when status becomes Done, clears when leaving Done
- Saved views seed **All todos**, **Today** (open + late deadlines), and **Board** on migration
- Restart API after core build so migration drops legacy `todos.tags` column on existing DBs
- Desktop Linux build needs `author` (+ email), `homepage`, and `linux.maintainer` in `packages/desktop/package.json` (required for `.deb`)
- Windows NSIS from Linux needs Wine (local) or Docker image `electronuserland/builder:wine`
- Cross-building Windows must ship `@libsql/win32-x64-msvc` (optional native). Root `pnpm.supportedArchitectures` includes `win32`, and `@just-me/core` depends on that package explicitly. Avoid broad `asarUnpack` — it breaks packaging of `../api`/`../core` dist files outside the desktop app dir
- `/api/health` returns HTTP 503 with JSON when storage fails; web `api.health()` parses the body anyway (do not use shared `request()` for health)
