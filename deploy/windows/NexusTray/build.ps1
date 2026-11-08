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
    $onPath = Get-Command dotnet -ErrorAction SilentlyContinue
    if ($onPath) { $candidates.Add($onPath.Source) }
    if ($env:USERPROFILE) { $candidates.Add((Join-Path $env:USERPROFILE ".dotnet\dotnet.exe")) }

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

# Ícone do arquivo: o atalho Bandeja do Nexus usa wscript.exe, então o símbolo
# do Nexus precisa estar embutido no NexusTray.exe (<ApplicationIcon>).
$icon = Join-Path $PSScriptRoot "NexusTray.ico"
$iconGenerator = Join-Path $PSScriptRoot "..\..\..\scripts\gerar-icone-tray.mjs"
$iconProblem = $null
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if (-not (Test-Path -LiteralPath $iconGenerator -PathType Leaf)) {
    $iconProblem = "gerador não encontrado em $iconGenerator"
}
elseif (-not $nodeCommand) {
    $iconProblem = "node não encontrado no PATH"
}
else {
    Write-Host "Gerando NexusTray.ico a partir de public\logo.svg" -ForegroundColor Cyan
    & $nodeCommand.Source $iconGenerator
    if ($LASTEXITCODE -ne 0) {
        $iconProblem = "scripts\gerar-icone-tray.mjs falhou (código $LASTEXITCODE)"
    }
}

if ($iconProblem) {
    if (Test-Path -LiteralPath $icon -PathType Leaf) {
        Write-Warning "Ícone: $iconProblem. Usando o NexusTray.ico existente."
    }
    else {
        throw ("O ícone da bandeja não pôde ser gerado ($iconProblem) e não existe em $icon. " +
            "Rode 'node scripts\gerar-icone-tray.mjs' antes de publicar.")
    }
}
elseif (-not (Test-Path -LiteralPath $icon -PathType Leaf)) {
    throw "O gerador terminou sem criar $icon. O .exe ficaria sem o ícone do Nexus."
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
