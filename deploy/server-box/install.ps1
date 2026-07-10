# Execute na pasta deploy/server-box (PowerShell)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent (Split-Path -Parent $Root)
Set-Location $Root

New-Item -ItemType Directory -Force -Path "config","data/postgres","data/uploads" | Out-Null

$stagingPub = Join-Path (Split-Path -Parent $Root) "keys/staging-public.pem"
$licensePub = Join-Path $Root "config/license-public.pem"

if (-not (Test-Path $licensePub)) {
  if (Test-Path $stagingPub) {
    Copy-Item $stagingPub $licensePub
    Write-Host "Chave publica de staging copiada para config/license-public.pem"
  } else {
    Copy-Item (Join-Path (Split-Path -Parent $Root) "keys/production-public.pem.example") (Join-Path $Root "config/license-public.pem.example")
    Write-Host "AVISO: staging-public.pem ausente. Copie uma chave publica para config/license-public.pem"
  }
}

if (-not (Test-Path ".env")) {
  Copy-Item ".env.example" ".env"
  Write-Host "Criado .env a partir de .env.example - edite JWT_SECRET, passwords e IP do mini PC."
}

$hwidScript = Join-Path (Split-Path -Parent $Root) "hwid/generate-hwid.mjs"
node $hwidScript --out (Join-Path $Root "config/hardware.id")

$hwid = (Get-Content (Join-Path $Root "config/hardware.id") -Raw).Trim()
$useBuild = Test-Path (Join-Path $RepoRoot "docker/api.Dockerfile")

Write-Host ""
Write-Host "Hardware ID: $hwid"
Write-Host ""
if ($useBuild) {
  Write-Host "Monorepo detectado - build local:"
  Write-Host "  docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build"
} else {
  Write-Host "Pacote cliente - use imagens GHCR no .env ou importe imagens Docker:"
  Write-Host "  docker compose up -d"
}
Write-Host "CMS: http://localhost:3000"
Write-Host "Login inicial: admin@demo.local / admin123"
