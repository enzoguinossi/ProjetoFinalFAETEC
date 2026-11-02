# Compila o instalador do Nexus com Inno Setup 7.
# Compatível com Windows PowerShell 5.1.
#
# Localiza o ISCC.exe nesta ordem: -IsccPath, PATH, instalações do Inno Setup
# em Program Files e, por último, o pacote NuGet Tools.InnoSetup 7.1.0 em
# %TEMP%\nexus-innosetup (baixado automaticamente).
[CmdletBinding()]
param(
    [string]$Version = "",
    [string]$Tag = "",
    [string]$IsccPath = ""
)

$ErrorActionPreference = "Stop"
$ScriptRoot = $PSScriptRoot

function Write-Step {
    param([Parameter(Mandatory = $true)][string]$Message)
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Fail {
    param([Parameter(Mandatory = $true)][string]$Message)
    Write-Host ""
    Write-Host "[ERRO] $Message" -ForegroundColor Red
    exit 1
}

if (-not $Version) {
    $packagePath = Join-Path $ScriptRoot "..\..\package.json"
    if (-not (Test-Path -LiteralPath $packagePath -PathType Leaf)) {
        Fail "package.json não encontrado em $packagePath. Informe -Version."
    }
    try {
        $package = Get-Content -LiteralPath $packagePath -Raw -Encoding UTF8 | ConvertFrom-Json
    }
    catch {
        Fail "Não foi possível ler $packagePath`: $($_.Exception.Message)"
    }
    $Version = [string]$package.version
}
$Version = $Version.Trim()
if (-not $Version) { Fail "Versão vazia. Informe -Version." }
if ($Version -match '[\\/:*?"<>|]') { Fail "Versão inválida para nome de arquivo: $Version" }

if (-not $Tag) { $Tag = "v$Version" }
$Tag = $Tag.Trim()
if (-not $Tag) { Fail "Tag vazia. Informe -Tag." }

function Test-Iscc {
    param([Parameter(Mandatory = $true)][string]$Path)
    return (Test-Path -LiteralPath $Path -PathType Leaf)
}

function Resolve-Iscc {
    param([string]$Explicit)

    if ($Explicit) {
        if (Test-Iscc -Path $Explicit) { return (Resolve-Path -LiteralPath $Explicit).Path }
        Fail "ISCC.exe não encontrado em '$Explicit'."
    }

    $command = Get-Command ISCC.exe -ErrorAction SilentlyContinue
    if ($command -and (Test-Iscc -Path $command.Source)) {
        return $command.Source
    }

    $candidates = New-Object System.Collections.Generic.List[string]
    $programFiles = $env:ProgramFiles
    $programFilesX86 = ${env:ProgramFiles(x86)}
    if ($programFiles) {
        $candidates.Add((Join-Path $programFiles "Inno Setup 7\ISCC.exe"))
        $candidates.Add((Join-Path $programFiles "Inno Setup 6\ISCC.exe"))
    }
    if ($programFilesX86) {
        $candidates.Add((Join-Path $programFilesX86 "Inno Setup 7\ISCC.exe"))
        $candidates.Add((Join-Path $programFilesX86 "Inno Setup 6\ISCC.exe"))
    }
    foreach ($candidate in $candidates) {
        if (Test-Iscc -Path $candidate) { return $candidate }
    }

    return ""
}

function Install-IsccFromNuGet {
    $root = Join-Path $env:TEMP "nexus-innosetup"
    $iscc = Join-Path $root "tools\ISCC.exe"
    if (Test-Iscc -Path $iscc) { return $iscc }

    Write-Step "Baixando Inno Setup 7.1.0 do NuGet em $root"
    if (-not (Test-Path -LiteralPath $root)) {
        New-Item -ItemType Directory -Force -Path $root | Out-Null
    }

    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $zip = Join-Path $root "Tools.InnoSetup.7.1.0.zip"
    $url = "https://www.nuget.org/api/v2/package/Tools.InnoSetup/7.1.0"
    try {
        Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing -ErrorAction Stop
        Expand-Archive -LiteralPath $zip -DestinationPath $root -Force -ErrorAction Stop
    }
    catch {
        Fail "Falha ao baixar/extrair o Inno Setup do NuGet: $($_.Exception.Message)"
    }
    finally {
        Remove-Item -LiteralPath $zip -Force -ErrorAction SilentlyContinue
    }

    if (-not (Test-Iscc -Path $iscc)) {
        Fail "ISCC.exe não encontrado após extrair o pacote NuGet em $root."
    }
    return $iscc
}

$trayExe = Join-Path $ScriptRoot "NexusTray\dist\NexusTray.exe"
if (-not (Test-Path -LiteralPath $trayExe -PathType Leaf)) {
    $trayBuild = Join-Path $ScriptRoot "NexusTray\build.ps1"
    if (-not (Test-Path -LiteralPath $trayBuild -PathType Leaf)) {
        Fail "NexusTray.exe não encontrado em $trayExe e NexusTray\build.ps1 não existe."
    }
    Write-Step "NexusTray.exe ausente; publicando a bandeja com NexusTray\build.ps1"
    try {
        & $trayBuild
    }
    catch {
        Fail "Falha ao publicar o NexusTray: $($_.Exception.Message)"
    }
    if (-not (Test-Path -LiteralPath $trayExe -PathType Leaf)) {
        Fail "NexusTray.exe não foi gerado em $trayExe. Rode NexusTray\build.ps1 e tente novamente."
    }
}

$iscc = Resolve-Iscc -Explicit $IsccPath
if (-not $iscc) {
    $iscc = Install-IsccFromNuGet
}

$iss = Join-Path $ScriptRoot "instalador.iss"
if (-not (Test-Path -LiteralPath $iss -PathType Leaf)) {
    Fail "instalador.iss não encontrado em $iss."
}

$outDir = Join-Path $ScriptRoot "out"
$setupExe = Join-Path $outDir ("NexusSetup-{0}.exe" -f $Version)

Write-Step "Compilando $iss"
Write-Host "  ISCC:   $iscc"
Write-Host "  Versão: $Version"
Write-Host "  Tag:    $Tag"

$exitCode = 0
Push-Location $ScriptRoot
try {
    if (Test-Path -LiteralPath $setupExe) {
        Remove-Item -LiteralPath $setupExe -Force
    }
    & $iscc "/DMyAppVersion=$Version" "/DMyAppTag=$Tag" $iss
    $exitCode = $LASTEXITCODE
}
finally {
    Pop-Location
}

if ($exitCode -ne 0) {
    Fail "ISCC falhou (código $exitCode). Veja as mensagens acima."
}
if (-not (Test-Path -LiteralPath $setupExe -PathType Leaf)) {
    Fail "O instalador não foi gerado em $setupExe."
}

$item = Get-Item -LiteralPath $setupExe
Write-Host ""
Write-Host "OK: $($item.FullName)" -ForegroundColor Green
Write-Host ("Tamanho: {0:N0} bytes ({1:N1} MB)" -f $item.Length, ($item.Length / 1MB))
