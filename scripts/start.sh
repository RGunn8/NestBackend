#!/bin/sh
set -e

echo "[start] ========================================"
echo "[start] Container boot $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "[start] NODE_ENV=${NODE_ENV:-unset}"
echo "[start] PORT=${PORT:-3000}"
echo "[start] HOST=${HOST:-0.0.0.0}"
echo "[start] cwd=$(pwd)"

if [ -n "$DATABASE_URL" ]; then
  echo "[start] DATABASE_URL=set"
else
  echo "[start] DATABASE_URL=MISSING"
fi

if [ ! -f dist/main.js ]; then
  echo "[start] FATAL: dist/main.js not found"
  ls -la dist 2>&1 || echo "[start] dist/ missing"
  exit 1
fi

echo "[start] Running migrations..."
node scripts/migrate.mjs

echo "[start] Starting NestJS on 0.0.0.0:${PORT:-3000}..."
exec node dist/main.js
