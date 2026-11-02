#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Desinstala os serviços, tarefas e arquivos do Nexus no Windows.

.DESCRIPTION
    Para e remove os serviços NexusApp e NexusCaddy, remove as tarefas NexusTray
    e NexusBackup, encerra a bandeja e apaga C:\Program Files\Nexus\app,
    C:\Program Files\Nexus\NexusTray, C:\Program Files\Nexus\caddy,
    C:\Program Files\Nexus\tools, C:\Program Files\Nexus\scripts,
    C:\ProgramData\Nexus\caddy e, se existir, C:\ProgramData\Caddy.

    C:\ProgramData\Nexus é PRESERVADO (banco, uploads, configuração, backups e
    logs), exceto o subdiretório caddy, que é removido. MySQL, Node.js e Git
    não são desinstalados.
#>
[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

$ProgramRoot = "C:\Program Files\Nexus"
$DataRoot = "C:\ProgramData\Nexus"
$LogsDir = Join-Path $DataRoot "logs"
$NexusCaddyData = Join-Path $DataRoot "caddy"
$CaddyData = "C:\ProgramData\Caddy"
$NssmExe = Join-Path $ProgramRoot "tools\nssm\nssm.exe"
$ScExe = Join-Path $env:SystemRoot "System32\sc.exe"
$SchtasksExe = Join-Path $env:SystemRoot "System32\schtasks.exe"
$LogPath = Join-Path $LogsDir ("desinstalar-" + (Get-Date -Format "yyyyMMdd-HHmmss") + ".log")
$script:Failures = 0

function Write-Log {
    param([Parameter(Mandatory = $true)][string]$Message)
    $line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Message
    Write-Host $line
    try {
        Add-Content -LiteralPath $LogPath -Value $line -Encoding UTF8 -ErrorAction Stop
    }
    catch {
        # O log não pode impedir a desinstalação.
    }
}

function Invoke-Native {
    param(
        [Parameter(Mandatory = $true)][string]$Exe,
        [Parameter(Mandatory = $true)][string[]]$Arguments
    )
    try {
        $output = & $Exe @Arguments 2>&1
        $code = $LASTEXITCODE
        foreach ($line in @($output)) {
            if ($null -ne $line -and "$line".Trim()) {
                Write-Log ("  {0}" -f "$line".Trim())
            }
        }
        Write-Log ("  {0} {1} -> código {2}" -f (Split-Path -Leaf $Exe), ($Arguments -join " "), $code)
        return [int]$code
    }
    catch {
        Write-Log ("  {0} {1} -> erro: {2}" -f (Split-Path -Leaf $Exe), ($Arguments -join " "), $_.Exception.Message)
        return 1
    }
}

function Stop-NexusService {
    param([Parameter(Mandatory = $true)][string]$Name)

    $service = Get-Service -Name $Name -ErrorAction SilentlyContinue
    if (-not $service) {
        Write-Log "Serviço $Name não existe."
        return
    }
    if ($service.Status -eq "Stopped") {
        Write-Log "Serviço $Name já está parado."
        return
    }

    Write-Log "Parando serviço $Name..."
    if (Test-Path -LiteralPath $NssmExe -PathType Leaf) {
        Invoke-Native -Exe $NssmExe -Arguments @("stop", $Name) | Out-Null
    }
    else {
        Invoke-Native -Exe $ScExe -Arguments @("stop", $Name) | Out-Null
    }

    $deadline = (Get-Date).AddSeconds(60)
    while ((Get-Date) -lt $deadline) {
        $current = Get-Service -Name $Name -ErrorAction SilentlyContinue
        if (-not $current -or $current.Status -eq "Stopped") { return }
        Start-Sleep -Seconds 1
    }
    Write-Log "[AVISO] O serviço $Name não parou em 60 segundos."
    $script:Failures++
}

function Remove-NexusService {
    param([Parameter(Mandatory = $true)][string]$Name)

    $service = Get-Service -Name $Name -ErrorAction SilentlyContinue
    if (-not $service) {
        Write-Log "Serviço $Name já removido."
        return
    }

    Write-Log "Removendo serviço $Name..."
    if (Test-Path -LiteralPath $NssmExe -PathType Leaf) {
        $code = Invoke-Native -Exe $NssmExe -Arguments @("remove", $Name, "confirm")
    }
    else {
        $code = Invoke-Native -Exe $ScExe -Arguments @("delete", $Name)
    }
    if ($code -ne 0) {
        Write-Log "[AVISO] Não foi possível remover o serviço $Name (código $code)."
        $script:Failures++
    }
}

function Remove-NexusTask {
    param([Parameter(Mandatory = $true)][string]$Name)

    if (-not (Get-Command Get-ScheduledTask -ErrorAction SilentlyContinue)) {
        $code = Invoke-Native -Exe $SchtasksExe -Arguments @("/Delete", "/TN", $Name, "/F")
        if ($code -ne 0) {
            Write-Log "[AVISO] Tarefa $Name não removida (ou não existia)."
        }
        return
    }

    $task = Get-ScheduledTask -TaskName $Name -ErrorAction SilentlyContinue
    if (-not $task) {
        Write-Log "Tarefa $Name não existe."
        return
    }

    Write-Log "Removendo tarefa agendada $Name..."
    try {
        Unregister-ScheduledTask -TaskName $Name -Confirm:$false -ErrorAction Stop
        Write-Log "Tarefa $Name removida."
    }
    catch {
        Write-Log "[AVISO] Falha ao remover a tarefa ${Name}: $($_.Exception.Message)"
        $code = Invoke-Native -Exe $SchtasksExe -Arguments @("/Delete", "/TN", $Name, "/F")
        if ($code -ne 0) { $script:Failures++ }
    }
}

function Remove-NexusDirectory {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Label
    )

    $normalized = $Path.TrimEnd("\")
    if (-not $normalized -or $normalized -eq $ProgramRoot -or $normalized -eq $DataRoot -or $normalized -eq "C:\") {
        Write-Log "[ERRO] Recusando remover caminho protegido: '$Path'."
        $script:Failures++
        return
    }
    if (-not (Test-Path -LiteralPath $Path)) {
        Write-Log "$Label não encontrado em $Path."
        return
    }

    Write-Log "Removendo $Label ($Path)..."
    try {
        Remove-Item -LiteralPath $Path -Recurse -Force -ErrorAction Stop
        Write-Log "$Label removido."
    }
    catch {
        Write-Log "[ERRO] Falha ao remover $Label ($Path): $($_.Exception.Message)"
        $script:Failures++
    }
}

try {
    if (-not (Test-Path -LiteralPath $LogsDir)) {
        New-Item -ItemType Directory -Force -Path $LogsDir | Out-Null
    }
}
catch {
    # O log não pode impedir a desinstalação.
}

Write-Log "Desinstalação do Nexus iniciada."

try {
    # A bandeja depende do NexusApp; o Caddy depende do NexusApp.
    Stop-NexusService -Name "NexusCaddy"
    Stop-NexusService -Name "NexusApp"

    $trayProcesses = Get-Process -Name "NexusTray" -ErrorAction SilentlyContinue
    if ($trayProcesses) {
        foreach ($process in $trayProcesses) {
            try {
                Stop-Process -Id $process.Id -Force -ErrorAction Stop
                Write-Log ("NexusTray encerrado (PID {0})." -f $process.Id)
            }
            catch {
                Write-Log ("[AVISO] Não foi possível encerrar o NexusTray (PID {0}): {1}" -f $process.Id, $_.Exception.Message)
            }
        }
    }

    Remove-NexusTask -Name "NexusTray"
    Remove-NexusTask -Name "NexusBackup"

    Remove-NexusService -Name "NexusCaddy"
    Remove-NexusService -Name "NexusApp"

    Remove-NexusDirectory -Path (Join-Path $ProgramRoot "caddy") -Label "Caddy"
    Remove-NexusDirectory -Path (Join-Path $ProgramRoot "tools") -Label "Ferramentas (NSSM)"
    Remove-NexusDirectory -Path (Join-Path $ProgramRoot "scripts") -Label "Scripts de operação"
    Remove-NexusDirectory -Path (Join-Path $ProgramRoot "app") -Label "Aplicação"
    Remove-NexusDirectory -Path (Join-Path $ProgramRoot "NexusTray") -Label "Bandeja"
    Remove-NexusDirectory -Path $NexusCaddyData -Label "Dados do Caddy (Nexus)"
    Remove-NexusDirectory -Path $CaddyData -Label "Dados legados do Caddy"

    Write-Log "C:\ProgramData\Nexus preservado (exceto caddy): banco, uploads, configuração, backups e logs."
    Write-Log "MySQL, Node.js e Git não foram desinstalados."

    if ($script:Failures -gt 0) {
        Write-Log "Desinstalação concluída com $($script:Failures) falha(s)."
        exit 1
    }
    Write-Log "Desinstalação concluída."
    exit 0
}
catch {
    Write-Log ("[ERRO] Desinstalação interrompida: {0}" -f $_.Exception.Message)
    exit 1
}
