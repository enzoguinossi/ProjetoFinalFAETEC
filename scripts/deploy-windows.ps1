<#
.SYNOPSIS
    Build completo e empacotamento do Nexus para Windows.

.DESCRIPTION
    Executa, em ordem:
      1. prisma generate (client do schema atual);
      2. geração do SQL de produção (schema.sql/seed.sql);
      3. lint;
      4. build do app Next standalone + app.zip;
      5. publish da bandeja (NexusTray) e do serviço (NexusAgent);
      6. montagem do payload e compilação do setup Inno Setup;
      7. cópia do setup final (e do .sha256) para o destino informado.

    O setup é único e autocontido: app, bandeja, agente, Node, MySQL, Caddy,
    NSSM, VC++, SQL e página de progresso.

.PARAMETER OutputPath
    Destino do setup. Pode ser um arquivo .exe ou um diretório. Padrão:
    deploy\windows\out. Relativo ao diretório atual.

.PARAMETER SkipSql
    Não regenera deploy\sql\schema.sql e seed.sql (use o que está no disco).

.PARAMETER SkipLint
    Não executa `npm run lint`.

.PARAMETER SkipApp
    Não recompila o app Next/app.zip (usa o pacote existente).

.PARAMETER SkipTray
    Não recompila a bandeja (usa NexusTray\dist\NexusTray.exe existente).

.PARAMETER SkipAgent
    Não recompila o agente (usa NexusAgent\dist\NexusAgent.exe existente).

.PARAMETER WithTests
    Executa `npm test` antes do build. Exige o banco descartável nexus_test e
    pode solicitar consentimento do Prisma para `db push`.

.PARAMETER Force
    Sobrescreve o destino mesmo que esteja marcado como somente leitura.

.EXAMPLE
    npm run deploy:windows

.EXAMPLE
    npm run deploy:windows -- -OutputPath "D:\Entregas"

.EXAMPLE
    npm run deploy:windows -- "C:\Users\Enzo\Desktop\NexusSetup.exe" -SkipLint
#>
[CmdletBinding()]
param(
    [Parameter(Position = 0)][string]$OutputPath = "",
    [switch]$SkipSql,
    [switch]$SkipLint,
    [switch]$SkipApp,
    [switch]$SkipTray,
    [switch]$SkipAgent,
    [switch]$WithTests,
    [switch]$Force
)

$ErrorActionPreference = "Stop"

$Root = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$DeployRoot = Join-Path $Root "deploy\windows"
$OutDir = Join-Path $DeployRoot "out"
$Npm = (Get-Command npm.cmd -ErrorAction SilentlyContinue).Source
if (-not $Npm) { $Npm = (Get-Command npm -ErrorAction SilentlyContinue).Source }
$Node = (Get-Command node -ErrorAction SilentlyContinue).Source
$Powershell = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"

function Write-Step {
    param([Parameter(Mandatory = $true)][string]$Message)
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Write-Ok {
    param([Parameter(Mandatory = $true)][string]$Message)
    Write-Host "  [OK] $Message" -ForegroundColor Green
}

function Fail {
    param([Parameter(Mandatory = $true)][string]$Message)
    Write-Host ""
    Write-Host "[ERRO] $Message" -ForegroundColor Red
    exit 1
}

function Invoke-External {
    param(
        [Parameter(Mandatory = $true)][string]$Label,
        [Parameter(Mandatory = $true)][scriptblock]$Action
    )

    Write-Step $Label
    $watch = [System.Diagnostics.Stopwatch]::StartNew()
    & $Action
    if ($LASTEXITCODE -ne 0) {
        Fail "$Label falhou (código $LASTEXITCODE)."
    }
    $watch.Stop()
    Write-Ok ("{0:N1}s" -f $watch.Elapsed.TotalSeconds)
}

function Invoke-PowerShellScript {
    param(
        [Parameter(Mandatory = $true)][string]$Label,
        [Parameter(Mandatory = $true)][string]$Path
    )

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        Fail "${Label}: script não encontrado em $Path."
    }

    Write-Step $Label
    $watch = [System.Diagnostics.Stopwatch]::StartNew()
    & $Powershell -NoProfile -ExecutionPolicy Bypass -File $Path
    if ($LASTEXITCODE -ne 0) {
        Fail "$Label falhou (código $LASTEXITCODE)."
    }
    $watch.Stop()
    Write-Ok ("{0:N1}s" -f $watch.Elapsed.TotalSeconds)
}

if (-not $Npm) { Fail "npm não encontrado no PATH." }
if (-not $Node) { Fail "node não encontrado no PATH." }
if (-not (Test-Path -LiteralPath $Powershell -PathType Leaf)) {
    Fail "powershell.exe não encontrado em $Powershell."
}

$packagePath = Join-Path $Root "package.json"
if (-not (Test-Path -LiteralPath $packagePath -PathType Leaf)) {
    Fail "package.json não encontrado em $packagePath."
}
$package = Get-Content -LiteralPath $packagePath -Raw -Encoding UTF8 | ConvertFrom-Json
$Version = [string]$package.version
if (-not $Version) { Fail "Versão vazia no package.json." }

$total = [System.Diagnostics.Stopwatch]::StartNew()
Write-Host ""
Write-Host "Nexus - deploy Windows $Version" -ForegroundColor White
Write-Host "  Raiz:   $Root"
Write-Host "  Saída:  $OutDir"

Push-Location $Root
try {
    if (-not $SkipApp) {
        Invoke-External "prisma generate" { & $Npm run db:generate }

        if (-not $SkipSql) {
            Invoke-External "SQL de produção (schema/seed)" {
                & $Node (Join-Path $Root "scripts\gerar-sql-producao.mjs")
            }
        }

        if (-not $SkipLint) {
            Invoke-External "lint" { & $Npm run lint }
        }

        if ($WithTests) {
            Invoke-External "testes" { & $Npm test }
        }

        Invoke-External "build do app (Next standalone)" { & $Npm run build:standalone }
        Invoke-External "pacote do app (app.zip)" { & $Npm run package:standalone }
    }
    else {
        Write-Step "app ignorado (-SkipApp)"
        if (-not (Test-Path -LiteralPath (Join-Path $Root "out\standalone\app.zip") -PathType Leaf)) {
            Fail "out\standalone\app.zip não existe; remova -SkipApp."
        }
        Write-Ok "usando out\standalone\app.zip existente"
    }

    if (-not $SkipTray) {
        Invoke-PowerShellScript "bandeja (NexusTray)" (Join-Path $DeployRoot "NexusTray\build.ps1")
    }
    else {
        Write-Step "bandeja ignorada (-SkipTray)"
        if (-not (Test-Path -LiteralPath (Join-Path $DeployRoot "NexusTray\dist\NexusTray.exe") -PathType Leaf)) {
            Fail "NexusTray\dist\NexusTray.exe não existe; remova -SkipTray."
        }
        Write-Ok "usando NexusTray.exe existente"
    }

    if (-not $SkipAgent) {
        Invoke-PowerShellScript "agente (NexusAgent)" (Join-Path $DeployRoot "NexusAgent\build.ps1")
    }
    else {
        Write-Step "agente ignorado (-SkipAgent)"
        if (-not (Test-Path -LiteralPath (Join-Path $DeployRoot "NexusAgent\dist\NexusAgent.exe") -PathType Leaf)) {
            Fail "NexusAgent\dist\NexusAgent.exe não existe; remova -SkipAgent."
        }
        Write-Ok "usando NexusAgent.exe existente"
    }

    Invoke-PowerShellScript "setup (Inno Setup)" (Join-Path $DeployRoot "build-instalador.ps1")
}
finally {
    Pop-Location
}

$sourceSetup = Join-Path $OutDir ("NexusSetup-{0}.exe" -f $Version)
if (-not (Test-Path -LiteralPath $sourceSetup -PathType Leaf)) {
    Fail "O setup não foi encontrado em $sourceSetup."
}

$sourceHash = (Get-FileHash -LiteralPath $sourceSetup -Algorithm SHA256).Hash
Set-Content -LiteralPath ($sourceSetup + ".sha256") -Value ("{0}  {1}" -f $sourceHash, (Split-Path -Leaf $sourceSetup)) -Encoding ASCII

$destination = $sourceSetup
if ($OutputPath) {
    $resolved = [System.IO.Path]::GetFullPath($OutputPath)
    if ([System.IO.Path]::GetExtension($resolved) -ieq ".exe") {
        $destination = $resolved
    }
    else {
        $destination = Join-Path $resolved ("NexusSetup-{0}.exe" -f $Version)
    }

    $destinationDir = Split-Path -Parent $destination
    if ($destinationDir -and -not (Test-Path -LiteralPath $destinationDir)) {
        New-Item -ItemType Directory -Force -Path $destinationDir | Out-Null
    }

    try {
        Copy-Item -LiteralPath $sourceSetup -Destination $destination -Force:$Force
    }
    catch {
        Fail "Não foi possível copiar o setup para ${destination}: $($_.Exception.Message)"
    }
    Set-Content -LiteralPath ($destination + ".sha256") -Value ("{0}  {1}" -f $sourceHash, (Split-Path -Leaf $destination)) -Encoding ASCII
}

$item = Get-Item -LiteralPath $destination
$total.Stop()

Write-Host ""
Write-Host "Deploy concluído." -ForegroundColor Green
Write-Host "  Versão:   $Version"
Write-Host "  Setup:    $($item.FullName)"
Write-Host ("  Tamanho:  {0:N0} bytes ({1:N1} MB)" -f $item.Length, ($item.Length / 1MB))
Write-Host "  SHA-256:  $sourceHash"
Write-Host "  Hash:     $($item.FullName).sha256"
Write-Host ("  Tempo:    {0:N1} min" -f $total.Elapsed.TotalMinutes)
exit 0
