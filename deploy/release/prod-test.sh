#!/usr/bin/env bash
# Prepara ambiente de teste de produção a partir do monorepo (Linux)
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

echo "== EasySignage — preparação teste de produção =="

echo ""
echo "[1/5] Chaves staging..."
node deploy/keys/generate-staging-keys.mjs

echo ""
echo "[2/6] Build pacotes workspace..."
pnpm prod:test:packages

echo ""
echo "[3/6] Build imagens Docker..."
docker compose -f deploy/server-box/docker-compose.yml -f deploy/server-box/docker-compose.build.yml build

echo ""
echo "[4/5] Instalação server-box..."
cd deploy/server-box
chmod +x install.sh
./install.sh

echo ""
echo "[5/5] Arranque contentores..."
docker compose -f docker-compose.yml -f docker-compose.build.yml up -d

HWID="$(tr -d '[:space:]' < config/hardware.id)"
cd "$REPO_ROOT"

echo ""
echo "== Pronto =="
echo "CMS:     http://localhost:3000"
echo "API:     http://localhost:3001/api/v1"
echo "Login:   admin@demo.local / admin123"
echo "HWID:    $HWID"
echo ""
echo "Gerar licença Standard (teste):"
echo "  pnpm license:test-serial -- --hwid $HWID --tier STD"
