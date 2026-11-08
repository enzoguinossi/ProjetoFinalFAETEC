# Testa a API local do NexusAgent em modo console, com dados em um diretório
# temporário limpo. NÃO executa backup nem restauração reais: o único job
# iniciado usa um backup.ps1 stub (ProgramRoot temporário) que dorme e falha,
# só para exercitar o 409 e o ciclo de vida do job. Valida health, token,
# status, agenda, jobs, manifesto (hasUploads), restore e desligamento.
# Compatível com Windows PowerShell 5.1.
#
# Uso:
#   .\build.ps1            # gera dist\NexusAgent.exe
#   .\test-api.ps1         # sobe o agente na porta 3216 e testa
[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

$root = Join-Path $env:TEMP "nexus-agent-test"
$port = 3216
$base = "http://127.0.0.1:$port"

$exe = Join-Path $PSScriptRoot "dist\NexusAgent.exe"
if (-not (Test-Path -LiteralPath $exe)) {
    throw "NexusAgent.exe não encontrado em $exe. Rode build.ps1 antes."
}

# Porta ocupada tornaria o teste enganoso (responderia outro processo).
$busy = $false
try {
    $probe = [System.Net.Sockets.TcpClient]::new()
    $busy = $probe.ConnectAsync("127.0.0.1", $port).Wait(300)
    $probe.Close()
}
catch {
    $busy = $false
}
if ($busy) {
    throw "A porta $port já está em uso. Feche o outro agente antes de testar."
}

if (Test-Path -LiteralPath $root) { Remove-Item -LiteralPath $root -Recurse -Force }
New-Item -ItemType Directory -Force -Path $root | Out-Null

$secret = "test-secret-123"
[System.IO.File]::WriteAllText((Join-Path $root "agent.secret"), $secret)

# Agenda desabilitada antes de subir o agente: o agendador não pode disparar um
# backup real durante o teste (a agenda padrão é "todo dia às 02:00").
$agentDir = Join-Path $root "agent"
New-Item -ItemType Directory -Force -Path $agentDir | Out-Null
$seed = '{"enabled":false,"time":"02:00","weekdays":[0,1,2,3,4,5,6],"retentionDays":30,"includeUploads":true}'
[System.IO.File]::WriteAllText((Join-Path $agentDir "schedule.json"), $seed)

# A1: um job RUNNING no jobs.json não sobreviveu ao processo anterior. Ao subir,
# o agente precisa marcá-lo FAILED e publicar done:true no status.json.
$staleJob = '[{"id":"stale-job","type":"BACKUP","status":"RUNNING","percent":40,' +
    '"step":"Banco de dados","message":"executando","startedAt":"2026-01-01T10:00:00-03:00",' +
    '"finishedAt":null,"requestedBy":1,"fileName":null,"includeUploads":false,"logPath":null,' +
    '"steps":[{"name":"Pre-checagem","status":"done","message":""},' +
    '{"name":"Banco de dados","status":"running","message":"executando"}]}]'
[System.IO.File]::WriteAllText((Join-Path $agentDir "jobs.json"), $staleJob)

# Manifesto: um dump válido, mas sem snapshot de uploads em backups\uploads\<timestamp>.
$dbDir = Join-Path $root "backups\db"
New-Item -ItemType Directory -Force -Path $dbDir | Out-Null
$dummyBackup = "nexus_prod-20260101-000000.sql"
[System.IO.File]::WriteAllText((Join-Path $dbDir $dummyBackup), "SELECT 1;`r`n")

# Backup interrompido: o marcador irmão esconde o dump do manifesto e do restore.
$incompleteBackup = "nexus_prod-20260101-000001.zip"
[System.IO.File]::WriteAllText((Join-Path $dbDir $incompleteBackup), "PK")
[System.IO.File]::WriteAllText((Join-Path $dbDir ($incompleteBackup + ".incomplete")), "incompleto")

# ProgramRoot com um backup.ps1 stub: o job termina FAILED em segundos, mas
# nunca executa um backup de verdade (o script real não é chamado).
$programRoot = Join-Path $root "program"
$scriptsDir = Join-Path $programRoot "scripts"
New-Item -ItemType Directory -Force -Path $scriptsDir | Out-Null
$stub = @'
param(
    [int]$RetentionDays = 30,
    [switch]$SkipUploads,
    [switch]$NoRetention,
    [switch]$AgentProgress,
    [switch]$RequireMysql
)
if ($AgentProgress) { Write-Output "##PROGRESS|15|Banco de dados|stub de teste (sem backup real)" }
Start-Sleep -Seconds 4
exit 1
'@
[System.IO.File]::WriteAllText((Join-Path $scriptsDir "backup.ps1"), $stub)

$oldDataDir = $env:NEXUS_AGENT_DATA_DIR
$oldSecretFile = $env:NEXUS_AGENT_SECRET_FILE
$oldUrl = $env:NEXUS_AGENT_URL
$oldProgramRoot = $env:NEXUS_AGENT_PROGRAM_ROOT

$env:NEXUS_AGENT_DATA_DIR = $root
$env:NEXUS_AGENT_SECRET_FILE = (Join-Path $root "agent.secret")
$env:NEXUS_AGENT_URL = $base
$env:NEXUS_AGENT_PROGRAM_ROOT = $programRoot

$stdout = Join-Path $root "agent.out.log"
$stderr = Join-Path $root "agent.err.log"
$proc = Start-Process -FilePath $exe -ArgumentList "--console" -PassThru -NoNewWindow `
    -RedirectStandardOutput $stdout -RedirectStandardError $stderr

$headers = @{ Authorization = "Bearer $secret" }
$ok = $true

function Assert-Code {
    param(
        [Parameter(Mandatory = $true)][string]$Label,
        [Parameter(Mandatory = $true)][scriptblock]$Action,
        [Parameter(Mandatory = $true)][int]$Expected
    )
    try {
        & $Action | Out-Null
        "{0}: FALHOU (200 inesperado)" -f $Label
        $script:ok = $false
    }
    catch {
        $code = 0
        try { $code = [int]$_.Exception.Response.StatusCode } catch { $code = -1 }
        "{0}: {1}" -f $Label, $code
        if ($code -ne $Expected) { $script:ok = $false }
    }
}

try {
    $ready = $false
    for ($i = 0; $i -lt 40; $i++) {
        Start-Sleep -Milliseconds 250
        try {
            $health = Invoke-RestMethod -Uri "$base/v1/health" -Headers $headers -TimeoutSec 3
            $ready = $true
            break
        }
        catch { }
    }
    if (-not $ready) {
        $tail = ""
        if (Test-Path -LiteralPath $stderr) { $tail = (Get-Content -LiteralPath $stderr -Raw) }
        throw "agente não respondeu. stderr: $tail"
    }

    "HEALTH: status=$($health.status) version=$($health.version) mysql=$($health.mysql) agentDir=$($health.agentDir)"
    if ($health.status -ne "ok" -or $health.agentDir -ne $agentDir) { $ok = $false }

    Assert-Code -Label "SEM-TOKEN" -Expected 401 -Action {
        Invoke-WebRequest -Uri "$base/v1/health" -UseBasicParsing -TimeoutSec 5
    }

    $status = Invoke-RestMethod -Uri "$base/v1/status" -Headers $headers -TimeoutSec 5
    $currentLabel = if ($null -eq $status.current) { "none" } else { $status.current.id }
    $lastLabel = if ($null -eq $status.last) { "none" } else { $status.last.id }
    "STATUS: current=$currentLabel last=$lastLabel time=$($status.schedule.time) retention=$($status.schedule.retentionDays) uploads=$($status.schedule.includeUploads)"
    if ($null -ne $status.current) { $ok = $false }

    $bad = '{"enabled":true,"time":"25:99","weekdays":[0,0],"retentionDays":0,"includeUploads":true}'
    Assert-Code -Label "AGENDA-INVALIDA" -Expected 400 -Action {
        Invoke-WebRequest -Uri "$base/v1/schedule" -Method Put -Headers $headers `
            -ContentType "application/json" -Body $bad -UseBasicParsing -TimeoutSec 5
    }

    # L5: agenda sem nenhum dia é recusada pelo agente.
    $semDias = '{"enabled":true,"time":"02:00","weekdays":[],"retentionDays":30,"includeUploads":true}'
    Assert-Code -Label "AGENDA-SEM-DIAS" -Expected 400 -Action {
        Invoke-WebRequest -Uri "$base/v1/schedule" -Method Put -Headers $headers `
            -ContentType "application/json" -Body $semDias -UseBasicParsing -TimeoutSec 5
    }

    $good = '{"enabled":false,"time":"03:15","weekdays":[1,2,3,4,5],"retentionDays":45,"includeUploads":false}'
    $saved = Invoke-RestMethod -Uri "$base/v1/schedule" -Method Put -Headers $headers `
        -ContentType "application/json" -Body $good -TimeoutSec 5
    $again = Invoke-RestMethod -Uri "$base/v1/schedule" -Headers $headers -TimeoutSec 5
    "AGENDA-VALIDA: enabled=$($again.enabled) time=$($saved.time) weekdays=$($again.weekdays -join ',') retention=$($again.retentionDays) uploads=$($again.includeUploads)"
    if ($again.enabled -ne $false -or $again.time -ne "03:15" -or $again.retentionDays -ne 45 -or
        $again.includeUploads -ne $false -or -not ($again.weekdays -contains 5)) {
        $ok = $false
    }

    $jobs = Invoke-RestMethod -Uri "$base/v1/jobs?limit=10" -Headers $headers -TimeoutSec 5
    $stale = @($jobs.jobs) | Where-Object { $_.id -eq "stale-job" } | Select-Object -First 1
    "JOBS: $($jobs.jobs.Count) stale=$($stale.status)"
    if ($jobs.jobs.Count -ne 1 -or -not $stale -or $stale.status -ne "FAILED" -or
        $stale.message -notmatch "reinício") {
        $ok = $false
    }

    # A1: o status.json do progresso recebe done:true para a página não ficar presa.
    $statusFile = Join-Path $root "caddy\progresso\status.json"
    if (Test-Path -LiteralPath $statusFile) {
        $progress = Get-Content -LiteralPath $statusFile -Raw | ConvertFrom-Json
        "PROGRESSO: job=$($progress.jobId) done=$($progress.done) ok=$($progress.ok)"
        if ($progress.jobId -ne "stale-job" -or $progress.done -ne $true -or $progress.ok -ne $false) {
            $ok = $false
        }
    }
    else {
        "PROGRESSO: status.json ausente"
        $ok = $false
    }

    # B4: o dump existe, mas não há snapshot de uploads para o timestamp dele.
    $backups = Invoke-RestMethod -Uri "$base/v1/backups" -Headers $headers -TimeoutSec 5
    $backupInfo = @($backups.files) | Where-Object { $_.name -eq $dummyBackup } | Select-Object -First 1
    "BACKUPS: $($backups.files.Count) hasUploads=$($backupInfo.hasUploads)"
    if ($backups.files.Count -ne 1 -or -not $backupInfo -or $backupInfo.hasUploads -ne $false) {
        $ok = $false
    }

    Assert-Code -Label "JOB-INEXISTENTE" -Expected 404 -Action {
        Invoke-WebRequest -Uri "$base/v1/jobs/nao-existe" -Headers $headers -UseBasicParsing -TimeoutSec 5
    }

    # Só valida o nome antes de iniciar: nada é restaurado.
    $badRestore = '{"fileName":"../nexus_prod-20260101-000000.zip","includeUploads":true,"requestedBy":1}'
    Assert-Code -Label "RESTORE-NOME-INVALIDO" -Expected 400 -Action {
        Invoke-WebRequest -Uri "$base/v1/restore" -Method Post -Headers $headers `
            -ContentType "application/json" -Body $badRestore -UseBasicParsing -TimeoutSec 5
    }

    $missingRestore = '{"fileName":"nexus_prod-20260102-000000.zip","includeUploads":true,"requestedBy":1}'
    Assert-Code -Label "RESTORE-AUSENTE" -Expected 400 -Action {
        Invoke-WebRequest -Uri "$base/v1/restore" -Method Post -Headers $headers `
            -ContentType "application/json" -Body $missingRestore -UseBasicParsing -TimeoutSec 5
    }

    # Backup com marcador .incomplete: não aparece no manifesto nem pode ser restaurado.
    $incompleteRestore = '{"fileName":"nexus_prod-20260101-000001.zip","includeUploads":false,"requestedBy":1}'
    Assert-Code -Label "RESTORE-INCOMPLETO" -Expected 400 -Action {
        Invoke-WebRequest -Uri "$base/v1/restore" -Method Post -Headers $headers `
            -ContentType "application/json" -Body $incompleteRestore -UseBasicParsing -TimeoutSec 5
    }

    # B4: arquivo válido, mas sem snapshot de uploads → 400 antes de criar o job.
    $semUploads = '{"fileName":"nexus_prod-20260101-000000.sql","includeUploads":true,"requestedBy":1}'
    Assert-Code -Label "RESTORE-UPLOADS-AUSENTE" -Expected 400 -Action {
        Invoke-WebRequest -Uri "$base/v1/restore" -Method Post -Headers $headers `
            -ContentType "application/json" -Body $semUploads -UseBasicParsing -TimeoutSec 5
    }

    $afterRestore = Invoke-RestMethod -Uri "$base/v1/status" -Headers $headers -TimeoutSec 5
    if ($null -ne $afterRestore.current) {
        "STATUS: job criado indevidamente para restore inválido"
        $ok = $false
    }

    # 409 (um job por vez): o script stub segura o job por ~4 s, sem backup real.
    $started = Invoke-RestMethod -Uri "$base/v1/backup" -Method Post -Headers $headers `
        -ContentType "application/json" -Body '{"requestedBy":1}' -TimeoutSec 5
    $firstStep = @($started.job.steps)[0]
    "BACKUP-INICIADO: $($started.job.id) status=$($started.job.status) primeiroPasso=$($firstStep.status)"
    if ($started.job.status -ne "RUNNING" -or $firstStep.status -ne "running") { $ok = $false }

    Assert-Code -Label "BACKUP-JOB-ATIVO" -Expected 409 -Action {
        Invoke-WebRequest -Uri "$base/v1/backup" -Method Post -Headers $headers `
            -ContentType "application/json" -Body '{"requestedBy":1}' -UseBasicParsing -TimeoutSec 5
    }

    $finished = $false
    for ($i = 0; $i -lt 40; $i++) {
        Start-Sleep -Milliseconds 500
        $state = Invoke-RestMethod -Uri "$base/v1/status" -Headers $headers -TimeoutSec 5
        if ($null -eq $state.current -and $null -ne $state.last) {
            $finished = $true
            break
        }
    }
    if ($finished) {
        "JOB-FINAL: $($state.last.id) status=$($state.last.status)"
        if ($state.last.status -ne "FAILED") { $ok = $false }
    }
    else {
        "JOB-FINAL: não terminou no tempo esperado"
        $ok = $false
    }

    "ARQUIVO-AGENDA: $(Test-Path -LiteralPath (Join-Path $root 'agent\schedule.json'))"
    "ARQUIVO-JOBS: $(Test-Path -LiteralPath (Join-Path $root 'agent\jobs.json')) (true = job do stub registrado)"
}
finally {
    if ($proc -and -not $proc.HasExited) {
        Stop-Process -Id $proc.Id -Force
        $proc.WaitForExit(5000) | Out-Null
    }

    # L6: devolve as variáveis de ambiente originais.
    $env:NEXUS_AGENT_DATA_DIR = $oldDataDir
    $env:NEXUS_AGENT_SECRET_FILE = $oldSecretFile
    $env:NEXUS_AGENT_URL = $oldUrl
    $env:NEXUS_AGENT_PROGRAM_ROOT = $oldProgramRoot
}

if ($ok) { "RESULTADO: OK" } else { "RESULTADO: FALHOU"; exit 1 }
