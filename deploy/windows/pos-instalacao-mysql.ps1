#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Pós-instalação do MySQL 8.4 dedicado do Nexus (porta 3214).

.DESCRIPTION
    Ajusta o my.ini do serviço NexusMySQL84 (bind local, porta 3214, utf8mb4,
    fuso -03:00, X Plugin desligado), reinicia o serviço e cria o banco
    nexus_prod e o usuário nexus_app.

    As senhas entram por SecureString e são entregues ao mysql.exe por arquivos
    temporários com ACL restrita (--defaults-extra-file); nunca por -p, log ou
    argumento de linha de comando.
#>
[CmdletBinding()]
param(
    [Security.SecureString]$RootPassword,
    [Security.SecureString]$AppPassword,
    [string]$Hostname = "localhost"
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "common.ps1")
Assert-Admin

$credentials = Read-MySqlCredentials -RootPassword $RootPassword -AppPassword $AppPassword
$RootPassword = $credentials.Root
$AppPassword = $credentials.App

$rootPlain = ConvertFrom-SecureStringPlain -Secure $RootPassword
$appPlain = ConvertFrom-SecureStringPlain -Secure $AppPassword
Assert-MysqlRootPassword -Plain $rootPlain
Assert-SafeAppPassword -Plain $appPlain -Label "Senha de nexus_app"

function Set-IniValue {
    param(
        [Parameter(Mandatory = $true)][System.Collections.Generic.List[string]]$Lines,
        [Parameter(Mandatory = $true)][string]$Section,
        [Parameter(Mandatory = $true)][string]$Key,
        [Parameter(Mandatory = $true)][string]$Value
    )

    $sectionStart = -1
    for ($i = 0; $i -lt $Lines.Count; $i++) {
        if ($Lines[$i].Trim() -match '^\[(.+)\]$') {
            if ($matches[1].Trim() -ieq $Section) {
                $sectionStart = $i
                break
            }
        }
    }

    if ($sectionStart -lt 0) {
        $Lines.Add("")
        $Lines.Add("[$Section]")
        $Lines.Add("$Key=$Value")
        return
    }

    $sectionEnd = $Lines.Count
    for ($i = $sectionStart + 1; $i -lt $Lines.Count; $i++) {
        if ($Lines[$i].Trim() -match '^\[(.+)\]$') {
            $sectionEnd = $i
            break
        }
    }

    $keyPattern = '^\s*' + [regex]::Escape($Key) + '\s*='
    $remove = New-Object System.Collections.Generic.List[int]
    for ($i = $sectionStart + 1; $i -lt $sectionEnd; $i++) {
        if ($Lines[$i] -match $keyPattern) {
            $remove.Add($i)
        }
    }
    foreach ($index in ($remove | Sort-Object -Descending)) {
        $Lines.RemoveAt($index)
    }
    $Lines.Insert($sectionStart + 1, "$Key=$Value")
}

$serviceName = $script:NexusMySqlService
$port = $script:NexusMySqlPort
$mysqlExe = Join-Path $script:NexusMySqlDir "bin\mysql.exe"
$myIni = $script:NexusMySqlConfig

Write-Step "Pós-instalação do MySQL 8.4 dedicado"

$mysqlService = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
if (-not $mysqlService) {
    Fail "O serviço $serviceName não existe. Rode instalar-mysql.ps1 antes."
}
Set-Service -Name $serviceName -StartupType Automatic

if (-not (Test-Path -LiteralPath $mysqlExe -PathType Leaf)) {
    Fail "mysql.exe não encontrado em $mysqlExe."
}
if (-not (Test-Path -LiteralPath $myIni -PathType Leaf)) {
    Fail "my.ini não encontrado em $myIni."
}
Write-Ok "my.ini: $myIni"

$configBackups = Join-Path $script:NexusBackupsDir "config"
if (-not (Test-Path -LiteralPath $configBackups)) {
    New-Item -ItemType Directory -Force -Path $configBackups | Out-Null
}
$myIniBackup = Join-Path $configBackups ("my.ini-" + (Get-Date -Format "yyyyMMdd-HHmmss") + ".bak")
Copy-Item -LiteralPath $myIni -Destination $myIniBackup -Force
Protect-File -Path $myIniBackup
Write-Ok "Backup do my.ini: $myIniBackup"

$basedir = $script:NexusMySqlDir.Replace("\", "/")
$datadir = $script:NexusMySqlDataDir.Replace("\", "/")
$myIniLines = @(
    "[mysqld]",
    "port=$port",
    "bind-address=127.0.0.1",
    "mysqlx=0",
    "basedir=$basedir",
    "datadir=$datadir",
    "character-set-server=utf8mb4",
    "collation-server=utf8mb4_0900_ai_ci",
    "default-time-zone='-03:00'",
    "",
    "[client]",
    "port=$port",
    ""
)

try {
    if (-not (Test-Path -LiteralPath $myIni)) {
        Write-Utf8NoBom -Path $myIni -Lines @("")
    }
    Protect-File -Path $myIni -ReadIdentities @("S-1-5-20")
    Write-Utf8NoBom -Path $myIni -Lines $myIniLines
}
catch {
    Fail "Não foi possível gravar $myIni. Backup em $myIniBackup. Detalhe: $($_.Exception.Message)"
}
Write-Ok "my.ini ajustado (porta $port, bind local, utf8mb4, fuso -03:00, mysqlx desligado)."

Restart-Service -Name $serviceName -Force
if (-not (Wait-ServiceState -Name $serviceName -Status "Running" -TimeoutSeconds 120)) {
    Fail "O $serviceName não reiniciou. Verifique $myIni e restaure o backup $myIniBackup se necessário."
}
$deadline = (Get-Date).AddSeconds(60)
while (-not (Test-TcpPort -Port $port -TimeoutMs 2000) -and (Get-Date) -lt $deadline) {
    Start-Sleep -Seconds 2
}
if (-not (Test-TcpPort -Port $port -TimeoutMs 2000)) {
    Fail "O $serviceName não voltou a aceitar conexões na porta $port."
}
Write-Ok "$serviceName reiniciado na porta $port."

$tempRoot = Join-Path $env:TEMP ("nexus-mysql-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Force -Path $tempRoot | Out-Null
$rootCnf = Join-Path $tempRoot "root.cnf"
$appCnf = Join-Path $tempRoot "app.cnf"
$sqlFile = Join-Path $tempRoot "setup.sql"
$sqlOut = Join-Path $tempRoot "setup.out"
$sqlErr = Join-Path $tempRoot "setup.err"
$appOut = Join-Path $tempRoot "app.out"
$appErr = Join-Path $tempRoot "app.err"

# Os arquivos de saída/erro também podem conter detalhes de SQL; nascem restritos.
foreach ($tempFile in @($sqlOut, $sqlErr, $appOut, $appErr)) {
    Write-Utf8NoBom -Path $tempFile -Lines @("")
    Protect-File -Path $tempFile
}

try {
    $rootLines = @(
        "[client]",
        "user=root",
        "host=127.0.0.1",
        "port=$port",
        ("password=" + (ConvertTo-MysqlOptionValue $rootPlain)),
        "default-character-set=utf8mb4",
        ""
    )
    Write-Utf8NoBom -Path $rootCnf -Lines @("")
    Protect-File -Path $rootCnf
    Write-Utf8NoBom -Path $rootCnf -Lines $rootLines

    $sql = @"
CREATE DATABASE IF NOT EXISTS nexus_prod CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER IF NOT EXISTS 'nexus_app'@'localhost' IDENTIFIED BY '$appPlain';
ALTER USER 'nexus_app'@'localhost' IDENTIFIED BY '$appPlain';
GRANT ALL PRIVILEGES ON nexus_prod.* TO 'nexus_app'@'localhost';
FLUSH PRIVILEGES;
"@
    Write-Utf8NoBom -Path $sqlFile -Lines @("")
    Protect-File -Path $sqlFile
    Write-Utf8NoBom -Path $sqlFile -Lines @($sql)

    $rootArgs = "--defaults-extra-file=`"$rootCnf`" --protocol=TCP -h 127.0.0.1 -P $port --default-character-set=utf8mb4"
    $process = Start-Process -FilePath $mysqlExe -ArgumentList $rootArgs `
        -RedirectStandardInput $sqlFile -RedirectStandardOutput $sqlOut -RedirectStandardError $sqlErr `
        -Wait -PassThru -NoNewWindow
    if ($process.ExitCode -ne 0) {
        $detail = ""
        if (Test-Path -LiteralPath $sqlErr) {
            $detail = ([string](Get-Content -LiteralPath $sqlErr -Raw -ErrorAction SilentlyContinue)).Trim()
            $detail = $detail.Replace($rootPlain, "***").Replace($appPlain, "***")
        }
        Fail "Falha ao criar o banco/usuário (código $($process.ExitCode)). $detail"
    }
    Write-Ok "Banco nexus_prod e usuário nexus_app criados/atualizados."

    $appLines = @(
        "[client]",
        "user=nexus_app",
        "host=127.0.0.1",
        "port=$port",
        ("password=" + (ConvertTo-MysqlOptionValue $appPlain)),
        "default-character-set=utf8mb4",
        ""
    )
    Write-Utf8NoBom -Path $appCnf -Lines @("")
    Protect-File -Path $appCnf
    Write-Utf8NoBom -Path $appCnf -Lines $appLines

    $appArgs = "--defaults-extra-file=`"$appCnf`" --protocol=TCP -h 127.0.0.1 -P $port -D nexus_prod -e `"SELECT 1;`""
    $appProcess = Start-Process -FilePath $mysqlExe -ArgumentList $appArgs `
        -RedirectStandardOutput $appOut -RedirectStandardError $appErr `
        -Wait -PassThru -NoNewWindow
    if ($appProcess.ExitCode -ne 0) {
        $detail = ""
        if (Test-Path -LiteralPath $appErr) {
            $detail = ([string](Get-Content -LiteralPath $appErr -Raw -ErrorAction SilentlyContinue)).Trim()
            $detail = $detail.Replace($rootPlain, "***").Replace($appPlain, "***")
        }
        Fail "O usuário nexus_app não conseguiu conectar em nexus_prod. $detail"
    }
    Write-Ok "Conexão de nexus_app em nexus_prod validada."
}
finally {
    if (Test-Path -LiteralPath $tempRoot) {
        Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
    $rootPlain = $null
    $appPlain = $null
}

Write-Ok "MySQL pronto para o Nexus em $Hostname (porta $port)."
exit 0
