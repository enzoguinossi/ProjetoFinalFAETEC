#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Atualiza o Nexus para uma tag publicada.

.DESCRIPTION
    Faz backup, para o NexusApp, troca a pasta da aplicação, compila a nova tag,
    aplica o schema, sobe o serviço e valida com smoke test. Em caso de falha,
    a pasta anterior volta a ser usada; o banco NÃO é restaurado automaticamente.

.PARAMETER Tag
    Tag a instalar (ex.: v1.02.11.2026).

.PARAMETER RepoUrl
    URL do repositório. Padrão: remote origin da instalação atual.

.PARAMETER SkipBackup
    Não executa o backup antes da atualização (não recomendado).
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$Tag,
    [string]$RepoUrl = "",
    [switch]$SkipBackup
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "common.ps1")
Assert-Admin
Update-SessionPath

$manifest = Get-Manifest
$ProgramRoot = $script:NexusProgramRoot
$AppDir = $script:NexusAppDir
$DataDir = $script:NexusDataDir
$LogsDir = $script:NexusLogsDir
$ConfigDir = $script:NexusConfigDir
$BackupsDir = $script:NexusBackupsDir
$PsExe = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"

if (-not (Test-Path -LiteralPath (Join-Path $AppDir "package.json"))) {
    Fail "Aplicação não encontrada em $AppDir. Rode o bootstrap primeiro."
}
if (-not (Get-Service -Name "NexusApp" -ErrorAction SilentlyContinue)) {
    Fail "O serviço NexusApp não existe. Rode o bootstrap primeiro."
}
if (-not $RepoUrl) {
    $git = Get-Command git.exe -ErrorAction SilentlyContinue
    if ($git -and (Test-Path -LiteralPath (Join-Path $AppDir ".git"))) {
        $RepoUrl = ([string](& $git.Source -C $AppDir remote get-url origin 2>$null | Select-Object -First 1)).Trim()
    }
    if (-not $RepoUrl) { $RepoUrl = [string]$manifest.repo.url }
}
if (-not $RepoUrl) {
    Fail "URL do repositório não definida. Passe -RepoUrl."
}

function Get-NexusHostname {
    $statePath = Join-Path $DataDir "bootstrap.state.json"
    if (Test-Path -LiteralPath $statePath) {
        try {
            $state = Get-Content -LiteralPath $statePath -Raw -Encoding UTF8 | ConvertFrom-Json
            if ($state.hostname) { return ([string]$state.hostname).Trim() }
        }
        catch { }
    }
    $caddyfile = Join-Path $ConfigDir "Caddyfile"
    if (Test-Path -LiteralPath $caddyfile) {
        foreach ($line in [System.IO.File]::ReadAllLines($caddyfile)) {
            $trimmed = $line.Trim()
            if ($trimmed -and -not $trimmed.StartsWith("#") -and $trimmed -match '^([A-Za-z0-9][A-Za-z0-9.-]*)\s*\{') {
                return $matches[1]
            }
        }
    }
    return ""
}

function Stop-NexusApp {
    $service = Get-Service -Name "NexusApp" -ErrorAction SilentlyContinue
    if ($service -and $service.Status.ToString() -ne "Stopped") {
        Stop-Service -Name "NexusApp" -Force
        if (-not (Wait-ServiceState -Name "NexusApp" -Status "Stopped" -TimeoutSeconds 60)) {
            throw "O serviço NexusApp não parou."
        }
    }
}

function Start-NexusApp {
    $service = Get-Service -Name "NexusApp" -ErrorAction SilentlyContinue
    if (-not $service) { throw "O serviço NexusApp não existe." }
    if ($service.Status.ToString() -ne "Running") {
        Start-Service -Name "NexusApp"
    }
    if (-not (Wait-ServiceState -Name "NexusApp" -Status "Running" -TimeoutSeconds 120)) {
        throw "O serviço NexusApp não iniciou."
    }
}

function Start-NexusCaddy {
    $service = Get-Service -Name "NexusCaddy" -ErrorAction SilentlyContinue
    if (-not $service) { throw "O serviço NexusCaddy não existe." }
    if ($service.Status.ToString() -ne "Running") {
        Start-Service -Name "NexusCaddy"
    }
    if (-not (Wait-ServiceState -Name "NexusCaddy" -Status "Running" -TimeoutSeconds 60)) {
        throw "O serviço NexusCaddy não iniciou."
    }
}

function Wait-NexusHealth {
    $deadline = (Get-Date).AddSeconds(180)
    $last = $null
    do {
        $last = Test-Health -Url "http://127.0.0.1:3000/api/health" -ExpectDb
        if ($last.Ok) { return $last }
        Start-Sleep -Seconds 3
    } while ((Get-Date) -lt $deadline)
    return $last
}

$hostname = Get-NexusHostname
if (-not $hostname) {
    Fail "Hostname não encontrado no bootstrap/Caddyfile. Não é possível rodar o smoke test."
}

$logFile = Join-Path $LogsDir ("deploy-" + (ConvertTo-SafeName $Tag) + ".log")
Start-NexusTranscript -Path $logFile
$git = Get-Command git.exe -ErrorAction SilentlyContinue
$npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (-not $git) { Fail "Git não encontrado." }
if (-not $npm) { Fail "npm.cmd não encontrado." }

try {
    Write-Step "Atualização do Nexus para $Tag"
    Write-Ok "Log: $logFile"

    if ($SkipBackup) {
        Write-Warn "Backup ignorado por -SkipBackup."
    }
    else {
        Write-Ok "Executando backup antes da atualização..."
        & $PsExe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "backup.ps1")
        if ($LASTEXITCODE -ne 0) {
            Fail "O backup falhou; a atualização foi cancelada antes de alterar a aplicação."
        }
    }

    $currentTag = Get-CurrentTag -RepoPath $AppDir
    if (-not $currentTag) { $currentTag = "desconhecida" }
    $previousDir = Join-Path $ProgramRoot ("app.prev-" + (ConvertTo-SafeName $currentTag))
    if (Test-Path -LiteralPath $previousDir) {
        $previousDir = Join-Path $ProgramRoot ("app.prev-" + (ConvertTo-SafeName $currentTag) + "-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
    }
    $failedDir = Join-Path $ProgramRoot ("app.failed-" + (ConvertTo-SafeName $Tag))
    if (Test-Path -LiteralPath $failedDir) {
        $failedDir = Join-Path $ProgramRoot ("app.failed-" + (ConvertTo-SafeName $Tag) + "-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
    }

    Write-Ok "Versão atual: $currentTag"
    Write-Ok "Parando NexusApp..."
    Stop-NexusApp

    Write-Ok "Movendo a aplicação atual para $previousDir..."
    Move-Item -LiteralPath $AppDir -Destination $previousDir

    try {
        Write-Ok "Clonando $Tag..."
        & $git.Source clone --branch $Tag --depth 1 $RepoUrl $AppDir
        if ($LASTEXITCODE -ne 0) { throw "git clone da tag $Tag falhou." }

        $previousEnv = Join-Path $previousDir ".env"
        if (-not (Test-Path -LiteralPath $previousEnv)) {
            throw "O .env da instalação anterior não foi encontrado."
        }
        Suspend-Transcript
        try {
            Copy-Item -LiteralPath $previousEnv -Destination (Join-Path $AppDir ".env") -Force
            Protect-File -Path (Join-Path $AppDir ".env") -ReadIdentities @("S-1-5-20")
        }
        finally {
            Resume-Transcript
        }
        Write-Ok ".env restaurado com ACL restrita."

        Push-Location $AppDir
        try {
            Remove-Item Env:NODE_ENV -ErrorAction SilentlyContinue
            Write-Ok "Executando npm ci..."
            & $npm.Source ci --no-audit --no-fund
            if ($LASTEXITCODE -ne 0) { throw "npm ci falhou." }

            Write-Ok "Gerando o cliente Prisma..."
            & $npm.Source run db:generate
            if ($LASTEXITCODE -ne 0) { throw "prisma generate falhou." }

            Write-Ok "Compilando a aplicação..."
            & $npm.Source run build
            if ($LASTEXITCODE -ne 0) { throw "npm run build falhou." }

            Write-Ok "Aplicando o schema no banco..."
            & $npm.Source run db:push
            if ($LASTEXITCODE -ne 0) { throw "prisma db push falhou." }

            Write-Ok "Executando o seed de referência..."
            & $npm.Source run db:seed
            if ($LASTEXITCODE -ne 0) { throw "db:seed falhou." }
        }
        finally {
            Pop-Location
        }

        $cacheDir = Join-Path $AppDir ".next\cache"
        if (-not (Test-Path -LiteralPath $cacheDir)) {
            New-Item -ItemType Directory -Force -Path $cacheDir | Out-Null
        }
        Set-AclModify -Path $cacheDir
        Set-AclReadExecute -Path $AppDir
        Write-Ok "Build concluído."

        Write-Ok "Iniciando NexusApp..."
        Start-NexusApp
        Write-Ok "Iniciando NexusCaddy..."
        Start-NexusCaddy
        $health = Wait-NexusHealth
        if (-not $health.Ok) {
            throw "O health local não respondeu 200 com db=true."
        }
        Write-Ok "Health local OK (versão $($health.Versao))."

        $https = Test-Health -Url ("https://{0}/login" -f $hostname)
        if (-not $https.Ok) {
            $deadline = (Get-Date).AddSeconds(60)
            do {
                Start-Sleep -Seconds 2
                $https = Test-Health -Url ("https://{0}/login" -f $hostname)
            } while (-not $https.Ok -and (Get-Date) -lt $deadline)
        }
        if (-not $https.Ok) {
            throw "HTTPS https://$hostname/login não respondeu 200."
        }
        Write-Ok "HTTPS https://$hostname/login OK."

        Write-Ok "Executando smoke test..."
        $expectedVersion = $Tag -replace '^v', ''
        & $PsExe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "smoke.ps1") `
            -Hostname $hostname -ExpectedVersion $expectedVersion
        if ($LASTEXITCODE -ne 0) {
            throw "O smoke test falhou."
        }

        Write-Ok "Atualização para $Tag concluída e validada."

        # Mantém a versão anterior recém-criada e mais uma; nunca apaga a atual.
        $olderVersions = Get-ChildItem -LiteralPath $ProgramRoot -Directory -Filter "app.prev-*" -ErrorAction SilentlyContinue |
            Where-Object { $_.FullName -ne $previousDir } |
            Sort-Object LastWriteTime -Descending
        $olderVersions | Select-Object -Skip 1 | ForEach-Object {
            Remove-Item -LiteralPath $_.FullName -Recurse -Force -ErrorAction SilentlyContinue
        }
        $kept = @($previousDir) + @($olderVersions | Select-Object -First 1 | ForEach-Object { $_.FullName })
        Write-Ok ("Versões anteriores mantidas: " + (($kept | ForEach-Object { Split-Path -Leaf $_ }) -join ", "))
    }
    catch {
        $message = $_.Exception.Message
        Write-Warn "Falha na atualização: $message"
        try { Stop-NexusApp } catch { }

        if (Test-Path -LiteralPath $AppDir) {
            Write-Warn "Movendo a versão com falha para $failedDir..."
            try { Move-Item -LiteralPath $AppDir -Destination $failedDir -Force } catch { }
        }
        if (Test-Path -LiteralPath $previousDir) {
            Write-Warn "Restaurando a versão anterior..."
            try { Move-Item -LiteralPath $previousDir -Destination $AppDir -Force } catch { }
        }
        try {
            Start-NexusApp
            Start-NexusCaddy
            $rollbackHealth = Wait-NexusHealth
            if ($rollbackHealth.Ok) {
                Write-Ok "Versão anterior restaurada e respondendo (versão $($rollbackHealth.Versao))."
            }
            else {
                Write-Warn "A versão anterior foi restaurada, mas o health ainda não respondeu."
            }
        }
        catch {
            Write-Warn "A versão anterior foi restaurada, mas o serviço não iniciou: $($_.Exception.Message)"
        }

        Write-Host ""
        Write-Host "A versão nova ficou em $failedDir para diagnóstico." -ForegroundColor Yellow
        Write-Host "O banco NÃO foi restaurado automaticamente." -ForegroundColor Yellow
        Write-Host "Se o db push/seed alterou dados, restaure o dump mais recente de $BackupsDir\db." -ForegroundColor Yellow
        Write-Host "Log desta execução: $logFile" -ForegroundColor Yellow
        exit 1
    }
}
finally {
    Stop-NexusTranscript
}
