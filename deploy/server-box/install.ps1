#Execute na pasta deploy/server-box (PowerShell como Administrador recomendado)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

New-Item -ItemType Directory -Force -Path "config","data/postgres","data/uploads" | Out-Null

if (-not (Test-Path ".env")) {
  Copy-Item ".env.example" ".env"
  Write-Host "Criado .env a partir de .env.example — edite JWT_SECRET e passwords."
}

$hwidScript = Join-Path (Split-Path -Parent $Root) "hwid/generate-hwid.mjs"
node $hwidScript --out (Join-Path $Root "config/hardware.id")

Write-Host ""
Write-Host "Hardware ID gerado. Arranque: docker compose up -d --build"
Write-Host "CMS: http://localhost:3000"
