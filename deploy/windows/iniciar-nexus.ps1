#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Inicia o Nexus: MySQL dedicado, aplicação e Caddy.

.DESCRIPTION
    Garante o StartupType Automatic dos três serviços (nunca Manual), sobe na
    ordem NexusMySQL84 → NexusApp → NexusCaddy, espera a porta 3214, o health
    local com db=true e o Caddy em execução. Grava
    C:\ProgramData\Nexus\config\nexus-state.json com nexusStopped=false.
    Usado pelo item “Iniciar Nexus” da bandeja. Retorna 0 em sucesso e 1 em
    falha; o log fica em C:\ProgramData\Nexus\logs\iniciar-nexus-<timestamp>.log.
#>
[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "common.ps1")

function Stop-InitFailure {
    param([Parameter(Mandatory = $true)][string]$Message)
    Write-Warn $Message
    Write-Host "INICIAR: FALHOU" -ForegroundColor Red
    exit 1
}

function Wait-AppHealth {
    param([int]$TimeoutSeconds = 180)
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    $last = $null
    do {
        $last = Test-Health -Url "http://127.0.0.1:3000/api/health" -ExpectDb
        if ($last.Ok) { return $last }
        Start-Sleep -Seconds 3
    } while ((Get-Date) -lt $deadline)
    return $last
}

function Set-NexusState {
    param([Parameter(Mandatory = $true)][bool]$Stopped)
    $statePath = Join-Path $script:NexusConfigDir "nexus-state.json"
    if (-not (Test-Path -LiteralPath $script:NexusConfigDir)) {
        New-Item -ItemType Directory -Force -Path $script:NexusConfigDir | Out-Null
    }
    $state = [ordered]@{
        nexusStopped = $Stopped
        updatedAt    = (Get-Date).ToString("o")
    }
    Write-Utf8NoBom -Path $statePath -Lines @(($state | ConvertTo-Json -Depth 3))
}

$LogsDir = $script:NexusLogsDir
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$logPath = Join-Path $LogsDir ("iniciar-nexus-" + $timestamp + ".log")
$transcriptActive = $false

try {
    if (-not (Test-Path -LiteralPath $LogsDir)) {
        New-Item -ItemType Directory -Force -Path $LogsDir | Out-Null
    }
    Start-Transcript -Path $logPath -Append -Force | Out-Null
    $transcriptActive = $true
}
catch {
    Write-Warn "Não foi possível iniciar o log em $logPath`: $($_.Exception.Message)"
}

$mySqlName = $script:NexusMySqlService
$appName = "NexusApp"
$caddyName = "NexusCaddy"

try {
    Write-Step "Início do Nexus ($timestamp)"
    Write-Host "Log: $logPath" -ForegroundColor DarkGray

    # StartupType Automatic (idempotente). Nunca muda para Manual.
    foreach ($name in @($mySqlName, $appName, $caddyName)) {
        $service = Get-Service -Name $name -ErrorAction SilentlyContinue
        if (-not $service) {
            Stop-InitFailure "O serviço $name não existe. Reinstale o Nexus com o setup oficial."
        }
        if ($service.StartType.ToString() -ne "Automatic") {
            Set-Service -Name $name -StartupType Automatic -ErrorAction Stop
            Write-Ok "Serviço $name definido como Automatic."
        }
        else {
            Write-Ok "Serviço $name já está Automatic."
        }
    }

    Write-Ok "Iniciando $mySqlName..."
    $mySql = Get-Service -Name $mySqlName -ErrorAction SilentlyContinue
    if (-not $mySql -or $mySql.Status.ToString() -ne "Running") {
        Start-Service -Name $mySqlName -ErrorAction SilentlyContinue
    }
    if (-not (Wait-ServiceState -Name $mySqlName -Status "Running" -TimeoutSeconds 120)) {
        Stop-InitFailure "O serviço $mySqlName não iniciou."
    }

    $deadline = (Get-Date).AddSeconds(120)
    while (-not (Test-TcpPort -Port $script:NexusMySqlPort -TimeoutMs 2000) -and (Get-Date) -lt $deadline) {
        Start-Sleep -Seconds 2
    }
    if (-not (Test-TcpPort -Port $script:NexusMySqlPort -TimeoutMs 2000)) {
        Stop-InitFailure "$mySqlName está em execução, mas não aceita conexões na porta $($script:NexusMySqlPort)."
    }
    Write-Ok "$mySqlName em execução em 127.0.0.1:$($script:NexusMySqlPort)."

    Write-Ok "Iniciando $appName..."
    $app = Get-Service -Name $appName -ErrorAction SilentlyContinue
    $appReady = $false
    if ($app -and $app.Status.ToString() -eq "Running") {
        # Já estava Running: só reinicia se o health não responder.
        $probe = Wait-AppHealth -TimeoutSeconds 30
        if ($probe.Ok) { $appReady = $true }
    }
    if (-not $appReady) {
        if (-not (Stop-NexusAppProcess)) {
            Stop-InitFailure "Não foi possível parar o $appName/liberar a porta 3000."
        }
        try {
            Start-NexusApp -TimeoutSeconds 180
        }
        catch {
            Stop-InitFailure $_.Exception.Message
        }
    }
    $health = Wait-AppHealth -TimeoutSeconds 180
    if (-not $health.Ok) {
        Stop-InitFailure "O health local não respondeu 200 com db=true. Veja $LogsDir\app.err.log."
    }
    Write-Ok "Health local OK (db=true, versão $($health.Versao))."

    Write-Ok "Iniciando $caddyName..."
    $caddy = Get-Service -Name $caddyName -ErrorAction SilentlyContinue
    if (-not $caddy -or $caddy.Status.ToString() -ne "Running") {
        Start-Service -Name $caddyName -ErrorAction SilentlyContinue
    }
    if (-not (Wait-ServiceState -Name $caddyName -Status "Running" -TimeoutSeconds 60)) {
        Stop-InitFailure "O serviço $caddyName não iniciou."
    }
    Write-Ok "$caddyName em execução."

    $healthAfterCaddy = Wait-AppHealth -TimeoutSeconds 60
    if (-not $healthAfterCaddy.Ok) {
        Stop-InitFailure "O health local não respondeu após iniciar $caddyName."
    }

    Set-NexusState -Stopped $false
    Write-Ok "Estado gravado: nexusStopped=false."
    Write-Ok "Nexus iniciado."
    Write-Host "INICIAR: OK" -ForegroundColor Green
    exit 0
}
catch {
    Write-Warn ("Início interrompido: {0}" -f $_.Exception.Message)
    Write-Host "INICIAR: FALHOU" -ForegroundColor Red
    exit 1
}
finally {
    if ($transcriptActive) {
        try { Stop-Transcript | Out-Null } catch { }
    }
}
