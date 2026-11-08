<#
.SYNOPSIS
    Backup do Nexus: banco, uploads, .env e Caddyfile.

.DESCRIPTION
    Usa C:\ProgramData\Nexus\config\backup.cnf (criado pelo bootstrap) para o
    mysqldump. O dump é compactado em backups\db; uploads são copiados com
    robocopy e o .env/Caddyfile vão para backups\config. O log fica em
    C:\ProgramData\Nexus\logs\backup-<timestamp>.log. Retorna código diferente
    de zero quando o backup falha.

    Dumps maiores que ~1,8 GB são mantidos como .sql: o Compress-Archive do
    Windows PowerShell 5.1 não lida com arquivos acima do limite prático de 2 GB.
    Enquanto o backup roda, um marcador <dump>.incomplete fica ao lado do arquivo;
    o NexusAgent ignora dumps com marcador e ele só sai no sucesso final.

.PARAMETER RetentionDays
    Dias de retenção para banco/configuração (padrão 30).

.PARAMETER SkipUploads
    Não copia a pasta de uploads.

.PARAMETER NoRetention
    Não aplica retenção: preserva dumps, configurações e snapshots de uploads.
    Usado pelo NexusAgent no backup de segurança que antecede uma restauração,
    para não apagar o backup escolhido pelo operador.

.PARAMETER AgentProgress
    Emite linhas "##PROGRESS|percentual|etapa|mensagem" no stdout para o
    NexusAgent acompanhar o andamento. Sem o switch, a saída não muda.

.PARAMETER RequireMysql
    Falha (código 1) quando o MySQL está parado, em vez de sair 0 "ignorado".
    Usado pelo NexusAgent; a tarefa agendada antiga não passa o switch.
#>
[CmdletBinding()]
param(
    [int]$RetentionDays = 30,
    [switch]$SkipUploads,
    [switch]$NoRetention,
    [switch]$AgentProgress,
    [switch]$RequireMysql
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "common.ps1")

function Stop-BackupFailure {
    param([Parameter(Mandatory = $true)][string]$Message)
    Write-Warn $Message
    Write-Host "BACKUP: FALHOU" -ForegroundColor Red
    exit 1
}

function Write-BackupProgress {
    param(
        [Parameter(Mandatory = $true)][int]$Percent,
        [Parameter(Mandatory = $true)][string]$Step,
        [string]$Message = ""
    )
    if (-not $AgentProgress) { return }
    $cleanStep = ($Step -replace '[\r\n|]', ' ').Trim()
    $cleanMessage = ($Message -replace '[\r\n|]', ' ').Trim()
    Write-Host ("##PROGRESS|{0}|{1}|{2}" -f $Percent, $cleanStep, $cleanMessage)
}

if ($RetentionDays -lt 1) {
    Stop-BackupFailure "RetentionDays deve ser maior que zero."
}

$AppDir = $script:NexusAppDir
$DataDir = $script:NexusDataDir
$BackupsDir = $script:NexusBackupsDir
$UploadsDir = $script:NexusUploadsDir
$ConfigDir = $script:NexusConfigDir
$LogsDir = $script:NexusLogsDir
$BackupCnf = Join-Path $ConfigDir "backup.cnf"

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$logPath = Join-Path $LogsDir ("backup-" + $timestamp + ".log")
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

# Com o Nexus encerrado (vencedor 1A), a tarefa diária não falha: apenas registra.
Write-BackupProgress 5 "Pre-checagem" "Verificando MySQL e credenciais"
$mysqlService = Get-Service -Name $script:NexusMySqlService -ErrorAction SilentlyContinue
if (-not $mysqlService -or $mysqlService.Status.ToString() -ne "Running") {
    if ($RequireMysql) {
        Stop-BackupFailure "MySQL parado; backup não executado (serviço $($script:NexusMySqlService))."
    }
    Write-Warn "MySQL parado; backup ignorado (serviço $($script:NexusMySqlService))."
    Write-Host "BACKUP: OK (ignorado)" -ForegroundColor Yellow
    if ($transcriptActive) {
        try { Stop-Transcript | Out-Null } catch { }
    }
    exit 0
}

$mysqlDump = $null
$dbBackupDir = Join-Path $BackupsDir "db"
$uploadsBackupRoot = Join-Path $BackupsDir "uploads"
# B4: um snapshot por backup, com o mesmo timestamp do dump.
$uploadsSnapshotDir = Join-Path $uploadsBackupRoot $timestamp
$configBackupDir = Join-Path $BackupsDir "config"
foreach ($dir in @($dbBackupDir, $uploadsBackupRoot, $configBackupDir)) {
    if (-not (Test-Path -LiteralPath $dir)) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
    }
}

$sqlFile = Join-Path $dbBackupDir ("nexus_prod-" + $timestamp + ".sql")
$zipFile = Join-Path $dbBackupDir ("nexus_prod-" + $timestamp + ".zip")
# Marcadores irmãos: enquanto existirem, o dump (zip ou sql) não aparece no
# manifesto do agente nem pode ser escolhido para restauração. Só são removidos
# no sucesso final do backup.
$zipMarker = $zipFile + ".incomplete"
$sqlMarker = $sqlFile + ".incomplete"
$errFile = Join-Path $env:TEMP ("nexus-backup-" + [guid]::NewGuid().ToString("N") + ".err")
$keepSql = $false
Write-Utf8NoBom -Path $errFile -Lines @("")
Protect-File -Path $errFile

try {
    Write-Step "Backup do Nexus ($timestamp)"
    Write-Host "Log: $logPath" -ForegroundColor DarkGray

    if (-not (Test-Path -LiteralPath $BackupCnf)) {
        Stop-BackupFailure "Arquivo de credenciais não encontrado: $BackupCnf. Rode a fase 2 do bootstrap."
    }
    $cnfPort = Get-CnfValue -Path $BackupCnf -Section "client" -Key "port"
    if ([string]$cnfPort -ne [string]$script:NexusMySqlPort) {
        Stop-BackupFailure "O backup.cnf usa a porta '$cnfPort'; esperado $($script:NexusMySqlPort). Rode a fase 2 do bootstrap."
    }

    $mysqlDump = Find-MysqldumpExe
    # A partir daqui qualquer falha deixa o marcador ao lado do dump: o agente
    # não lista um artefato parcial como restaurável.
    Write-Utf8NoBom -Path $zipMarker -Lines @("backup em andamento")
    Write-Utf8NoBom -Path $sqlMarker -Lines @("backup em andamento")
    # --no-tablespaces evita exigir o privilégio global PROCESS no MySQL 8.
    Write-BackupProgress 15 "Banco de dados" "Gerando dump do banco nexus_prod"
    $dumpArgs = "--defaults-extra-file=`"$BackupCnf`" --single-transaction --routines --triggers --no-tablespaces --default-character-set=utf8mb4 --databases nexus_prod --result-file=`"$sqlFile`""
    $dump = Start-Process -FilePath $mysqlDump -ArgumentList $dumpArgs `
        -RedirectStandardError $errFile -Wait -PassThru -NoNewWindow
    if ($dump.ExitCode -ne 0) {
        $detail = ""
        if (Test-Path -LiteralPath $errFile) {
            $detail = ([string](Get-Content -LiteralPath $errFile -Raw -ErrorAction SilentlyContinue)).Trim()
            # Nunca ecoar uma linha de credencial do mysqldump.
            $detail = [regex]::Replace($detail, '(?im)^.*(password|identified\s+by).*$', '[credencial omitida]')
        }
        Stop-BackupFailure "mysqldump falhou (código $($dump.ExitCode)). $detail"
    }
    if (-not (Test-Path -LiteralPath $sqlFile) -or (Get-Item -LiteralPath $sqlFile).Length -eq 0) {
        Stop-BackupFailure "O dump não gerou um arquivo válido."
    }

    $sqlSize = (Get-Item -LiteralPath $sqlFile).Length
    $largeDumpLimit = 1800 * 1MB
    Write-BackupProgress 35 "Compactacao" "Compactando o dump do banco"
    if ($sqlSize -ge $largeDumpLimit) {
        $keepSql = $true
        Write-Warn ("Dump de {0:N2} GB; mantendo o .sql sem compactar (limite do Compress-Archive no PowerShell 5.1)." -f ($sqlSize / 1GB))
        Write-Ok "Banco: $sqlFile"
    }
    else {
        Compress-Archive -LiteralPath $sqlFile -DestinationPath $zipFile -CompressionLevel Optimal -Force
        Remove-Item -LiteralPath $sqlFile -Force -ErrorAction SilentlyContinue
        Write-Ok "Banco: $zipFile"
    }

    if (-not $SkipUploads) {
        if (-not (Test-Path -LiteralPath $UploadsDir)) {
            New-Item -ItemType Directory -Force -Path $UploadsDir | Out-Null
        }
        if (-not (Test-Path -LiteralPath $uploadsSnapshotDir)) {
            New-Item -ItemType Directory -Force -Path $uploadsSnapshotDir | Out-Null
        }
        Write-BackupProgress 70 "Uploads" "Copiando uploads"
        $robocopy = Join-Path $env:SystemRoot "System32\robocopy.exe"
        & $robocopy $UploadsDir $uploadsSnapshotDir /E /COPY:DAT /R:2 /W:2 /NP /NFL /NDL /NJH /NJS
        $copyCode = $LASTEXITCODE
        if ($copyCode -ge 8) {
            Stop-BackupFailure "robocopy falhou (código $copyCode) ao copiar uploads."
        }
        Write-Ok "Uploads: $uploadsSnapshotDir"
    }
    else {
        Write-Warn "Cópia de uploads ignorada (-SkipUploads); nenhum snapshot foi criado."
    }

    Write-BackupProgress 85 "Configuracao" "Copiando .env e Caddyfile"
    $envSource = Join-Path $AppDir ".env"
    if (Test-Path -LiteralPath $envSource) {
        $envTarget = Join-Path $configBackupDir (".env-" + $timestamp)
        Copy-Item -LiteralPath $envSource -Destination $envTarget -Force
        Protect-File -Path $envTarget
        Write-Ok "Configuração: $envTarget"
    }
    else {
        Stop-BackupFailure "O .env da aplicação não foi encontrado; o backup está incompleto."
    }

    $caddyfileSource = Join-Path $ConfigDir "Caddyfile"
    if (Test-Path -LiteralPath $caddyfileSource) {
        $caddyfileTarget = Join-Path $configBackupDir ("Caddyfile-" + $timestamp)
        Copy-Item -LiteralPath $caddyfileSource -Destination $caddyfileTarget -Force
        Protect-File -Path $caddyfileTarget
        Write-Ok "Configuração: $caddyfileTarget"
    }
    else {
        Write-Warn "O Caddyfile não foi encontrado; o backup está incompleto."
    }

    if ($NoRetention) {
        Write-BackupProgress 95 "Retencao" "Retenção desativada (-NoRetention)"
        Write-Ok "Retenção ignorada (-NoRetention)."
    }
    else {
        $cutoff = (Get-Date).AddDays(-$RetentionDays)
        Write-BackupProgress 95 "Retencao" "Aplicando retenção de $RetentionDays dias"
        $oldDumps = @(Get-ChildItem -LiteralPath $dbBackupDir -File -ErrorAction SilentlyContinue |
            Where-Object { ($_.Extension -in @(".zip", ".sql")) -and $_.LastWriteTime -lt $cutoff })
        foreach ($oldDump in $oldDumps) {
            Remove-Item -LiteralPath $oldDump.FullName -Force -ErrorAction SilentlyContinue
            # O marcador sai junto com o dump; sozinho ele esconderia um novo
            # arquivo de mesmo nome (não ocorre: o nome tem timestamp).
            Remove-Item -LiteralPath ($oldDump.FullName + ".incomplete") -Force -ErrorAction SilentlyContinue
        }
        Get-ChildItem -LiteralPath $configBackupDir -File -ErrorAction SilentlyContinue |
            Where-Object { ($_.Name -like ".env-*" -or $_.Name -like "Caddyfile-*") -and $_.LastWriteTime -lt $cutoff } |
            ForEach-Object { Remove-Item -LiteralPath $_.FullName -Force -ErrorAction SilentlyContinue }
        # Snapshot de uploads sem dump correspondente é órfão (dump apagado,
        # backup falho ou nome divergente): pode sair em qualquer idade. O dump
        # sem snapshot é legítimo (-SkipUploads) e por isso NÃO é podado.
        $liveDumps = @(Get-ChildItem -LiteralPath $dbBackupDir -File -ErrorAction SilentlyContinue |
            Where-Object {
                ($_.Extension -in @(".zip", ".sql")) -and
                -not (Test-Path -LiteralPath ($_.FullName + ".incomplete"))
            } |
            ForEach-Object { $_.BaseName })
        # Só os snapshots <timestamp> são podados: o diretório raiz antigo
        # (backups\uploads com os arquivos soltos) é preservado como legado.
        Get-ChildItem -LiteralPath $uploadsBackupRoot -Directory -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -match '^\d{8}-\d{6}$' } |
            ForEach-Object {
                $dumpName = "nexus_prod-" + $_.Name
                $orphan = ($_.Name -ne $timestamp) -and -not ($liveDumps -contains $dumpName)
                if ($orphan -or $_.LastWriteTime -lt $cutoff) {
                    Remove-Item -LiteralPath $_.FullName -Recurse -Force -ErrorAction SilentlyContinue
                }
            }
        # Marcador sem arquivo irmão (resto de falha antiga) é lixo seguro.
        Get-ChildItem -LiteralPath $dbBackupDir -File -Filter "*.incomplete" -ErrorAction SilentlyContinue |
            ForEach-Object {
                $target = $_.FullName.Substring(0, $_.FullName.Length - ".incomplete".Length)
                if (-not (Test-Path -LiteralPath $target)) {
                    Remove-Item -LiteralPath $_.FullName -Force -ErrorAction SilentlyContinue
                }
            }
        Write-Ok "Retenção aplicada (db, config e snapshots de uploads): $RetentionDays dias."
    }

    # Só o sucesso final publica o dump no manifesto do agente.
    foreach ($marker in @($zipMarker, $sqlMarker)) {
        if (Test-Path -LiteralPath $marker) {
            Remove-Item -LiteralPath $marker -Force -ErrorAction Stop
        }
    }

    Write-Ok "Backup concluído."
    Write-BackupProgress 100 "Concluido" "Backup concluído"
    Write-Host "BACKUP: OK" -ForegroundColor Green
    exit 0
}
finally {
    if (Test-Path -LiteralPath $errFile) {
        Remove-Item -LiteralPath $errFile -Force -ErrorAction SilentlyContinue
    }
    if (-not $keepSql -and (Test-Path -LiteralPath $sqlFile)) {
        Remove-Item -LiteralPath $sqlFile -Force -ErrorAction SilentlyContinue
    }
    if ($transcriptActive) {
        try { Stop-Transcript | Out-Null } catch { }
    }
}
