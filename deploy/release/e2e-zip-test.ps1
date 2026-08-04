# Teste E2E do pacote ZIP server-box (ambiente limpo simulado)
# Uso: powershell -File deploy/release/e2e-zip-test.ps1 [-ZipPath path] [-UseGhcr]
param(
  [string]$ZipPath = "",
  [switch]$UseGhcr,
  [string]$Version = "1.0.0-rc2"
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)

if (-not $ZipPath) {
  $ZipPath = Join-Path $RepoRoot "dist/release-download/easysignage-server-box-v$Version/easysignage-server-box-$Version.zip"
  if (-not (Test-Path $ZipPath)) {
    $ZipPath = Join-Path $RepoRoot "dist/release/easysignage-server-box-$Version.zip"
  }
}
if (-not (Test-Path $ZipPath)) {
  throw "ZIP nao encontrado: $ZipPath"
}

$CleanDir = Join-Path $RepoRoot "dist/e2e-clean-test"
$BoxDir = Join-Path $CleanDir "easysignage-server-box"

Write-Host "==> ZIP: $ZipPath"
if (Test-Path $CleanDir) { Remove-Item -Recurse -Force $CleanDir }
New-Item -ItemType Directory -Force -Path $CleanDir | Out-Null
Expand-Archive -Path $ZipPath -DestinationPath $CleanDir -Force

# Copiar install.ps1 corrigido se o ZIP for antigo (pre-fix hwid)
Copy-Item (Join-Path $RepoRoot "deploy/server-box/install.ps1") (Join-Path $BoxDir "install.ps1") -Force

Push-Location $BoxDir
try {
  Write-Host "==> install.ps1"
  & powershell -NoProfile -ExecutionPolicy Bypass -File install.ps1

  $hwid = (Get-Content "config/hardware.id" -Raw).Trim()
  Write-Host "HWID: $hwid"

  $envContent = Get-Content ".env" -Raw
  $envContent = $envContent -replace 'JWT_SECRET=.*', 'JWT_SECRET=e2e-test-jwt-secret-min-32-chars-ok'
  $envContent = $envContent -replace 'RT_INTERNAL_SECRET=.*', 'RT_INTERNAL_SECRET=e2e-rt-secret-min-32-chars-ok'
  $envContent = $envContent -replace 'POSTGRES_PASSWORD=.*', 'POSTGRES_PASSWORD=e2e_pg_pass'
  $envContent = $envContent -replace 'http://192\.168\.1\.100', 'http://localhost'
  $envContent = $envContent -replace 'ws://192\.168\.1\.100', 'ws://localhost'
  if ($UseGhcr) {
    $envLines = $envContent -split "`r?`n" | Where-Object {
      $_ -notmatch '^\s*#?\s*EASYSIGNAGE_(VERSION|API_IMAGE|CMS_IMAGE|RT_IMAGE|MEDIA_WORKER_IMAGE)='
    }
    $envContent = ($envLines -join "`n").TrimEnd() + "`n"
    $envContent += "EASYSIGNAGE_VERSION=$Version`n"
    $envContent += "EASYSIGNAGE_API_IMAGE=ghcr.io/audiorobson/easysignage-api:$Version`n"
    $envContent += "EASYSIGNAGE_CMS_IMAGE=ghcr.io/audiorobson/easysignage-cms:$Version`n"
    $envContent += "EASYSIGNAGE_RT_IMAGE=ghcr.io/audiorobson/easysignage-realtime-gateway:$Version`n"
    $envContent += "EASYSIGNAGE_MEDIA_WORKER_IMAGE=ghcr.io/audiorobson/easysignage-media-worker:$Version`n"
  }
  Set-Content -Path ".env" -Value $envContent.TrimEnd() -NoNewline

  Write-Host "==> docker compose up -d"
  $prevEap = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  docker compose up -d
  if ($LASTEXITCODE -ne 0) { throw "docker compose up falhou (exit $LASTEXITCODE)" }
  $ErrorActionPreference = $prevEap

  Write-Host "==> Aguardar API..."
  $ok = $false
  for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Seconds 5
    try {
      $r = Invoke-RestMethod -Uri "http://localhost:3001/api/v1/health" -TimeoutSec 5
      if ($r.status -eq 'ok') { $ok = $true; break }
    } catch {}
  }
  if (-not $ok) { throw "API health timeout" }
  Write-Host "API health: OK"

  Write-Host "==> Aguardar realtime-gateway..."
  $rtOk = $false
  for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 3
    try {
      $rt = Invoke-RestMethod -Uri "http://localhost:3020/health" -TimeoutSec 5
      if ($rt.ok -eq $true) { $rtOk = $true; break }
    } catch {}
  }
  if (-not $rtOk) { throw "Realtime-gateway health timeout" }
  Write-Host "Realtime-gateway health: OK"

  Write-Host "==> Preparar chaves staging"
  Push-Location $RepoRoot
  if (-not (Test-Path "deploy/keys/staging-private.pem")) {
    pnpm license:gen-staging-keys | Out-Null
  }
  Copy-Item "deploy/keys/staging-public.pem" (Join-Path $BoxDir "config/license-public.pem") -Force
  Pop-Location
  docker compose restart api | Out-Null
  Start-Sleep -Seconds 8
  do {
    Start-Sleep -Seconds 2
    try {
      $r = Invoke-RestMethod -Uri "http://localhost:3001/api/v1/health" -TimeoutSec 5
    } catch { $r = $null }
  } while ($r.status -ne 'ok')

  Write-Host "==> Gerar serial staging"
  Push-Location $RepoRoot
  pnpm --filter @easysignage/license-core build | Out-Null
  $genOut = node deploy/release/generate-test-license.mjs --hwid $hwid --tier STD 2>&1
  Pop-Location
  $serialLine = ($genOut | Where-Object { $_ -match '^SERIAL_RAW=' }) -replace '^SERIAL_RAW=', ''
  if (-not $serialLine) { throw "SERIAL_RAW nao encontrado na saida do gerador" }

  Write-Host "==> Activar licenca via API"
  $login = Invoke-RestMethod -Method POST -Uri "http://localhost:3001/api/v1/auth/login" `
    -ContentType "application/json" `
    -Body '{"tenantSlug":"demo","email":"admin@demo.local","password":"admin123"}'
  $token = $login.accessToken

  $licenseStatus = Invoke-RestMethod -Uri "http://localhost:3001/api/v1/license/status" `
    -Headers @{ Authorization = "Bearer $token" }
  Write-Host "Licenca antes: tier=$($licenseStatus.tier) valid=$($licenseStatus.valid)"

  Invoke-RestMethod -Method POST -Uri "http://localhost:3001/api/v1/license/apply" `
    -Headers @{ Authorization = "Bearer $token" } `
    -ContentType "application/json" `
    -Body (@{ licenseKey = $serialLine } | ConvertTo-Json) | Out-Null

  $licenseAfter = Invoke-RestMethod -Uri "http://localhost:3001/api/v1/license/status" `
    -Headers @{ Authorization = "Bearer $token" }
  Write-Host "Licenca depois: tier=$($licenseAfter.tier) valid=$($licenseAfter.valid) maxPlayers=$($licenseAfter.maxPlayers)"

  if (-not $licenseAfter.valid -or $licenseAfter.tier -ne 'STD') {
    throw "Licenca staging nao activada correctamente"
  }

  Write-Host ""
  Write-Host "E2E ZIP teste: SUCESSO"
  Write-Host "  CMS: http://localhost:3000"
  Write-Host "  HWID: $hwid"
  Write-Host "  Plano: $($licenseAfter.tier) ($($licenseAfter.maxPlayers) players)"
} finally {
  Pop-Location
}
