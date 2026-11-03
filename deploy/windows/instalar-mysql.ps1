#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Instala o MySQL 8.4.13 LTS dedicado do Nexus na porta 3214.

.DESCRIPTION
    Baixa o ZIP oficial (validando o MD5), instala os binários em
    C:\Program Files\Nexus\mysql e mantém dados/configuração em
    C:\ProgramData\MySQL\MySQL Server 8.4. Cria o serviço NexusMySQL84 com
    bind em 127.0.0.1 e define a senha do root por arquivo temporário
    protegido — nunca por -p, log ou argumento de linha de comando.

    É idempotente: se o serviço existe e roda, se os binários existem ou se
    Data não está vazio, as etapas correspondentes não são refeitas. Não cria
    o banco/usuário nexus_app; isso é feito por pos-instalacao-mysql.ps1.
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
$mysqld = Join-Path $mysqlDir "bin\mysqld.exe"
$mysql = Join-Path $mysqlDir "bin\mysql.exe"
$scExe = Join-Path $env:SystemRoot "System32\sc.exe"

$credentials = Read-MySqlCredentials -RootPassword $RootPassword -AppPassword $AppPassword
$RootPassword = $credentials.Root
$AppPassword = $credentials.App

$appPlain = ConvertFrom-SecureStringPlain -Secure $AppPassword
Assert-SafeAppPassword -Plain $appPlain -Label "Senha de nexus_app"
$appPlain = $null

$rootProbe = ConvertFrom-SecureStringPlain -Secure $RootPassword
Assert-MysqlRootPassword -Plain $rootProbe
$rootProbe = $null

$manifest = Get-Manifest
$mysqlInfo = $manifest.mysql
$url = [string]$mysqlInfo.url
$md5 = [string]$mysqlInfo.md5
$version = [string]$mysqlInfo.version
if (-not $url) { Fail "mysql.url não definido no manifesto." }
if (-not $md5) { Fail "mysql.md5 não definido no manifesto." }

function Install-MySqlZip {
    $tempRoot = Join-Path $env:TEMP ("nexus-mysql-zip-" + [guid]::NewGuid().ToString("N"))
    $zipFile = Join-Path $tempRoot "mysql.zip"
    $extractDir = Join-Path $tempRoot "extract"
    try {
        New-Item -ItemType Directory -Force -Path $tempRoot | Out-Null
        Invoke-Download -Url $url -Destination $zipFile -Md5 $md5 -Label "MySQL $version"
        Expand-Archive -LiteralPath $zipFile -DestinationPath $extractDir -Force

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

Write-Step "MySQL 8.4 dedicado do Nexus (porta $Port)"

if (-not (Test-Path -LiteralPath $mysqld -PathType Leaf)) {
    Write-Ok "Baixando MySQL $version..."
    Install-MySqlZip
    Write-Ok "Binários instalados em $mysqlDir."
}
else {
    Write-Ok "Binários MySQL já presentes em $mysqlDir."
}
if (-not (Test-Path -LiteralPath $mysql -PathType Leaf)) {
    Fail "mysql.exe não encontrado em $mysql\bin."
}

foreach ($dir in @($mysqlRoot, $dataDir)) {
    if (-not (Test-Path -LiteralPath $dir)) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
    }
}
Set-AclReadExecute -Path $mysqlDir -Identity "S-1-5-20"
Set-AclRestricted -Path $mysqlRoot -ModifyIdentities @("S-1-5-20")
Set-AclRestricted -Path $dataDir -ModifyIdentities @("S-1-5-20")

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

if ($dataEmpty -and $service -and $service.Status.ToString() -ne "Stopped") {
    Stop-Service -Name $serviceName -Force
    if (-not (Wait-ServiceState -Name $serviceName -Status "Stopped" -TimeoutSeconds 60)) {
        Fail "O serviço $serviceName não parou para inicialização do Data."
    }
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

$rootPlain = ConvertFrom-SecureStringPlain -Secure $RootPassword
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
    if ($check.ExitCode -eq 0) {
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
        Write-Warn "O root já possui senha; a configuração existente será mantida."
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
