#!/bin/sh
set -e
if [ -n "$DATABASE_URL" ]; then
  echo "Running prisma db push..."
  npx prisma db push --skip-generate || {
    echo "WARN: prisma db push failed — starting app anyway" >&2
  }
fi
exec node server.js
