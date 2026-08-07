#Requires -Version 5.1
# Configura e valida acesso amplo a conta GitHub (incluindo repositorios privados),
# para uso local e para os Cloud Agents do Cursor.
#
# Porque e preciso: o token que os Cloud Agents recebem por omissao e um token de
# instalacao de GitHub App (prefixo ghs_) limitado aos repositorios onde a App esta
# instalada. Ele nao consegue listar os repositorios privados da conta. Este script
# trata de obter uma credencial com alcance total e de a colocar onde e precisa.
#
# Uso tipico (na raiz do repo):
#   pnpm run gh:access
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/setup-github-access.ps1
#
# Variantes:
#   ... -Persist File          guarda o token cifrado (DPAPI, so o utilizador atual o le)
#   ... -Persist UserEnv       grava GH_PAT nas variaveis de ambiente do utilizador
#   ... -CopyToClipboard       copia o token para a area de transferencia no fim
#   ... -Days 90               janela do levantamento de atividade
#   ... -ReportPath gh.md      escreve o relatorio em Markdown
#   ... -NoAudit               so configura e valida, sem levantamento
#   ... -NoElevate             nao pede UAC (util em CI ou quando ja e admin)
#
# No Windows, o script pede elevacao (UAC) automaticamente se nao estiver a correr
# como administrador. Isto garante permissoes para gravar GH_PAT no registo (-Persist UserEnv)
# e para ajustar ACL do ficheiro cifrado (-Persist File).
#
# O token nunca e escrito no ecra, nos logs, nem no relatorio.

[CmdletBinding()]
param(
    [string]$Token,
    [int]$Days = 60,
    [ValidateSet('None', 'File', 'UserEnv')]
    [string]$Persist = 'None',
    [switch]$CopyToClipboard,
    [switch]$NoAudit,
    [switch]$NoBrowser,
    [switch]$NoElevate,
    [switch]$Elevated,
    [string]$ReportPath
)

$ErrorActionPreference = 'Stop'

# PowerShell 5.1 ainda negoceia TLS 1.0 por omissao; a API do GitHub exige 1.2+.
if ($PSVersionTable.PSVersion.Major -lt 6) {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
}

$IsWindowsPlatform = if ($null -ne $PSVersionTable.Platform) { $PSVersionTable.Platform -eq 'Win32NT' } else { $true }

function Test-IsAdministrator {
    if (-not $IsWindowsPlatform) { return $true }
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Invoke-SelfElevation {
    $scriptPath = $PSCommandPath
    if ([string]::IsNullOrWhiteSpace($scriptPath) -or -not (Test-Path -LiteralPath $scriptPath)) {
        Write-Warning 'Nao foi possivel resolver o caminho deste script; a continuar sem elevacao.'
        return
    }

    $shell = if (Get-Command pwsh -ErrorAction SilentlyContinue) {
        (Get-Command pwsh).Source
    } else {
        (Get-Command powershell -ErrorAction SilentlyContinue).Source
    }
    if (-not $shell) {
        Write-Warning 'PowerShell nao encontrado para relancamento elevado; a continuar sem elevacao.'
        return
    }

    $argList = New-Object System.Collections.Generic.List[string]
    [void]$argList.Add('-NoProfile')
    [void]$argList.Add('-ExecutionPolicy')
    [void]$argList.Add('Bypass')
    [void]$argList.Add('-File')
    [void]$argList.Add($scriptPath)
    [void]$argList.Add('-Elevated')

    foreach ($entry in $PSBoundParameters.GetEnumerator()) {
        $key = $entry.Key
        if ($key -in @('Elevated', 'NoElevate')) { continue }
        $val = $entry.Value
        if ($val -is [switch]) {
            if ($val.IsPresent) { [void]$argList.Add("-$key") }
            continue
        }
        [void]$argList.Add("-$key")
        [void]$argList.Add([string]$val)
    }

    Write-Host ''
    Write-Host 'Este script precisa de permissoes de administrador no Windows.' -ForegroundColor Yellow
    Write-Host 'A abrir o pedido UAC - confirme para continuar.' -ForegroundColor Yellow
    Write-Host ''

    try {
        $proc = Start-Process -FilePath $shell -ArgumentList $argList.ToArray() -Verb RunAs -Wait -PassThru
        $code = if ($proc -and $null -ne $proc.ExitCode) { [int]$proc.ExitCode } else { 0 }
        exit $code
    } catch {
        Write-Host ''
        Write-Host '[FALHA] Elevacao recusada ou indisponivel.' -ForegroundColor Red
        Write-Host '        Volte a executar o script manualmente como Administrador,' -ForegroundColor Gray
        Write-Host '        ou use -NoElevate se nao precisar de gravar no registo (-Persist UserEnv).' -ForegroundColor Gray
        Write-Host ''
        exit 1
    }
}

if ($IsWindowsPlatform -and -not $NoElevate -and -not $Elevated -and -not (Test-IsAdministrator)) {
    Invoke-SelfElevation
    exit 0
}
$TokenStore = Join-Path $HOME '.easysignage/github-token.xml'
$NewTokenUrl = 'https://github.com/settings/tokens/new?scopes=repo,read:org&description=Cursor+Cloud+Agent+-+EasySignage'
$InstallationsUrl = 'https://github.com/settings/installations'
$CursorDashboardUrl = 'https://cursor.com/dashboard'

function Write-Ok($msg) { Write-Host "[OK]    $msg" -ForegroundColor Green }
function Write-Bad($msg) { Write-Host "[FALHA] $msg" -ForegroundColor Red }
function Write-Warn($msg) { Write-Host "[AVISO] $msg" -ForegroundColor Yellow }
function Write-Info($msg) { Write-Host "        $msg" -ForegroundColor Gray }
function Write-Step($msg) { Write-Host ""; Write-Host $msg -ForegroundColor Cyan }

function ConvertFrom-SecureStringPlain([System.Security.SecureString]$Secure) {
    if (-not $Secure) { return $null }
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Secure)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
}

function Get-MaskedToken([string]$Value) {
    if ([string]::IsNullOrWhiteSpace($Value)) { return '(vazio)' }
    $prefix = if ($Value.Length -ge 4) { $Value.Substring(0, 4) } else { '' }
    return ('{0}{1} ({2} caracteres)' -f $prefix, ('*' * 8), $Value.Length)
}

function ConvertTo-Utc([string]$Iso) {
    if ([string]::IsNullOrWhiteSpace($Iso)) { return $null }
    return [datetime]::Parse(
        $Iso,
        [Globalization.CultureInfo]::InvariantCulture,
        [Globalization.DateTimeStyles]::AdjustToUniversal -bor [Globalization.DateTimeStyles]::AssumeUniversal)
}

function Invoke-GitHubApi {
    param(
        [Parameter(Mandatory)][string]$Path,
        [string]$TokenValue = $script:ActiveToken
    )
    $uri = if ($Path -match '^https?://') { $Path } else { "https://api.github.com$Path" }
    $headers = @{
        Authorization          = "Bearer $TokenValue"
        Accept                 = 'application/vnd.github+json'
        'X-GitHub-Api-Version' = '2022-11-28'
        'User-Agent'           = 'easysignage-setup-github-access'
    }
    try {
        $resp = Invoke-WebRequest -Uri $uri -Headers $headers -UseBasicParsing -TimeoutSec 30 -ErrorAction Stop
        $data = if ($resp.Content) { $resp.Content | ConvertFrom-Json } else { $null }
        return [pscustomobject]@{ Ok = $true; Status = [int]$resp.StatusCode; Data = $data; Headers = $resp.Headers }
    } catch {
        $status = 0
        $response = $_.Exception.Response
        if ($response -and $response.StatusCode) { $status = [int]$response.StatusCode }
        return [pscustomobject]@{ Ok = $false; Status = $status; Data = $null; Headers = $null; Message = $_.Exception.Message }
    }
}

function Get-GitHubPaged {
    param([Parameter(Mandatory)][string]$Path, [int]$PerPage = 100, [int]$MaxPages = 30)
    $all = @()
    $sep = if ($Path.Contains('?')) { '&' } else { '?' }
    for ($page = 1; $page -le $MaxPages; $page++) {
        $url = '{0}{1}per_page={2}&page={3}' -f $Path, $sep, $PerPage, $page
        $result = Invoke-GitHubApi -Path $url
        if (-not $result.Ok) { break }
        $batch = @($result.Data)
        if ($batch.Count -eq 0) { break }
        $all += $batch
        if ($batch.Count -lt $PerPage) { break }
    }
    return $all
}

# --- Obtencao do token -------------------------------------------------------

function Read-TokenFromStore {
    if (-not (Test-Path $TokenStore)) { return $null }
    try {
        $secure = Get-Content $TokenStore -Raw | ConvertTo-SecureString
        return ConvertFrom-SecureStringPlain $secure
    } catch {
        Write-Warn "Nao consegui decifrar $TokenStore (foi criado noutro utilizador ou maquina?). A ignorar."
        return $null
    }
}

function Get-GhCliToken {
    if (-not (Get-Command gh -ErrorAction SilentlyContinue)) { return $null }
    try {
        $value = & gh auth token 2>$null | Select-Object -First 1
        if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($value)) { return $null }
        return $value.Trim()
    } catch { return $null }
}

function Read-TokenInteractive {
    Write-Info "Abrindo a pagina de criacao do token com os ambitos ja marcados (repo + read:org)."
    Write-Info "Escolha uma validade, clique em 'Generate token' e copie o valor apresentado."
    if ($NoBrowser) {
        Write-Info "Abra manualmente: $NewTokenUrl"
    } else {
        try { Start-Process $NewTokenUrl | Out-Null }
        catch { Write-Warn "Nao consegui abrir o browser. Abra manualmente: $NewTokenUrl" }
    }
    Write-Host ""
    $secure = Read-Host -AsSecureString "Cole aqui o token (nao aparece no ecra)"
    $value = ConvertFrom-SecureStringPlain $secure
    if ([string]::IsNullOrWhiteSpace($value)) { throw "Nenhum token introduzido." }
    return $value.Trim()
}

function Resolve-Token {
    if (-not [string]::IsNullOrWhiteSpace($Token)) {
        Write-Ok "A usar o token passado em -Token."
        return $Token.Trim()
    }

    foreach ($name in 'GH_PAT', 'GITHUB_TOKEN', 'GH_TOKEN') {
        $value = [Environment]::GetEnvironmentVariable($name)
        if ([string]::IsNullOrWhiteSpace($value)) { continue }
        if ($value.StartsWith('ghs_')) {
            Write-Warn "$name contem um token de instalacao de GitHub App (ghs_), que nao ve repositorios privados. A ignorar."
            continue
        }
        Write-Ok "A usar o token da variavel de ambiente $name."
        return $value.Trim()
    }

    $stored = Read-TokenFromStore
    if ($stored) {
        Write-Ok "A usar o token guardado em $TokenStore."
        return $stored
    }

    $cli = Get-GhCliToken
    if ($cli -and -not $cli.StartsWith('ghs_')) {
        Write-Ok "A usar o token da CLI do GitHub (gh auth token)."
        return $cli
    }

    Write-Info "Nenhuma credencial reutilizavel encontrada. Vamos criar uma."
    return Read-TokenInteractive
}

# --- Validacao ---------------------------------------------------------------

function Test-TokenAccess([string]$TokenValue) {
    $user = Invoke-GitHubApi -Path '/user' -TokenValue $TokenValue
    if (-not $user.Ok) {
        if ($user.Status -eq 401) { throw "Token invalido ou expirado (HTTP 401)." }
        if ($user.Status -eq 403) {
            if ($TokenValue.StartsWith('ghs_')) {
                throw "Este e um token de instalacao de GitHub App (ghs_): so ve os repositorios onde a App esta instalada e nunca a conta inteira. E preciso um token pessoal."
            }
            throw "Token sem permissao de utilizador (HTTP 403)."
        }
        throw "Nao foi possivel validar o token: $($user.Message)"
    }

    $scopes = $null
    if ($user.Headers -and $user.Headers['X-OAuth-Scopes']) {
        $scopes = ($user.Headers['X-OAuth-Scopes'] | Select-Object -First 1)
    }

    # Teste funcional: um token sem alcance sobre privados devolve 403 aqui.
    $probe = Invoke-GitHubApi -Path '/user/repos?visibility=private&per_page=1' -TokenValue $TokenValue
    if (-not $probe.Ok) {
        throw "O token autentica mas nao consegue listar repositorios privados (HTTP $($probe.Status)). Faltam-lhe os ambitos necessarios."
    }

    return [pscustomobject]@{
        Login              = $user.Data.login
        Name               = $user.Data.name
        PublicRepos        = $user.Data.public_repos
        TotalPrivateRepos  = $user.Data.total_private_repos
        OwnedPrivateRepos  = $user.Data.owned_private_repos
        Scopes             = $scopes
    }
}

# --- Persistencia ------------------------------------------------------------

function Save-TokenToStore([string]$TokenValue) {
    if (-not $IsWindowsPlatform) {
        Write-Warn "A cifragem DPAPI so existe no Windows. Token nao guardado em ficheiro."
        return
    }
    $dir = Split-Path -Parent $TokenStore
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    $secure = ConvertTo-SecureString $TokenValue -AsPlainText -Force
    $secure | ConvertFrom-SecureString | Set-Content -Path $TokenStore -Encoding ASCII

    # Sem heranca: so o dono do ficheiro o consegue ler.
    try {
        $acl = Get-Acl $TokenStore
        $acl.SetAccessRuleProtection($true, $false)
        $acl.Access | ForEach-Object { [void]$acl.RemoveAccessRule($_) }
        $rule = New-Object Security.AccessControl.FileSystemAccessRule(
            [Security.Principal.WindowsIdentity]::GetCurrent().Name, 'FullControl', 'Allow')
        $acl.AddAccessRule($rule)
        Set-Acl -Path $TokenStore -AclObject $acl
    } catch {
        Write-Warn "Token guardado, mas nao consegui restringir as permissoes do ficheiro: $_"
    }
    Write-Ok "Token guardado cifrado em $TokenStore (so o utilizador atual o consegue ler)."
}

function Save-TokenToUserEnv([string]$TokenValue) {
    if (-not $IsWindowsPlatform) {
        Write-Warn "Variaveis de ambiente de utilizador persistentes so no Windows. Nada gravado."
        return
    }
    [Environment]::SetEnvironmentVariable('GH_PAT', $TokenValue, 'User')
    $env:GH_PAT = $TokenValue
    Write-Ok "GH_PAT gravado nas variaveis de ambiente do utilizador."
    Write-Warn "Fica em texto simples no registo do Windows. Prefira -Persist File se isso o incomodar."
    Write-Info "Terminais ja abertos so veem a variavel depois de reiniciados."
}

# --- Levantamento de atividade ----------------------------------------------

function Get-RepositoryActivity {
    param([Parameter(Mandatory)][string]$Login, [Parameter(Mandatory)][datetime]$Cutoff)

    $repos = Get-GitHubPaged -Path '/user/repos?affiliation=owner,collaborator,organization_member&sort=pushed'
    Write-Ok ("$($repos.Count) repositorios visiveis (" +
        "$(@($repos | Where-Object { $_.private }).Count) privados, " +
        "$(@($repos | Where-Object { -not $_.private }).Count) publicos).")

    # Um fork sem commits herda o pushed_at do upstream, que pode ser antigo.
    # Filtrar so por pushed_at deixa esses repositorios de fora, por isso
    # consideramos tambem a data de criacao.
    $candidates = @($repos | Where-Object {
            (ConvertTo-Utc $_.pushed_at) -ge $Cutoff -or (ConvertTo-Utc $_.created_at) -ge $Cutoff
        })

    $since = $Cutoff.ToString('yyyy-MM-ddTHH:mm:ssZ')
    $rows = @()
    $index = 0

    foreach ($repo in $candidates) {
        $index++
        Write-Progress -Activity 'A contar commits' -Status $repo.full_name `
            -PercentComplete ([int](100 * $index / [Math]::Max($candidates.Count, 1)))

        $mine = 0
        $total = 0
        $mineResult = Invoke-GitHubApi -Path ('/repos/{0}/commits?since={1}&author={2}&per_page=100' -f $repo.full_name, $since, $Login)
        if ($mineResult.Ok) { $mine = @($mineResult.Data).Count }
        $totalResult = Invoke-GitHubApi -Path ('/repos/{0}/commits?since={1}&per_page=100' -f $repo.full_name, $since)
        if ($totalResult.Ok) { $total = @($totalResult.Data).Count }

        $rows += [pscustomobject]@{
            Repositorio  = $repo.full_name
            Privado      = [bool]$repo.private
            Fork         = [bool]$repo.fork
            MeusCommits  = $mine
            CommitsTotal = $total
            UltimoPush   = (ConvertTo-Utc $repo.pushed_at).ToString('yyyy-MM-dd')
            Criado       = (ConvertTo-Utc $repo.created_at).ToString('yyyy-MM-dd')
        }
    }
    Write-Progress -Activity 'A contar commits' -Completed

    return $rows | Sort-Object -Property @{ Expression = 'MeusCommits'; Descending = $true },
                                         @{ Expression = 'UltimoPush'; Descending = $true }
}

function Write-ActivityReport {
    param([object[]]$Rows, [string]$Path, [int]$WindowDays, [string]$Login)

    $lines = @()
    $lines += "# Atividade GitHub de $Login - ultimos $WindowDays dias"
    $lines += ''
    $lines += "Gerado em $((Get-Date).ToUniversalTime().ToString('yyyy-MM-dd HH:mm')) UTC por scripts/setup-github-access.ps1."
    $lines += ''
    $lines += '| Repositorio | Privado | Fork | Meus commits | Commits totais | Ultimo push | Criado |'
    $lines += '| --- | --- | --- | ---: | ---: | --- | --- |'
    foreach ($row in $Rows) {
        $lines += ('| {0} | {1} | {2} | {3} | {4} | {5} | {6} |' -f `
                $row.Repositorio,
            $(if ($row.Privado) { 'sim' } else { 'nao' }),
            $(if ($row.Fork) { 'sim' } else { 'nao' }),
            $row.MeusCommits, $row.CommitsTotal, $row.UltimoPush, $row.Criado)
    }
    $lines += ''
    Set-Content -Path $Path -Value $lines -Encoding UTF8
    Write-Ok "Relatorio escrito em $Path"
}

function Show-RemediationHelp {
    Write-Host ""
    Write-Info "Como resolver:"
    Write-Info "  1. Crie um token pessoal em $NewTokenUrl"
    Write-Info "     (classico: marque 'repo' e 'read:org'; granularidade fina: 'All repositories'"
    Write-Info "      com leitura em Metadata, Contents e Commit statuses)."
    Write-Info "  2. Volte a correr este script e cole o token quando for pedido,"
    Write-Info "     ou passe-o directamente: -Token <valor>."
    Write-Info ""
    Write-Info "Se preferir nao criar token, em $InstallationsUrl abra a instalacao"
    Write-Info "do Cursor e mude para 'All repositories' - mas isso nao ajuda este script,"
    Write-Info "que precisa mesmo de uma credencial de utilizador."
}

# --- Execucao ----------------------------------------------------------------

function Invoke-Main {
    Write-Host ""
    Write-Host "EasySignage - acesso amplo ao GitHub" -ForegroundColor Cyan
    Write-Host "PowerShell $($PSVersionTable.PSVersion)"
    if ($Elevated -or (Test-IsAdministrator)) {
        Write-Ok "A correr com permissoes de administrador."
    } elseif ($IsWindowsPlatform) {
        Write-Info "Sem elevacao (use -NoElevate so se souber que nao precisa de admin)."
    }

    Write-Step "1) Credencial"
    $script:ActiveToken = Resolve-Token
    Write-Info "Token: $(Get-MaskedToken $script:ActiveToken)"

    Write-Step "2) Validacao"
    $identity = Test-TokenAccess $script:ActiveToken
    Write-Ok "Autenticado como $($identity.Login)$(if ($identity.Name) { " ($($identity.Name))" })."
    if ($identity.Scopes) {
        Write-Info "Ambitos do token: $($identity.Scopes)"
        if ($identity.Scopes -notmatch '\brepo\b') {
            Write-Warn "O ambito 'repo' nao aparece na lista. Repositorios privados podem ficar de fora."
        }
    } else {
        Write-Info "Token de granularidade fina (sem lista de ambitos). O alcance depende dos repositorios que lhe atribuiu."
    }
    Write-Ok "Leitura de repositorios privados confirmada."
    Write-Info "Publicos: $($identity.PublicRepos) | privados totais: $($identity.TotalPrivateRepos) | privados proprios: $($identity.OwnedPrivateRepos)"

    Write-Step "3) Persistencia"
    switch ($Persist) {
        'File' { Save-TokenToStore $script:ActiveToken }
        'UserEnv' { Save-TokenToUserEnv $script:ActiveToken }
        default {
            Write-Info "Nada guardado (-Persist None). Use -Persist File para reutilizar sem colar outra vez."
        }
    }

    if (-not $NoAudit) {
        Write-Step "4) Atividade dos ultimos $Days dias"
        $cutoff = (Get-Date).ToUniversalTime().AddDays(-$Days)
        Write-Info "Janela desde $($cutoff.ToString('yyyy-MM-dd')) UTC."

        $rows = @(Get-RepositoryActivity -Login $identity.Login -Cutoff $cutoff)
        if ($rows.Count -eq 0) {
            Write-Warn "Nenhum repositorio com atividade na janela."
        } else {
            $worked = @($rows | Where-Object { $_.MeusCommits -gt 0 })
            $touched = @($rows | Where-Object { $_.MeusCommits -eq 0 })

            Write-Host ""
            Write-Host "Com commits seus ($($worked.Count)):" -ForegroundColor Green
            if ($worked.Count -gt 0) { $worked | Format-Table -AutoSize | Out-Host } else { Write-Info "nenhum" }

            Write-Host "Sem commits seus - forks e sincronizacoes ($($touched.Count)):" -ForegroundColor Yellow
            if ($touched.Count -gt 0) { $touched | Format-Table -AutoSize | Out-Host } else { Write-Info "nenhum" }

            $mineTotal = ($worked | Measure-Object -Property MeusCommits -Sum).Sum
            Write-Info "$($rows.Count) repositorios movimentados, $mineTotal commits seus."

            if ($ReportPath) { Write-ActivityReport -Rows $rows -Path $ReportPath -WindowDays $Days -Login $identity.Login }
        }
    }

    Write-Step "5) Proximos passos"
    if ($CopyToClipboard) {
        try {
            Set-Clipboard -Value $script:ActiveToken
            Write-Ok "Token copiado para a area de transferencia. Cole-o e limpe a area de transferencia depois."
        } catch {
            Write-Warn "Set-Clipboard indisponivel neste ambiente: $_"
        }
    }
    Write-Info "Para dar o mesmo acesso aos Cloud Agents do Cursor:"
    Write-Info "  1. Abra $CursorDashboardUrl e va a Cloud Agents > Secrets."
    Write-Info "  2. Crie o secret GH_PAT com o valor deste token."
    Write-Info "  3. Inicie um agente NOVO: os secrets so entram em VMs criadas depois de os gravar."
    Write-Info ""
    Write-Info "Alternativa sem token: em $InstallationsUrl, abra a instalacao do Cursor"
    Write-Info "e mude de 'Only select repositories' para 'All repositories'."
    Write-Host ""
}

try {
    Invoke-Main
} catch {
    Write-Host ""
    Write-Bad $_.Exception.Message
    Show-RemediationHelp
    Write-Host ""
    exit 1
} finally {
    # Nao deixar a credencial em memoria depois de o script terminar.
    $script:ActiveToken = $null
}
exit 0
