#Requires -Version 5.1
<#
.SYNOPSIS
    Monta o payload autocontido do instalador do Nexus.

.DESCRIPTION
    Baixa (ou reutiliza) os binários do manifesto e monta:

        deploy\windows\payload\
        ├── node\node-v24.19.0-win-x64.zip
        ├── mysql\mysql-8.4.13-winx64.zip
        ├── caddy\caddy_2.11.9_windows_amd64.zip
        ├── vcredist\vc_redist.x64.exe
        ├── app\app.zip              (copiado de out\standalone\app.zip)
        ├── nssm\nssm.exe            (copiado de deploy\windows\tools\nssm\nssm.exe)
        └── sql\{schema.sql,seed.sql,migracoes\...}

    O payload é ignorado pelo Git (deploy\windows\payload\) e entra no setup do
    Inno. Nada é baixado na máquina de destino.

    Cada arquivo é verificado pelo hash do manifesto quando ele existe
    (SHA-256, SHA-512 ou MD5). Arquivos já presentes e válidos são mantidos;
    -Force força o download novamente.

.PARAMETER Force
    Baixa novamente todos os binários, mesmo que já existam e o hash confira.

.PARAMETER PayloadDir
    Diretório de saída. Padrão: deploy\windows\payload.

.EXAMPLE
    powershell -NoProfile -ExecutionPolicy Bypass -File scripts\preparar-payload.ps1

.EXAMPLE
    powershell -NoProfile -ExecutionPolicy Bypass -File scripts\preparar-payload.ps1 -Force
#>
[CmdletBinding()]
param(
    [switch]$Force,
    [string]$PayloadDir = ""
)

$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$DeployRoot = Join-Path $RepoRoot "deploy\windows"
$ManifestPath = Join-Path $DeployRoot "manifesto.json"
$AppZipSource = Join-Path $RepoRoot "out\standalone\app.zip"
$NssmSource = Join-Path $DeployRoot "tools\nssm\nssm.exe"
$SqlSource = Join-Path $RepoRoot "deploy\sql"
if (-not $PayloadDir) {
    $PayloadDir = Join-Path $DeployRoot "payload"
}
$PayloadDir = [System.IO.Path]::GetFullPath($PayloadDir)

function Write-Step {
    param([Parameter(Mandatory = $true)][string]$Message)
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Write-Ok {
    param([Parameter(Mandatory = $true)][string]$Message)
    Write-Host "  [OK] $Message" -ForegroundColor Green
}

function Write-Warn {
    param([Parameter(Mandatory = $true)][string]$Message)
    Write-Host "  [AVISO] $Message" -ForegroundColor Yellow
}

function Fail {
    param([Parameter(Mandatory = $true)][string]$Message)
    Write-Host ""
    Write-Host "[ERRO] $Message" -ForegroundColor Red
    exit 1
}

function Get-Manifest {
    if (-not (Test-Path -LiteralPath $ManifestPath -PathType Leaf)) {
        Fail "Manifesto não encontrado: $ManifestPath"
    }
    try {
        return (Get-Content -LiteralPath $ManifestPath -Raw -Encoding UTF8 | ConvertFrom-Json)
    }
    catch {
        Fail "Manifesto inválido em ${ManifestPath}: $($_.Exception.Message)"
    }
}

function Test-Hash {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [string]$Sha256 = "",
        [string]$Sha512 = "",
        [string]$Md5 = ""
    )
    if ($Sha256) {
        $actual = (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($actual -ne $Sha256.Trim().ToLowerInvariant()) { return $false }
    }
    if ($Sha512) {
        $actual = (Get-FileHash -LiteralPath $Path -Algorithm SHA512).Hash.ToLowerInvariant()
        if ($actual -ne $Sha512.Trim().ToLowerInvariant()) { return $false }
    }
    if ($Md5) {
        $actual = (Get-FileHash -LiteralPath $Path -Algorithm MD5).Hash.ToLowerInvariant()
        if ($actual -ne $Md5.Trim().ToLowerInvariant()) { return $false }
    }
    return $true
}

function Assert-Hash {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Label,
        [string]$Sha256 = "",
        [string]$Sha512 = "",
        [string]$Md5 = ""
    )
    if (-not (Test-Hash -Path $Path -Sha256 $Sha256 -Sha512 $Sha512 -Md5 $Md5)) {
        Fail "O hash de $Label não confere com o manifesto: $Path"
    }
    Write-Ok "Hash de $Label verificado."
}

function Invoke-PayloadDownload {
    param(
        [Parameter(Mandatory = $true)][string]$Url,
        [Parameter(Mandatory = $true)][string]$Destination,
        [Parameter(Mandatory = $true)][string]$Label,
        [string]$Sha256 = "",
        [string]$Sha512 = "",
        [string]$Md5 = "",
        [int]$Attempts = 3
    )

    $parent = Split-Path -Parent $Destination
    if (-not (Test-Path -LiteralPath $parent)) {
        New-Item -ItemType Directory -Force -Path $parent | Out-Null
    }

    if ((Test-Path -LiteralPath $Destination -PathType Leaf) -and -not $Force) {
        if (Test-Hash -Path $Destination -Sha256 $Sha256 -Sha512 $Sha512 -Md5 $Md5) {
            Write-Ok "$Label já está no payload."
            return
        }
        Write-Warn "$Label existe mas o hash não confere; baixando novamente."
    }

    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $oldProgress = $ProgressPreference
    $ProgressPreference = "SilentlyContinue"
    try {
        for ($attempt = 1; $attempt -le $Attempts; $attempt++) {
            try {
                Write-Host "  baixando $Label de $Url"
                if (Test-Path -LiteralPath $Destination) {
                    Remove-Item -LiteralPath $Destination -Force
                }
                Invoke-WebRequest -Uri $Url -OutFile $Destination -UseBasicParsing -TimeoutSec 1800
                break
            }
            catch {
                if ($attempt -ge $Attempts) {
                    Fail "Falha ao baixar $Label de ${Url}: $($_.Exception.Message)"
                }
                Write-Warn "Download de $Label falhou (tentativa $attempt). Repetindo..."
                Start-Sleep -Seconds ($attempt * 5)
            }
        }
    }
    finally {
        $ProgressPreference = $oldProgress
    }

    if (-not (Test-Path -LiteralPath $Destination -PathType Leaf)) {
        Fail "O download de $Label não gerou o arquivo esperado: $Destination"
    }
    Unblock-File -LiteralPath $Destination -ErrorAction SilentlyContinue
    Assert-Hash -Path $Destination -Label $Label -Sha256 $Sha256 -Sha512 $Sha512 -Md5 $Md5
}

function Assert-ZipEntry {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Label,
        [Parameter(Mandatory = $true)][string[]]$Patterns
    )
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $archive = $null
    try {
        $archive = [System.IO.Compression.ZipFile]::OpenRead($Path)
        $names = @($archive.Entries | ForEach-Object { $_.FullName })
    }
    catch {
        Fail "O pacote de $Label não é um ZIP válido: $Path ($($_.Exception.Message))"
    }
    finally {
        if ($archive) { $archive.Dispose() }
    }
    foreach ($pattern in $Patterns) {
        if (-not ($names | Where-Object { $_ -match $pattern } | Select-Object -First 1)) {
            Fail "O pacote de $Label não contém '$pattern': $Path"
        }
    }
    Write-Ok "$Label validado (ZIP)."
}

function Copy-PayloadFile {
    param(
        [Parameter(Mandatory = $true)][string]$Source,
        [Parameter(Mandatory = $true)][string]$Destination,
        [Parameter(Mandatory = $true)][string]$Label
    )
    if (-not (Test-Path -LiteralPath $Source -PathType Leaf)) {
        Fail "$Label não encontrado em $Source"
    }
    $parent = Split-Path -Parent $Destination
    if (-not (Test-Path -LiteralPath $parent)) {
        New-Item -ItemType Directory -Force -Path $parent | Out-Null
    }
    $needsCopy = $true
    if ((Test-Path -LiteralPath $Destination -PathType Leaf) -and -not $Force) {
        $sourceHash = (Get-FileHash -LiteralPath $Source -Algorithm SHA256).Hash
        $destHash = (Get-FileHash -LiteralPath $Destination -Algorithm SHA256).Hash
        $needsCopy = ($sourceHash -ne $destHash)
    }
    if ($needsCopy) {
        Copy-Item -LiteralPath $Source -Destination $Destination -Force
    }
}

Write-Step "Payload do instalador do Nexus"
$manifest = Get-Manifest

$targets = [ordered]@{
    Node      = @{ Dir = "node"; File = [string]$manifest.node.archive }
    MySql     = @{ Dir = "mysql"; File = [string]$manifest.mysql.archive }
    Caddy     = @{ Dir = "caddy"; File = [string]$manifest.caddy.archive }
    VcRedist  = @{ Dir = "vcredist"; File = [string]$manifest.vcredist.archive }
}

foreach ($item in $targets.GetEnumerator()) {
    if (-not $item.Value.File) {
        Fail "O manifesto não define o arquivo de $($item.Key)."
    }
}

Write-Host "  Payload:  $PayloadDir"
Write-Host "  Manifest: $ManifestPath"

if (-not (Test-Path -LiteralPath $PayloadDir)) {
    New-Item -ItemType Directory -Force -Path $PayloadDir | Out-Null
}

# --- Runtime embutido -------------------------------------------------------
$nodeZip = Join-Path (Join-Path $PayloadDir "node") ([string]$manifest.node.archive)
if (-not [string]$manifest.node.url) { Fail "node.url não definido no manifesto." }
Invoke-PayloadDownload -Url ([string]$manifest.node.url) -Destination $nodeZip -Label "Node.js $($manifest.node.version)" `
    -Sha256 ([string]$manifest.node.sha256)
Assert-ZipEntry -Path $nodeZip -Label "Node.js $($manifest.node.version)" -Patterns @('(^|[\\/])node\.exe$')

$mysqlZip = Join-Path (Join-Path $PayloadDir "mysql") ([string]$manifest.mysql.archive)
if (-not [string]$manifest.mysql.url) { Fail "mysql.url não definido no manifesto." }
Invoke-PayloadDownload -Url ([string]$manifest.mysql.url) -Destination $mysqlZip -Label "MySQL $($manifest.mysql.version)" `
    -Md5 ([string]$manifest.mysql.md5) -Sha256 ([string]$manifest.mysql.sha256)
Assert-ZipEntry -Path $mysqlZip -Label "MySQL $($manifest.mysql.version)" -Patterns @('(^|[\\/])bin[\\/]mysqld\.exe$', '(^|[\\/])bin[\\/]mysql\.exe$')

$caddyZip = Join-Path (Join-Path $PayloadDir "caddy") ([string]$manifest.caddy.archive)
if (-not [string]$manifest.caddy.url) { Fail "caddy.url não definido no manifesto." }
Invoke-PayloadDownload -Url ([string]$manifest.caddy.url) -Destination $caddyZip -Label "Caddy $($manifest.caddy.version)" `
    -Sha512 ([string]$manifest.caddy.sha512)
Assert-ZipEntry -Path $caddyZip -Label "Caddy $($manifest.caddy.version)" -Patterns @('(^|[\\/])caddy\.exe$')

$vcRedist = Join-Path (Join-Path $PayloadDir "vcredist") ([string]$manifest.vcredist.archive)
if (-not [string]$manifest.vcredist.url) { Fail "vcredist.url não definido no manifesto." }
Invoke-PayloadDownload -Url ([string]$manifest.vcredist.url) -Destination $vcRedist -Label "VC++ Redistributable" `
    -Sha256 ([string]$manifest.vcredist.sha256)

# --- NSSM -------------------------------------------------------------------
$nssmTarget = Join-Path (Join-Path $PayloadDir "nssm") "nssm.exe"
Copy-PayloadFile -Source $NssmSource -Destination $nssmTarget -Label "NSSM embutido"
$nssmHash = ([string]$manifest.nssm.exe_sha256).ToUpperInvariant()
if ($nssmHash) {
    $actual = (Get-FileHash -LiteralPath $nssmTarget -Algorithm SHA256).Hash.ToUpperInvariant()
    if ($actual -ne $nssmHash) {
        Fail "O hash do NSSM não confere (esperado $nssmHash, obtido $actual)."
    }
}
Write-Ok "NSSM copiado."

# --- Aplicação standalone ---------------------------------------------------
$appZip = Join-Path (Join-Path $PayloadDir "app") "app.zip"
if (-not (Test-Path -LiteralPath $AppZipSource -PathType Leaf)) {
    Fail ("app.zip não encontrado em $AppZipSource. " +
        "Rode 'npm run build:standalone' e 'npm run package:standalone' antes de montar o payload.")
}
Copy-PayloadFile -Source $AppZipSource -Destination $appZip -Label "app.zip standalone"
$appSizeMb = [math]::Round(((Get-Item -LiteralPath $appZip).Length / 1MB), 1)
if ($appSizeMb -lt 1) {
    Fail "app.zip tem apenas $appSizeMb MB; o pacote standalone parece incompleto."
}
Write-Ok "app.zip copiado ($appSizeMb MB)."
Assert-ZipEntry -Path $appZip -Label "app standalone" -Patterns @('(^|[\\/])server\.js$', '(^|[\\/])\.next[\\/]')

# --- SQL --------------------------------------------------------------------
$sqlTarget = Join-Path $PayloadDir "sql"
$sqlFiles = @(
    @{ Source = (Join-Path $SqlSource "schema.sql"); Destination = (Join-Path $sqlTarget "schema.sql") },
    @{ Source = (Join-Path $SqlSource "seed.sql"); Destination = (Join-Path $sqlTarget "seed.sql") },
    @{ Source = (Join-Path $SqlSource "migracoes\001-unidades-pct10-cx50.sql"); Destination = (Join-Path $sqlTarget "migracoes\001-unidades-pct10-cx50.sql") }
)
foreach ($sqlFile in $sqlFiles) {
    Copy-PayloadFile -Source $sqlFile.Source -Destination $sqlFile.Destination -Label (Split-Path -Leaf $sqlFile.Source)
}
Write-Ok "SQL copiado (schema, seed e migração 001)."

# --- Resumo -----------------------------------------------------------------
Write-Step "Resumo do payload"
$files = @(
    $nodeZip, $mysqlZip, $caddyZip, $vcRedist, $nssmTarget, $appZip,
    (Join-Path $sqlTarget "schema.sql"), (Join-Path $sqlTarget "seed.sql"),
    (Join-Path $sqlTarget "migracoes\001-unidades-pct10-cx50.sql")
)
$total = 0
foreach ($file in $files) {
    if (-not (Test-Path -LiteralPath $file -PathType Leaf)) {
        Fail "Arquivo ausente no payload: $file"
    }
    $size = (Get-Item -LiteralPath $file).Length
    $total += $size
    Write-Host ("  {0,-52} {1,12:N0} bytes" -f $file.Replace($PayloadDir + "\", ""), $size)
}
Write-Host ("  {0,-52} {1,12:N0} bytes" -f "TOTAL", $total) -ForegroundColor Cyan
Write-Host ""
Write-Host "OK: payload pronto em $PayloadDir" -ForegroundColor Green
exit 0
