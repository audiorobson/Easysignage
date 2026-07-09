# Verifica o ambiente de desenvolvimento EasySignage (Windows / PowerShell).
# Uso: na raiz do repo  ->  pnpm run check:env
#      ou:  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/check-dev-env.ps1
#
# O que costuma falhar:
#   1) PostgreSQL parado ou DATABASE_URL errado -> a API Nest nao fica a escuta na 3001
#   2) API nao arrancada -> CMS ve "connection refused" para localhost:3001
#   3) CORS_ORIGINS na API sem a origem exacta do browser (apos a API estar no ar)
#   4) NEXT_PUBLIC_API_URL no CMS diferente da URL real da API

$ErrorActionPreference = "Continue"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$apiDir = Join-Path $root "apps\api"
$cmsDir = Join-Path $root "apps\cms"
$apiEnv = Join-Path $apiDir ".env"
$cmsLocal = Join-Path $cmsDir ".env.local"

function Write-Ok($msg) { Write-Host "[OK]   $msg" -ForegroundColor Green }
function Write-Bad($msg) { Write-Host "[FALTA] $msg" -ForegroundColor Red }
function Write-Warn($msg) { Write-Host "[AVISO] $msg" -ForegroundColor Yellow }
function Write-Info($msg) { Write-Host "       $msg" -ForegroundColor Gray }

function Get-DotEnvValue([string]$path, [string]$key) {
    if (-not (Test-Path $path)) { return $null }
    $line = Get-Content $path -ErrorAction SilentlyContinue | Where-Object { $_ -match "^\s*$key\s*=" } | Select-Object -First 1
    if (-not $line) { return $null }
    $val = $line -replace "^\s*$key\s*=\s*", ""
    $val = $val.Trim().Trim('"').Trim("'")
    return $val
}

function Parse-PostgresFromUrl([string]$url) {
    if ([string]::IsNullOrWhiteSpace($url)) { return $null }
    # postgresql://user:pass@host:5432/db
    if ($url -notmatch '^postgres(ql)?://[^@]+@([^:/]+)(?::(\d+))?/') {
        return @{ Host = "localhost"; Port = 5432 }
    }
    $h = $Matches[2]
    $p = if ($Matches[3]) { [int]$Matches[3] } else { 5432 }
    return @{ Host = $h; Port = $p }
}

Write-Host ""
Write-Host "EasySignage - verificacao de ambiente (dev)" -ForegroundColor Cyan
Write-Host "Raiz: $root"
Write-Host ""

# --- Ficheiros .env ---
if (-not (Test-Path $apiEnv)) {
    Write-Bad "apps/api/.env nao existe. Copie a partir do modelo do repositorio e defina DATABASE_URL."
    Write-Info "Crie apps/api/.env com pelo menos DATABASE_URL, PORT=3001, JWT_SECRET, CORS_ORIGINS."
} else {
    Write-Ok "apps/api/.env encontrado."
}

$databaseUrl = Get-DotEnvValue $apiEnv "DATABASE_URL"
$pg = Parse-PostgresFromUrl $databaseUrl

if ($pg) {
    $hostName = $pg.Host
    $port = $pg.Port
    Write-Host ""
    Write-Host "PostgreSQL (DATABASE_URL): host=$hostName porta=$port"
    try {
        $tcp = Test-NetConnection -ComputerName $hostName -Port $port -WarningAction SilentlyContinue -ErrorAction SilentlyContinue
        if ($tcp.TcpTestSucceeded) {
            Write-Ok "Porta $port acessivel em $hostName."
        } else {
            Write-Bad "Nao foi possivel ligar a $hostName`:$port."
            Write-Info "Arranque o PostgreSQL (servico local, ou: pnpm db:setup se usar Docker com o script de setup)."
            Write-Info "Sem BD, o Nest termina ao iniciar e a porta 3001 fica vazia."
        }
    } catch {
        Write-Bad "Teste de ligacao TCP falhou: $_"
    }
} else {
    Write-Warn "DATABASE_URL nao lido (verifique apps/api/.env)."
}

# --- API health ---
Write-Host ""
Write-Host "API Nest (http://localhost:3001/api/v1)"
try {
    $healthUrl = "http://127.0.0.1:3001/api/v1/health"
    $r = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
    if ($r.StatusCode -eq 200) {
        Write-Ok "API responde em $healthUrl"
    } else {
        Write-Warn "Resposta HTTP $($r.StatusCode) em /health."
    }
} catch {
    Write-Bad "API nao acessivel (connection refused ou timeout)."
    Write-Info "Num terminal: pnpm dev:api  (ou: pnpm turbo run dev --filter=@easysignage/api)"
    Write-Info "Confirme que o Postgres esta OK antes; senao o processo da API cai ao arrancar."
}

# --- CMS NEXT_PUBLIC_API_URL ---
Write-Host ""
Write-Host "CMS (Next.js)"
if (Test-Path $cmsLocal) {
    Write-Ok "apps/cms/.env.local encontrado."
    $cmsUrl = Get-DotEnvValue $cmsLocal "NEXT_PUBLIC_API_URL"
    if ($cmsUrl) {
        Write-Info "NEXT_PUBLIC_API_URL=$cmsUrl"
        if ($cmsUrl -notmatch 'api/v1\s*$') {
            Write-Warn "O URL normalmente termina em /api/v1"
        }
    } else {
        Write-Warn "NEXT_PUBLIC_API_URL nao definido em .env.local - o CMS usa o default http://localhost:3001/api/v1"
    }
} else {
    Write-Warn "apps/cms/.env.local nao existe (opcional). Default da app: http://localhost:3001/api/v1"
}

$cors = Get-DotEnvValue $apiEnv "CORS_ORIGINS"
if ($cors) {
    Write-Info "CORS_ORIGINS na API: $cors"
    if ($cors -notmatch 'localhost:3000' -and $cors -notmatch '127\.0\.0\.1:3000') {
        Write-Warn "Inclua http://localhost:3000 e http://127.0.0.1:3000 se usar o CMS nesses hosts."
    }
} else {
    Write-Warn "CORS_ORIGINS vazio no .env - defina origens do browser (ex.: http://localhost:3000)."
}

# --- Ferramentas ---
Write-Host ""
Write-Host "Ferramentas"
try {
    $pv = pnpm -v 2>$null
    if ($LASTEXITCODE -eq 0) { Write-Ok "pnpm $pv" } else { throw }
} catch {
    Write-Bad "pnpm nao encontrado no PATH."
}

Write-Host ""
Write-Host "Resumo: corrija primeiro PostgreSQL + DATABASE_URL, depois arranque a API (pnpm dev:api), depois o CMS (pnpm dev:cms)." -ForegroundColor Cyan
Write-Host ""
