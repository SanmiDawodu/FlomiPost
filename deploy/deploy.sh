#!/usr/bin/env bash
# =============================================================================
# FlomiPost frontend deploy — reproducible replacement for the manual
# "find the dist folder, then cp -r dist/* public/" step in the handoff notes.
#
# Run on the VPS from the repo/app root. Assumes:
#   FRONTEND_DIR  Vite/React project (package.json + vite build)
#   WEB_ROOT      nginx document root that serves the SPA
#
# First make the build output deterministic by pinning it in vite.config.js:
#     export default defineConfig({ build: { outDir: 'dist' } })
#
# Usage:  ./deploy/deploy.sh
# =============================================================================
set -euo pipefail

FRONTEND_DIR="${FRONTEND_DIR:-/var/www/flowpost/frontend}"
WEB_ROOT="${WEB_ROOT:-/var/www/flowpost/public}"
DIST_DIR="${FRONTEND_DIR}/dist"

echo "==> Building frontend in ${FRONTEND_DIR}"
cd "${FRONTEND_DIR}"
npm ci
npm run build

if [[ ! -f "${DIST_DIR}/index.html" ]]; then
  echo "ERROR: ${DIST_DIR}/index.html not found after build." >&2
  echo "       Pin build.outDir to 'dist' in vite.config.js (see header)." >&2
  exit 1
fi

# Keep a real robots.txt in the build output so it survives deploys.
if [[ -f "$(git -C "${FRONTEND_DIR}" rev-parse --show-toplevel 2>/dev/null)/public/robots.txt" ]]; then
  cp "$(git -C "${FRONTEND_DIR}" rev-parse --show-toplevel)/public/robots.txt" "${DIST_DIR}/robots.txt" || true
fi

echo "==> Deploying to ${WEB_ROOT} (atomic rsync, removes stale hashed assets)"
# --delete clears old content-hashed assets so the dir doesn't grow unbounded.
rsync -a --delete "${DIST_DIR}/" "${WEB_ROOT}/"

echo "==> Reloading nginx"
nginx -t && systemctl reload nginx

echo "==> Done. Verify:  curl -sI https://scheduler.flomicso.dev | grep -i 'content-security\|strict-transport\|cache-control'"
