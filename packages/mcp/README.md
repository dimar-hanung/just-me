# Just Me MCP Server

stdio MCP server for Cursor. Requires completed onboarding and configured storage.

## Cursor config

```json
{
  "mcpServers": {
    "just-me-todos": {
      "command": "node",
      "args": ["/absolute/path/to/just-me/packages/mcp/dist/stdio.js"],
      "env": {
        "JUST_ME_CONFIG": "/home/you/.config/just-me/config.json"
      }
    }
  }
}
```

## Tools

- `list_todos` — optional `status_id`, `tag`, `code`
- `get_todo` — by `id` or `code`; returns `content_with_lines` (`N|line`) for edits
- `add_todo` — `title`, optional `content`, `status_id`, `due_at`, `tags`
- `update_todo` — `id` + patch fields (full `content` replace)
- `edit_todo_lines` — line-range markdown edit (`start_line` / `end_line` 1-based inclusive)
- `list_statuses`

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
