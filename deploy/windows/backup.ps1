<#
.SYNOPSIS
    Backup do Nexus: banco, uploads e .env.

.DESCRIPTION
    Usa C:\ProgramData\Nexus\config\backup.cnf (criado pelo bootstrap) para o
    mysqldump. O dump é compactado em backups\db; uploads são copiados com
    robocopy e o .env vai para backups\config. Retorna código diferente de zero
    quando o dump falha.

.PARAMETER RetentionDays
    Dias de retenção para os arquivos de banco/.env (padrão 30).

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

if ($RetentionDays -lt 1) {
    Fail "RetentionDays deve ser maior que zero."
}

$AppDir = $script:NexusAppDir
$DataDir = $script:NexusDataDir
$BackupsDir = $script:NexusBackupsDir
$UploadsDir = $script:NexusUploadsDir
$ConfigDir = $script:NexusConfigDir
$BackupCnf = Join-Path $ConfigDir "backup.cnf"

if (-not (Test-Path -LiteralPath $BackupCnf)) {
    Fail "Arquivo de credenciais não encontrado: $BackupCnf. Rode a fase 2 do bootstrap."
}

$mysqlDump = Find-MysqldumpExe
$dbBackupDir = Join-Path $BackupsDir "db"
$uploadsBackupDir = Join-Path $BackupsDir "uploads"
$configBackupDir = Join-Path $BackupsDir "config"
foreach ($dir in @($dbBackupDir, $uploadsBackupDir, $configBackupDir)) {
    if (-not (Test-Path -LiteralPath $dir)) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
    }
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$sqlFile = Join-Path $dbBackupDir ("nexus_prod-" + $timestamp + ".sql")
$zipFile = Join-Path $dbBackupDir ("nexus_prod-" + $timestamp + ".zip")
$errFile = Join-Path $env:TEMP ("nexus-backup-" + [guid]::NewGuid().ToString("N") + ".err")
Write-Utf8NoBom -Path $errFile -Lines @("")
Protect-File -Path $errFile

try {
    Write-Step "Backup do Nexus ($timestamp)"

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
        Write-Warn "mysqldump falhou (código $($dump.ExitCode)). $detail"
        exit 1
    }
    if (-not (Test-Path -LiteralPath $sqlFile) -or (Get-Item -LiteralPath $sqlFile).Length -eq 0) {
        Write-Warn "O dump não gerou um arquivo válido."
        exit 1
    }

    Compress-Archive -LiteralPath $sqlFile -DestinationPath $zipFile -CompressionLevel Optimal -Force
    Remove-Item -LiteralPath $sqlFile -Force -ErrorAction SilentlyContinue
    Write-Ok "Banco: $zipFile"

    if (-not $SkipUploads) {
        if (-not (Test-Path -LiteralPath $UploadsDir)) {
            New-Item -ItemType Directory -Force -Path $UploadsDir | Out-Null
        }
        $robocopy = Join-Path $env:SystemRoot "System32\robocopy.exe"
        & $robocopy $UploadsDir $uploadsBackupDir /E /COPY:DAT /R:2 /W:2 /NP /NFL /NDL /NJH /NJS
        $copyCode = $LASTEXITCODE
        if ($copyCode -ge 8) {
            Write-Warn "robocopy falhou (código $copyCode) ao copiar uploads."
            exit 1
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
        Write-Warn "O .env da aplicação não foi encontrado; o backup está incompleto."
        exit 1
    }

    $cutoff = (Get-Date).AddDays(-$RetentionDays)
    Get-ChildItem -LiteralPath $dbBackupDir -Filter "*.zip" -File -ErrorAction SilentlyContinue |
        Where-Object { $_.LastWriteTime -lt $cutoff } |
        ForEach-Object { Remove-Item -LiteralPath $_.FullName -Force -ErrorAction SilentlyContinue }
    Get-ChildItem -LiteralPath $configBackupDir -Filter ".env-*" -File -ErrorAction SilentlyContinue |
        Where-Object { $_.LastWriteTime -lt $cutoff } |
        ForEach-Object { Remove-Item -LiteralPath $_.FullName -Force -ErrorAction SilentlyContinue }
    Write-Ok "Retenção aplicada: $RetentionDays dias."

    Write-Ok "Backup concluído."
    exit 0
}
finally {
    if (Test-Path -LiteralPath $errFile) {
        Remove-Item -LiteralPath $errFile -Force -ErrorAction SilentlyContinue
    }
    if (Test-Path -LiteralPath $sqlFile) {
        Remove-Item -LiteralPath $sqlFile -Force -ErrorAction SilentlyContinue
    }
}
