# PowerShell — prepara ambiente de teste de produção a partir do monorepo
$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $RepoRoot

Write-Host "== EasySignage — preparacao teste de producao ==" -ForegroundColor Cyan

Write-Host "`n[1/6] Chaves staging..."
node deploy/keys/generate-staging-keys.mjs

Write-Host "`n[2/6] Build pacotes workspace..."
pnpm prod:test:packages

Write-Host "`n[3/6] Build imagens Docker (pode demorar)..."
docker compose -f deploy/server-box/docker-compose.yml -f deploy/server-box/docker-compose.build.yml build

Write-Host "`n[4/6] Instalacao server-box..."
Set-Location deploy/server-box
& .\install.ps1

Write-Host "`n[5/6] Arranque contentores..."
docker compose -f docker-compose.yml -f docker-compose.build.yml up -d

Write-Host "`n[6/6] Verificacao saude..."
Start-Sleep -Seconds 10
docker compose -f docker-compose.yml -f docker-compose.build.yml ps

$hwid = (Get-Content config/hardware.id -Raw).Trim()
Set-Location $RepoRoot

Write-Host "`n== Pronto ==" -ForegroundColor Green
Write-Host "CMS:     http://localhost:3000"
Write-Host "API:     http://localhost:3001/api/v1"
Write-Host "Login:   admin@demo.local / admin123"
Write-Host "HWID:    $hwid"
Write-Host ""
Write-Host "Gerar licenca Standard (teste):"
Write-Host "  pnpm license:test-serial -- --hwid $hwid --tier STD"
Write-Host ""
Write-Host "ZIP de distribuicao:"
Write-Host "  pnpm release:zip"
