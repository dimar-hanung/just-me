# release-just-me

## When to Use

Use when the user asks to **commit**, **push**, **tag**, **release**, or **publish** a Just Me version — especially desktop installers on GitHub Releases.

Run this skill end-to-end. Do not improvise partial steps.

## Key locations

- Version fields: `packages/{api,core,desktop,mcp,web}/package.json` (keep all five in sync)
- Desktop build output: `release/` (`JustMe-{version}-x86_64.AppImage`, `JustMe-{version}-amd64.deb`, `JustMe-{version}-x64-setup.exe`)
- Bundled web UI for desktop: `packages/desktop/web-dist/` (copied from `packages/web/dist` during `prepare:app`)
- Root scripts: `package.json` → `build:desktop:linux`, `build:desktop:win`, `build:desktop:all`
- Remote: `https://github.com/dimar-hanung/just-me.git` (GitHub, not GitLab)
- Tag pattern: `vX.Y.Z` (e.g. user says "0.2" → `v0.2.0`)

## References

- [develop-module-just-me-todos](../develop-module-just-me-todos/SKILL.md) — app architecture; open only if release notes need feature context
- [scripts/fix-build-permissions.sh](scripts/fix-build-permissions.sh) — run before builds when Docker left root-owned files

## Learned user preferences

- Release attaches **three** installers: AppImage + `.deb` + Windows `*-setup.exe`
- Do **not** attach `.blockmap` files unless the user asks
- Release notes: short `## Just Me X.Y.Z` with `### New` / `### Changed` / `### Fix` and install steps for Windows + Linux

## Learned Workspace Facts

- Prior Docker/Wine cross-builds often leave **root-owned** files under `packages/web/dist`, `packages/desktop/web-dist`, `node_modules`, and `release/` → builds fail with `EACCES`. Fix with [scripts/fix-build-permissions.sh](scripts/fix-build-permissions.sh) before building.
- Linux build runs locally: `pnpm build:desktop:linux`
- Windows `.exe` cross-build from Linux uses Docker + Wine (see Step 5 below)
- `prepare:app` rebuilds web + MCP bundle, copies to `web-dist` and `resources/mcp`; installers always use fresh assets even if committed copies are stale
- After a release build, `web-dist` hashes may differ from what was committed — optional follow-up commit; not required for correct installers

---

## Workflow checklist

Copy and track progress:

```
- [ ] 1. Confirm version (e.g. 0.2 → v0.2.0) and what's staged
- [ ] 2. Bump all five package.json versions
- [ ] 3. Commit (staged + version bump)
- [ ] 4. Push main
- [ ] 5. Fix build permissions
- [ ] 6. Build Linux installers
- [ ] 7. Build Windows installer (Docker)
- [ ] 8. Tag vX.Y.Z and push tag
- [ ] 9. Create GitHub release with three artifacts
- [ ] 10. Report release URL
```

---

## Step 1 — Preflight

Run in parallel:

```bash
git status
git diff --cached
git diff
git log -3 --oneline
git tag -l 'v*' | tail -5
```

Confirm with the user only if version is ambiguous. Map shorthand:

| User says | Tag |
|-----------|-----|
| `0.2` | `v0.2.0` |
| `1.0` | `v1.0.0` |
| `0.2.1` | `v0.2.1` |

**Never** commit `.env`, credentials, or secrets.

---

## Step 2 — Bump version

Set the **same** version in all five files:

- `packages/api/package.json`
- `packages/core/package.json`
- `packages/desktop/package.json`
- `packages/mcp/package.json`
- `packages/web/package.json`

Stage version files with other release changes:

```bash
git add packages/api/package.json packages/core/package.json packages/desktop/package.json packages/mcp/package.json packages/web/package.json
```

---

## Step 3 — Commit

Only when the user explicitly asked to commit. Message focuses on **why**, includes version when it's a release commit:

```bash
git commit -m "$(cat <<'EOF'
<short summary of user-facing changes> (vX.Y.Z).

<1-2 sentences on the main themes — nav, API, desktop, etc.>
EOF
)"
```

If nothing was staged, stop — do not create an empty commit.

---

## Step 4 — Push

```bash
git push origin main
```

If push fails on auth, stop and tell the user to configure GitHub credentials — do not retry blindly.

---

## Step 5 — Fix build permissions

**Always run before building** if any prior build used Docker:

```bash
bash .agents/skills/release-just-me/scripts/fix-build-permissions.sh
```

If the script is unavailable:

```bash
docker run --rm -v "$PWD":/project alpine sh -c \
  "chown -R $(id -u):$(id -g) /project/packages/web/dist /project/packages/desktop/web-dist /project/node_modules /project/release 2>/dev/null; true"
```

---

## Step 6 — Build Linux

```bash
pnpm build:desktop:linux
```

Expect (~1–2 min):

- `release/JustMe-{version}-x86_64.AppImage`
- `release/JustMe-{version}-amd64.deb`

On `EACCES`, re-run Step 5 and retry once.

---

## Step 7 — Build Windows (Docker cross-build)

From repo root:

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

Expect (~1–2 min):

- `release/JustMe-{version}-x64-setup.exe`

Re-run Step 5 after Docker if `gh release create` cannot read the `.exe` (root-owned).

---

## Step 8 — Tag and push tag

Tag the **commit that was pushed** (usually `HEAD` on `main` after Step 4):

```bash
git tag vX.Y.Z
git push origin vX.Y.Z
```

If the tag already exists locally/remotely, stop and ask the user — do not force-move tags.

---

## Step 9 — GitHub release

Verify artifacts exist:

```bash
ls -lh release/JustMe-{version}-x86_64.AppImage \
       release/JustMe-{version}-amd64.deb \
       release/JustMe-{version}-x64-setup.exe
```

Create release (replace `{version}` and notes):

```bash
gh release create vX.Y.Z \
  "release/JustMe-{version}-x86_64.AppImage" \
  "release/JustMe-{version}-amd64.deb" \
  "release/JustMe-{version}-x64-setup.exe" \
  --title "vX.Y.Z" \
  --notes "$(cat <<'EOF'
## Just Me X.Y.Z

### New
- ...

### Changed
- ...

### Fix
- ...

### Install

**Windows:** run `JustMe-X.Y.Z-x64-setup.exe` (uninstall old build and quit any running Just Me processes first).

**Linux:** AppImage — `chmod +x JustMe-X.Y.Z-x86_64.AppImage && ./JustMe-X.Y.Z-x86_64.AppImage`
Debian/Ubuntu — `sudo apt install ./JustMe-X.Y.Z-amd64.deb`
EOF
)"
```

Return the release URL to the user.

---

## Step 10 — Optional post-release commit

If `packages/desktop/web-dist/` changed after the build and the user wants repo parity:

```bash
git add packages/desktop/web-dist/
git commit -m "Update desktop web-dist for vX.Y.Z."
git push origin main
```

Do **not** move or recreate the existing tag unless the user explicitly asks.

---

## Rules

- **MUST** bump all five `packages/*/package.json` versions together
- **MUST** run permission fix (Step 5) before builds when Docker was used previously
- **MUST** attach all three platform installers to the GitHub release
- **MUST** use `gh release create` (GitHub), not GitLab MR workflow
- **NEVER** commit secrets or `.env`
- **NEVER** force-push `main` or force-move release tags
- **NEVER** skip the Windows Docker build unless the user explicitly says Linux-only release
- **NEVER** dump the full staged diff into chat — summarize for commit message and release notes only

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `EACCES` on `packages/web/dist` or `web-dist` | Step 5 |
| `EACCES` on `node_modules/.../256x256.png` during electron-builder | Step 5 (includes `node_modules`) |
| `chmod ... operation not permitted` in app-builder | Step 5 |
| Windows build OK but `gh` cannot upload `.exe` | Step 5 on `release/JustMe-*-setup.exe` |
| Vite hash changed, uncommitted `web-dist` | Optional Step 10; installers are still valid |
