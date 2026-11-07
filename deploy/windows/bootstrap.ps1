#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Instalação do Nexus em Windows a partir do pacote autocontido.

.DESCRIPTION
    Executa as fases 0 a 7 com estado em
    C:\ProgramData\Nexus\bootstrap.state.json. É idempotente e retomável.

    Nada é baixado na máquina de destino: Node.js portátil, MySQL 8.4.13,
    NSSM, Caddy, VC++ e a aplicação standalone vêm do payload embutido no
    instalador (C:\Program Files\Nexus\Instalador\payload). A aplicação é
    extraída de app.zip e executada por `node server.js` — sem Git, npm,
    `next build` ou Prisma no destino.

    O SQL (schema/seed ou migração 001 + seed) é aplicado por aplicar-sql.ps1
    com mysql.exe.

.PARAMETER Hostname
    Nome DNS usado pelo Caddy (ex.: nexus.escola.local).

.PARAMETER Resume
    Retoma da última fase concluída.

.PARAMETER SkipTray
    Não copia nem registra a bandeja NexusTray.

.PARAMETER TrayExe
    Caminho explícito do NexusTray.exe.

.PARAMETER Force
    Ignora o estado e reinstala a aplicação sobre um diretório existente.

.PARAMETER CredentialsFile
    Arquivo UTF-8 sem BOM com as linhas `root=<senha>` e `app=<senha>`, gravado
    pelo instalador com ACL restrita. Quando informado, substitui a leitura no
    console e o arquivo é apagado ao final (inclusive em erro). Nunca use a
    senha na linha de comando.

.PARAMETER ProgressFile
    Arquivo INI em que o bootstrap grava o andamento para o wizard do Inno:
    [progress] step=0..8, done=0|1 e exit=0|1. Opcional; sem ele nada é gravado.

.PARAMETER NoPrompt
    Não abre Read-Host. Se faltar a senha do root ou do nexus_app, falha com
    mensagem clara em vez de pedir no console. O instalador usa sempre este
    modo e envia as senhas por -CredentialsFile.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$Hostname,
    [switch]$Resume,
    [switch]$SkipTray,
    [string]$TrayExe = "",
    [Security.SecureString]$RootPassword,
    [Security.SecureString]$AppPassword,
    [string]$CredentialsFile = "",
    [string]$ProgressFile = "",
    [switch]$NoPrompt,
    [switch]$Force
)

$ErrorActionPreference = "Continue"

trap {
    try {
        $trapLog = Join-Path $env:TEMP "nexus-fail.log"
        $trapText = "[{0}] EXCEÇÃO: {1}`r`n{2}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $_.Exception.Message, $_.ScriptStackTrace
        Add-Content -LiteralPath $trapLog -Value $trapText -Encoding UTF8 -ErrorAction Stop
    }
    catch {
        # O log de erro não pode mascarar a exceção original.
    }
    throw
}

. (Join-Path $PSScriptRoot "common.ps1")

# Usuário que executou o setup (processo elevado): recebe Modify na árvore de
# dados em C:\ProgramData\Nexus, como a ACL aplicada manualmente na instalação.
$script:NexusInstallUserSid = ([Security.Principal.WindowsIdentity]::GetCurrent()).User.Value

$Hostname = $Hostname.Trim().ToLowerInvariant()
if ($Hostname -notmatch '^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$') {
    Fail "Hostname inválido: '$Hostname'. Informe apenas o nome DNS, sem http://, porta ou caminho."
}

$manifest = Get-Manifest

$ProgramRoot = $script:NexusProgramRoot
$AppDir = $script:NexusAppDir
$PayloadDir = $script:NexusPayloadDir
$DataDir = $script:NexusDataDir
$LogsDir = $script:NexusLogsDir
$ConfigDir = $script:NexusConfigDir
$BackupsDir = $script:NexusBackupsDir
$UploadsDir = $script:NexusUploadsDir
$CaddyDataDir = $script:NexusCaddyDataDir
$CaddyConfigDir = $script:NexusCaddyConfigDir
$CaddyLogsDir = $script:NexusCaddyLogsDir
$CaddyDir = Join-Path $ProgramRoot "caddy"
$NodeDir = $script:NexusNodeDir
$NodeExe = $script:NexusNodeExe
$MySqlDir = $script:NexusMySqlDir
$MySqlExe = Join-Path $MySqlDir "bin\mysql.exe"
$NssmDir = Join-Path $ProgramRoot "tools\nssm"
$NssmExe = Join-Path $NssmDir "nssm.exe"
$CaddyExe = Join-Path $CaddyDir "caddy.exe"
$Caddyfile = Join-Path $ConfigDir "Caddyfile"
$BackupCnf = Join-Path $ConfigDir "backup.cnf"
$EnvPath = Join-Path $AppDir ".env"
$StatePath = Join-Path $DataDir "bootstrap.state.json"
$PsExe = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"
$SqlDir = Join-Path $PSScriptRoot "sql"
if (-not (Test-Path -LiteralPath $SqlDir -PathType Container)) {
    $SqlDir = Join-Path $PayloadDir "sql"
}

# Progresso para o wizard do Inno Setup (arquivo INI em {tmp}).
$script:NexusProgressFile = $ProgressFile
$script:NexusProgressStep = 0
$script:NexusBootstrapExit = 1

function Write-NexusProgress {
    param(
        [int]$Step = $script:NexusProgressStep,
        [int]$Done = 0,
        [int]$ExitCode = 0
    )
    if (-not $script:NexusProgressFile) { return }
    $script:NexusProgressStep = $Step
    try {
        $content = "[progress]`r`nstep=$Step`r`ndone=$Done`r`nexit=$ExitCode`r`n"
        [System.IO.File]::WriteAllText($script:NexusProgressFile, $content, [System.Text.Encoding]::ASCII)
    }
    catch {
        # O arquivo de progresso nunca pode interromper a instalação.
    }
}

# Diretórios necessários antes do transcript e do estado.
foreach ($dir in @(
    $ProgramRoot,
    $DataDir,
    $LogsDir,
    $ConfigDir,
    $BackupsDir,
    (Join-Path $BackupsDir "db"),
    (Join-Path $BackupsDir "uploads"),
    (Join-Path $BackupsDir "config"),
    $UploadsDir
)) {
    if (-not (Test-Path -LiteralPath $dir)) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
    }
}

function Save-BootstrapState {
    param([Parameter(Mandatory = $true)][hashtable]$State)
    $State.updatedAt = (Get-Date).ToString("s")
    $json = $State | ConvertTo-Json -Depth 6
    $encoding = New-Object System.Text.UTF8Encoding -ArgumentList $false
    [System.IO.File]::WriteAllText($StatePath, $json, $encoding)
}

function Get-PreviousState {
    if (-not (Test-Path -LiteralPath $StatePath)) { return $null }
    try {
        return (Get-Content -LiteralPath $StatePath -Raw -Encoding UTF8 | ConvertFrom-Json)
    }
    catch {
        return $null
    }
}

function Get-PayloadFile {
    param(
        [Parameter(Mandatory = $true)][string]$RelativePath,
        [Parameter(Mandatory = $true)][string]$Label
    )
    $path = Join-Path $PayloadDir $RelativePath
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        Fail ("$Label não encontrado no payload ($path). " +
            "O instalador precisa ter sido gerado por build-instalador.ps1 com o payload completo.")
    }
    return $path
}

function Assert-Payload {
    Write-Step "Validando o payload embutido"
    $required = @(
        @{ Path = (Join-Path "node" ([string]$manifest.node.archive)); Label = "Node.js $($manifest.node.version)" },
        @{ Path = (Join-Path "mysql" ([string]$manifest.mysql.archive)); Label = "MySQL $($manifest.mysql.version)" },
        @{ Path = (Join-Path "caddy" ([string]$manifest.caddy.archive)); Label = "Caddy $($manifest.caddy.version)" },
        @{ Path = (Join-Path "vcredist" ([string]$manifest.vcredist.archive)); Label = "VC++ Redistributable" },
        @{ Path = "nssm\nssm.exe"; Label = "NSSM" },
        @{ Path = "app\app.zip"; Label = "aplicação standalone (app.zip)" },
        @{ Path = "sql\schema.sql"; Label = "schema.sql" },
        @{ Path = "sql\seed.sql"; Label = "seed.sql" },
        @{ Path = "sql\migracoes\001-unidades-pct10-cx50.sql"; Label = "migração 001" }
    )
    foreach ($item in $required) {
        $path = Join-Path $PayloadDir $item.Path
        if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
            Fail "Arquivo obrigatório ausente no payload: $($item.Label) ($path)"
        }
        Write-Ok "$($item.Label)"
    }
}

function Install-PortableNode {
    $nodeZip = Get-PayloadFile -RelativePath (Join-Path "node" ([string]$manifest.node.archive)) -Label "Node.js"
    $expectedVersion = "v" + [string]$manifest.node.version
    if (Test-Path -LiteralPath $NodeExe -PathType Leaf) {
        $current = ([string](& $NodeExe "--version" 2>$null | Select-Object -First 1)).Trim()
        if ($current -eq $expectedVersion) {
            Write-Ok "Node.js portátil já presente ($current)."
            return
        }
        Write-Warn "Node.js portátil em versão inesperada ('$current'); reinstalando $expectedVersion."
    }

    $appService = Get-Service -Name "NexusApp" -ErrorAction SilentlyContinue
    if ($appService -and $appService.Status.ToString() -ne "Stopped") {
        Stop-Service -Name "NexusApp" -Force
        if (-not (Wait-ServiceState -Name "NexusApp" -Status "Stopped" -TimeoutSeconds 60)) {
            Fail "O serviço NexusApp não parou para atualizar o Node portátil."
        }
    }

    $tempRoot = Join-Path $env:TEMP ("nexus-node-" + [guid]::NewGuid().ToString("N"))
    try {
        New-Item -ItemType Directory -Force -Path $tempRoot | Out-Null
        Write-Ok "Extraindo Node.js $($manifest.node.version) do payload..."
        Expand-Archive -LiteralPath $nodeZip -DestinationPath $tempRoot -Force
        $sourceDir = Get-ChildItem -LiteralPath $tempRoot -Directory -ErrorAction SilentlyContinue |
            Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName "node.exe") } |
            Select-Object -First 1
        if (-not $sourceDir) {
            Fail "O pacote do Node.js não contém node.exe."
        }
        if (Test-Path -LiteralPath $NodeDir) {
            Remove-Item -LiteralPath $NodeDir -Recurse -Force
        }
        New-Item -ItemType Directory -Force -Path $NodeDir | Out-Null
        Copy-Item -Path (Join-Path $sourceDir.FullName "*") -Destination $NodeDir -Recurse -Force
    }
    finally {
        if (Test-Path -LiteralPath $tempRoot) {
            Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
        }
    }

    if (-not (Test-Path -LiteralPath $NodeExe -PathType Leaf)) {
        Fail "node.exe não encontrado em $NodeDir após a extração."
    }
    Unblock-File -LiteralPath $NodeExe -ErrorAction SilentlyContinue
    $installed = ([string](& $NodeExe "--version" 2>$null | Select-Object -First 1)).Trim()
    if ($installed -ne $expectedVersion) {
        Fail "Node.js portátil é '$installed'; esperado '$expectedVersion'."
    }
    Write-Ok "Node.js portátil $installed instalado em $NodeDir."
}

function Install-Nssm {
    $source = Get-PayloadFile -RelativePath "nssm\nssm.exe" -Label "NSSM"
    $expectedHash = ([string]$manifest.nssm.exe_sha256).ToUpperInvariant()
    $payloadHash = (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash.ToUpperInvariant()
    if ($expectedHash -and $payloadHash -ne $expectedHash) {
        Fail "O hash do NSSM embutido não confere (esperado $expectedHash, obtido $payloadHash)."
    }

    # Upgrade comum: o NSSM instalado é o host dos serviços NexusApp/NexusCaddy e
    # não pode ser sobrescrito em uso. Se o hash confere, nem toca no arquivo.
    if (Test-Path -LiteralPath $NssmExe -PathType Leaf) {
        $installedHash = (Get-FileHash -LiteralPath $NssmExe -Algorithm SHA256).Hash.ToUpperInvariant()
        if ($installedHash -eq $payloadHash) {
            Write-Ok "NSSM $($manifest.nssm.version) já presente em $NssmExe (hash confere)."
            return
        }
        Write-Warn "O NSSM instalado difere do payload; atualizando $NssmExe."
    }

    if (-not (Test-Path -LiteralPath $NssmDir)) {
        New-Item -ItemType Directory -Force -Path $NssmDir | Out-Null
    }

    # Caddy depende do App: para primeiro o Caddy; no finally, reinicia o App e
    # depois o Caddy. O finally não lança para não mascarar a falha original.
    $stopped = @()
    try {
        foreach ($serviceName in @("NexusCaddy", "NexusApp")) {
            $service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
            if (-not $service) { continue }
            if ($service.Status.ToString() -eq "Stopped") { continue }
            Write-Ok "Parando $serviceName para atualizar o NSSM..."
            Stop-Service -Name $serviceName -Force -ErrorAction SilentlyContinue
            if (-not (Wait-ServiceState -Name $serviceName -Status "Stopped" -TimeoutSeconds 60)) {
                Fail "O serviço $serviceName não parou para atualizar o NSSM. Pare-o manualmente e repita."
            }
            $stopped += $serviceName
        }
        Copy-Item -LiteralPath $source -Destination $NssmExe -Force -ErrorAction Stop
        Unblock-File -LiteralPath $NssmExe -ErrorAction SilentlyContinue
    }
    finally {
        foreach ($serviceName in @("NexusApp", "NexusCaddy")) {
            if ($stopped -notcontains $serviceName) { continue }
            try {
                $service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
                if (-not $service -or $service.Status.ToString() -eq "Running") { continue }
                Start-Service -Name $serviceName -ErrorAction Stop
                if (-not (Wait-ServiceState -Name $serviceName -Status "Running" -TimeoutSeconds 120)) {
                    Write-Warn "O serviço $serviceName não voltou a iniciar após a atualização do NSSM."
                }
                else {
                    Write-Ok "$serviceName reiniciado."
                }
            }
            catch {
                Write-Warn "Não foi possível reiniciar $serviceName após a atualização do NSSM: $($_.Exception.Message)"
            }
        }
    }
    Write-Ok "NSSM $($manifest.nssm.version) instalado em $NssmExe."
}

function Install-Caddy {
    $expectedVersion = "v" + [string]$manifest.caddy.version
    if (Test-Path -LiteralPath $CaddyExe -PathType Leaf) {
        $current = ([string](& $CaddyExe "version" 2>&1 | Select-Object -First 1)).Trim()
        $currentVersion = ($current -split '\s+')[0]
        if ($currentVersion -eq $expectedVersion) {
            Write-Ok "Caddy já presente: $current"
            return
        }
        Write-Warn "O Caddy instalado ('$current') difere de $expectedVersion; atualizando."
    }

    $caddyZip = Get-PayloadFile -RelativePath (Join-Path "caddy" ([string]$manifest.caddy.archive)) -Label "Caddy"
    $tempRoot = Join-Path $env:TEMP ("nexus-caddy-" + [guid]::NewGuid().ToString("N"))
    $stopped = $false
    try {
        $service = Get-Service -Name "NexusCaddy" -ErrorAction SilentlyContinue
        if ($service -and $service.Status.ToString() -ne "Stopped") {
            Write-Ok "Parando NexusCaddy para atualizar o Caddy..."
            Stop-Service -Name "NexusCaddy" -Force -ErrorAction SilentlyContinue
            if (-not (Wait-ServiceState -Name "NexusCaddy" -Status "Stopped" -TimeoutSeconds 60)) {
                Fail "O serviço NexusCaddy não parou para atualizar o Caddy. Pare-o manualmente e repita."
            }
            $stopped = $true
        }

        New-Item -ItemType Directory -Force -Path $tempRoot | Out-Null
        Write-Ok "Extraindo Caddy $($manifest.caddy.version) do payload..."
        Expand-Archive -LiteralPath $caddyZip -DestinationPath $tempRoot -Force
        $binary = Get-ChildItem -Path $tempRoot -Recurse -Filter "caddy.exe" -File -ErrorAction SilentlyContinue |
            Select-Object -First 1
        if (-not $binary) {
            Fail "caddy.exe não encontrado no pacote embutido."
        }
        if (-not (Test-Path -LiteralPath $CaddyDir)) {
            New-Item -ItemType Directory -Force -Path $CaddyDir | Out-Null
        }
        Copy-Item -LiteralPath $binary.FullName -Destination $CaddyExe -Force -ErrorAction Stop
        Unblock-File -LiteralPath $CaddyExe -ErrorAction SilentlyContinue
    }
    finally {
        if (Test-Path -LiteralPath $tempRoot) {
            Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
        }
        if ($stopped) {
            try {
                $service = Get-Service -Name "NexusCaddy" -ErrorAction SilentlyContinue
                if ($service -and $service.Status.ToString() -ne "Running") {
                    Start-Service -Name "NexusCaddy" -ErrorAction Stop
                    if (-not (Wait-ServiceState -Name "NexusCaddy" -Status "Running" -TimeoutSeconds 60)) {
                        Write-Warn "O serviço NexusCaddy não voltou a iniciar após a atualização do Caddy."
                    }
                    else {
                        Write-Ok "NexusCaddy reiniciado."
                    }
                }
            }
            catch {
                Write-Warn "Não foi possível reiniciar o NexusCaddy após a atualização do Caddy: $($_.Exception.Message)"
            }
        }
    }
    $installed = ([string](& $CaddyExe "version" 2>&1 | Select-Object -First 1)).Trim()
    $installedVersion = ($installed -split '\s+')[0]
    if ($installedVersion -ne $expectedVersion) {
        Fail "Caddy instalado é '$installed'; esperado '$expectedVersion'."
    }
    Write-Ok "Caddy instalado: $installed"
}

function Install-VcRedist {
    $vcInstalled = $false
    foreach ($key in @(
        "HKLM:\SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64",
        "HKLM:\SOFTWARE\WOW6432Node\Microsoft\VisualStudio\14.0\VC\Runtimes\x64"
    )) {
        $value = Get-ItemProperty -Path $key -ErrorAction SilentlyContinue
        if ($value -and $value.Installed -eq 1) {
            $vcInstalled = $true
            break
        }
    }
    if ($vcInstalled) {
        Write-Ok "VC++ Redistributable x64 já instalado."
        return
    }
    $vcPath = Get-PayloadFile -RelativePath (Join-Path "vcredist" ([string]$manifest.vcredist.archive)) -Label "VC++ Redistributable"
    Install-Exe -Path $vcPath -Arguments "/install /quiet /norestart" -Label "VC++ Redistributable"
}

function Expand-AppPackage {
    $appZip = Get-PayloadFile -RelativePath "app\app.zip" -Label "aplicação standalone"
    $appService = Get-Service -Name "NexusApp" -ErrorAction SilentlyContinue
    if ($appService -and $appService.Status.ToString() -ne "Stopped") {
        Write-Ok "Parando NexusApp para atualizar a aplicação..."
        Stop-Service -Name "NexusApp" -Force
        if (-not (Wait-ServiceState -Name "NexusApp" -Status "Stopped" -TimeoutSeconds 60)) {
            Fail "O serviço NexusApp não parou para atualizar a aplicação."
        }
    }

    $previousDir = ""
    if (Test-Path -LiteralPath $AppDir) {
        $previousDir = Join-Path $ProgramRoot ("app.prev-manual-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
        Move-Item -LiteralPath $AppDir -Destination $previousDir -ErrorAction Stop
        Write-Ok "Aplicação anterior movida para $previousDir."
    }

    New-Item -ItemType Directory -Force -Path $AppDir | Out-Null
    Write-Ok "Extraindo a aplicação standalone..."
    Expand-Archive -LiteralPath $appZip -DestinationPath $AppDir -Force -ErrorAction Stop
    if (-not (Test-Path -LiteralPath (Join-Path $AppDir "server.js") -PathType Leaf)) {
        Fail "app.zip não contém server.js no diretório raiz."
    }

    # Preserva o .env (segredos e URL do banco) na atualização/reinstalação.
    if ($previousDir) {
        $previousEnv = Join-Path $previousDir ".env"
        if (Test-Path -LiteralPath $previousEnv -PathType Leaf) {
            Copy-Item -LiteralPath $previousEnv -Destination $EnvPath -Force
            Write-Ok ".env anterior preservado."
        }
    }
    return $previousDir
}

function Get-AppVersion {
    $packagePath = Join-Path $AppDir "package.json"
    if (-not (Test-Path -LiteralPath $packagePath -PathType Leaf)) {
        return ""
    }
    try {
        return [string](Get-Content -LiteralPath $packagePath -Raw -Encoding UTF8 | ConvertFrom-Json).version
    }
    catch {
        return ""
    }
}

function Write-AppEnvironment {
    $appPasswordPlain = $null
    $jwtSecret = $null
    $generatedJwt = $false
    Suspend-Transcript
    try {
        if (Test-Path -LiteralPath $BackupCnf) {
            $appPasswordPlain = Get-CnfValue -Path $BackupCnf -Section "client" -Key "password"
        }
        if (-not $appPasswordPlain) {
            Fail "Senha de nexus_app não encontrada em $BackupCnf. Refaça a fase 2."
        }

        Set-EnvFile -Path $EnvPath -Key "DATABASE_URL" -Value ('"mysql://nexus_app:{0}@127.0.0.1:{1}/nexus_prod"' -f $appPasswordPlain, $script:NexusMySqlPort) -ReadIdentities @("S-1-5-20")
        Set-EnvFile -Path $EnvPath -Key "UPLOADS_DIR" -Value $UploadsDir -ReadIdentities @("S-1-5-20")
        Set-EnvFile -Path $EnvPath -Key "NODE_ENV" -Value "production" -ReadIdentities @("S-1-5-20")
        Set-EnvFile -Path $EnvPath -Key "PORT" -Value "3000" -ReadIdentities @("S-1-5-20")
        Set-EnvFile -Path $EnvPath -Key "HOSTNAME" -Value "127.0.0.1" -ReadIdentities @("S-1-5-20")
        $jwtSecret = Get-EnvValue -Path $EnvPath -Key "JWT_SECRET"
        if (-not $jwtSecret) {
            $jwtSecret = New-RandomSecret -Bytes 48
            Set-EnvFile -Path $EnvPath -Key "JWT_SECRET" -Value ('"{0}"' -f $jwtSecret) -ReadIdentities @("S-1-5-20")
            $generatedJwt = $true
        }
    }
    finally {
        Resume-Transcript
        $appPasswordPlain = $null
        $jwtSecret = $null
    }
    if ($generatedJwt) {
        Write-Ok "JWT_SECRET gerado para esta instalação."
    }
    Protect-File -Path $EnvPath -ReadIdentities @("S-1-5-20")
    Write-Ok "Arquivo .env criado com ACL restrita (NetworkService lê; Administrators/SYSTEM controlam)."
}

function Read-NexusCredentialsFile {
    param([Parameter(Mandatory = $true)][string]$Path)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        Fail ("Arquivo de credenciais não encontrado em '$Path'. " +
            "Execute o instalador novamente e preencha a página de credenciais do MySQL.")
    }
    $rootPlain = $null
    $appPlain = $null
    foreach ($line in [System.IO.File]::ReadAllLines($Path, [System.Text.Encoding]::UTF8)) {
        if ($line -match '^root=(.*)$') {
            $rootPlain = $matches[1]
            continue
        }
        if ($line -match '^app=(.*)$') {
            $appPlain = $matches[1]
        }
    }
    $rootMessage = Test-MysqlRootPassword -Plain $rootPlain
    if ($rootMessage) { Fail $rootMessage }
    $appMessage = Test-SafeAppPassword -Plain $appPlain -Label "Senha de nexus_app"
    if ($appMessage) { Fail $appMessage }

    $result = @{
        Root = (ConvertTo-SecureString -String $rootPlain -AsPlainText -Force)
        App  = (ConvertTo-SecureString -String $appPlain -AsPlainText -Force)
    }
    $rootPlain = $null
    $appPlain = $null
    return $result
}

$previousState = Get-PreviousState
if ($Resume -and -not $previousState) {
    Fail "Não há estado anterior em $StatePath. Rode sem -Resume."
}

$state = @{
    version        = 2
    hostname       = $Hostname
    appVersion     = ""
    completedPhase = -1
    paused         = $false
    pausedPhase    = $null
    startedAt      = (Get-Date).ToString("s")
    updatedAt      = (Get-Date).ToString("s")
}

if ($previousState -and -not $Force) {
    $state.completedPhase = [int]$previousState.completedPhase
    if ($previousState.startedAt) { $state.startedAt = [string]$previousState.startedAt }
    if ($previousState.appVersion) { $state.appVersion = [string]$previousState.appVersion }
    $state.paused = [bool]$previousState.paused
    $state.pausedPhase = $previousState.pausedPhase
    if ($previousState.hostname -and [string]$previousState.hostname -ne $Hostname) {
        Fail "O hostname mudou desde a instalação anterior ('$($previousState.hostname)'). Use -Force para reconfigurar."
    }
}

$startPhase = 0
if ($Resume -and -not $Force) {
    $startPhase = [int]$state.completedPhase + 1
    if ($state.paused -and $state.pausedPhase) {
        $startPhase = [int]$state.pausedPhase
    }
    if ($startPhase -lt 0) { $startPhase = 0 }
    if ($startPhase -gt 7) { $startPhase = 7 }
    # Permite refazer a bandeja/tarefas quando a instalação já terminou.
    if ($state.completedPhase -ge 7 -and -not $SkipTray) { $startPhase = 6 }
}

$transcriptPath = Join-Path $LogsDir ("bootstrap-" + (Get-Date -Format "yyyyMMdd-HHmmss") + ".log")
Start-NexusTranscript -Path $transcriptPath

function Invoke-Nssm {
    param([Parameter(Mandatory = $true)][string[]]$Arguments)
    $oldPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $output = & $NssmExe @Arguments 2>&1
        $code = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $oldPreference
    }
    if ($code -ne 0) {
        Fail ("NSSM falhou: " + ($Arguments -join " ") + " (código $code)")
    }
}

function Set-NexusService {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$Application,
        [Parameter(Mandatory = $true)][string]$Parameters,
        [Parameter(Mandatory = $true)][string]$Directory,
        [Parameter(Mandatory = $true)][string[]]$Environment,
        [Parameter(Mandatory = $true)][string]$Stdout,
        [Parameter(Mandatory = $true)][string]$Stderr,
        [Parameter(Mandatory = $true)][string]$Description,
        [string]$DependOnService = "",
        [string]$ObjectName = "NT AUTHORITY\NetworkService"
    )

    $existing = Get-Service -Name $Name -ErrorAction SilentlyContinue
    if ($existing) {
        if ($existing.Status.ToString() -ne "Stopped") {
            Stop-Service -Name $Name -Force -ErrorAction SilentlyContinue
            if (-not (Wait-ServiceState -Name $Name -Status "Stopped" -TimeoutSeconds 45)) {
                Fail "O serviço $Name não parou para reconfiguração."
            }
        }
        Invoke-Nssm -Arguments @("set", $Name, "Application", $Application)
    }
    else {
        Invoke-Nssm -Arguments @("install", $Name, $Application)
    }

    Invoke-Nssm -Arguments @("set", $Name, "AppParameters", $Parameters)
    Invoke-Nssm -Arguments @("set", $Name, "AppDirectory", $Directory)
    $envArguments = @("set", $Name, "AppEnvironmentExtra") + $Environment
    Invoke-Nssm -Arguments $envArguments
    Invoke-Nssm -Arguments @("set", $Name, "ObjectName", $ObjectName)
    Invoke-Nssm -Arguments @("set", $Name, "Start", "SERVICE_AUTO_START")
    Invoke-Nssm -Arguments @("set", $Name, "AppStdout", $Stdout)
    Invoke-Nssm -Arguments @("set", $Name, "AppStderr", $Stderr)
    Invoke-Nssm -Arguments @("set", $Name, "AppRotateFiles", "1")
    Invoke-Nssm -Arguments @("set", $Name, "AppRotateOnline", "1")
    Invoke-Nssm -Arguments @("set", $Name, "AppRotateBytes", "10485760")
    Invoke-Nssm -Arguments @("set", $Name, "AppStopMethodConsole", "15000")
    Invoke-Nssm -Arguments @("set", $Name, "AppExit", "Default", "Restart")
    Invoke-Nssm -Arguments @("set", $Name, "AppRestartDelay", "5000")
    Invoke-Nssm -Arguments @("set", $Name, "AppThrottle", "1500")
    Invoke-Nssm -Arguments @("set", $Name, "Description", $Description)
    if ($DependOnService) {
        Invoke-Nssm -Arguments @("set", $Name, "DependOnService", $DependOnService)
    }
}

function Wait-HttpHealth {
    param(
        [Parameter(Mandatory = $true)][string]$Url,
        [int]$TimeoutSeconds = 180
    )
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    $last = $null
    do {
        $last = Test-Health -Url $Url -ExpectDb
        if ($last.Ok) { return $last }
        Start-Sleep -Seconds 3
    } while ((Get-Date) -lt $deadline)
    return $last
}

function Write-BackupCnf {
    param([Parameter(Mandatory = $true)][string]$Password)
    $passwordLine = "password=" + (ConvertTo-MysqlOptionValue $Password)
    $lines = @(
        "[client]",
        "host=127.0.0.1",
        "port=$script:NexusMySqlPort",
        "user=nexus_app",
        $passwordLine,
        "default-character-set=utf8mb4",
        ""
    )
    if (-not (Test-Path -LiteralPath $BackupCnf)) {
        Write-Utf8NoBom -Path $BackupCnf -Lines @("")
    }
    Protect-File -Path $BackupCnf -ModifyIdentities @($script:NexusInstallUserSid)
    Write-Utf8NoBom -Path $BackupCnf -Lines $lines
}

function Ensure-HostnameHostsEntry {
    param([Parameter(Mandatory = $true)][string]$Hostname)
    $hostsPath = Join-Path $env:SystemRoot "System32\drivers\etc\hosts"
    $pattern = "(^|\s){0}(\s|$)" -f [regex]::Escape($Hostname)
    if (Select-String -LiteralPath $hostsPath -Pattern $pattern -ErrorAction SilentlyContinue) {
        return
    }
    try {
        $addresses = [System.Net.Dns]::GetHostAddresses($Hostname) |
            Where-Object { $_.AddressFamily -eq [System.Net.Sockets.AddressFamily]::InterNetwork }
        if ($addresses) { return }
    }
    catch {
        # Nome sem DNS: o próprio servidor resolve pelo hosts.
    }
    Add-Content -LiteralPath $hostsPath -Value ("127.0.0.1`t{0}" -f $Hostname) -Encoding ASCII
    Write-Ok "Hostname $Hostname adicionado ao hosts local (127.0.0.1)."
}

function Set-NexusFirewallRules {
    if (-not (Get-Command New-NetFirewallRule -ErrorAction SilentlyContinue)) {
        Fail "O módulo NetSecurity não está disponível para criar as regras de firewall."
    }

    $rules = @(
        @{ Name = "Nexus HTTP"; Port = 80; Action = "Allow" },
        @{ Name = "Nexus HTTPS"; Port = 443; Action = "Allow" },
        @{ Name = "Nexus MySQL (LAN)"; Port = $script:NexusMySqlPort; Action = "Block" },
        @{ Name = "Nexus Next (LAN)"; Port = 3000; Action = "Block" }
    )
    foreach ($rule in $rules) {
        Get-NetFirewallRule -DisplayName $rule.Name -ErrorAction SilentlyContinue |
            Remove-NetFirewallRule -Confirm:$false -ErrorAction SilentlyContinue
        New-NetFirewallRule `
            -DisplayName $rule.Name `
            -Direction Inbound `
            -Action $rule.Action `
            -Protocol TCP `
            -LocalPort $rule.Port `
            -RemoteAddress LocalSubnet `
            -Profile Any `
            -Enabled True | Out-Null
    }
}

$rootSecure = $null
$appSecure = $null

try {
    Write-NexusProgress -Step 0

    if ($CredentialsFile) {
        $credentials = Read-NexusCredentialsFile -Path $CredentialsFile
        $RootPassword = $credentials.Root
        $AppPassword = $credentials.App
        Remove-Item -LiteralPath $CredentialsFile -Force -ErrorAction SilentlyContinue
    }

    if ($startPhase -le 0) {
        Write-NexusProgress -Step 0
        Write-Step "Fase 0/7 - Pré-checagem (offline)"
        Assert-Admin
        Assert-Payload
        Ensure-HostnameHostsEntry -Hostname $Hostname

        if (-not [Environment]::Is64BitOperatingSystem) {
            Fail "Este projeto exige Windows 64 bits."
        }
        Write-Ok "Windows 64 bits."

        $freeGb = Get-FreeSpaceGB -Drive "C"
        if ($freeGb -lt 5) {
            Fail "Espaço livre insuficiente em C: ($freeGb GB). São necessários pelo menos 5 GB."
        }
        Write-Ok "Espaço livre em C: $freeGb GB."

        $ports = @(
            @{ Port = $script:NexusMySqlPort; Service = $script:NexusMySqlService },
            @{ Port = 3000; Service = "NexusApp" },
            @{ Port = 80; Service = "NexusCaddy" },
            @{ Port = 443; Service = "NexusCaddy" }
        )
        foreach ($entry in $ports) {
            if (-not (Test-TcpPort -Port $entry.Port -TimeoutMs 1500)) {
                continue
            }
            $ownerService = Get-Service -Name $entry.Service -ErrorAction SilentlyContinue
            if (-not $ownerService -or $ownerService.Status.ToString() -ne "Running") {
                $owner = "processo desconhecido"
                $connection = Get-NetTCPConnection -LocalPort $entry.Port -State Listen -ErrorAction SilentlyContinue |
                    Select-Object -First 1
                if ($connection) {
                    $process = Get-Process -Id $connection.OwningProcess -ErrorAction SilentlyContinue
                    if ($process) {
                        $owner = "$($process.ProcessName) (PID $($process.Id))"
                    }
                    else {
                        $owner = "PID $($connection.OwningProcess)"
                    }
                }
                Fail "A porta $($entry.Port) está em uso por $owner. Libere-a antes de continuar."
            }
            Write-Warn "Porta $($entry.Port) em uso pelo serviço $($entry.Service); será reutilizada."
        }
        Write-Ok "Portas $($script:NexusMySqlPort), 3000, 80 e 443 verificadas."

        $state.completedPhase = 0
        $state.paused = $false
        $state.pausedPhase = $null
        Save-BootstrapState -State $state
    }

    if ($startPhase -le 1) {
        Write-NexusProgress -Step 1
        Write-Step "Fase 1/7 - Runtime embutido (VC++, Node, NSSM, Caddy)"
        Assert-Admin

        Install-VcRedist
        Install-PortableNode
        Install-Nssm
        Install-Caddy
        Update-SessionPath

        $state.completedPhase = 1
        $state.paused = $false
        $state.pausedPhase = $null
        Save-BootstrapState -State $state
    }

    if ($startPhase -le 2) {
        Write-NexusProgress -Step 2
        Write-Step "Fase 2/7 - MySQL 8.4 dedicado"
        Assert-Admin

        $serviceExisted = [bool](Get-Service -Name $script:NexusMySqlService -ErrorAction SilentlyContinue)
        $dataDirEmpty = (@(Get-ChildItem -LiteralPath $script:NexusMySqlDataDir -Force -ErrorAction SilentlyContinue).Count -eq 0)
        $legacyDataExists = Test-Path -LiteralPath $script:NexusMySqlLegacyDataDir -PathType Container
        if (-not $serviceExisted -or ($dataDirEmpty -and -not $legacyDataExists)) {
            $credentials = Read-MySqlCredentials -RootPassword $RootPassword -AppPassword $AppPassword -NoPrompt:$NoPrompt
            $rootSecure = $credentials.Root
            $appSecure = $credentials.App
        }

        # Sempre garante os binários 8.4.13, a migração dos dados para
        # C:\ProgramData\Nexus\mysql e o serviço com o my.ini novo. É idempotente.
        Write-Ok "Garantindo o MySQL dedicado (serviço $($script:NexusMySqlService), porta $($script:NexusMySqlPort))..."
        & (Join-Path $PSScriptRoot "instalar-mysql.ps1") `
            -RootPassword $rootSecure `
            -AppPassword $appSecure `
            -Port $script:NexusMySqlPort
        if ($LASTEXITCODE -ne 0) {
            Fail "A instalação do MySQL dedicado falhou (código $LASTEXITCODE). Consulte $LogsDir."
        }

        $mysqlService = Get-Service -Name $script:NexusMySqlService -ErrorAction SilentlyContinue
        if (-not $mysqlService) {
            Fail "O serviço $($script:NexusMySqlService) não foi criado."
        }
        if ($mysqlService.Status.ToString() -ne "Running") {
            Start-Service -Name $script:NexusMySqlService
        }
        if (-not (Wait-ServiceState -Name $script:NexusMySqlService -Status "Running" -TimeoutSeconds 120)) {
            Fail "O serviço $($script:NexusMySqlService) não iniciou."
        }
        $deadline = (Get-Date).AddSeconds(120)
        while (-not (Test-TcpPort -Port $script:NexusMySqlPort -TimeoutMs 2000) -and (Get-Date) -lt $deadline) {
            Start-Sleep -Seconds 2
        }
        if (-not (Test-TcpPort -Port $script:NexusMySqlPort -TimeoutMs 2000)) {
            Fail "O $($script:NexusMySqlService) está em execução, mas não aceita conexões na porta $($script:NexusMySqlPort)."
        }
        Write-Ok "$($script:NexusMySqlService) em execução em 127.0.0.1:$($script:NexusMySqlPort)."

        if (-not (Test-Path -LiteralPath $MySqlExe -PathType Leaf)) {
            Fail "mysql.exe não encontrado em $MySqlExe."
        }

        $needsSetup = $true
        if ($serviceExisted -and (Test-Path -LiteralPath $BackupCnf)) {
            $cnfPort = Get-CnfValue -Path $BackupCnf -Section "client" -Key "port"
            if ([string]$cnfPort -ne [string]$script:NexusMySqlPort) {
                Write-Warn "O backup.cnf usa a porta '$cnfPort'; ele será regravado para $($script:NexusMySqlPort)."
            }
            else {
                $testOut = Join-Path $env:TEMP ("nexus-mysql-test-" + [guid]::NewGuid().ToString("N") + ".out")
                $testErr = Join-Path $env:TEMP ("nexus-mysql-test-" + [guid]::NewGuid().ToString("N") + ".err")
                try {
                    $testArgs = "--defaults-extra-file=`"$BackupCnf`" --protocol=TCP -h 127.0.0.1 -P $script:NexusMySqlPort -D nexus_prod -e `"SELECT 1;`""
                    $testProcess = Start-Process -FilePath $MySqlExe -ArgumentList $testArgs -Wait -PassThru -NoNewWindow `
                        -RedirectStandardOutput $testOut -RedirectStandardError $testErr
                    if ($testProcess.ExitCode -eq 0) {
                        $needsSetup = $false
                        Write-Ok "Banco nexus_prod acessível com o usuário nexus_app."
                    }
                    else {
                        Write-Warn "O usuário nexus_app não conseguiu conectar; a configuração do banco será refeita."
                    }
                }
                finally {
                    Remove-Item -LiteralPath $testOut, $testErr -Force -ErrorAction SilentlyContinue
                }
            }
        }

        if ($needsSetup) {
            if (-not $rootSecure) {
                $credentials = Read-MySqlCredentials -RootPassword $RootPassword -AppPassword $AppPassword -NoPrompt:$NoPrompt
                $rootSecure = $credentials.Root
                $appSecure = $credentials.App
            }
            Write-Ok "Configurando o banco nexus_prod e o usuário nexus_app..."
            & (Join-Path $PSScriptRoot "pos-instalacao-mysql.ps1") `
                -RootPassword $rootSecure `
                -AppPassword $appSecure `
                -Hostname $Hostname
            $mysqlSetupCode = $LASTEXITCODE
            if ($mysqlSetupCode -ne 0) {
                Fail "A configuração do MySQL falhou (código $mysqlSetupCode). Consulte o log em $LogsDir."
            }
            $appPlain = ConvertFrom-SecureStringPlain -Secure $appSecure
            Write-BackupCnf -Password $appPlain
            $appPlain = $null
            Write-Ok "Configuração do MySQL concluída; backup.cnf criado com ACL restrita."
        }

        $state.completedPhase = 2
        $state.paused = $false
        $state.pausedPhase = $null
        Save-BootstrapState -State $state
    }

    if ($startPhase -le 3) {
        Write-NexusProgress -Step 3
        Write-Step "Fase 3/7 - Diretórios e ACLs"
        Assert-Admin

        foreach ($dir in @(
            $ProgramRoot,
            $DataDir,
            $LogsDir,
            $ConfigDir,
            $BackupsDir,
            (Join-Path $BackupsDir "db"),
            (Join-Path $BackupsDir "uploads"),
            (Join-Path $BackupsDir "config"),
            $UploadsDir,
            $script:NexusCaddyDir,
            $CaddyDataDir,
            $CaddyConfigDir,
            $CaddyLogsDir
        )) {
            if (-not (Test-Path -LiteralPath $dir)) {
                New-Item -ItemType Directory -Force -Path $dir | Out-Null
            }
        }

        # ACLs restritas: nada herda Users de C:\ProgramData. O usuário que
        # instalou recebe Modify em toda a árvore de dados e nos arquivos de
        # configuração; os serviços mantêm o acesso atual.
        Set-AclReadExecute -Path $ProgramRoot
        Set-AclReadExecute -Path $ProgramRoot -Identity "S-1-5-19"
        Set-AclRestricted -Path $DataDir -ModifyIdentities @($script:NexusInstallUserSid)
        Set-AclRestricted -Path $UploadsDir -ModifyIdentities @("S-1-5-20", $script:NexusInstallUserSid)
        Set-AclRestricted -Path $LogsDir -ModifyIdentities @("S-1-5-20", $script:NexusInstallUserSid)
        Set-AclRestricted -Path $ConfigDir -ModifyIdentities @($script:NexusInstallUserSid)
        Set-AclRestricted -Path $BackupsDir -ModifyIdentities @($script:NexusInstallUserSid)
        foreach ($dir in @(
            (Join-Path $BackupsDir "db"),
            (Join-Path $BackupsDir "uploads"),
            (Join-Path $BackupsDir "config")
        )) {
            Set-AclRestricted -Path $dir -ModifyIdentities @($script:NexusInstallUserSid)
        }
        foreach ($dir in @(
            $script:NexusCaddyDir,
            $CaddyDataDir,
            $CaddyConfigDir,
            $CaddyLogsDir
        )) {
            Set-AclRestricted -Path $dir -ModifyIdentities @("S-1-5-19", $script:NexusInstallUserSid)
        }

        if (Test-Path -LiteralPath $NodeDir) {
            Set-AclReadExecute -Path $NodeDir -Identity "S-1-5-20"
        }
        if (Test-Path -LiteralPath $MySqlDir) {
            Set-AclReadExecute -Path $MySqlDir -Identity "S-1-5-20"
        }
        if (Test-Path -LiteralPath $script:NexusMySqlRoot) {
            Set-AclRestricted -Path $script:NexusMySqlRoot -ModifyIdentities @("S-1-5-20", $script:NexusInstallUserSid)
            if (Test-Path -LiteralPath $script:NexusMySqlDataDir) {
                Set-AclRestricted -Path $script:NexusMySqlDataDir -ModifyIdentities @("S-1-5-20", $script:NexusInstallUserSid)
            }
            if (Test-Path -LiteralPath $script:NexusMySqlConfig) {
                Protect-File -Path $script:NexusMySqlConfig -ReadIdentities @("S-1-5-20") -ModifyIdentities @($script:NexusInstallUserSid)
            }
        }
        $templatePath = Join-Path $PSScriptRoot "Caddyfile"
        if (-not (Test-Path -LiteralPath $templatePath -PathType Leaf)) {
            Fail "Template Caddyfile não encontrado em $templatePath."
        }
        $caddyContent = [System.IO.File]::ReadAllText($templatePath)
        $caddyContent = $caddyContent.Replace("__HOSTNAME__", $Hostname)
        $utf8NoBom = New-Object System.Text.UTF8Encoding -ArgumentList $false
        [System.IO.File]::WriteAllText($Caddyfile, $caddyContent, $utf8NoBom)

        if (Test-Path -LiteralPath $CaddyExe -PathType Leaf) {
            $oldXdgData = $env:XDG_DATA_HOME
            $oldXdgConfig = $env:XDG_CONFIG_HOME
            $oldAppData = $env:APPDATA
            $env:XDG_DATA_HOME = $CaddyDataDir
            $env:XDG_CONFIG_HOME = $CaddyConfigDir
            $env:APPDATA = $CaddyDataDir
            try {
                & $CaddyExe validate --config $Caddyfile --adapter caddyfile
                $caddyValidateCode = $LASTEXITCODE
            }
            finally {
                if ($oldXdgData) { $env:XDG_DATA_HOME = $oldXdgData } else { Remove-Item Env:XDG_DATA_HOME -ErrorAction SilentlyContinue }
                if ($oldXdgConfig) { $env:XDG_CONFIG_HOME = $oldXdgConfig } else { Remove-Item Env:XDG_CONFIG_HOME -ErrorAction SilentlyContinue }
                if ($oldAppData) { $env:APPDATA = $oldAppData } else { Remove-Item Env:APPDATA -ErrorAction SilentlyContinue }
            }
            if ($caddyValidateCode -ne 0) {
                Fail "O Caddyfile gerado é inválido."
            }
        }
        Write-Ok "Caddyfile gerado para $Hostname."

        Protect-File -Path $Caddyfile -ReadIdentities @("S-1-5-19") -ModifyIdentities @($script:NexusInstallUserSid)
        Set-NexusFirewallRules
        Write-Ok "ACLs restritas e regras de firewall aplicadas."

        if (Test-Path -LiteralPath $EnvPath) {
            Protect-File -Path $EnvPath -ReadIdentities @("S-1-5-20")
        }

        $state.completedPhase = 3
        $state.paused = $false
        $state.pausedPhase = $null
        Save-BootstrapState -State $state
    }

    if ($startPhase -le 4) {
        Write-NexusProgress -Step 4
        Write-Step "Fase 4/7 - Banco e aplicação"
        Assert-Admin
        Update-SessionPath

        $caddyService = Get-Service -Name "NexusCaddy" -ErrorAction SilentlyContinue
        if ($caddyService -and $caddyService.Status.ToString() -ne "Stopped") {
            Write-Ok "Parando NexusCaddy para atualizar a aplicação..."
            Stop-Service -Name "NexusCaddy" -Force
            if (-not (Wait-ServiceState -Name "NexusCaddy" -Status "Stopped" -TimeoutSeconds 60)) {
                Fail "O serviço NexusCaddy não parou para atualizar a aplicação."
            }
        }

        $previousDir = Expand-AppPackage
        Write-AppEnvironment

        $appVersion = Get-AppVersion
        if ($appVersion) {
            Write-Ok "Aplicação standalone $appVersion extraída em $AppDir."
            $state.appVersion = $appVersion
        }
        else {
            Write-Warn "package.json da aplicação sem versão; o smoke não validará a versão."
        }
        if ($previousDir) {
            Write-Ok "Versão anterior preservada em $previousDir."
        }

        # SQL de produção, sem Prisma: banco vazio → schema+seed; existente → migração+seed.
        $sqlRootSecure = $rootSecure
        $sqlAppSecure = $appSecure
        if (-not ($sqlRootSecure -or $sqlAppSecure)) {
            if (Test-Path -LiteralPath $BackupCnf) {
                $appPlain = Get-CnfValue -Path $BackupCnf -Section "client" -Key "password"
                if ($appPlain) {
                    $sqlAppSecure = ConvertTo-SecureString -String $appPlain -AsPlainText -Force
                }
                $appPlain = $null
            }
        }
        if (-not ($sqlRootSecure -or $sqlAppSecure)) {
            Fail "Credenciais do MySQL indisponíveis para aplicar o SQL. Refaça a fase 2."
        }
        Write-Ok "Aplicando o SQL de produção com mysql.exe..."
        $sqlArguments = @{
            MysqlExe  = $MySqlExe
            Database  = "nexus_prod"
            Mode      = "Auto"
            Port      = $script:NexusMySqlPort
            SqlDir    = $SqlDir
        }
        if ($sqlRootSecure) { $sqlArguments.RootPassword = $sqlRootSecure }
        if ($sqlAppSecure) { $sqlArguments.AppPassword = $sqlAppSecure }
        & (Join-Path $PSScriptRoot "aplicar-sql.ps1") @sqlArguments
        if ($LASTEXITCODE -ne 0) {
            Fail "A aplicação do SQL falhou (código $LASTEXITCODE). Consulte $LogsDir."
        }

        $cacheDir = Join-Path $AppDir ".next\cache"
        if (-not (Test-Path -LiteralPath $cacheDir)) {
            New-Item -ItemType Directory -Force -Path $cacheDir | Out-Null
        }
        Set-AclModify -Path $cacheDir
        Set-AclReadExecute -Path $AppDir
        Write-Ok "Cache da aplicação acessível ao serviço."

        $state.completedPhase = 4
        $state.paused = $false
        $state.pausedPhase = $null
        Save-BootstrapState -State $state
    }

    if ($startPhase -le 5) {
        Write-NexusProgress -Step 5
        Write-Step "Fase 5/7 - Serviços NexusApp e NexusCaddy"
        Assert-Admin
        Update-SessionPath

        if (-not (Test-Path -LiteralPath $NodeExe -PathType Leaf)) { Fail "node.exe não encontrado em $NodeExe." }
        if (-not (Test-Path -LiteralPath (Join-Path $AppDir "server.js") -PathType Leaf)) {
            Fail "server.js não encontrado em $AppDir. Refaça a fase 4."
        }
        if (-not (Test-Path -LiteralPath $NssmExe)) { Fail "NSSM não encontrado em $NssmExe." }
        if (-not (Test-Path -LiteralPath $CaddyExe)) { Fail "Caddy não encontrado em $CaddyExe." }

        $databaseUrl = Get-EnvValue -Path $EnvPath -Key "DATABASE_URL"
        $jwtSecret = Get-EnvValue -Path $EnvPath -Key "JWT_SECRET"
        if (-not $databaseUrl) { Fail "DATABASE_URL não encontrada em $EnvPath." }
        if (-not $jwtSecret) { Fail "JWT_SECRET não encontrado em $EnvPath." }

        foreach ($dir in @($script:NexusCaddyDir, $CaddyDataDir, $CaddyConfigDir, $CaddyLogsDir)) {
            if (-not (Test-Path -LiteralPath $dir)) {
                New-Item -ItemType Directory -Force -Path $dir | Out-Null
            }
            Set-AclRestricted -Path $dir -ModifyIdentities @("S-1-5-19", $script:NexusInstallUserSid)
        }

        # AppDirectory é o diretório da aplicação; por isso server.js é relativo.
        Set-NexusService `
            -Name "NexusApp" `
            -Application $NodeExe `
            -Parameters "server.js" `
            -Directory $AppDir `
            -Environment @(
                "NODE_ENV=production",
                "PORT=3000",
                "HOSTNAME=127.0.0.1",
                "UPLOADS_DIR=$UploadsDir",
                "DATABASE_URL=$databaseUrl",
                "JWT_SECRET=$jwtSecret",
                "NEXT_TELEMETRY_DISABLED=1"
            ) `
            -Stdout (Join-Path $LogsDir "app.out.log") `
            -Stderr (Join-Path $LogsDir "app.err.log") `
            -Description "Nexus - aplicação Next.js (standalone)" `
            -DependOnService $script:NexusMySqlService
        Write-Ok "Serviço NexusApp configurado (Node portátil + server.js, NT AUTHORITY\NetworkService)."
        $databaseUrl = $null
        $jwtSecret = $null

        $caddyParameters = "run --config $Caddyfile --adapter caddyfile"
        Set-NexusService `
            -Name "NexusCaddy" `
            -Application $CaddyExe `
            -Parameters $caddyParameters `
            -Directory $CaddyDir `
            -Environment @(
                "XDG_DATA_HOME=$CaddyDataDir",
                "XDG_CONFIG_HOME=$CaddyConfigDir",
                "APPDATA=$CaddyDataDir"
            ) `
            -Stdout (Join-Path $CaddyLogsDir "caddy.out.log") `
            -Stderr (Join-Path $CaddyLogsDir "caddy.err.log") `
            -Description "Nexus - proxy HTTPS (Caddy)" `
            -DependOnService "NexusApp" `
            -ObjectName "NT AUTHORITY\LocalService"
        Write-Ok "Serviço NexusCaddy configurado (NT AUTHORITY\LocalService)."

        $appService = Get-Service -Name "NexusApp" -ErrorAction SilentlyContinue
        if (-not $appService -or $appService.Status.ToString() -ne "Running") {
            Start-Service -Name "NexusApp"
        }
        if (-not (Wait-ServiceState -Name "NexusApp" -Status "Running" -TimeoutSeconds 120)) {
            Fail "O serviço NexusApp não iniciou. Veja $LogsDir\app.err.log."
        }
        Write-Ok "NexusApp em execução."

        $health = Wait-HttpHealth -Url "http://127.0.0.1:3000/api/health" -TimeoutSeconds 180
        if (-not $health.Ok) {
            Fail "Health local não respondeu 200 com db=true. Veja $LogsDir\app.err.log."
        }
        Write-Ok "Health local OK (db=true, versão $($health.Versao))."

        $caddyService = Get-Service -Name "NexusCaddy" -ErrorAction SilentlyContinue
        if (-not $caddyService -or $caddyService.Status.ToString() -ne "Running") {
            Start-Service -Name "NexusCaddy"
        }
        if (-not (Wait-ServiceState -Name "NexusCaddy" -Status "Running" -TimeoutSeconds 60)) {
            Fail "O serviço NexusCaddy não iniciou. Veja $CaddyLogsDir\caddy.err.log."
        }
        Write-Ok "NexusCaddy em execução."

        # Com `admin off` não há API administrativa para o `caddy trust`; a CA
        # local é lida do data dir e instalada diretamente no repositório do Windows.
        $certUtil = Join-Path $env:SystemRoot "System32\certutil.exe"
        $rootCert = Join-Path $CaddyDataDir "caddy\pki\authorities\local\root.crt"
        Write-Ok "Instalando a CA interna do Caddy no repositório de confiança do Windows..."
        $trustCode = 1
        for ($attempt = 1; $attempt -le 30; $attempt++) {
            if (Test-Path -LiteralPath $rootCert) {
                & $certUtil -addstore -f Root $rootCert | Out-Null
                $trustCode = $LASTEXITCODE
                if ($trustCode -eq 0) { break }
            }
            Start-Sleep -Seconds 2
        }
        if ($trustCode -ne 0) {
            Fail "Não foi possível instalar a CA interna do Caddy em $rootCert. Verifique $CaddyLogsDir\caddy.err.log."
        }
        Write-Ok "CA interna confiada pelo Windows."

        $https = Test-Health -Url ("https://{0}/login" -f $Hostname)
        if (-not $https.Ok) {
            $deadline = (Get-Date).AddSeconds(60)
            do {
                Start-Sleep -Seconds 2
                $https = Test-Health -Url ("https://{0}/login" -f $Hostname)
            } while (-not $https.Ok -and (Get-Date) -lt $deadline)
        }
        if (-not $https.Ok) {
            Fail "HTTPS https://$Hostname/login não respondeu 200 após confiar na CA do Caddy. Verifique DNS/certificado."
        }
        Write-Ok "HTTPS https://$Hostname/login OK."

        $state.completedPhase = 5
        $state.paused = $false
        $state.pausedPhase = $null
        Save-BootstrapState -State $state
    }

    if ($startPhase -le 6) {
        Write-NexusProgress -Step 6
        Write-Step "Fase 6/7 - Bandeja e backup diário"
        Assert-Admin

        $scriptsDir = Join-Path $ProgramRoot "scripts"
        if (-not (Test-Path -LiteralPath $scriptsDir)) {
            New-Item -ItemType Directory -Force -Path $scriptsDir | Out-Null
        }
        Copy-Item -LiteralPath (Join-Path $PSScriptRoot "backup.ps1") -Destination (Join-Path $scriptsDir "backup.ps1") -Force
        Copy-Item -LiteralPath (Join-Path $PSScriptRoot "common.ps1") -Destination (Join-Path $scriptsDir "common.ps1") -Force
        $restartScriptSource = Join-Path $PSScriptRoot "restart.ps1"
        if (Test-Path -LiteralPath $restartScriptSource -PathType Leaf) {
            Copy-Item -LiteralPath $restartScriptSource -Destination (Join-Path $scriptsDir "restart.ps1") -Force
        }
        else {
            Write-Warn "restart.ps1 não encontrado em $restartScriptSource; o reinício pela bandeja ficará indisponível."
        }
        foreach ($scriptName in @("iniciar-nexus.ps1", "encerrar-nexus.ps1", "abrir-bandeja.vbs")) {
            $scriptSource = Join-Path $PSScriptRoot $scriptName
            if (Test-Path -LiteralPath $scriptSource -PathType Leaf) {
                Copy-Item -LiteralPath $scriptSource -Destination (Join-Path $scriptsDir $scriptName) -Force
            }
            else {
                Write-Warn "$scriptName não encontrado em $scriptSource; o liga/desliga pela bandeja ficará indisponível."
            }
        }
        Set-AclReadExecute -Path $scriptsDir

        $backupScript = Join-Path $scriptsDir "backup.ps1"
        $restartScript = Join-Path $scriptsDir "restart.ps1"
        $startScript = Join-Path $scriptsDir "iniciar-nexus.ps1"
        $stopScript = Join-Path $scriptsDir "encerrar-nexus.ps1"
        $stateFile = Join-Path $ConfigDir "nexus-state.json"
        $backupAction = New-ScheduledTaskAction -Execute $PsExe `
            -Argument ('-NoProfile -ExecutionPolicy Bypass -File "{0}" -RetentionDays 30' -f $backupScript)
        $backupTrigger = New-ScheduledTaskTrigger -Daily -At "02:00"
        $backupPrincipal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
        $backupSettings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
        Register-ScheduledTask -TaskName "NexusBackup" -Action $backupAction -Trigger $backupTrigger `
            -Principal $backupPrincipal -Settings $backupSettings `
            -Description "Backup diário do Nexus (banco, uploads e .env)" -Force | Out-Null
        Write-Ok "Tarefa NexusBackup registrada (diária, 02:00)."

        if ($SkipTray) {
            Write-Warn "Bandeja ignorada (-SkipTray)."
        }
        else {
            if ($TrayExe -and -not (Test-Path -LiteralPath $TrayExe -PathType Leaf)) {
                Fail "NexusTray.exe não encontrado em '$TrayExe'."
            }
            $traySource = $TrayExe
            if (-not $traySource) {
                $candidates = @(
                    (Join-Path $PSScriptRoot "NexusTray\dist\NexusTray.exe"),
                    (Join-Path $PSScriptRoot "NexusTray\bin\Release\net10.0-windows\win-x64\publish\NexusTray.exe"),
                    (Join-Path $PSScriptRoot "NexusTray\bin\Release\net10.0-windows\win-x64\NexusTray.exe"),
                    (Join-Path $PSScriptRoot "NexusTray\bin\Release\net10.0-windows\NexusTray.exe"),
                    (Join-Path $PSScriptRoot "NexusTray.exe")
                )
                foreach ($candidate in $candidates) {
                    if (Test-Path -LiteralPath $candidate -PathType Leaf) {
                        $traySource = $candidate
                        break
                    }
                }
            }

            if ($traySource -and (Test-Path -LiteralPath $traySource -PathType Leaf)) {
                $trayDir = Join-Path $ProgramRoot "NexusTray"
                if (-not (Test-Path -LiteralPath $trayDir)) {
                    New-Item -ItemType Directory -Force -Path $trayDir | Out-Null
                }
                $trayTarget = Join-Path $trayDir "NexusTray.exe"
                Get-ScheduledTask -TaskName "NexusTray" -ErrorAction SilentlyContinue |
                    Stop-ScheduledTask -ErrorAction SilentlyContinue
                $trayRunning = Get-Process -Name "NexusTray" -ErrorAction SilentlyContinue
                if ($trayRunning) {
                    Write-Ok "Parando a bandeja para atualizar o executável..."
                    $trayRunning | Stop-Process -Force -ErrorAction SilentlyContinue
                    Start-Sleep -Seconds 3
                }
                $trayCopied = $false
                for ($attempt = 0; $attempt -lt 5; $attempt++) {
                    try {
                        Copy-Item -LiteralPath $traySource -Destination $trayTarget -Force -ErrorAction Stop
                        $trayCopied = $true
                        break
                    }
                    catch {
                        Start-Sleep -Seconds 2
                    }
                }
                if (-not $trayCopied) {
                    Fail "Não foi possível atualizar o NexusTray.exe; o arquivo continua em uso."
                }

                # Configuração da bandeja: caminhos reais desta instalação, sem segredos.
                $trayJsonPath = Join-Path $trayDir "tray.json"
                $trayConfig = [ordered]@{
                    baseUrl       = ("https://{0}" -f $Hostname)
                    healthUrl     = "http://127.0.0.1:3000/api/health"
                    serviceName   = "NexusApp"
                    mysqlService  = $script:NexusMySqlService
                    caddyService  = "NexusCaddy"
                    nssmPath      = $NssmExe
                    logsDir       = $LogsDir
                    dataDir       = $DataDir
                    backupScript  = $backupScript
                    restartScript = $restartScript
                    stopScript    = $stopScript
                    startScript   = $startScript
                    stateFile     = $stateFile
                }
                Write-Utf8NoBom -Path $trayJsonPath -Lines @(($trayConfig | ConvertTo-Json -Depth 3))
                Set-AclReadExecute -Path $trayDir
                Set-AclReadExecute -Path $trayJsonPath

                $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent().Name
                $trayAction = New-ScheduledTaskAction -Execute $trayTarget -WorkingDirectory $trayDir
                $trayTrigger = New-ScheduledTaskTrigger -AtLogOn -User $currentUser
                # Highest: a bandeja reinicia o serviço via NSSM sem pedir UAC.
                $trayPrincipal = New-ScheduledTaskPrincipal -UserId $currentUser -LogonType Interactive -RunLevel Highest
                $traySettings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
                try {
                    Register-ScheduledTask -TaskName "NexusTray" -Action $trayAction -Trigger $trayTrigger `
                        -Principal $trayPrincipal -Settings $traySettings `
                        -Description "Bandeja do Nexus (logon de $currentUser)" -Force | Out-Null
                    Write-Ok "Bandeja copiada para $trayTarget e registrada no logon de $currentUser."

                    # Inicia agora; o gatilho de logon só vale no próximo logon.
                    try {
                        Start-ScheduledTask -TaskName "NexusTray" -ErrorAction Stop
                        $trayStarted = $false
                        for ($attempt = 0; $attempt -lt 10; $attempt++) {
                            Start-Sleep -Seconds 1
                            if (Get-Process -Name "NexusTray" -ErrorAction SilentlyContinue) {
                                $trayStarted = $true
                                break
                            }
                        }
                        if ($trayStarted) {
                            Write-Ok "Bandeja em execução."
                        }
                        else {
                            $taskInfo = Get-ScheduledTaskInfo -TaskName "NexusTray" -ErrorAction SilentlyContinue
                            Write-Warn "A bandeja foi registrada, mas não iniciou agora (resultado $($taskInfo.LastTaskResult)); ela inicia no próximo logon."
                        }
                    }
                    catch {
                        Write-Warn "A bandeja foi registrada, mas não foi possível iniciá-la agora: $($_.Exception.Message). Ela inicia no próximo logon."
                    }
                }
                catch {
                    Write-Warn "Não foi possível registrar a tarefa NexusTray: $($_.Exception.Message)"
                    if ($TrayExe) { Fail "A tarefa da bandeja não foi registrada." }
                }
            }
            else {
                Write-Warn "NexusTray.exe não encontrado; a bandeja não foi registrada nesta execução."
            }
        }

        $state.completedPhase = 6
        $state.paused = $false
        $state.pausedPhase = $null
        Save-BootstrapState -State $state
    }

    if ($startPhase -le 7) {
        Write-NexusProgress -Step 7
        Write-Step "Fase 7/7 - Smoke test e resumo"
        Assert-Admin

        $smokeScript = Join-Path $PSScriptRoot "smoke.ps1"
        if (-not (Test-Path -LiteralPath $smokeScript)) {
            Fail "smoke.ps1 não encontrado em $smokeScript."
        }
        $expectedVersion = [string]$state.appVersion
        & $PsExe -NoProfile -ExecutionPolicy Bypass -File $smokeScript -Hostname $Hostname -ExpectedVersion $expectedVersion
        if ($LASTEXITCODE -ne 0) {
            Fail "O smoke test falhou. Verifique serviços, certificado e logs em $LogsDir."
        }

        $state.completedPhase = 7
        $state.paused = $false
        $state.pausedPhase = $null
        Save-BootstrapState -State $state

        Write-Ok "Instalação concluída e validada."
        Write-Host ""
        Write-Host "Resumo" -ForegroundColor Cyan
        Write-Host "  URL:        https://$Hostname"
        Write-Host "  Aplicação:  $AppDir"
        Write-Host "  Node:       $NodeExe"
        Write-Host "  MySQL:      $MySqlDir (dados em $script:NexusMySqlDataDir)"
        Write-Host "  Dados:      $DataDir"
        Write-Host "  Logs:       $LogsDir"
        Write-Host "  Versão:     $expectedVersion"
        Write-Host "  Backup:     tarefa NexusBackup (diária, 02:00)"
        Write-Host "  Atualizar:  .\atualizar.ps1 -Package <pasta com app\ e sql\>"
        Write-Host ""
        Write-NexusProgress -Step 8
    }

    $script:NexusBootstrapExit = 0
}
finally {
    Stop-NexusTranscript
    Write-NexusProgress -Step $script:NexusProgressStep -Done 1 -ExitCode $script:NexusBootstrapExit
    if ($CredentialsFile) {
        Remove-Item -LiteralPath $CredentialsFile -Force -ErrorAction SilentlyContinue
    }
    $rootSecure = $null
    $appSecure = $null
}
