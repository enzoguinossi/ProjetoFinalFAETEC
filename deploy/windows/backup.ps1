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

.PARAMETER RetentionDays
    Dias de retenção para banco/configuração (padrão 30).

.PARAMETER SkipUploads
    Não copia a pasta de uploads.
#>
[CmdletBinding()]
param(
    [int]$RetentionDays = 30,
    [switch]$SkipUploads
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "common.ps1")

function Stop-BackupFailure {
    param([Parameter(Mandatory = $true)][string]$Message)
    Write-Warn $Message
    Write-Host "BACKUP: FALHOU" -ForegroundColor Red
    exit 1
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

$mysqlDump = $null
$dbBackupDir = Join-Path $BackupsDir "db"
$uploadsBackupDir = Join-Path $BackupsDir "uploads"
$configBackupDir = Join-Path $BackupsDir "config"
foreach ($dir in @($dbBackupDir, $uploadsBackupDir, $configBackupDir)) {
    if (-not (Test-Path -LiteralPath $dir)) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
    }
}

$sqlFile = Join-Path $dbBackupDir ("nexus_prod-" + $timestamp + ".sql")
$zipFile = Join-Path $dbBackupDir ("nexus_prod-" + $timestamp + ".zip")
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
    # --no-tablespaces evita exigir o privilégio global PROCESS no MySQL 8.
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
        $robocopy = Join-Path $env:SystemRoot "System32\robocopy.exe"
        & $robocopy $UploadsDir $uploadsBackupDir /E /COPY:DAT /R:2 /W:2 /NP /NFL /NDL /NJH /NJS
        $copyCode = $LASTEXITCODE
        if ($copyCode -ge 8) {
            Stop-BackupFailure "robocopy falhou (código $copyCode) ao copiar uploads."
        }
        Write-Ok "Uploads: $uploadsBackupDir"
    }
    else {
        Write-Warn "Cópia de uploads ignorada (-SkipUploads)."
    }

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

    $cutoff = (Get-Date).AddDays(-$RetentionDays)
    Get-ChildItem -LiteralPath $dbBackupDir -File -ErrorAction SilentlyContinue |
        Where-Object { ($_.Extension -in @(".zip", ".sql")) -and $_.LastWriteTime -lt $cutoff } |
        ForEach-Object { Remove-Item -LiteralPath $_.FullName -Force -ErrorAction SilentlyContinue }
    Get-ChildItem -LiteralPath $configBackupDir -File -ErrorAction SilentlyContinue |
        Where-Object { ($_.Name -like ".env-*" -or $_.Name -like "Caddyfile-*") -and $_.LastWriteTime -lt $cutoff } |
        ForEach-Object { Remove-Item -LiteralPath $_.FullName -Force -ErrorAction SilentlyContinue }
    Write-Ok "Retenção aplicada: $RetentionDays dias."

    Write-Ok "Backup concluído."
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
