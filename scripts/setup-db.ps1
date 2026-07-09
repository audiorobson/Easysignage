# Migra + seed do Postgres (mesma DATABASE_URL que apps/api/.env).
# Se o Docker estiver ativo, sobe o container `easysignage-pg` se necessário.
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$api = Join-Path $root "apps\api"

function Test-Docker {
    $null = docker info 2>&1
    return $LASTEXITCODE -eq 0
}

if (Test-Docker) {
    $running = docker ps --filter "name=easysignage-pg" --format "{{.Names}}" 2>$null
    if ($running -eq "easysignage-pg") {
        Write-Host "Postgres (Docker): container easysignage-pg ja em execucao."
    } else {
        $stopped = docker ps -a --filter "name=easysignage-pg" --format "{{.Names}}" 2>$null
        if ($stopped -eq "easysignage-pg") {
            Write-Host "Postgres (Docker): iniciando easysignage-pg..."
            docker start easysignage-pg
        } else {
            Write-Host "Postgres (Docker): criando easysignage-pg (porta 5432)..."
            docker run -d --name easysignage-pg `
                -e POSTGRES_USER=easysignage `
                -e POSTGRES_PASSWORD=easysignage_dev `
                -e POSTGRES_DB=easysignage `
                -p 5432:5432 postgres:16-alpine
        }
        $n = 0
        while ($n -lt 40) {
            docker exec easysignage-pg pg_isready -U easysignage 2>$null | Out-Null
            if ($LASTEXITCODE -eq 0) { break }
            Start-Sleep -Milliseconds 500
            $n++
        }
        if ($n -ge 40) { throw "Postgres nao respondeu a tempo (pg_isready)." }
        Write-Host "Postgres pronto."
    }
} else {
    Write-Host "Docker nao disponivel - usando Postgres em localhost:5432 se existir."
}

Push-Location $api
try {
    pnpm exec prisma migrate deploy
    if ($LASTEXITCODE -ne 0) { throw "prisma migrate deploy falhou (exit $LASTEXITCODE)." }
    pnpm exec prisma db seed
    if ($LASTEXITCODE -ne 0) { throw "prisma db seed falhou (exit $LASTEXITCODE)." }
    Write-Host "Prisma: migrate deploy + seed OK."
} finally {
    Pop-Location
}
