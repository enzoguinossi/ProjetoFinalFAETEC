#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Encerra o Nexus mantendo os serviços em Automatic.

.DESCRIPTION
    Para os serviços na ordem NexusCaddy → NexusApp → NexusMySQL84, com
    Stop-Service -Force e espera de parada. Tenta todos os serviços mesmo se
    um falhar; termina com código 1 se algum não parou. Não altera o
    StartupType (decisão 1A): os serviços continuam Automatic e voltam no
    próximo boot. Grava C:\ProgramData\Nexus\config\nexus-state.json com
    nexusStopped=true somente quando os três estão parados. Idempotente.
    Log em C:\ProgramData\Nexus\logs\encerrar-nexus-<timestamp>.log.
#>
[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "common.ps1")

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
$logPath = Join-Path $LogsDir ("encerrar-nexus-" + $timestamp + ".log")
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
$failures = New-Object System.Collections.Generic.List[string]

try {
    Write-Step "Encerramento do Nexus ($timestamp)"
    Write-Host "Log: $logPath" -ForegroundColor DarkGray

    # Caddy → App → MySQL. Tenta todos mesmo se um falhar.
    foreach ($name in @("NexusCaddy", "NexusApp", $mySqlName)) {
        if ($name -eq "NexusCaddy") {
            $caddyService = Get-Service -Name $name -ErrorAction SilentlyContinue
            if (-not $caddyService) {
                Write-Warn "O serviço $name não existe."
                $failures.Add($name)
                continue
            }
            Write-Ok "Parando $name e liberando as portas 80/443..."
            if (Stop-NexusCaddyProcess) {
                Write-Ok "$name parado."
            }
            else {
                Write-Warn "O serviço $name/portas 80 e 443 não foi liberado."
                $failures.Add($name)
            }
            continue
        }

        if ($name -eq "NexusApp") {
            $appService = Get-Service -Name $name -ErrorAction SilentlyContinue
            if (-not $appService) {
                Write-Warn "O serviço $name não existe."
                $failures.Add($name)
                continue
            }
            Write-Ok "Parando $name e liberando a porta 3000..."
            if (Stop-NexusAppProcess) {
                Write-Ok "$name parado."
            }
            else {
                Write-Warn "O serviço $name/porta 3000 não foi liberado."
                $failures.Add($name)
            }
            continue
        }

        $service = Get-Service -Name $name -ErrorAction SilentlyContinue
        if (-not $service) {
            Write-Warn "O serviço $name não existe."
            $failures.Add($name)
            continue
        }
        if ($service.Status.ToString() -eq "Stopped") {
            Write-Ok "$name já está parado."
            continue
        }

        $timeout = if ($name -eq $mySqlName) { 120 } else { 60 }
        Write-Ok "Parando $name..."
        Stop-Service -Name $name -Force -ErrorAction SilentlyContinue
        if (-not (Wait-ServiceState -Name $name -Status "Stopped" -TimeoutSeconds $timeout)) {
            Write-Warn "O serviço $name não parou em $timeout segundos."
            $failures.Add($name)
        }
        else {
            Write-Ok "$name parado."
        }
    }

    if ($failures.Count -eq 0) {
        Set-NexusState -Stopped $true
        Write-Ok "Estado gravado: nexusStopped=true."
        Write-Ok "Nexus encerrado; os serviços continuam Automatic e voltam no próximo boot."
        Write-Host "ENCERRAR: OK" -ForegroundColor Green
        exit 0
    }

    Write-Warn ("Não foi possível parar: {0}" -f ($failures -join ", "))
    Write-Host "ENCERRAR: FALHOU" -ForegroundColor Red
    exit 1
}
catch {
    Write-Warn ("Encerramento interrompido: {0}" -f $_.Exception.Message)
    Write-Host "ENCERRAR: FALHOU" -ForegroundColor Red
    exit 1
}
finally {
    if ($transcriptActive) {
        try { Stop-Transcript | Out-Null } catch { }
    }
}
