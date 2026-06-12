#!/bin/sh
set -e
# DB push em background — não bloqueia o servidor (evita 502 se o Postgres demorar)
if [ -n "$DATABASE_URL" ]; then
  (
    echo "Running prisma db push (background)..."
    npx prisma db push --accept-data-loss && echo "prisma db push OK" || echo "WARN: prisma db push failed" >&2
  ) &
fi
exec node server.js
