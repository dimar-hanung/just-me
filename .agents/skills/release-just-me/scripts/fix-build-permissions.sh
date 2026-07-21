#!/usr/bin/env bash
# Fix root-owned files from prior Docker/Wine electron-builder runs.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../../../" && pwd)"
UID_GID="$(id -u):$(id -g)"

echo "Fixing build permissions under ${ROOT} (owner → ${UID_GID})…"

docker run --rm -v "${ROOT}":/project alpine sh -c "
  for dir in \
    /project/packages/web/dist \
    /project/packages/desktop/web-dist \
    /project/node_modules \
    /project/release
  do
    [ -e \"\$dir\" ] && chown -R ${UID_GID} \"\$dir\"
  done
"

echo "Done."
