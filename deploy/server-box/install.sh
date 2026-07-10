#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$ROOT/../.." && pwd)"
cd "$ROOT"

mkdir -p config data/postgres data/uploads

STAGING_PUB="$(dirname "$ROOT")/keys/staging-public.pem"
LICENSE_PUB="$ROOT/config/license-public.pem"

if [[ ! -f "$LICENSE_PUB" ]]; then
  if [[ -f "$STAGING_PUB" ]]; then
    cp "$STAGING_PUB" "$LICENSE_PUB"
    echo "Chave publica de staging copiada para config/license-public.pem"
  else
    cp "$(dirname "$ROOT")/keys/production-public.pem.example" "$ROOT/config/license-public.pem.example"
    echo "AVISO: staging-public.pem ausente. Copie uma chave publica para config/license-public.pem"
  fi
fi

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Criado .env — edite JWT_SECRET, passwords e IP do mini PC."
fi

node "$(dirname "$ROOT")/hwid/generate-hwid.mjs" --out "$ROOT/config/hardware.id"
HWID="$(tr -d '[:space:]' < "$ROOT/config/hardware.id")"

echo ""
echo "Hardware ID: $HWID"
echo ""
if [[ -f "$REPO_ROOT/docker/api.Dockerfile" ]]; then
  echo "Monorepo detectado — build local:"
  echo "  docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build"
else
  echo "Pacote cliente — use imagens GHCR no .env:"
  echo "  docker compose up -d"
fi
echo "CMS: http://localhost:3000"
echo "Login inicial: admin@demo.local / admin123"
