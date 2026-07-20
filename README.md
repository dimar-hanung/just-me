# Just Me Todos

Personal todo app: React UI, local Hono API, Turso or local SQLite, MCP for Cursor, manual Google Drive backup, Electron installer.

## Prerequisites

- Node.js 20+
- pnpm 9+
- Turso account (only if using cloud storage)
- Google Cloud OAuth Desktop client (only for Drive backup)

## Setup

```bash
pnpm install
cp .env.example .env   # optional: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
```

## Development

Start API and web together (recommended):

```bash
pnpm dev
```

Or use two terminals:

Terminal 1 — API (required for `/api` routes):

```bash
pnpm dev:api
```

Terminal 2 — Web with hot reload (proxies `/api` to port 7841):

```bash
pnpm dev:web
```

Open http://localhost:5173

If onboarding or API calls return 500, check that the API terminal is running on `127.0.0.1:7841`.

For production-style web serving:

```bash
pnpm --filter @just-me/web build
pnpm --filter @just-me/core build
pnpm --filter @just-me/api build
pnpm dev:desktop
```

MCP (after onboarding):

```bash
pnpm dev:mcp
```

See `packages/mcp/README.md` for Cursor config.

## Build installer

```bash
pnpm build:desktop
```

Outputs `.deb` and AppImage under `release/`.

## Config

Stored at `~/.config/just-me/config.json`:

- Storage mode: `local` (default path `~/.config/just-me/todos.sqlite`) or `turso`
- Google refresh token after Drive connect
- `onboardingComplete` flag

## Architecture

- **Electron** starts **Hono** on `127.0.0.1:7841` and opens a BrowserWindow
- **MCP** is a separate stdio process used by Cursor
- **Backup** is manual via Settings → Backup now
