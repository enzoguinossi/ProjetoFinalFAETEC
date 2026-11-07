#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Instala o MySQL 8.4.13 LTS dedicado do Nexus na porta 3214.

.DESCRIPTION
    Usa o ZIP embutido no payload do instalador (nada é baixado na máquina de
    destino), instala os binários em C:\Program Files\Nexus\mysql e mantém
    dados/configuração em C:\ProgramData\Nexus\mysql (data\ e my.ini).

    Se existir o diretório antigo C:\ProgramData\MySQL\MySQL Server 8.4\Data
    (instalação anterior), copia os dados para o novo local, preservando o
    original, e recria o serviço NexusMySQL84 com o novo --defaults-file.

    Cria/recria o serviço NexusMySQL84 com bind em 127.0.0.1 e define a senha
    do root por arquivo temporário protegido — nunca por -p, log ou argumento
    de linha de comando.

    É idempotente: se o serviço existe, aponta para o my.ini atual e roda, as
    etapas correspondentes não são refeitas. Não cria o banco/usuário
    nexus_app; isso é feito por pos-instalacao-mysql.ps1.
#>
[CmdletBinding()]
param(
    [Security.SecureString]$RootPassword,
    [Security.SecureString]$AppPassword,
    [int]$Port = 3214
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "common.ps1")
Assert-Admin

if ($Port -lt 1 -or $Port -gt 65535) {
    Fail "Porta inválida: $Port."
}

$serviceName = $script:NexusMySqlService
$mysqlDir = $script:NexusMySqlDir
$mysqlRoot = $script:NexusMySqlRoot
$dataDir = $script:NexusMySqlDataDir
$myIni = $script:NexusMySqlConfig
$payloadDir = $script:NexusPayloadDir
$mysqld = Join-Path $mysqlDir "bin\mysqld.exe"
$mysql = Join-Path $mysqlDir "bin\mysql.exe"
$scExe = Join-Path $env:SystemRoot "System32\sc.exe"
$robocopy = Join-Path $env:SystemRoot "System32\robocopy.exe"

$manifest = Get-Manifest
$mysqlInfo = $manifest.mysql
$version = [string]$mysqlInfo.version
$archive = [string]$mysqlInfo.archive
$md5 = [string]$mysqlInfo.md5
if (-not $archive) { Fail "mysql.archive não definido no manifesto." }
$mysqlZip = Join-Path (Join-Path $payloadDir "mysql") $archive

function Install-MySqlZip {
    if (-not (Test-Path -LiteralPath $mysqlZip -PathType Leaf)) {
        Fail ("MySQL embutido não encontrado em $mysqlZip. " +
            "Monte o payload com scripts\preparar-payload.ps1 antes de gerar o instalador.")
    }
    $actualMd5 = (Get-FileHash -LiteralPath $mysqlZip -Algorithm MD5).Hash.ToLowerInvariant()
    if ($md5 -and $actualMd5 -ne $md5.Trim().ToLowerInvariant()) {
        Fail "O MD5 do MySQL embutido não confere (esperado $md5, obtido $actualMd5)."
    }

    # Os binários podem estar em uso pelo serviço antigo; pare antes de trocar.
    Stop-MySqlForMigration

    $tempRoot = Join-Path $env:TEMP ("nexus-mysql-zip-" + [guid]::NewGuid().ToString("N"))
    $extractDir = Join-Path $tempRoot "extract"
    try {
        New-Item -ItemType Directory -Force -Path $tempRoot | Out-Null
        Write-Ok "Extraindo MySQL $version do payload..."
        Expand-Archive -LiteralPath $mysqlZip -DestinationPath $extractDir -Force

        $sourceMysqld = Get-ChildItem -Path $extractDir -Recurse -Filter "mysqld.exe" -File -ErrorAction SilentlyContinue |
            Where-Object { $_.Directory.Name -eq "bin" } |
            Select-Object -First 1
        if (-not $sourceMysqld) {
            Fail "mysqld.exe não encontrado no pacote MySQL $version."
        }

        $sourceRoot = Split-Path -Parent (Split-Path -Parent $sourceMysqld.FullName)
        if (Test-Path -LiteralPath $mysqlDir) {
            Remove-Item -LiteralPath $mysqlDir -Recurse -Force
        }
        New-Item -ItemType Directory -Force -Path $mysqlDir | Out-Null
        Copy-Item -Path (Join-Path $sourceRoot "*") -Destination $mysqlDir -Recurse -Force
    }
    finally {
        if (Test-Path -LiteralPath $tempRoot) {
            Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
}

function Stop-MySqlForMigration {
    $service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
    if ($service -and $service.Status.ToString() -ne "Stopped") {
        Stop-Service -Name $serviceName -Force
        if (-not (Wait-ServiceState -Name $serviceName -Status "Stopped" -TimeoutSeconds 60)) {
            Fail "O serviço $serviceName não parou para migrar os dados."
        }
    }
}

function Copy-LegacyData {
    $legacyData = $script:NexusMySqlLegacyDataDir
    if (-not (Test-Path -LiteralPath $legacyData -PathType Container)) {
        return $false
    }
    $existingItems = @(Get-ChildItem -LiteralPath $dataDir -Force -ErrorAction SilentlyContinue)
    if ($existingItems.Count -gt 0) {
        return $false
    }

    Write-Step "Migrando os dados do MySQL anterior"
    Write-Ok "Origem: $legacyData (preservada)"
    Write-Ok "Destino: $dataDir"
    Stop-MySqlForMigration
    if (-not (Test-Path -LiteralPath $dataDir)) {
        New-Item -ItemType Directory -Force -Path $dataDir | Out-Null
    }
    & $robocopy $legacyData $dataDir /E /COPY:DAT /R:2 /W:2 /NP /NFL /NDL /NJH /NJS
    if ($LASTEXITCODE -ge 8) {
        Fail "robocopy falhou (código $LASTEXITCODE) ao migrar os dados do MySQL anterior."
    }
    $newItems = @(Get-ChildItem -LiteralPath $dataDir -Force -ErrorAction SilentlyContinue)
    if ($newItems.Count -eq 0) {
        Fail "A cópia dos dados do MySQL anterior não gerou arquivos em $dataDir."
    }
    Write-Ok "Dados migrados para $dataDir (o diretório antigo continua intacto)."
    return $true
}

function Test-ServiceUsesConfig {
    param([Parameter(Mandatory = $true)][string]$ConfigPath)
    try {
        $service = Get-CimInstance -ClassName Win32_Service -Filter ("Name='{0}'" -f $serviceName) -ErrorAction Stop
    }
    catch {
        return $true
    }
    if (-not $service -or -not $service.PathName) {
        return $false
    }
    return ($service.PathName.IndexOf($ConfigPath, [System.StringComparison]::OrdinalIgnoreCase) -ge 0)
}

function Remove-MySqlService {
    $service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
    if (-not $service) { return }
    Stop-MySqlForMigration
    Write-Ok "Removendo o serviço $serviceName para recriá-lo com o novo my.ini..."
    & $scExe delete $serviceName | Out-Null
    $deadline = (Get-Date).AddSeconds(30)
    while ((Get-Service -Name $serviceName -ErrorAction SilentlyContinue) -and (Get-Date) -lt $deadline) {
        Start-Sleep -Seconds 1
    }
    if (Get-Service -Name $serviceName -ErrorAction SilentlyContinue) {
        Fail "Não foi possível remover o serviço $serviceName para recriá-lo."
    }
}

Write-Step "MySQL 8.4 dedicado do Nexus (porta $Port)"

$needBinaries = $true
if (Test-Path -LiteralPath $mysqld -PathType Leaf) {
    $currentVersion = ([string](& $mysqld "--version" 2>&1 | Select-Object -First 1)).Trim()
    if ($currentVersion -match [regex]::Escape($version)) {
        $needBinaries = $false
        Write-Ok "Binários MySQL $version já presentes em $mysqlDir."
    }
    else {
        Write-Warn "Binários em $mysqlDir estão em outra versão ('$currentVersion'); reinstalando $version."
    }
}
if ($needBinaries) {
    Install-MySqlZip
    Write-Ok "Binários instalados em $mysqlDir."
}
if (-not (Test-Path -LiteralPath $mysql -PathType Leaf)) {
    Fail "mysql.exe não encontrado em $mysql\bin."
}
$versionOutput = ([string](& $mysqld "--version" 2>&1 | Select-Object -First 1)).Trim()
if ($versionOutput -notmatch [regex]::Escape($version)) {
    Fail "Versão do mysqld diferente da esperada ($version): $versionOutput"
}
Write-Ok $versionOutput

foreach ($dir in @($mysqlRoot, $dataDir)) {
    if (-not (Test-Path -LiteralPath $dir)) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
    }
}
Set-AclReadExecute -Path $mysqlDir -Identity "S-1-5-20"
Set-AclRestricted -Path $mysqlRoot -ModifyIdentities @("S-1-5-20")
Set-AclRestricted -Path $dataDir -ModifyIdentities @("S-1-5-20")

$migrated = Copy-LegacyData

$basedir = $mysqlDir.Replace("\", "/")
$datadir = $dataDir.Replace("\", "/")
$myIniLines = @(
    "[mysqld]",
    "port=$Port",
    "bind-address=127.0.0.1",
    "mysqlx=0",
    "basedir=$basedir",
    "datadir=$datadir",
    "character-set-server=utf8mb4",
    "collation-server=utf8mb4_0900_ai_ci",
    "default-time-zone='-03:00'",
    "",
    "[client]",
    "port=$Port",
    ""
)
if (-not (Test-Path -LiteralPath $myIni)) {
    Write-Utf8NoBom -Path $myIni -Lines @("")
}
Protect-File -Path $myIni -ReadIdentities @("S-1-5-20")
Write-Utf8NoBom -Path $myIni -Lines $myIniLines
Write-Ok "my.ini gravado em $myIni."

$service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
$dataItems = @(Get-ChildItem -LiteralPath $dataDir -Force -ErrorAction SilentlyContinue)
$dataEmpty = ($dataItems.Count -eq 0)

if ($service -and -not (Test-ServiceUsesConfig -ConfigPath $myIni)) {
    Write-Warn "O serviço $serviceName aponta para outro my.ini; será recriado."
    $migrated = $true
}

if ($dataEmpty -and $service -and $service.Status.ToString() -ne "Stopped") {
    Stop-MySqlForMigration
}

if ($dataEmpty -and -not $RootPassword) {
    Fail ("O diretório de dados do MySQL está vazio e a senha do root não foi informada. " +
        "Rode a instalação pelo bootstrap/instalador (ele solicita a senha).")
}

if ($dataEmpty) {
    Write-Ok "Inicializando o diretório Data (root sem senha)..."
    $initArgs = '--defaults-file="{0}" --initialize-insecure --console' -f $myIni
    $init = Start-Process -FilePath $mysqld -ArgumentList $initArgs -Wait -PassThru -NoNewWindow
    if ($init.ExitCode -ne 0) {
        Fail "mysqld --initialize-insecure falhou (código $($init.ExitCode))."
    }
    Write-Ok "Data inicializado."
}
else {
    Write-Ok "Data já possui conteúdo; inicialização ignorada."
}

if ($migrated) {
    Remove-MySqlService
}

$service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
if (-not $service) {
    Write-Ok "Criando o serviço $serviceName..."
    # MySQL 8.4 removeu `mysqld --install`; o serviço precisa ser criado pelo SCM.
    # O nome do serviço no fim do binPath é o que coloca o mysqld em modo de serviço
    # (o SCM espera SERVICE_RUNNING; sem ele o processo roda como console e fica START_PENDING).
    $binPath = '"{0}" --defaults-file="{1}" {2}' -f $mysqld, $myIni, $serviceName
    try {
        New-Service `
            -Name $serviceName `
            -BinaryPathName $binPath `
            -DisplayName "Nexus MySQL 8.4" `
            -Description "MySQL 8.4 dedicado do Nexus (porta $Port)" `
            -StartupType Automatic `
            -ErrorAction Stop | Out-Null
    }
    catch {
        Fail "Não foi possível criar o serviço $serviceName via New-Service: $($_.Exception.Message)"
    }
}

$serviceConfigArgs = 'config {0} start= auto obj= "NT AUTHORITY\NetworkService"' -f $serviceName
$serviceConfig = Start-Process -FilePath $scExe -ArgumentList $serviceConfigArgs -Wait -PassThru -NoNewWindow
if ($serviceConfig.ExitCode -ne 0) {
    Fail "Não foi possível configurar o serviço $serviceName como NT AUTHORITY\NetworkService (sc.exe código $($serviceConfig.ExitCode))."
}
$service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
if (-not $service) {
    Fail "O serviço $serviceName não foi criado."
}
if ($service.Status.ToString() -ne "Running") {
    Start-Service -Name $serviceName
}
if (-not (Wait-ServiceState -Name $serviceName -Status "Running" -TimeoutSeconds 120)) {
    Fail "O serviço $serviceName não iniciou."
}

$deadline = (Get-Date).AddSeconds(120)
while (-not (Test-TcpPort -Port $Port -TimeoutMs 2000) -and (Get-Date) -lt $deadline) {
    Start-Sleep -Seconds 2
}
if (-not (Test-TcpPort -Port $Port -TimeoutMs 2000)) {
    Fail "O $serviceName está em execução, mas não aceita conexões na porta $Port."
}
Write-Ok "$serviceName em execução em 127.0.0.1:$Port."

# A senha do root só é definida quando o Data acabou de ser inicializado (root
# sem senha). Em dados migrados/antigos a senha existente é mantida.
$rootPlain = $null
if ($RootPassword) {
    $rootPlain = ConvertFrom-SecureStringPlain -Secure $RootPassword
    Assert-MysqlRootPassword -Plain $rootPlain
}

$tempRoot = Join-Path $env:TEMP ("nexus-mysql-root-" + [guid]::NewGuid().ToString("N"))
$checkOut = Join-Path $tempRoot "check.out"
$checkErr = Join-Path $tempRoot "check.err"
$sqlFile = Join-Path $tempRoot "root-password.sql"
$sqlOut = Join-Path $tempRoot "root-password.out"
$sqlErr = Join-Path $tempRoot "root-password.err"

try {
    New-Item -ItemType Directory -Force -Path $tempRoot | Out-Null
    foreach ($tempFile in @($checkOut, $checkErr, $sqlFile, $sqlOut, $sqlErr)) {
        Write-Utf8NoBom -Path $tempFile -Lines @("")
        Protect-File -Path $tempFile
    }

    $checkArgs = "--protocol=TCP -h 127.0.0.1 -P $Port -u root --skip-password --connect-timeout=5 -e `"SELECT 1;`""
    $check = Start-Process -FilePath $mysql -ArgumentList $checkArgs `
        -RedirectStandardOutput $checkOut -RedirectStandardError $checkErr `
        -Wait -PassThru -NoNewWindow
    if ($check.ExitCode -eq 0 -and $rootPlain) {
        $escaped = $rootPlain.Replace("\", "\\").Replace("'", "''")
        $sql = "ALTER USER 'root'@'localhost' IDENTIFIED BY '$escaped'; FLUSH PRIVILEGES;"
        Write-Utf8NoBom -Path $sqlFile -Lines @("")
        Protect-File -Path $sqlFile
        Write-Utf8NoBom -Path $sqlFile -Lines @($sql)

        $rootArgs = "--protocol=TCP -h 127.0.0.1 -P $Port -u root --skip-password --default-character-set=utf8mb4"
        $setPassword = Start-Process -FilePath $mysql -ArgumentList $rootArgs `
            -RedirectStandardInput $sqlFile `
            -RedirectStandardOutput $sqlOut -RedirectStandardError $sqlErr `
            -Wait -PassThru -NoNewWindow
        if ($setPassword.ExitCode -ne 0) {
            $detail = ""
            if (Test-Path -LiteralPath $sqlErr) {
                $detail = ([string](Get-Content -LiteralPath $sqlErr -Raw -ErrorAction SilentlyContinue)).Trim()
                $detail = $detail.Replace($rootPlain, "***")
            }
            Fail "Não foi possível definir a senha do root (código $($setPassword.ExitCode)). $detail"
        }
        Write-Ok "Senha do root definida."
    }
    else {
        Write-Ok "O root já possui senha; a configuração existente será mantida."
    }
}
finally {
    if (Test-Path -LiteralPath $tempRoot) {
        Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
    $rootPlain = $null
}

Write-Ok "MySQL dedicado pronto para o Nexus em 127.0.0.1:$Port."
exit 0
