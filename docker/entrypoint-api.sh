#!/bin/sh
set -e
cd /app

attempt=0
max=30
until prisma migrate deploy; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge "$max" ]; then
    echo "[entrypoint] migrate falhou apos ${max} tentativas"
    exit 1
  fi
  echo "[entrypoint] aguardar postgres (${attempt}/${max})..."
  sleep 2
done

if [ -f prisma/seed.ts ]; then
  tsx prisma/seed.ts || echo "[entrypoint] seed ignorado ou ja aplicado"
fi

exec node dist/main.js
