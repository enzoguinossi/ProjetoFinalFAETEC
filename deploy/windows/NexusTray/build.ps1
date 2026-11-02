# Publica a bandeja do Nexus (self-contained, single-file) em dist\.
# Compatível com Windows PowerShell 5.1.
[CmdletBinding()]
param(
    [string]$Dotnet = ""
)

$ErrorActionPreference = "Stop"
$project = Join-Path $PSScriptRoot "NexusTray.csproj"
$outDir = Join-Path $PSScriptRoot "dist"

function Test-DotnetSdk {
    param([Parameter(Mandatory = $true)][string]$Exe)
    try {
        $sdks = & $Exe --list-sdks 2>$null
        return (($LASTEXITCODE -eq 0) -and ($sdks -and $sdks.Count -gt 0))
    }
    catch {
        return $false
    }
}

if (-not $Dotnet) {
    $candidates = New-Object System.Collections.Generic.List[string]
    $onPath = Get-Command dotnet.exe -ErrorAction SilentlyContinue
    if ($onPath) { $candidates.Add($onPath.Source) }
    if ($env:USERPROFILE) { $candidates.Add((Join-Path $env:USERPROFILE ".dotnet\dotnet.exe")) }
    # SDK usado nesta máquina de build (o dotnet do PATH não tem SDK).
    $candidates.Add("C:\Users\Enzo\.dotnet\dotnet.exe")

    foreach ($candidate in $candidates) {
        if ((Test-Path -LiteralPath $candidate) -and (Test-DotnetSdk -Exe $candidate)) {
            $Dotnet = $candidate
            break
        }
    }
}

if (-not $Dotnet -or -not (Test-Path -LiteralPath $Dotnet)) {
    throw "SDK do .NET não encontrado. Informe -Dotnet com o caminho do dotnet.exe."
}

if (Test-Path -LiteralPath $outDir) {
    Remove-Item -LiteralPath $outDir -Recurse -Force
}

Write-Host "Publicando NexusTray com $Dotnet" -ForegroundColor Cyan
& $Dotnet publish $project -c Release -r win-x64 --self-contained true `
    -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -o $outDir
if ($LASTEXITCODE -ne 0) {
    throw "dotnet publish falhou (código $LASTEXITCODE)."
}

$exe = Join-Path $outDir "NexusTray.exe"
if (-not (Test-Path -LiteralPath $exe)) {
    throw "NexusTray.exe não foi gerado em $outDir."
}

Write-Host "OK: $exe" -ForegroundColor Green
