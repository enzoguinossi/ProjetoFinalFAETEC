#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Desinstala os serviços, tarefas e arquivos do Nexus no Windows.

.DESCRIPTION
    Para e remove os serviços NexusApp, NexusCaddy, NexusAgent e NexusMySQL84,
    remove as tarefas NexusTray e NexusBackup, encerra a bandeja e apaga o
    runtime embutido: C:\Program Files\Nexus\app, node, mysql, caddy, tools,
    scripts, payload, sql, NexusTray, NexusAgent e as versões antigas
    app.prev-*/app.failed-*. Também remove as regras de firewall do Nexus.

    C:\ProgramData\Nexus é PRESERVADO (mysql\data, uploads, configuração,
    backups, agent, agent.secret e logs). O MySQL antigo em
    C:\ProgramData\MySQL não é removido: os dados precisam de confirmação
    explícita do operador.
#>
[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

$ProgramRoot = "C:\Program Files\Nexus"
$DataRoot = "C:\ProgramData\Nexus"
$LogsDir = Join-Path $DataRoot "logs"
$CaddyData = "C:\ProgramData\Caddy"
$MySqlService = "NexusMySQL84"
$AgentService = "NexusAgent"
$MySqlDir = Join-Path $ProgramRoot "mysql"
$LegacyMySqlRoot = "C:\ProgramData\MySQL\MySQL Server 8.4"
$FirewallRuleNames = @("Nexus HTTP", "Nexus HTTPS", "Nexus MySQL (LAN)", "Nexus Next (LAN)", "Nexus Agent (LAN)")
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

function Test-AgentJobActive {
    # Consulta /v1/status antes de parar o agente: um job em andamento não pode
    # ser interrompido pela desinstalação.
    $secretPath = Join-Path $DataRoot "config\agent.secret"
    if (-not (Test-Path -LiteralPath $secretPath -PathType Leaf)) { return $false }
    try {
        $secret = ([System.IO.File]::ReadAllText($secretPath)).Trim()
    }
    catch {
        return $false
    }
    if (-not $secret) { return $false }

    try {
        $response = Invoke-WebRequest -Uri "http://127.0.0.1:3215/v1/status" -UseBasicParsing `
            -TimeoutSec 5 -Headers @{ Authorization = ("Bearer {0}" -f $secret) }
        $json = ([string]$response.Content).TrimStart() | ConvertFrom-Json
        if ($null -eq $json.current) { return $false }
        $status = [string]$json.current.status
        return ($status -eq "QUEUED" -or $status -eq "RUNNING")
    }
    catch {
        return $false
    }
}

function Stop-AgentService {
    # O NexusAgent é criado pelo sc.exe (não pelo NSSM): usa o SCM direto.
    $service = Get-Service -Name $AgentService -ErrorAction SilentlyContinue
    if (-not $service) {
        Write-Log "Serviço $AgentService não existe."
        return
    }
    if ($service.Status -eq "Stopped") {
        Write-Log "Serviço $AgentService já está parado."
        return
    }

    Write-Log "Parando serviço $AgentService..."
    Invoke-Native -Exe $ScExe -Arguments @("stop", $AgentService) | Out-Null

    $deadline = (Get-Date).AddSeconds(60)
    while ((Get-Date) -lt $deadline) {
        $current = Get-Service -Name $AgentService -ErrorAction SilentlyContinue
        if (-not $current -or $current.Status -eq "Stopped") { return }
        Start-Sleep -Seconds 1
    }
    Write-Log "[AVISO] O serviço $AgentService não parou em 60 segundos."
    $script:Failures++
}

function Remove-AgentService {
    $service = Get-Service -Name $AgentService -ErrorAction SilentlyContinue
    if (-not $service) {
        Write-Log "Serviço $AgentService já removido."
        return
    }

    Write-Log "Removendo serviço $AgentService..."
    $code = Invoke-Native -Exe $ScExe -Arguments @("delete", $AgentService)
    if ($code -ne 0) {
        Write-Log "[AVISO] Não foi possível remover o serviço $AgentService (código $code)."
        $script:Failures++
    }
}

function Stop-MySqlService {
    $service = Get-Service -Name $MySqlService -ErrorAction SilentlyContinue
    if (-not $service) {
        Write-Log "Serviço $MySqlService não existe."
        return
    }
    if ($service.Status -eq "Stopped") {
        Write-Log "Serviço $MySqlService já está parado."
        return
    }

    Write-Log "Parando serviço $MySqlService..."
    try {
        Stop-Service -Name $MySqlService -Force -ErrorAction Stop
    }
    catch {
        Write-Log "[AVISO] Falha ao parar $MySqlService`: $($_.Exception.Message)"
    }

    $deadline = (Get-Date).AddSeconds(60)
    while ((Get-Date) -lt $deadline) {
        $current = Get-Service -Name $MySqlService -ErrorAction SilentlyContinue
        if (-not $current -or $current.Status -eq "Stopped") { return }
        Start-Sleep -Seconds 1
    }
    Write-Log "[AVISO] O serviço $MySqlService não parou em 60 segundos."
    $script:Failures++
}

function Remove-MySqlService {
    $service = Get-Service -Name $MySqlService -ErrorAction SilentlyContinue
    if (-not $service) {
        Write-Log "Serviço $MySqlService já removido."
        return
    }

    Write-Log "Removendo serviço $MySqlService..."
    $code = Invoke-Native -Exe $ScExe -Arguments @("delete", $MySqlService)
    if ($code -ne 0) {
        Write-Log "[AVISO] Não foi possível remover o serviço $MySqlService (código $code)."
        $script:Failures++
    }
}

function Remove-NexusFirewallRules {
    if (-not (Get-Command Get-NetFirewallRule -ErrorAction SilentlyContinue)) {
        Write-Log "[AVISO] NetSecurity indisponível; regras de firewall mantidas."
        return
    }
    foreach ($name in $FirewallRuleNames) {
        $rules = @(Get-NetFirewallRule -DisplayName $name -ErrorAction SilentlyContinue)
        if ($rules.Count -eq 0) { continue }
        try {
            $rules | Remove-NetFirewallRule -Confirm:$false -ErrorAction Stop
            Write-Log "Regra de firewall removida: $name."
        }
        catch {
            Write-Log "[AVISO] Falha ao remover a regra ${name}: $($_.Exception.Message)"
            $script:Failures++
        }
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
    if (Test-AgentJobActive) {
        Write-Log "[ERRO] Há uma operação de backup/restauração em andamento no NexusAgent (job ativo)."
        Write-Log "Nada foi parado nem removido. Aguarde o job terminar e rode a desinstalação novamente."
        exit 1
    }

    # O Caddy não depende mais do app (só o app depende do MySQL).
    Stop-NexusService -Name "NexusCaddy"
    Stop-NexusService -Name "NexusApp"
    Stop-AgentService
    Stop-MySqlService

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
    Remove-AgentService
    Remove-MySqlService

    if ($script:Failures -gt 0) {
        Write-Log "[ERRO] Serviços ou tarefas não foram removidos; app, NexusTray, NexusAgent, versões antigas e binários do MySQL serão preservados."
        Write-Log "C:\ProgramData\Nexus preservado."
        exit 1
    }

    # Versões deixadas pelo atualizador (app.prev-*, app.failed-*, app.prev-manual-*).
    Get-ChildItem -LiteralPath $ProgramRoot -Directory -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -like "app.prev-*" -or $_.Name -like "app.failed-*" -or $_.Name -like "app.prev-manual-*" } |
        ForEach-Object { Remove-NexusDirectory -Path $_.FullName -Label ("Versão antiga " + $_.Name) }

    Remove-NexusDirectory -Path (Join-Path $ProgramRoot "caddy") -Label "Caddy"
    Remove-NexusDirectory -Path (Join-Path $ProgramRoot "tools") -Label "Ferramentas (NSSM)"
    Remove-NexusDirectory -Path (Join-Path $ProgramRoot "scripts") -Label "Scripts de operação"
    Remove-NexusDirectory -Path (Join-Path $ProgramRoot "payload") -Label "Payload do instalador"
    Remove-NexusDirectory -Path (Join-Path $ProgramRoot "sql") -Label "SQL do instalador"
    Remove-NexusDirectory -Path $MySqlDir -Label "Binários do MySQL dedicado"
    Remove-NexusDirectory -Path (Join-Path $ProgramRoot "node") -Label "Node.js portátil"
    Remove-NexusDirectory -Path (Join-Path $ProgramRoot "app") -Label "Aplicação"
    Remove-NexusDirectory -Path (Join-Path $ProgramRoot "NexusTray") -Label "Bandeja"
    Remove-NexusDirectory -Path (Join-Path $ProgramRoot "NexusAgent") -Label "Agente de backup"
    Remove-NexusDirectory -Path $CaddyData -Label "Dados legados do Caddy"
    Remove-NexusFirewallRules

    Write-Log "C:\ProgramData\Nexus preservado: mysql\data, uploads, configuração, backups, agent, agent.secret e logs."
    if (Test-Path -LiteralPath $LegacyMySqlRoot) {
        Write-Log "C:\ProgramData\MySQL\MySQL Server 8.4 preservado (dados do MySQL antigo; remova manualmente se não precisar)."
    }
    Write-Log "Node.js, MySQL e Git do sistema não foram desinstalados (o Nexus usava runtimes embutidos)."

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
