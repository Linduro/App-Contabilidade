#!/bin/sh
set -e
if [ -n "$DATABASE_URL" ]; then
  echo "Running prisma db push (max 90s)..."
  if command -v timeout >/dev/null 2>&1; then
    timeout 90 npx prisma db push --skip-generate || {
      echo "WARN: prisma db push failed or timed out — starting app anyway" >&2
    }
  else
    npx prisma db push --skip-generate || {
      echo "WARN: prisma db push failed — starting app anyway" >&2
    }
  fi
fi
exec node server.js
