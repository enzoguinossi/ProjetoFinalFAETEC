# Compila o instalador autocontido do Nexus com Inno Setup 7.
# Compatível com Windows PowerShell 5.1.
#
# Antes de compilar, monta deploy\windows\payload (Node portátil, MySQL,
# Caddy, VC++, NSSM, app.zip standalone e SQL). O payload NÃO é versionado:
# é baixado/copiado por scripts\preparar-payload.ps1.
#
# Localiza o ISCC.exe nesta ordem: -IsccPath, PATH, instalações do Inno Setup
# em Program Files e, por último, o pacote NuGet Tools.InnoSetup 7.1.0 em
# %TEMP%\nexus-innosetup (baixado automaticamente).
[CmdletBinding()]
param(
    [string]$Version = "",
    [string]$IsccPath = "",
    [string]$PayloadDir = ""
)

$ErrorActionPreference = "Stop"
$ScriptRoot = $PSScriptRoot

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

$manifestPath = Join-Path $ScriptRoot "manifesto.json"
if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
    Fail "manifesto.json não encontrado em $manifestPath."
}
try {
    $manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
}
catch {
    Fail "Manifesto inválido em ${manifestPath}: $($_.Exception.Message)"
}

# --- Payload -----------------------------------------------------------------
$prepareScript = Join-Path $ScriptRoot "..\..\scripts\preparar-payload.ps1"
if (-not (Test-Path -LiteralPath $prepareScript -PathType Leaf)) {
    Fail "scripts\preparar-payload.ps1 não encontrado em $prepareScript."
}

$payloadArguments = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $prepareScript)
if ($PayloadDir) {
    $payloadArguments += @("-PayloadDir", $PayloadDir)
}
Write-Step "Montando o payload embutido"
$powershellExe = Join-Path $PSHOME "powershell.exe"
if (-not (Test-Path -LiteralPath $powershellExe -PathType Leaf)) {
    $powershellExe = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"
}
& $powershellExe @payloadArguments
if ($LASTEXITCODE -ne 0) {
    Fail "Falha ao montar o payload (scripts\preparar-payload.ps1). Veja as mensagens acima."
}

$payloadRoot = if ($PayloadDir) { $PayloadDir } else { Join-Path $ScriptRoot "payload" }
$requiredPayload = @(
    @{ Path = (Join-Path $payloadRoot ("node\" + [string]$manifest.node.archive)); Label = "Node.js" },
    @{ Path = (Join-Path $payloadRoot ("mysql\" + [string]$manifest.mysql.archive)); Label = "MySQL" },
    @{ Path = (Join-Path $payloadRoot ("caddy\" + [string]$manifest.caddy.archive)); Label = "Caddy" },
    @{ Path = (Join-Path $payloadRoot ("vcredist\" + [string]$manifest.vcredist.archive)); Label = "VC++" },
    @{ Path = (Join-Path $payloadRoot "nssm\nssm.exe"); Label = "NSSM" },
    @{ Path = (Join-Path $payloadRoot "app\app.zip"); Label = "app.zip" },
    @{ Path = (Join-Path $payloadRoot "sql\schema.sql"); Label = "schema.sql" },
    @{ Path = (Join-Path $payloadRoot "sql\seed.sql"); Label = "seed.sql" },
    @{ Path = (Join-Path $payloadRoot "sql\migracoes\002-tipos-destinatario.sql"); Label = "migração 002" }
)
foreach ($item in $requiredPayload) {
    if (-not (Test-Path -LiteralPath $item.Path -PathType Leaf)) {
        Fail "Payload incompleto: $($item.Label) não encontrado em $($item.Path)."
    }
    Write-Ok "$($item.Label)"
}

# --- Bandeja -----------------------------------------------------------------
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

# O atalho Bandeja do Nexus usa wscript.exe (elevação sem UAC); o ícone do
# atalho vem deste .ico, que também é embutido no NexusTray.exe.
$trayIcon = Join-Path $ScriptRoot "NexusTray\NexusTray.ico"
if (-not (Test-Path -LiteralPath $trayIcon -PathType Leaf)) {
    Fail ("NexusTray.ico não encontrado em $trayIcon. " +
        "Gere com 'node scripts\gerar-icone-tray.mjs' antes de compilar o setup; " +
        "sem ele o atalho Bandeja do Nexus fica sem o ícone do Nexus.")
}
Write-Ok "NexusTray.ico"

# --- Agente ------------------------------------------------------------------
# Não publica automaticamente: o serviço é um projeto .NET separado e o setup
# precisa do exe já gerado (NexusAgent\build.ps1).
$agentExe = Join-Path $ScriptRoot "NexusAgent\dist\NexusAgent.exe"
if (-not (Test-Path -LiteralPath $agentExe -PathType Leaf)) {
    Fail ("NexusAgent.exe não encontrado em $agentExe. " +
        "Publique o agente com deploy\windows\NexusAgent\build.ps1 antes de gerar o setup.")
}
Write-Ok "NexusAgent.exe"

$progressPage = Join-Path $ScriptRoot "progresso\index.html"
if (-not (Test-Path -LiteralPath $progressPage -PathType Leaf)) {
    Fail "progresso\index.html não encontrado em $progressPage; a página /progresso/ ficaria indisponível."
}
Write-Ok "progresso\index.html"

# --- ISCC --------------------------------------------------------------------
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
Write-Host "  ISCC:    $iscc"
Write-Host "  Versão:  $Version"
Write-Host "  Payload: $payloadRoot"

$exitCode = 0
Push-Location $ScriptRoot
try {
    if (Test-Path -LiteralPath $setupExe) {
        Remove-Item -LiteralPath $setupExe -Force
    }
    if ($PayloadDir) {
        & $iscc "/DMyAppVersion=$Version" "/DPayloadDir=$payloadRoot" $iss
    }
    else {
        & $iscc "/DMyAppVersion=$Version" $iss
    }
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
exit 0
