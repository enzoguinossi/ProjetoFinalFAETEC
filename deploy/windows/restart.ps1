#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Reinicia a aplicação do Nexus mantendo o Caddy sob controle.

.DESCRIPTION
    Para o NexusCaddy, reinicia o NexusApp (via NSSM quando disponível),
    aguarda o health local, inicia o NexusCaddy e aguarda o health novamente.
    É usado pelo item “Reiniciar aplicação” da bandeja e grava o log em
    C:\ProgramData\Nexus\logs\restart-<timestamp>.log. Retorna 0 em sucesso e
    1 em falha.
#>
[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "common.ps1")

function Stop-RestartFailure {
    param([Parameter(Mandatory = $true)][string]$Message)
    Write-Warn $Message
    Write-Host "RESTART: FALHOU" -ForegroundColor Red
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

$LogsDir = $script:NexusLogsDir
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$logPath = Join-Path $LogsDir ("restart-" + $timestamp + ".log")
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

$appName = "NexusApp"
$caddyName = "NexusCaddy"
$nssmExe = Join-Path $script:NexusProgramRoot "tools\nssm\nssm.exe"

try {
    Write-Step "Reinício do Nexus ($timestamp)"
    Write-Host "Log: $logPath" -ForegroundColor DarkGray

    $appService = Get-Service -Name $appName -ErrorAction SilentlyContinue
    if (-not $appService) { Stop-RestartFailure "O serviço $appName não existe." }
    $caddyService = Get-Service -Name $caddyName -ErrorAction SilentlyContinue
    if (-not $caddyService) { Stop-RestartFailure "O serviço $caddyName não existe." }

    Write-Ok "Parando $caddyName..."
    if ($caddyService.Status.ToString() -ne "Stopped") {
        Stop-Service -Name $caddyName -Force
        if (-not (Wait-ServiceState -Name $caddyName -Status "Stopped" -TimeoutSeconds 60)) {
            Stop-RestartFailure "O serviço $caddyName não parou."
        }
    }
    Write-Ok "$caddyName parado."

    Write-Ok "Reiniciando $appName..."
    if (Test-Path -LiteralPath $nssmExe -PathType Leaf) {
        & $nssmExe restart $appName
        if ($LASTEXITCODE -ne 0) {
            Stop-RestartFailure "nssm restart $appName falhou (código $LASTEXITCODE)."
        }
    }
    else {
        if ($appService.Status.ToString() -ne "Stopped") {
            Stop-Service -Name $appName -Force
            if (-not (Wait-ServiceState -Name $appName -Status "Stopped" -TimeoutSeconds 60)) {
                Stop-RestartFailure "O serviço $appName não parou."
            }
        }
        Start-Service -Name $appName
    }

    if (-not (Wait-ServiceState -Name $appName -Status "Running" -TimeoutSeconds 120)) {
        Stop-RestartFailure "O serviço $appName não iniciou."
    }
    $health = Wait-AppHealth
    if (-not $health.Ok) {
        Stop-RestartFailure "O health local não respondeu 200 com db=true após reiniciar $appName."
    }
    Write-Ok "Health local OK (versão $($health.Versao))."

    Write-Ok "Iniciando $caddyName..."
    $currentCaddy = Get-Service -Name $caddyName -ErrorAction SilentlyContinue
    if (-not $currentCaddy -or $currentCaddy.Status.ToString() -ne "Running") {
        Start-Service -Name $caddyName
    }
    if (-not (Wait-ServiceState -Name $caddyName -Status "Running" -TimeoutSeconds 60)) {
        Stop-RestartFailure "O serviço $caddyName não iniciou."
    }
    $healthAfterCaddy = Wait-AppHealth -TimeoutSeconds 60
    if (-not $healthAfterCaddy.Ok) {
        Stop-RestartFailure "O health local não respondeu após iniciar $caddyName."
    }
    Write-Ok "$caddyName em execução; health local OK."

    Write-Ok "Reinício concluído."
    Write-Host "RESTART: OK" -ForegroundColor Green
    exit 0
}
catch {
    Write-Warn ("Reinício interrompido: {0}" -f $_.Exception.Message)
    Write-Host "RESTART: FALHOU" -ForegroundColor Red
    exit 1
}
finally {
    if ($transcriptActive) {
        try { Stop-Transcript | Out-Null } catch { }
    }
}
