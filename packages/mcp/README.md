# Just Me MCP Server

stdio MCP server for Cursor and other MCP clients. Requires completed onboarding and configured storage.

**User-facing setup:** open **Docs** in the Just Me app (`/docs`) and use **Copy Cursor MCP config** (installer users). Settings health shows MCP readiness (`ready` / `needs onboarding` / `not bundled`).

## Cursor config

**Installer / desktop app:** use **Docs → Copy Cursor MCP config** — paths point at the mirrored bundle under your config dir (e.g. `~/.config/just-me/mcp/stdio.js` on Linux).

**Development from repo checkout:**

```json
{
  "mcpServers": {
    "just-me-todos": {
      "command": "node",
      "args": ["/absolute/path/to/just-me/packages/mcp/dist/bundle/stdio.js"],
      "env": {
        "JUST_ME_CONFIG": "/home/you/.config/just-me/config.json"
      }
    }
  }
}
```

On Windows, point `JUST_ME_CONFIG` at `%APPDATA%\just-me\config.json`:

```json
{
  "mcpServers": {
    "just-me-todos": {
      "command": "node",
      "args": ["C:\\\\path\\\\to\\\\just-me\\\\packages\\\\mcp\\\\dist\\\\bundle\\\\stdio.js"],
      "env": {
        "JUST_ME_CONFIG": "C:\\\\Users\\\\you\\\\AppData\\\\Roaming\\\\just-me\\\\config.json"
      }
    }
  }
}
```

See in-app **Docs** for verify steps and other MCP clients.

## Build bundle

```bash
pnpm --filter @just-me/mcp build
```

Produces `dist/bundle/stdio.js` plus libsql sidecars for packaging.

## Tools

- `list_todos` — optional `status_id`, `tag`, `code`
- `get_todo` — by `id` or `code`; returns `content_with_lines` (`N|line`) for edits
- `add_todo` — `title`, optional `content`, `status_id`, `start_at`, `deadline_at`, `done_at`, `field_values`
- `update_todo` — `id` + patch fields (full `content` replace)
- `edit_todo_lines` — line-range markdown edit (`start_line` / `end_line` 1-based inclusive)
- `list_statuses`
- `list_fields` — field definitions and tag options; call before setting `field_values`

### Line-range edit

1. Call `get_todo` with `id` or ticket `code` and read `content_with_lines`.
2. Call `edit_todo_lines` with the same id/code, `start_line`, `end_line`, and `new_content`.

- Replace lines 3–5: `start_line: 3`, `end_line: 5`, `new_content: "..."`  
- Delete lines 3–5: same range, `new_content: ""`  
- Insert before line 3: `start_line: 3`, `end_line: 2`, `new_content: "..."`  

Prefer `edit_todo_lines` over replacing the whole `content` via `update_todo`.

Backup is app-only (manual button in Settings).

## Dev

```bash
pnpm --filter @just-me/mcp dev
```
