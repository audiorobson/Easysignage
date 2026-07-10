#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

mkdir -p config data/postgres data/uploads

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Criado .env — edite JWT_SECRET e passwords."
fi

node "$(dirname "$ROOT")/hwid/generate-hwid.mjs" --out "$ROOT/config/hardware.id"

echo ""
echo "Hardware ID gerado. Arranque: docker compose up -d --build"
echo "CMS: http://localhost:3000"
