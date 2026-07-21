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

(`pnpm dev:web` runs the same — API + web in one terminal.)

Or use two terminals:

Terminal 1 — API:

```bash
pnpm dev:api
```

Terminal 2 — Web with hot reload (proxies `/api` to dev port **7842**):

```bash
pnpm --filter @just-me/web dev
```

Open http://localhost:5173

Dev API runs on `127.0.0.1:7842` so it does not conflict with the desktop app on **7841**. Override with `JUST_ME_DEV_API_PORT` in `.env`.

If onboarding or API calls return 500, check that the API terminal is running on `127.0.0.1:7842`.

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

## Install (desktop)

### Windows

1. Download `JustMe-*-setup.exe` from [Releases](https://github.com/dimar-hanung/just-me/releases).
2. Run the installer and follow the prompts (choose install folder if you like).
3. Launch **Just Me** from the Start menu or desktop shortcut.
4. Complete onboarding (local SQLite or Turso; optional Google Drive).

Config and the default local database live under `%APPDATA%\just-me\` (usually `C:\Users\<you>\AppData\Roaming\just-me\`).

### Linux

1. Download the `.AppImage` or `.deb` from [Releases](https://github.com/dimar-hanung/just-me/releases).
2. AppImage: `chmod +x JustMe-*.AppImage && ./JustMe-*.AppImage`
3. Debian/Ubuntu: `sudo apt install ./JustMe-*-amd64.deb`

## Build installer

Linux (default):

```bash
pnpm build:desktop
# or: pnpm build:desktop:linux
```

Windows NSIS setup (`.exe`). On Windows:

```bash
pnpm build:desktop:win
```

Cross-build Windows from Linux (Docker + Wine image):

```bash
docker run --rm \
  -v "$PWD":/project \
  -v "$HOME/.cache/electron":/root/.cache/electron \
  -v "$HOME/.cache/electron-builder":/root/.cache/electron-builder \
  -w /project \
  -e CI=1 \
  electronuserland/builder:wine \
  /bin/bash -c "corepack enable && corepack prepare pnpm@9.15.0 --activate && pnpm install && pnpm build:desktop:win"
```

Both platforms:

```bash
pnpm build:desktop:all
```

Artifacts land in `release/` (`JustMe-*-setup.exe`, `.deb`, AppImage).

## Config

- **Linux / macOS:** `~/.config/just-me/config.json` (default DB: `~/.config/just-me/todos.sqlite`)
- **Windows:** `%APPDATA%\just-me\config.json` (default DB: `%APPDATA%\just-me\todos.sqlite`)
- Override config file with `JUST_ME_CONFIG`, or config directory with `JUST_ME_CONFIG_DIR`

Stored fields:

- Storage mode: `local` or `turso`
- Google refresh token after Drive connect
- `onboardingComplete` flag

## Architecture

- **Electron** starts **Hono** on `127.0.0.1:7841` and opens a BrowserWindow
- **MCP** is a separate stdio process used by Cursor
- **Backup** is manual via Settings → Backup now
