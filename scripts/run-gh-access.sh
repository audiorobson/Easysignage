#!/bin/sh
# Wrapper multiplataforma para setup-github-access.ps1 (pwsh no Linux/macOS, pwsh ou powershell no Windows).
set -e
ROOT="$(CDPATH= cd "$(dirname "$0")/.." && pwd)"
SCRIPT="$ROOT/scripts/setup-github-access.ps1"

if command -v pwsh >/dev/null 2>&1; then
  exec pwsh -NoProfile -ExecutionPolicy Bypass -File "$SCRIPT" "$@"
fi
if command -v powershell >/dev/null 2>&1; then
  exec powershell -NoProfile -ExecutionPolicy Bypass -File "$SCRIPT" "$@"
fi

echo "PowerShell nao encontrado. Instale PowerShell 7 (pwsh) ou use Windows PowerShell." >&2
exit 1
