#!/bin/sh
set -e

echo "[start] NestJS boot"
echo "[start] NODE_ENV=${NODE_ENV:-unset}"
echo "[start] PORT=${PORT:-3000}"
if [ -n "$DATABASE_URL" ]; then
  echo "[start] DATABASE_URL=set"
else
  echo "[start] DATABASE_URL=MISSING — link Postgres on Railway"
fi

exec node dist/main.js
