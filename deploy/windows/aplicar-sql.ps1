#Requires -Version 5.1
<#
.SYNOPSIS
    Aplica o SQL de produção do Nexus com mysql.exe (sem Prisma).

.DESCRIPTION
    Instala o esquema e o seed de referência em um banco novo (Fresh) ou aplica
    a migração 001 + seed em um banco existente (Update). O modo Auto detecta
    pelo information_schema: banco sem tabelas → Fresh; com tabelas → Update.

    As credenciais são entregues ao mysql.exe por um arquivo temporário com ACL
    restrita (--defaults-extra-file). A senha nunca vai para -p, log ou
    argumento de linha de comando.

    Ao final valida as contagens de referência: 82 permissões, 2 perfis e as
    3 conversões UNIDADE/PCT10/CX50 (PCT10 fator 10, CX50 fator 50).

.PARAMETER MysqlExe
    Caminho do mysql.exe (C:\Program Files\Nexus\mysql\bin\mysql.exe).

.PARAMETER RootPassword
    Senha do root do MySQL dedicado. Preferida quando informada.

.PARAMETER AppPassword
    Alternativa ao root: senha de nexus_app (tem ALL em nexus_prod).

.PARAMETER Database
    Banco de destino. Padrão: nexus_prod.

.PARAMETER Mode
    Auto (padrão), Fresh (schema + seed) ou Update (migração 001 + seed).

.PARAMETER SqlDir
    Diretório com schema.sql, seed.sql e migracoes\. Padrão: .\sql ao lado
    deste script (o instalador copia para {app}\sql), com fallback para
    .\payload\sql.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$MysqlExe,
    [Security.SecureString]$RootPassword,
    [Security.SecureString]$AppPassword,
    [string]$Database = "nexus_prod",
    [ValidateSet("Auto", "Fresh", "Update")][string]$Mode = "Auto",
    [string]$SqlDir = "",
    [int]$Port = 3214
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "common.ps1")
Assert-Admin

if ($Database -notmatch '^[A-Za-z0-9_]+$') {
    Fail "Nome de banco inválido: '$Database'."
}
if ($Port -lt 1 -or $Port -gt 65535) {
    Fail "Porta inválida: $Port."
}
if (-not (Test-Path -LiteralPath $MysqlExe -PathType Leaf)) {
    Fail "mysql.exe não encontrado em $MysqlExe."
}
if (-not $RootPassword -and -not $AppPassword) {
    Fail "Informe -RootPassword ou -AppPassword para aplicar o SQL."
}

function Resolve-SqlDir {
    param([string]$Explicit)
    if ($Explicit) {
        if (Test-Path -LiteralPath $Explicit -PathType Container) {
            return (Resolve-Path -LiteralPath $Explicit).Path
        }
        Fail "Diretório de SQL não encontrado: $Explicit"
    }
    $candidates = @(
        (Join-Path $PSScriptRoot "sql"),
        (Join-Path $PSScriptRoot "payload\sql"),
        (Join-Path $PSScriptRoot "..\..\deploy\sql")
    )
    foreach ($candidate in $candidates) {
        if (Test-Path -LiteralPath (Join-Path $candidate "schema.sql") -PathType Leaf) {
            return (Resolve-Path -LiteralPath $candidate).Path
        }
    }
    Fail ("SQL não encontrado. Esperado schema.sql em .\sql (ou .\payload\sql) ao lado de " +
        "$PSScriptRoot. Reinstale o Nexus com o pacote completo.")
}

$SqlDir = Resolve-SqlDir -Explicit $SqlDir
$schemaFile = Join-Path $SqlDir "schema.sql"
$seedFile = Join-Path $SqlDir "seed.sql"
$migrationFile = Join-Path $SqlDir "migracoes\001-unidades-pct10-cx50.sql"

$tempRoot = Join-Path $env:TEMP ("nexus-sql-" + [guid]::NewGuid().ToString("N"))
$cnfPath = Join-Path $tempRoot "client.cnf"
$stdoutPath = Join-Path $tempRoot "stdout.txt"
$stderrPath = Join-Path $tempRoot "stderr.txt"
$queryPath = Join-Path $tempRoot "query.sql"
$plainPassword = $null

function Get-PlainPassword {
    if ($RootPassword) {
        return (ConvertFrom-SecureStringPlain -Secure $RootPassword)
    }
    return (ConvertFrom-SecureStringPlain -Secure $AppPassword)
}

function Get-MysqlUser {
    if ($RootPassword) { return "root" }
    return "nexus_app"
}

function Write-ClientCnf {
    param([Parameter(Mandatory = $true)][string]$Password)
    $lines = @(
        "[client]",
        ("user=" + (Get-MysqlUser)),
        "host=127.0.0.1",
        "port=$Port",
        ("password=" + (ConvertTo-MysqlOptionValue $Password)),
        "default-character-set=utf8mb4",
        ""
    )
    Write-Utf8NoBom -Path $cnfPath -Lines @("")
    Protect-File -Path $cnfPath
    Write-Utf8NoBom -Path $cnfPath -Lines $lines
}

function Invoke-Mysql {
    param(
        [Parameter(Mandatory = $true)][string]$InputFile,
        [Parameter(Mandatory = $true)][string]$Label,
        [switch]$CaptureOutput
    )

    foreach ($tempFile in @($stdoutPath, $stderrPath)) {
        if (Test-Path -LiteralPath $tempFile) {
            Remove-Item -LiteralPath $tempFile -Force -ErrorAction SilentlyContinue
        }
    }

    $arguments = @(
        ('--defaults-extra-file="{0}"' -f $cnfPath),
        "--protocol=TCP",
        "-h", "127.0.0.1",
        "-P", "$Port",
        "--default-character-set=utf8mb4",
        "--database=$Database"
    )
    if ($CaptureOutput) {
        $arguments += @("--batch", "--skip-column-names")
    }
    $process = Start-Process -FilePath $MysqlExe -ArgumentList $arguments `
        -RedirectStandardInput $InputFile `
        -RedirectStandardOutput $stdoutPath `
        -RedirectStandardError $stderrPath `
        -Wait -PassThru -NoNewWindow

    $stdout = ""
    if (Test-Path -LiteralPath $stdoutPath) {
        $stdout = [System.IO.File]::ReadAllText($stdoutPath)
    }
    if ($process.ExitCode -ne 0) {
        $detail = ""
        if (Test-Path -LiteralPath $stderrPath) {
            $detail = ([System.IO.File]::ReadAllText($stderrPath)).Trim()
            if ($plainPassword) { $detail = $detail.Replace($plainPassword, "***") }
        }
        Fail "Falha ao aplicar $Label (código $($process.ExitCode)). $detail"
    }
    if (-not $CaptureOutput) {
        Write-Ok "$Label aplicado."
    }
    return $stdout.Trim()
}

function Invoke-SqlQuery {
    param(
        [Parameter(Mandatory = $true)][string]$Query,
        [Parameter(Mandatory = $true)][string]$Label
    )
    Write-Utf8NoBom -Path $queryPath -Lines @("")
    Protect-File -Path $queryPath
    Write-Utf8NoBom -Path $queryPath -Lines @($Query)
    return (Invoke-Mysql -InputFile $queryPath -Label $Label -CaptureOutput)
}

function Get-TableCount {
    $query = "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '$Database';"
    $text = Invoke-SqlQuery -Query $query -Label "verificação de tabelas"
    $value = 0
    if ([int]::TryParse($text, [ref]$value)) { return $value }
    Fail "Resposta inesperada ao contar as tabelas de ${Database}: '$text'"
}

Write-Step "SQL do Nexus ($Database)"

try {
    if (-not (Test-Path -LiteralPath $tempRoot)) {
        New-Item -ItemType Directory -Force -Path $tempRoot | Out-Null
    }
    # Os arquivos nascem vazios e restritos antes de receber conteúdo sensível.
    foreach ($tempFile in @($stdoutPath, $stderrPath, $queryPath)) {
        Write-Utf8NoBom -Path $tempFile -Lines @("")
        Protect-File -Path $tempFile
    }

    $plainPassword = Get-PlainPassword
    if (-not $plainPassword) { Fail "Senha vazia para aplicar o SQL." }
    Write-ClientCnf -Password $plainPassword

    $tableCount = Get-TableCount
    $effectiveMode = $Mode
    if ($Mode -eq "Auto") {
        if ($tableCount -eq 0) { $effectiveMode = "Fresh" }
        else { $effectiveMode = "Update" }
    }

    if ($effectiveMode -eq "Fresh") {
        if ($tableCount -gt 0) {
            Fail ("O banco $Database já tem $tableCount tabela(s); o modo Fresh recusa sobrescrever. " +
                "Use -Mode Update.")
        }
        if (-not (Test-Path -LiteralPath $schemaFile -PathType Leaf)) {
            Fail "schema.sql não encontrado em $SqlDir."
        }
        if (-not (Test-Path -LiteralPath $seedFile -PathType Leaf)) {
            Fail "seed.sql não encontrado em $SqlDir."
        }
        Write-Ok "Banco vazio: aplicando schema.sql e seed.sql."
        Invoke-Mysql -InputFile $schemaFile -Label "schema.sql" | Out-Null
        Invoke-Mysql -InputFile $seedFile -Label "seed.sql" | Out-Null
    }
    else {
        if (-not (Test-Path -LiteralPath $migrationFile -PathType Leaf)) {
            Fail "Migração 001 não encontrada em $migrationFile."
        }
        if (-not (Test-Path -LiteralPath $seedFile -PathType Leaf)) {
            Fail "seed.sql não encontrado em $SqlDir."
        }
        Write-Ok "Banco com $tableCount tabela(s): aplicando migração 001 e seed.sql."
        Invoke-Mysql -InputFile $migrationFile -Label "migração 001" | Out-Null
        Invoke-Mysql -InputFile $seedFile -Label "seed.sql" | Out-Null
    }

    $permissions = Invoke-SqlQuery -Query "SELECT COUNT(*) FROM permissao;" -Label "contagem de permissões"
    $profiles = Invoke-SqlQuery -Query "SELECT COUNT(*) FROM perfil;" -Label "contagem de perfis"
    $conversions = Invoke-SqlQuery -Query "SELECT COUNT(*) FROM conversao_unidade WHERE nome IN ('UNIDADE','PCT10','CX50');" -Label "contagem de conversões"
    $renamed = Invoke-SqlQuery -Query "SELECT COUNT(*) FROM conversao_unidade WHERE (nome = 'PCT10' AND fator = 10) OR (nome = 'CX50' AND fator = 50);" -Label "conferência de PCT10/CX50"

    $expected = @{ permissions = 82; profiles = 2; conversions = 3; renamed = 2 }
    $actual = @{ permissions = $permissions; profiles = $profiles; conversions = $conversions; renamed = $renamed }
    foreach ($key in @("permissions", "profiles", "conversions", "renamed")) {
        if ([string]($actual[$key]) -ne [string]$expected[$key]) {
            Fail ("Contagem de referência divergente em ${key}: esperado $($expected[$key]), " +
                "obtido '$($actual[$key])'.")
        }
    }
    Write-Ok "Referência validada: 82 permissões, 2 perfis, 3 conversões (PCT10/CX50)."
}
finally {
    if (Test-Path -LiteralPath $tempRoot) {
        Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
    $plainPassword = $null
}

Write-Ok "SQL de produção aplicado em $Database."
exit 0
