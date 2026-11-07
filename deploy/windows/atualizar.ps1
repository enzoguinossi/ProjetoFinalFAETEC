#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Atualiza o Nexus a partir de um pacote de atualização (sem Git).

.DESCRIPTION
    O pacote contém a aplicação standalone (app.zip) e o SQL de produção
    (schema.sql/seed.sql/migracoes). O atualizador faz backup, para o
    NexusCaddy/NexusApp, troca a pasta da aplicação, preserva o .env, aplica o
    SQL com mysql.exe, sobe os serviços e valida com smoke test. Em caso de
    falha, a pasta anterior volta a ser usada; o banco NÃO é restaurado
    automaticamente.

    Layout do pacote (-Package):
        <pacote>\app\app.zip    (ou <pacote>\app.zip)
        <pacote>\sql\schema.sql
        <pacote>\sql\seed.sql
        <pacote>\sql\migracoes\001-unidades-pct10-cx50.sql

.PARAMETER Package
    Diretório do pacote de atualização (app\ + sql\).

.PARAMETER AppZip
    Caminho alternativo do app.zip (quando não se usa -Package).

.PARAMETER Sql
    Diretório do SQL de produção. Padrão: <pacote>\sql, .\sql ou payload\sql.

.PARAMETER Version
    Versão da nova aplicação (ex.: 12.02.11.2026). Padrão: lida do package.json
    dentro do app.zip.

.PARAMETER SkipBackup
    Não executa o backup antes da atualização (não recomendado).
#>
[CmdletBinding()]
param(
    [string]$Package = "",
    [string]$AppZip = "",
    [string]$Sql = "",
    [string]$Version = "",
    [switch]$SkipBackup
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "common.ps1")
Assert-Admin
Update-SessionPath

$ProgramRoot = $script:NexusProgramRoot
$AppDir = $script:NexusAppDir
$DataDir = $script:NexusDataDir
$LogsDir = $script:NexusLogsDir
$ConfigDir = $script:NexusConfigDir
$BackupsDir = $script:NexusBackupsDir
$UploadsDir = $script:NexusUploadsDir
$EnvPath = Join-Path $AppDir ".env"
$BackupCnf = Join-Path $ConfigDir "backup.cnf"
$MySqlExe = Join-Path $script:NexusMySqlDir "bin\mysql.exe"
$PsExe = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"

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

function Get-AppZipVersion {
    param([Parameter(Mandatory = $true)][string]$Path)
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $archive = $null
    try {
        $archive = [System.IO.Compression.ZipFile]::OpenRead($Path)
        $entry = $archive.Entries |
            Where-Object { $_.FullName -eq "package.json" } |
            Select-Object -First 1
        if (-not $entry) { return "" }
        $reader = New-Object System.IO.StreamReader -ArgumentList $entry.Open()
        try {
            $package = $reader.ReadToEnd() | ConvertFrom-Json
            return ([string]$package.version).Trim()
        }
        finally {
            $reader.Dispose()
        }
    }
    catch {
        return ""
    }
    finally {
        if ($archive) { $archive.Dispose() }
    }
}

function Assert-AppZip {
    param([Parameter(Mandatory = $true)][string]$Path)
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $archive = $null
    try {
        $archive = [System.IO.Compression.ZipFile]::OpenRead($Path)
        $names = @($archive.Entries | ForEach-Object { $_.FullName })
    }
    catch {
        throw "app.zip inválido ($Path): $($_.Exception.Message)"
    }
    finally {
        if ($archive) { $archive.Dispose() }
    }
    if (-not ($names | Where-Object { $_ -eq "server.js" } | Select-Object -First 1)) {
        throw "O app.zip não contém server.js na raiz. Gere o pacote com npm run package:standalone."
    }
}

function Resolve-SqlDir {
    param([string]$Explicit)
    $candidates = @()
    if ($Explicit) { $candidates += $Explicit }
    if ($Package) { $candidates += (Join-Path $Package "sql") }
    $candidates += @(
        (Join-Path $PSScriptRoot "sql"),
        (Join-Path $PSScriptRoot "payload\sql"),
        (Join-Path $PSScriptRoot "..\..\deploy\sql")
    )
    foreach ($candidate in $candidates) {
        if (Test-Path -LiteralPath (Join-Path $candidate "schema.sql") -PathType Leaf) {
            return (Resolve-Path -LiteralPath $candidate).Path
        }
    }
    throw "SQL de produção não encontrado. Informe -Sql com a pasta que contém schema.sql/seed.sql."
}

function Stop-NexusCaddy {
    $service = Get-Service -Name "NexusCaddy" -ErrorAction SilentlyContinue
    if ($service -and $service.Status.ToString() -ne "Stopped") {
        Stop-Service -Name "NexusCaddy" -Force
        if (-not (Wait-ServiceState -Name "NexusCaddy" -Status "Stopped" -TimeoutSeconds 60)) {
            throw "O serviço NexusCaddy não parou."
        }
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

function Wait-NexusHttps {
    param(
        [Parameter(Mandatory = $true)][string]$Hostname,
        [int]$TimeoutSeconds = 60
    )
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    $last = $null
    do {
        $last = Test-Health -Url ("https://{0}/login" -f $Hostname)
        if ($last.Ok) { return $last }
        Start-Sleep -Seconds 2
    } while ((Get-Date) -lt $deadline)
    return $last
}

# --- Pacote -----------------------------------------------------------------
if (-not $Package -and -not $AppZip) {
    Fail "Informe -Package (pasta com app\ e sql\) ou -AppZip (caminho do app.zip)."
}

$PackageRoot = ""
if ($Package) {
    if (-not (Test-Path -LiteralPath $Package -PathType Container)) {
        Fail "Pacote não encontrado: $Package"
    }
    $PackageRoot = (Resolve-Path -LiteralPath $Package).Path
    if (-not $AppZip) {
        $candidates = @(
            (Join-Path $PackageRoot "app\app.zip"),
            (Join-Path $PackageRoot "app.zip")
        )
        foreach ($candidate in $candidates) {
            if (Test-Path -LiteralPath $candidate -PathType Leaf) {
                $AppZip = $candidate
                break
            }
        }
    }
}
if (-not $AppZip) {
    Fail "app.zip não encontrado no pacote. Esperado app\app.zip ou app.zip."
}
if (-not (Test-Path -LiteralPath $AppZip -PathType Leaf)) {
    Fail "app.zip não encontrado: $AppZip"
}
$AppZip = (Resolve-Path -LiteralPath $AppZip).Path

Assert-AppZip -Path $AppZip

$sqlDir = ""
try {
    $sqlDir = Resolve-SqlDir -Explicit $Sql
}
catch {
    Fail $_.Exception.Message
}

if (-not $Version) {
    $Version = Get-AppZipVersion -Path $AppZip
}
if (-not $Version) {
    $Version = "manual-" + (Get-Date -Format "yyyyMMdd-HHmmss")
}

if (-not (Test-Path -LiteralPath (Join-Path $AppDir "server.js"))) {
    Fail "Aplicação não encontrada em $AppDir. Rode o bootstrap primeiro."
}
if (-not (Get-Service -Name "NexusApp" -ErrorAction SilentlyContinue)) {
    Fail "O serviço NexusApp não existe. Rode o bootstrap primeiro."
}
if (-not (Test-Path -LiteralPath $MySqlExe -PathType Leaf)) {
    Fail "mysql.exe não encontrado em $MySqlExe."
}

$hostname = Get-NexusHostname
if (-not $hostname) {
    Fail "Hostname não encontrado no bootstrap/Caddyfile. Não é possível rodar o smoke test."
}

$logFile = Join-Path $LogsDir ("deploy-" + (ConvertTo-SafeName $Version) + ".log")
Start-NexusTranscript -Path $logFile

$previousDir = ""
$failedDir = ""
$oldAppMoved = $false

function Get-CurrentAppVersion {
    $packagePath = Join-Path $AppDir "package.json"
    if (-not (Test-Path -LiteralPath $packagePath -PathType Leaf)) { return "desconhecida" }
    try {
        return [string](Get-Content -LiteralPath $packagePath -Raw -Encoding UTF8 | ConvertFrom-Json).version
    }
    catch {
        return "desconhecida"
    }
}

try {
    Write-Step "Atualização do Nexus para $Version (pacote standalone)"
    Write-Ok "Log: $logFile"
    Write-Ok "Aplicação: $AppZip"
    Write-Ok "SQL: $sqlDir"

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

    $currentVersion = Get-CurrentAppVersion
    $previousDir = Join-Path $ProgramRoot ("app.prev-" + (ConvertTo-SafeName $currentVersion))
    if (Test-Path -LiteralPath $previousDir) {
        $previousDir = Join-Path $ProgramRoot ("app.prev-" + (ConvertTo-SafeName $currentVersion) + "-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
    }
    $failedDir = Join-Path $ProgramRoot ("app.failed-" + (ConvertTo-SafeName $Version) + "-" + (Get-Date -Format "yyyyMMdd-HHmmss"))

    Write-Ok "Versão atual: $currentVersion"
    Write-Ok "Parando NexusCaddy..."
    Stop-NexusCaddy
    Write-Ok "Parando NexusApp e liberando a porta 3000..."
    if (-not (Stop-NexusAppProcess)) {
        throw "Não foi possível parar o NexusApp/liberar a porta 3000."
    }

    Write-Ok "Movendo a aplicação atual para $previousDir..."
    Move-Item -LiteralPath $AppDir -Destination $previousDir -ErrorAction Stop
    $oldAppMoved = $true

    Write-Ok "Extraindo a nova aplicação..."
    New-Item -ItemType Directory -Force -Path $AppDir | Out-Null
    Expand-Archive -LiteralPath $AppZip -DestinationPath $AppDir -Force -ErrorAction Stop
    if (-not (Test-Path -LiteralPath (Join-Path $AppDir "server.js") -PathType Leaf)) {
        throw "O app.zip não contém server.js na raiz."
    }

    $previousEnv = Join-Path $previousDir ".env"
    if (-not (Test-Path -LiteralPath $previousEnv -PathType Leaf)) {
        throw "O .env da instalação anterior não foi encontrado."
    }
    Suspend-Transcript
    try {
        Copy-Item -LiteralPath $previousEnv -Destination $EnvPath -Force
        Set-EnvFile -Path $EnvPath -Key "UPLOADS_DIR" -Value $UploadsDir -ReadIdentities @("S-1-5-20")
        Set-EnvFile -Path $EnvPath -Key "NODE_ENV" -Value "production" -ReadIdentities @("S-1-5-20")
        Set-EnvFile -Path $EnvPath -Key "PORT" -Value "3000" -ReadIdentities @("S-1-5-20")
        Set-EnvFile -Path $EnvPath -Key "HOSTNAME" -Value "127.0.0.1" -ReadIdentities @("S-1-5-20")
    }
    finally {
        Resume-Transcript
    }
    Protect-File -Path $EnvPath -ReadIdentities @("S-1-5-20")
    Write-Ok ".env restaurado com ACL restrita e UPLOADS_DIR garantido."

    $appPasswordPlain = Get-CnfValue -Path $BackupCnf -Section "client" -Key "password"
    if (-not $appPasswordPlain) {
        throw "Senha de nexus_app não encontrada em $BackupCnf."
    }
    $appSecure = ConvertTo-SecureString -String $appPasswordPlain -AsPlainText -Force
    $appPasswordPlain = $null
    try {
        Write-Ok "Aplicando o SQL de produção (migração/seed)..."
        & (Join-Path $PSScriptRoot "aplicar-sql.ps1") `
            -MysqlExe $MySqlExe `
            -AppPassword $appSecure `
            -Database "nexus_prod" `
            -Mode Auto `
            -Port $script:NexusMySqlPort `
            -SqlDir $sqlDir
        if ($LASTEXITCODE -ne 0) {
            throw "A aplicação do SQL falhou (código $LASTEXITCODE)."
        }
    }
    finally {
        $appSecure = $null
    }

    $cacheDir = Join-Path $AppDir ".next\cache"
    if (-not (Test-Path -LiteralPath $cacheDir)) {
        New-Item -ItemType Directory -Force -Path $cacheDir | Out-Null
    }
    Set-AclModify -Path $cacheDir
    Set-AclReadExecute -Path $AppDir
    Write-Ok "ACLs aplicadas."

    Write-Ok "Iniciando NexusApp..."
    Start-NexusApp
    $health = Wait-NexusHealth
    if (-not $health.Ok) {
        throw "O health local não respondeu 200 com db=true."
    }
    Write-Ok "Health local OK (versão $($health.Versao))."

    Write-Ok "Iniciando NexusCaddy..."
    Start-NexusCaddy
    $https = Wait-NexusHttps -Hostname $hostname
    if (-not $https.Ok) {
        throw "HTTPS https://$hostname/login não respondeu 200."
    }
    Write-Ok "HTTPS https://$hostname/login OK."

    Write-Ok "Executando smoke test..."
    & $PsExe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "smoke.ps1") `
        -Hostname $hostname -ExpectedVersion $Version
    if ($LASTEXITCODE -ne 0) {
        throw "O smoke test falhou."
    }

    Write-Ok "Atualização para $Version concluída e validada."

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

    try { Stop-NexusCaddy } catch { Write-Warn "Não foi possível parar o NexusCaddy: $($_.Exception.Message)" }
    try {
        if (-not (Stop-NexusAppProcess)) {
            Write-Warn "Não foi possível parar o NexusApp/liberar a porta 3000."
        }
    }
    catch { Write-Warn "Não foi possível parar o NexusApp: $($_.Exception.Message)" }

    if ($oldAppMoved -and (Test-Path -LiteralPath $AppDir)) {
        Write-Warn "Movendo a versão com falha para $failedDir..."
        try {
            Move-Item -LiteralPath $AppDir -Destination $failedDir -Force -ErrorAction Stop
        }
        catch {
            Write-Warn "Não foi possível mover a versão com falha: $($_.Exception.Message)"
        }
    }

    if ($oldAppMoved -and (Test-Path -LiteralPath $previousDir)) {
        Write-Warn "Restaurando a versão anterior..."
        try {
            Move-Item -LiteralPath $previousDir -Destination $AppDir -Force -ErrorAction Stop
        }
        catch {
            Write-Warn "Não foi possível restaurar a versão anterior: $($_.Exception.Message)"
        }
    }

    try {
        Write-Ok "Religando NexusApp..."
        Start-NexusApp
        $rollbackHealth = Wait-NexusHealth
        if ($rollbackHealth.Ok) {
            Write-Ok "NexusApp respondendo (versão $($rollbackHealth.Versao))."
        }
        else {
            Write-Warn "O NexusApp foi iniciado, mas o health ainda não respondeu."
        }

        Write-Ok "Religando NexusCaddy..."
        Start-NexusCaddy
        $rollbackHttps = Wait-NexusHttps -Hostname $hostname
        if ($rollbackHttps.Ok) {
            Write-Ok "HTTPS https://$hostname/login restaurado."
        }
        else {
            Write-Warn "O NexusCaddy foi iniciado, mas o HTTPS ainda não respondeu."
        }
    }
    catch {
        Write-Warn "Os serviços não foram religados completamente: $($_.Exception.Message)"
    }

    Write-Host ""
    if (Test-Path -LiteralPath $failedDir) {
        Write-Host "A versão nova ficou em $failedDir para diagnóstico." -ForegroundColor Yellow
    }
    else {
        Write-Host "A versão em produção não foi alterada." -ForegroundColor Yellow
    }
    Write-Host "O banco NÃO foi restaurado automaticamente." -ForegroundColor Yellow
    Write-Host "Se o SQL alterou dados, restaure o dump mais recente de $BackupsDir\db." -ForegroundColor Yellow
    Write-Host "Log desta execução: $logFile" -ForegroundColor Yellow
    exit 1
}
finally {
    Stop-NexusTranscript
}
