#!/bin/sh
set -e
# DB push em background — não bloqueia o servidor (evita 502 se o Postgres demorar)
if [ -n "$DATABASE_URL" ]; then
  (
    PUSH_URL="${DIRECT_DATABASE_URL:-$DATABASE_URL}"
    echo "Running prisma db push (background) via pooler/direct..."
    PRISMA_PUSH=1 DATABASE_URL="$PUSH_URL" npx prisma db push --accept-data-loss && echo "prisma db push OK" || echo "WARN: prisma db push failed" >&2
  ) &
fi
exec node server.js
