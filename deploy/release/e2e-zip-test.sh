#!/usr/bin/env bash
# Teste E2E do pacote ZIP server-box (ambiente limpo simulado)
# Uso: ./deploy/release/e2e-zip-test.sh [--zip path] [--use-ghcr] [--version 1.0.0-rc2] [--host-gateway]
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ZIP_PATH=""
USE_GHCR=0
HOST_GATEWAY=0
VERSION="1.0.0-rc2"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --zip) ZIP_PATH="$2"; shift 2 ;;
    --use-ghcr) USE_GHCR=1; shift ;;
    --host-gateway) HOST_GATEWAY=1; shift ;;
    --version) VERSION="$2"; shift 2 ;;
    *) echo "Argumento desconhecido: $1" >&2; exit 1 ;;
  esac
done

if [[ -z "$ZIP_PATH" ]]; then
  ZIP_PATH="$REPO_ROOT/dist/release/easysignage-server-box-${VERSION}.zip"
  if [[ ! -f "$ZIP_PATH" ]]; then
    ZIP_PATH="$REPO_ROOT/dist/release-download/easysignage-server-box-v${VERSION}/easysignage-server-box-${VERSION}.zip"
  fi
fi
if [[ ! -f "$ZIP_PATH" ]]; then
  echo "ZIP nao encontrado: $ZIP_PATH" >&2
  exit 1
fi

CLEAN_DIR="$REPO_ROOT/dist/e2e-clean-test"
BOX_DIR="$CLEAN_DIR/easysignage-server-box"

echo "==> ZIP: $ZIP_PATH"
rm -rf "$CLEAN_DIR"
mkdir -p "$CLEAN_DIR"
unzip -q "$ZIP_PATH" -d "$CLEAN_DIR"

# Garantir scripts actualizados do monorepo
cp "$REPO_ROOT/deploy/server-box/install.sh" "$BOX_DIR/install.sh"
chmod +x "$BOX_DIR/install.sh"
if [[ "$HOST_GATEWAY" -eq 1 ]]; then
  cp "$REPO_ROOT/deploy/server-box/docker-compose.e2e.yml" "$BOX_DIR/docker-compose.e2e.yml"
fi

cd "$BOX_DIR"

echo "==> install.sh"
./install.sh

HWID="$(tr -d '[:space:]' < config/hardware.id)"
echo "HWID: $HWID"

# Ajustar .env para teste local
sed -i 's/^JWT_SECRET=.*/JWT_SECRET=e2e-test-jwt-secret-min-32-chars-ok/' .env
sed -i 's/^RT_INTERNAL_SECRET=.*/RT_INTERNAL_SECRET=e2e-rt-secret-min-32-chars-ok/' .env
sed -i 's/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=e2e_pg_pass/' .env
sed -i 's|http://192\.168\.1\.100|http://localhost|g' .env
sed -i 's|ws://192\.168\.1\.100|ws://localhost|g' .env

if [[ "$USE_GHCR" -eq 1 ]]; then
  grep -vE '^\s*#?\s*EASYSIGNAGE_(VERSION|API_IMAGE|CMS_IMAGE|RT_IMAGE|MEDIA_WORKER_IMAGE)=' .env > .env.tmp || true
  mv .env.tmp .env
  cat >> .env <<EOF
EASYSIGNAGE_VERSION=$VERSION
EASYSIGNAGE_API_IMAGE=ghcr.io/audiorobson/easysignage-api:$VERSION
EASYSIGNAGE_CMS_IMAGE=ghcr.io/audiorobson/easysignage-cms:$VERSION
EASYSIGNAGE_RT_IMAGE=ghcr.io/audiorobson/easysignage-realtime-gateway:$VERSION
EASYSIGNAGE_MEDIA_WORKER_IMAGE=ghcr.io/audiorobson/easysignage-media-worker:$VERSION
EOF
fi

echo "==> docker compose up -d"
compose_args=(-f docker-compose.yml)
if [[ "$HOST_GATEWAY" -eq 1 ]]; then
  compose_args+=(-f docker-compose.e2e.yml)
  echo "    (modo host-gateway para rede bridge limitada)"
fi
docker compose "${compose_args[@]}" up -d

echo "==> Aguardar API..."
ok=0
for i in $(seq 1 60); do
  sleep 5
  if curl -sf "http://localhost:3001/api/v1/health" | grep -q '"status":"ok"'; then
    ok=1
    break
  fi
done
if [[ "$ok" -ne 1 ]]; then
  echo "API health timeout" >&2
  docker compose "${compose_args[@]}" ps
  docker compose "${compose_args[@]}" logs api --tail 30
  exit 1
fi
echo "API health: OK"

echo "==> Aguardar realtime-gateway..."
rt_ok=0
for i in $(seq 1 30); do
  sleep 3
  if curl -sf "http://localhost:3020/health" | grep -q '"ok":true'; then
    rt_ok=1
    break
  fi
done
if [[ "$rt_ok" -ne 1 ]]; then
  echo "Realtime-gateway health timeout" >&2
  docker compose "${compose_args[@]}" ps
  docker compose "${compose_args[@]}" logs realtime-gateway --tail 30
  exit 1
fi
echo "Realtime-gateway health: OK"

echo "==> Preparar chaves staging"
cd "$REPO_ROOT"
if [[ ! -f deploy/keys/staging-private.pem ]]; then
  pnpm license:gen-staging-keys >/dev/null
fi
cp deploy/keys/staging-public.pem "$BOX_DIR/config/license-public.pem"
cd "$BOX_DIR"
docker compose "${compose_args[@]}" restart api >/dev/null
sleep 8
until curl -sf "http://localhost:3001/api/v1/health" | grep -q '"status":"ok"'; do sleep 2; done

echo "==> Gerar serial staging"
cd "$REPO_ROOT"
pnpm --filter @easysignage/license-core build >/dev/null
gen_out="$(node deploy/release/generate-test-license.mjs --hwid "$HWID" --tier STD 2>&1)"
serial_line="$(echo "$gen_out" | grep '^SERIAL_RAW=' | sed 's/^SERIAL_RAW=//')"
if [[ -z "$serial_line" ]]; then
  echo "SERIAL_RAW nao encontrado" >&2
  echo "$gen_out" >&2
  exit 1
fi

echo "==> Activar licenca via API"
login="$(curl -sf -X POST "http://localhost:3001/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"tenantSlug":"demo","email":"admin@demo.local","password":"admin123"}')"
token="$(echo "$login" | node -e "process.stdout.write(JSON.parse(require('fs').readFileSync(0,'utf8')).accessToken)")"

license_before="$(curl -sf "http://localhost:3001/api/v1/license/status" -H "Authorization: Bearer $token")"
echo "Licenca antes: $(echo "$license_before" | node -pe "const j=JSON.parse(require('fs').readFileSync(0,'utf8')); \`tier=\${j.tier} valid=\${j.valid}\`")"

curl -sf -X POST "http://localhost:3001/api/v1/license/apply" \
  -H "Authorization: Bearer $token" \
  -H "Content-Type: application/json" \
  -d "{\"licenseKey\":\"$serial_line\"}" >/dev/null

license_after="$(curl -sf "http://localhost:3001/api/v1/license/status" -H "Authorization: Bearer $token")"
tier="$(echo "$license_after" | node -pe "JSON.parse(require('fs').readFileSync(0,'utf8')).tier")"
valid="$(echo "$license_after" | node -pe "JSON.parse(require('fs').readFileSync(0,'utf8')).valid")"
max_players="$(echo "$license_after" | node -pe "JSON.parse(require('fs').readFileSync(0,'utf8')).maxPlayers")"
echo "Licenca depois: tier=$tier valid=$valid maxPlayers=$max_players"

if [[ "$valid" != "true" || "$tier" != "STD" ]]; then
  echo "Licenca staging nao activada correctamente" >&2
  exit 1
fi

echo ""
echo "E2E ZIP teste: SUCESSO"
echo "  CMS: http://localhost:3000"
echo "  HWID: $HWID"
echo "  Plano: $tier ($max_players players)"
