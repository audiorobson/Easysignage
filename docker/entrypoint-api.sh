#!/bin/sh
set -e
cd /app
# Prisma CLI instalada globalmente na imagem (migrate em arranque)
prisma migrate deploy
exec node dist/main.js
