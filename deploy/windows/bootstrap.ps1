#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Instalação do Nexus em Windows, do zero (sem Node, Git ou MySQL).

.DESCRIPTION
    Executa as fases 0 a 7 com estado em
    C:\ProgramData\Nexus\bootstrap.state.json. É idempotente e retomável.

    A fase 2 pausa quando o serviço MySQL84 ainda não existe. Instale o
    MySQL Installer 8.4 LTS (Server only) e execute novamente com -Resume.

.PARAMETER Hostname
    Nome DNS usado pelo Caddy (ex.: nexus.escola.local).

.PARAMETER RepoUrl
    URL do repositório. Padrão: manifesto.json.

.PARAMETER Tag
    Tag a instalar. Padrão: manifesto.json.

.PARAMETER Resume
    Retoma da última fase concluída.

.PARAMETER SkipTray
    Não copia nem registra a bandeja NexusTray.

.PARAMETER TrayExe
    Caminho explícito do NexusTray.exe.

.PARAMETER Force
    Ignora o estado e reinstala a aplicação sobre um diretório existente.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$Hostname,
    [string]$RepoUrl = "",
    [string]$Tag = "",
    [switch]$Resume,
    [switch]$SkipTray,
    [string]$TrayExe = "",
    [switch]$Force
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "common.ps1")

$Hostname = $Hostname.Trim().ToLowerInvariant()
if ($Hostname -notmatch '^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$') {
    Fail "Hostname inválido: '$Hostname'. Informe apenas o nome DNS, sem http://, porta ou caminho."
}

$manifest = Get-Manifest
if (-not $RepoUrl) { $RepoUrl = [string]$manifest.repo.url }
if (-not $Tag) { $Tag = [string]$manifest.repo.tag }
if (-not $RepoUrl) { Fail "repo.url não definido no manifesto." }
if (-not $Tag) { Fail "repo.tag não definido no manifesto." }

$ProgramRoot = $script:NexusProgramRoot
$AppDir = $script:NexusAppDir
$DataDir = $script:NexusDataDir
$LogsDir = $script:NexusLogsDir
$ConfigDir = $script:NexusConfigDir
$BackupsDir = $script:NexusBackupsDir
$UploadsDir = $script:NexusUploadsDir
$CaddyDir = Join-Path $ProgramRoot "caddy"
$NssmDir = Join-Path $ProgramRoot "tools\nssm"
$NssmExe = Join-Path $NssmDir "nssm.exe"
$CaddyExe = Join-Path $CaddyDir "caddy.exe"
$Caddyfile = Join-Path $ConfigDir "Caddyfile"
$BackupCnf = Join-Path $ConfigDir "backup.cnf"
$StatePath = Join-Path $DataDir "bootstrap.state.json"
$PsExe = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"

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

$previous = Get-PreviousState
if ($Resume -and -not $previous) {
    Fail "Não há estado anterior em $StatePath. Rode sem -Resume."
}

$state = @{
    version        = 1
    hostname       = $Hostname
    tag            = $Tag
    repoUrl        = $RepoUrl
    completedPhase = -1
    paused         = $false
    pausedPhase    = $null
    startedAt      = (Get-Date).ToString("s")
    updatedAt      = (Get-Date).ToString("s")
}

if ($previous -and -not $Force) {
    $state.completedPhase = [int]$previous.completedPhase
    if ($previous.startedAt) { $state.startedAt = [string]$previous.startedAt }
    $state.paused = [bool]$previous.paused
    $state.pausedPhase = $previous.pausedPhase
    if ($previous.hostname -and [string]$previous.hostname -ne $Hostname) {
        Fail "O hostname mudou desde a instalação anterior ('$($previous.hostname)'). Use -Force para reconfigurar."
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
    & $NssmExe @Arguments
    if ($LASTEXITCODE -ne 0) {
        Fail ("NSSM falhou: " + ($Arguments -join " "))
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
        [string]$DependOnService = ""
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
    Invoke-Nssm -Arguments @("set", $Name, "ObjectName", "NT AUTHORITY\NetworkService")
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
        "port=3306",
        "user=nexus_app",
        $passwordLine,
        "default-character-set=utf8mb4",
        ""
    )
    Write-Utf8NoBom -Path $BackupCnf -Lines $lines
    Protect-File -Path $BackupCnf
}

try {
    if ($startPhase -le 0) {
        Write-Step "Fase 0/7 - Pré-checagem"
        Assert-Admin

        if (-not [Environment]::Is64BitOperatingSystem) {
            Fail "Este projeto exige Windows 64 bits."
        }
        Write-Ok "Windows 64 bits."

        $freeGb = Get-FreeSpaceGB -Drive "C"
        if ($freeGb -lt 5) {
            Fail "Espaço livre insuficiente em C: ($freeGb GB). São necessários pelo menos 5 GB."
        }
        Write-Ok "Espaço livre em C: $freeGb GB."

        if (-not (Test-Internet)) {
            Fail "Sem conectividade com a internet (nodejs.org:443). Verifique a rede/proxy."
        }
        Write-Ok "Internet disponível."

        $ports = @(
            @{ Port = 3306; Service = "MySQL84" },
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
                Fail "A porta $($entry.Port) está em uso por outro processo. Libere-a antes de continuar."
            }
            Write-Warn "Porta $($entry.Port) em uso pelo serviço $($entry.Service); será reutilizada."
        }
        Write-Ok "Portas 3306, 3000, 80 e 443 verificadas."

        try {
            $response = Invoke-WebRequest -Uri "https://nodejs.org" -Method Head -UseBasicParsing -TimeoutSec 20
            $dateText = [string]$response.Headers["Date"]
            if ($dateText) {
                $remote = [DateTimeOffset]::Parse(
                    $dateText,
                    [Globalization.CultureInfo]::InvariantCulture,
                    [Globalization.DateTimeStyles]::AssumeUniversal
                ).UtcDateTime
                $skew = [math]::Abs(((Get-Date).ToUniversalTime() - $remote).TotalMinutes)
                if ($skew -gt 10) {
                    Fail "O relógio do servidor está $([math]::Round($skew)) min fora do horário da internet. Ajuste o horário antes de instalar."
                }
                Write-Ok "Relógio dentro da tolerância ($([math]::Round($skew)) min)."
            }
            else {
                Write-Warn "O servidor não informou a data; verificação do relógio ignorada."
            }
        }
        catch {
            Write-Warn "Não foi possível conferir o relógio pela internet; siga apenas se o horário estiver correto."
        }

        $state.completedPhase = 0
        $state.paused = $false
        $state.pausedPhase = $null
        Save-BootstrapState -State $state
    }

    if ($startPhase -le 1) {
        Write-Step "Fase 1/7 - Runtime (VC++, Node.js, Git)"
        Assert-Admin

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
        }
        else {
            $vcPath = Join-Path $env:TEMP "nexus-vc_redist.x64.exe"
            Invoke-Download -Url $manifest.vcredist.url -Destination $vcPath -Sha256 ([string]$manifest.vcredist.sha256) -Label "VC++ Redistributable"
            Install-Exe -Path $vcPath -Arguments "/install /quiet /norestart" -Label "VC++ Redistributable"
        }

        $nodeVersion = ""
        $nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
        if ($nodeCommand) {
            $nodeVersion = ([string](& $nodeCommand.Source --version 2>$null | Select-Object -First 1)).Trim()
        }
        if ($nodeVersion -ne ("v" + [string]$manifest.node.version)) {
            $nodeMsi = Join-Path $env:TEMP ("nexus-node-v" + [string]$manifest.node.version + "-x64.msi")
            Invoke-Download -Url $manifest.node.url -Destination $nodeMsi -Sha256 ([string]$manifest.node.sha256) -Label "Node.js $($manifest.node.version)"
            Install-Msi -Path $nodeMsi -Label "Node.js $($manifest.node.version)"
            Update-SessionPath
        }
        $nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
        if (-not $nodeCommand) {
            Fail "Node.js não encontrado após a instalação."
        }
        $nodeVersion = ([string](& $nodeCommand.Source --version 2>$null | Select-Object -First 1)).Trim()
        if ($nodeVersion -ne ("v" + [string]$manifest.node.version)) {
            Fail "Node.js instalado é $nodeVersion; esperado v$($manifest.node.version)."
        }
        Write-Ok "Node.js $nodeVersion."

        $gitCommand = Get-Command git.exe -ErrorAction SilentlyContinue
        if (-not $gitCommand) {
            $gitUrl = [string]$manifest.git.url
            $gitVersion = [string]$manifest.git.version
            if (-not $gitUrl) {
                $gitInfo = Resolve-LatestGitForWindows
                $gitUrl = $gitInfo.Url
                $gitVersion = $gitInfo.Version
            }
            Write-Ok "Baixando Git for Windows $gitVersion..."
            $gitInstaller = Join-Path $env:TEMP "nexus-git-for-windows-x64.exe"
            Invoke-Download -Url $gitUrl -Destination $gitInstaller -Sha256 ([string]$manifest.git.sha256) -Label "Git for Windows"
            Install-Exe -Path $gitInstaller -Arguments "/VERYSILENT /NORESTART /NOCANCEL /SP-" -Label "Git for Windows"
            Update-SessionPath
        }
        else {
            Write-Ok "Git já instalado: $((& $gitCommand.Source --version 2>$null | Select-Object -First 1))."
        }
        $gitCommand = Get-Command git.exe -ErrorAction SilentlyContinue
        if (-not $gitCommand) {
            Fail "Git não encontrado após a instalação."
        }

        $npmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
        if (-not $npmCommand) {
            Update-SessionPath
            $npmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
        }
        if (-not $npmCommand) {
            Fail "npm.cmd não encontrado após a instalação do Node.js."
        }
        Write-Ok "npm disponível em $($npmCommand.Source)."

        $state.completedPhase = 1
        $state.paused = $false
        $state.pausedPhase = $null
        Save-BootstrapState -State $state
    }

    if ($startPhase -le 2) {
        Write-Step "Fase 2/7 - MySQL 8.4 LTS"
        Assert-Admin

        $mysqlService = Get-Service -Name "MySQL84" -ErrorAction SilentlyContinue
        if (-not $mysqlService) {
            $state.completedPhase = 1
            $state.paused = $true
            $state.pausedPhase = 2
            Save-BootstrapState -State $state
            Stop-NexusTranscript
            Write-Host ""
            Write-Warn "O serviço MySQL84 ainda não existe."
            Write-Host "  1. Baixe o MySQL Installer 8.4 LTS em https://dev.mysql.com/downloads/installer/"
            Write-Host "  2. Escolha 'MySQL Server 8.4' (Server only) e conclua o instalador gráfico."
            Write-Host "  3. Defina a senha do root e guarde-a."
            Write-Host "  4. Retome a instalação com:"
            Write-Host "     .\bootstrap.ps1 -Hostname $Hostname -Resume"
            Write-Host ""
            Write-Host "STATUS: PAUSADO (código 2). Nada foi perdido; o estado está em $StatePath." -ForegroundColor Yellow
            exit 2
        }

        if ($mysqlService.Status.ToString() -ne "Running") {
            Start-Service -Name "MySQL84"
        }
        if (-not (Wait-ServiceState -Name "MySQL84" -Status "Running" -TimeoutSeconds 120)) {
            Fail "O serviço MySQL84 não iniciou."
        }
        $deadline = (Get-Date).AddSeconds(60)
        while (-not (Test-TcpPort -Port 3306 -TimeoutMs 2000) -and (Get-Date) -lt $deadline) {
            Start-Sleep -Seconds 2
        }
        if (-not (Test-TcpPort -Port 3306 -TimeoutMs 2000)) {
            Fail "O MySQL84 está em execução, mas não aceita conexões na porta 3306."
        }
        Write-Ok "Serviço MySQL84 em execução."

        $mysqlExe = Find-MysqlExe
        $needsSetup = $true
        if (Test-Path -LiteralPath $BackupCnf) {
            $testOut = Join-Path $env:TEMP ("nexus-mysql-test-" + [guid]::NewGuid().ToString("N") + ".out")
            $testErr = Join-Path $env:TEMP ("nexus-mysql-test-" + [guid]::NewGuid().ToString("N") + ".err")
            try {
                $testArgs = "--defaults-extra-file=`"$BackupCnf`" --protocol=TCP -h 127.0.0.1 -P 3306 -D nexus_prod -e `"SELECT 1;`""
                $testProcess = Start-Process -FilePath $mysqlExe -ArgumentList $testArgs -Wait -PassThru -NoNewWindow `
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

        if ($needsSetup) {
            Suspend-Transcript
            $rootSecure = Read-Host -AsSecureString "Senha do usuário root do MySQL"
            $appSecure = Read-Host -AsSecureString "Senha para o usuário nexus_app (12+ caracteres; letras, números, . _ -)"
            $rootPlain = ConvertFrom-SecureStringPlain -Secure $rootSecure
            $appPlain = ConvertFrom-SecureStringPlain -Secure $appSecure
            Assert-MysqlRootPassword -Plain $rootPlain
            Assert-SafeAppPassword -Plain $appPlain -Label "Senha de nexus_app"

            try {
                & (Join-Path $PSScriptRoot "pos-instalacao-mysql.ps1") `
                    -RootPassword $rootSecure `
                    -AppPassword $appSecure `
                    -Hostname $Hostname
                Write-BackupCnf -Password $appPlain
            }
            finally {
                Resume-Transcript
                $rootPlain = $null
                $appPlain = $null
            }
            Write-Ok "Configuração do MySQL concluída; backup.cnf criado com ACL restrita."
        }

        $state.completedPhase = 2
        $state.paused = $false
        $state.pausedPhase = $null
        Save-BootstrapState -State $state
    }

    if ($startPhase -le 3) {
        Write-Step "Fase 3/7 - Ferramentas, diretórios e ACLs"
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
            (Join-Path $DataDir "caddy"),
            (Join-Path $DataDir "caddy\data"),
            (Join-Path $DataDir "caddy\config"),
            (Split-Path -Parent $script:NexusCaddyLogsDir),
            $script:NexusCaddyLogsDir
        )) {
            if (-not (Test-Path -LiteralPath $dir)) {
                New-Item -ItemType Directory -Force -Path $dir | Out-Null
            }
        }

        if (-not (Test-Path -LiteralPath $NssmExe)) {
            $nssmZip = Join-Path $env:TEMP "nexus-nssm-2.24.zip"
            Invoke-Download -Url $manifest.nssm.url -Destination $nssmZip -Sha256 ([string]$manifest.nssm.sha256) -Label "NSSM 2.24"
            $nssmTemp = Join-Path $env:TEMP ("nexus-nssm-" + [guid]::NewGuid().ToString("N"))
            try {
                Expand-Archive -LiteralPath $nssmZip -DestinationPath $nssmTemp -Force
                $nssmBinary = Get-ChildItem -Path $nssmTemp -Recurse -Filter "nssm.exe" -ErrorAction SilentlyContinue |
                    Where-Object { $_.FullName -match '\\win64\\' } |
                    Select-Object -First 1
                if (-not $nssmBinary) {
                    Fail "nssm.exe (win64) não encontrado no pacote baixado."
                }
                if (-not (Test-Path -LiteralPath $NssmDir)) {
                    New-Item -ItemType Directory -Force -Path $NssmDir | Out-Null
                }
                Copy-Item -LiteralPath $nssmBinary.FullName -Destination $NssmExe -Force
            }
            finally {
                Remove-Item -LiteralPath $nssmTemp -Recurse -Force -ErrorAction SilentlyContinue
                Remove-Item -LiteralPath $nssmZip -Force -ErrorAction SilentlyContinue
            }
        }
        Unblock-File -LiteralPath $NssmExe -ErrorAction SilentlyContinue
        $nssmVersion = ([string](& $NssmExe version 2>&1 | Select-Object -First 1)).Trim()
        Write-Ok "NSSM instalado: $nssmVersion"

        if (-not (Test-Path -LiteralPath $CaddyExe)) {
            $caddyUrl = [string]$manifest.caddy.url
            $caddyVersion = [string]$manifest.caddy.version
            if (-not $caddyUrl) {
                $caddyInfo = Resolve-LatestCaddy
                $caddyUrl = $caddyInfo.Url
                $caddyVersion = $caddyInfo.Version
            }
            Write-Ok "Baixando Caddy $caddyVersion..."
            $caddyZip = Join-Path $env:TEMP "nexus-caddy-windows-amd64.zip"
            Invoke-Download -Url $caddyUrl -Destination $caddyZip -Sha256 ([string]$manifest.caddy.sha256) -Label "Caddy"
            $caddyTemp = Join-Path $env:TEMP ("nexus-caddy-" + [guid]::NewGuid().ToString("N"))
            try {
                Expand-Archive -LiteralPath $caddyZip -DestinationPath $caddyTemp -Force
                $caddyBinary = Get-ChildItem -Path $caddyTemp -Recurse -Filter "caddy.exe" -ErrorAction SilentlyContinue |
                    Select-Object -First 1
                if (-not $caddyBinary) {
                    Fail "caddy.exe não encontrado no pacote baixado."
                }
                if (-not (Test-Path -LiteralPath $CaddyDir)) {
                    New-Item -ItemType Directory -Force -Path $CaddyDir | Out-Null
                }
                Copy-Item -LiteralPath $caddyBinary.FullName -Destination $CaddyExe -Force
            }
            finally {
                Remove-Item -LiteralPath $caddyTemp -Recurse -Force -ErrorAction SilentlyContinue
                Remove-Item -LiteralPath $caddyZip -Force -ErrorAction SilentlyContinue
            }
        }
        Unblock-File -LiteralPath $CaddyExe -ErrorAction SilentlyContinue
        $caddyVersion = ([string](& $CaddyExe version 2>&1 | Select-Object -First 1)).Trim()
        Write-Ok "Caddy instalado: $caddyVersion"

        $templatePath = Join-Path $PSScriptRoot "Caddyfile"
        if (-not (Test-Path -LiteralPath $templatePath)) {
            Fail "Template Caddyfile não encontrado em $templatePath."
        }
        $caddyContent = [System.IO.File]::ReadAllText($templatePath)
        $caddyContent = $caddyContent.Replace("__HOSTNAME__", $Hostname)
        $utf8NoBom = New-Object System.Text.UTF8Encoding -ArgumentList $false
        [System.IO.File]::WriteAllText($Caddyfile, $caddyContent, $utf8NoBom)

        $oldXdgData = $env:XDG_DATA_HOME
        $oldXdgConfig = $env:XDG_CONFIG_HOME
        $oldAppData = $env:APPDATA
        $env:XDG_DATA_HOME = Join-Path $DataDir "caddy\data"
        $env:XDG_CONFIG_HOME = Join-Path $DataDir "caddy\config"
        $env:APPDATA = Join-Path $DataDir "caddy\data"
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
        Write-Ok "Caddyfile gerado para $Hostname."

        # NETWORK SERVICE precisa escrever dados/logs e ler a instalação.
        Set-AclReadExecute -Path $ProgramRoot
        Set-AclModify -Path $DataDir
        foreach ($dir in @(
            $LogsDir,
            $ConfigDir,
            $BackupsDir,
            (Join-Path $BackupsDir "db"),
            (Join-Path $BackupsDir "uploads"),
            (Join-Path $BackupsDir "config"),
            $UploadsDir,
            (Join-Path $DataDir "caddy"),
            (Join-Path $DataDir "caddy\data"),
            (Join-Path $DataDir "caddy\config"),
            (Split-Path -Parent $script:NexusCaddyLogsDir),
            $script:NexusCaddyLogsDir
        )) {
            Set-AclModify -Path $dir
        }
        Write-Ok "ACLs aplicadas em $DataDir e $ProgramRoot."

        $appEnv = Join-Path $AppDir ".env"
        if (Test-Path -LiteralPath $appEnv) {
            Protect-File -Path $appEnv -ReadIdentities @("S-1-5-20")
        }

        $state.completedPhase = 3
        $state.paused = $false
        $state.pausedPhase = $null
        Save-BootstrapState -State $state
    }

    if ($startPhase -le 4) {
        Write-Step "Fase 4/7 - Aplicação"
        Assert-Admin
        Update-SessionPath

        $gitCommand = Get-Command git.exe -ErrorAction SilentlyContinue
        if (-not $gitCommand) { Fail "Git não encontrado." }
        $npmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
        if (-not $npmCommand) { Fail "npm.cmd não encontrado." }

        if (Test-Path -LiteralPath $AppDir) {
            if (Test-Path -LiteralPath (Join-Path $AppDir ".git")) {
                Write-Ok "Repositório existente; atualizando para $Tag..."
                & $gitCommand.Source -C $AppDir remote set-url origin $RepoUrl
                if ($LASTEXITCODE -ne 0) { Fail "git remote set-url falhou." }
                & $gitCommand.Source -C $AppDir fetch --tags --force origin
                if ($LASTEXITCODE -ne 0) { Fail "git fetch falhou." }
                & $gitCommand.Source -C $AppDir checkout -f $Tag
                if ($LASTEXITCODE -ne 0) { Fail "git checkout $Tag falhou." }
            }
            else {
                $appItems = @(Get-ChildItem -LiteralPath $AppDir -Force -ErrorAction SilentlyContinue)
                if ($appItems.Count -gt 0) {
                    if (-not $Force) {
                        Fail "$AppDir já existe e não é um repositório Git. Use -Force para movê-lo e reinstalar."
                    }
                    $oldDir = Join-Path $ProgramRoot ("app.prev-manual-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
                    Move-Item -LiteralPath $AppDir -Destination $oldDir
                    Write-Warn "Diretório anterior movido para $oldDir."
                }
            }
        }

        if (-not (Test-Path -LiteralPath (Join-Path $AppDir "package.json"))) {
            if (-not (Test-Path -LiteralPath $AppDir)) {
                & $gitCommand.Source clone --branch $Tag --depth 1 $RepoUrl $AppDir
                if ($LASTEXITCODE -ne 0) { Fail "git clone da tag $Tag falhou." }
            }
            elseif (-not (Test-Path -LiteralPath (Join-Path $AppDir ".git"))) {
                & $gitCommand.Source clone --branch $Tag --depth 1 $RepoUrl $AppDir
                if ($LASTEXITCODE -ne 0) { Fail "git clone da tag $Tag falhou." }
            }
        }
        if (-not (Test-Path -LiteralPath (Join-Path $AppDir "package.json"))) {
            Fail "A aplicação não foi encontrada em $AppDir após o clone."
        }

        $envPath = Join-Path $AppDir ".env"
        $appPassword = $null
        $jwtSecret = $null
        $generatedJwt = $false
        Suspend-Transcript
        try {
            if (Test-Path -LiteralPath $BackupCnf) {
                $appPassword = Get-CnfValue -Path $BackupCnf -Section "client" -Key "password"
            }
            if (-not $appPassword) {
                Fail "Senha de nexus_app não encontrada em $BackupCnf. Refaça a fase 2."
            }

            Set-EnvFile -Path $envPath -Key "DATABASE_URL" -Value ('"mysql://nexus_app:{0}@127.0.0.1:3306/nexus_prod"' -f $appPassword)
            Set-EnvFile -Path $envPath -Key "UPLOADS_DIR" -Value $UploadsDir
            Set-EnvFile -Path $envPath -Key "NODE_ENV" -Value "production"
            Set-EnvFile -Path $envPath -Key "PORT" -Value "3000"
            $jwtSecret = Get-EnvValue -Path $envPath -Key "JWT_SECRET"
            if (-not $jwtSecret) {
                $jwtSecret = New-RandomSecret -Bytes 48
                Set-EnvFile -Path $envPath -Key "JWT_SECRET" -Value ('"{0}"' -f $jwtSecret)
                $generatedJwt = $true
            }
        }
        finally {
            Resume-Transcript
            $appPassword = $null
            $jwtSecret = $null
        }
        if ($generatedJwt) {
            Write-Ok "JWT_SECRET gerado para esta instalação."
        }
        Protect-File -Path $envPath -ReadIdentities @("S-1-5-20")
        Write-Ok "Arquivo .env criado com ACL restrita (NetworkService lê; Administrators/SYSTEM controlam)."

        Push-Location $AppDir
        try {
            Remove-Item Env:NODE_ENV -ErrorAction SilentlyContinue
            Write-Ok "Executando npm ci..."
            & $npmCommand.Source ci --no-audit --no-fund
            if ($LASTEXITCODE -ne 0) { Fail "npm ci falhou." }

            Write-Ok "Gerando o cliente Prisma..."
            & $npmCommand.Source run db:generate
            if ($LASTEXITCODE -ne 0) { Fail "prisma generate falhou." }

            Write-Ok "Compilando a aplicação..."
            & $npmCommand.Source run build
            if ($LASTEXITCODE -ne 0) { Fail "npm run build falhou." }

            Write-Ok "Aplicando o schema no banco..."
            & $npmCommand.Source run db:push
            if ($LASTEXITCODE -ne 0) { Fail "prisma db push falhou." }

            Write-Ok "Executando o seed de referência..."
            & $npmCommand.Source run db:seed
            if ($LASTEXITCODE -ne 0) { Fail "db:seed falhou." }
        }
        finally {
            Pop-Location
        }

        $cacheDir = Join-Path $AppDir ".next\cache"
        if (-not (Test-Path -LiteralPath $cacheDir)) {
            New-Item -ItemType Directory -Force -Path $cacheDir | Out-Null
        }
        Set-AclModify -Path $cacheDir
        Set-AclReadExecute -Path $AppDir
        Write-Ok "Build concluído e cache acessível ao serviço."

        $state.completedPhase = 4
        $state.paused = $false
        $state.pausedPhase = $null
        Save-BootstrapState -State $state
    }

    if ($startPhase -le 5) {
        Write-Step "Fase 5/7 - Serviços NexusApp e NexusCaddy"
        Assert-Admin
        Update-SessionPath

        $nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
        if (-not $nodeCommand) { Fail "node.exe não encontrado." }
        if (-not (Test-Path -LiteralPath $NssmExe)) { Fail "NSSM não encontrado em $NssmExe." }
        if (-not (Test-Path -LiteralPath $CaddyExe)) { Fail "Caddy não encontrado em $CaddyExe." }
        $nextBin = Join-Path $AppDir "node_modules\next\dist\bin\next"
        if (-not (Test-Path -LiteralPath $nextBin)) {
            Fail "O binário do Next não foi encontrado em $nextBin. Refaça a fase 4."
        }

        $caddyData = Join-Path $DataDir "caddy\data"
        $caddyConfig = Join-Path $DataDir "caddy\config"
        foreach ($dir in @($caddyData, $caddyConfig, (Split-Path -Parent $script:NexusCaddyLogsDir), $script:NexusCaddyLogsDir)) {
            if (-not (Test-Path -LiteralPath $dir)) {
                New-Item -ItemType Directory -Force -Path $dir | Out-Null
            }
            Set-AclModify -Path $dir
        }

        # AppDirectory é o diretório da aplicação; por isso o caminho do Next pode
        # ser relativo (sem espaços) e não precisa de aspas no AppParameters do NSSM.
        $appParameters = "node_modules\next\dist\bin\next start -H 127.0.0.1 -p 3000"
        Set-NexusService `
            -Name "NexusApp" `
            -Application $nodeCommand.Source `
            -Parameters $appParameters `
            -Directory $AppDir `
            -Environment @(
                "NODE_ENV=production",
                "PORT=3000",
                "HOSTNAME=127.0.0.1",
                "UPLOADS_DIR=$UploadsDir",
                "NEXT_TELEMETRY_DISABLED=1"
            ) `
            -Stdout (Join-Path $LogsDir "app.out.log") `
            -Stderr (Join-Path $LogsDir "app.err.log") `
            -Description "Nexus - aplicação Next.js" `
            -DependOnService "MySQL84"
        Write-Ok "Serviço NexusApp configurado (NT AUTHORITY\NetworkService)."

        $caddyParameters = "run --config $Caddyfile --adapter caddyfile"
        Set-NexusService `
            -Name "NexusCaddy" `
            -Application $CaddyExe `
            -Parameters $caddyParameters `
            -Directory $CaddyDir `
            -Environment @(
                "XDG_DATA_HOME=$caddyData",
                "XDG_CONFIG_HOME=$caddyConfig",
                "APPDATA=$caddyData"
            ) `
            -Stdout (Join-Path $LogsDir "caddy.out.log") `
            -Stderr (Join-Path $LogsDir "caddy.err.log") `
            -Description "Nexus - proxy HTTPS (Caddy)" `
            -DependOnService "NexusApp"
        Write-Ok "Serviço NexusCaddy configurado (NT AUTHORITY\NetworkService)."

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
            Fail "O serviço NexusCaddy não iniciou. Veja $LogsDir\caddy.err.log."
        }
        Write-Ok "NexusCaddy em execução."

        # O `caddy trust` conversa com a API administrativa (localhost:2019) para
        # obter a CA; por isso roda depois de o serviço estar em execução.
        $oldXdgData = $env:XDG_DATA_HOME
        $oldXdgConfig = $env:XDG_CONFIG_HOME
        $oldAppData = $env:APPDATA
        $env:XDG_DATA_HOME = $caddyData
        $env:XDG_CONFIG_HOME = $caddyConfig
        $env:APPDATA = $caddyData
        try {
            Write-Ok "Instalando a CA interna do Caddy no repositório de confiança do Windows..."
            $trustCode = 1
            for ($attempt = 1; $attempt -le 15; $attempt++) {
                & $CaddyExe trust
                $trustCode = $LASTEXITCODE
                if ($trustCode -eq 0) { break }
                Start-Sleep -Seconds 2
            }
        }
        finally {
            if ($oldXdgData) { $env:XDG_DATA_HOME = $oldXdgData } else { Remove-Item Env:XDG_DATA_HOME -ErrorAction SilentlyContinue }
            if ($oldXdgConfig) { $env:XDG_CONFIG_HOME = $oldXdgConfig } else { Remove-Item Env:XDG_CONFIG_HOME -ErrorAction SilentlyContinue }
            if ($oldAppData) { $env:APPDATA = $oldAppData } else { Remove-Item Env:APPDATA -ErrorAction SilentlyContinue }
        }
        if ($trustCode -ne 0) {
            Fail "caddy trust falhou. O HTTPS não será confiável até a CA ser instalada."
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
            Fail "HTTPS https://$Hostname/login não respondeu 200 após o caddy trust. Verifique DNS/certificado."
        }
        Write-Ok "HTTPS https://$Hostname/login OK."

        $state.completedPhase = 5
        $state.paused = $false
        $state.pausedPhase = $null
        Save-BootstrapState -State $state
    }

    if ($startPhase -le 6) {
        Write-Step "Fase 6/7 - Bandeja e backup diário"
        Assert-Admin

        $scriptsDir = Join-Path $ProgramRoot "scripts"
        if (-not (Test-Path -LiteralPath $scriptsDir)) {
            New-Item -ItemType Directory -Force -Path $scriptsDir | Out-Null
        }
        Copy-Item -LiteralPath (Join-Path $PSScriptRoot "backup.ps1") -Destination (Join-Path $scriptsDir "backup.ps1") -Force
        Copy-Item -LiteralPath (Join-Path $PSScriptRoot "common.ps1") -Destination (Join-Path $scriptsDir "common.ps1") -Force
        Set-AclReadExecute -Path $scriptsDir

        $backupScript = Join-Path $scriptsDir "backup.ps1"
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
                    (Join-Path $PSScriptRoot "NexusTray\bin\Release\net8.0-windows\win-x64\publish\NexusTray.exe"),
                    (Join-Path $PSScriptRoot "NexusTray\bin\Release\net8.0-windows\win-x64\NexusTray.exe"),
                    (Join-Path $PSScriptRoot "NexusTray\bin\Release\net8.0-windows\NexusTray.exe"),
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
                Copy-Item -LiteralPath $traySource -Destination $trayTarget -Force

                # Configuração da bandeja: caminhos reais desta instalação, sem segredos.
                $trayJsonPath = Join-Path $trayDir "tray.json"
                $trayConfig = [ordered]@{
                    baseUrl      = ("https://{0}" -f $Hostname)
                    healthUrl    = "http://127.0.0.1:3000/api/health"
                    serviceName  = "NexusApp"
                    nssmPath     = $NssmExe
                    logsDir      = $LogsDir
                    dataDir      = $DataDir
                    backupScript = $backupScript
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
        Write-Step "Fase 7/7 - Smoke test e resumo"
        Assert-Admin

        $smokeScript = Join-Path $PSScriptRoot "smoke.ps1"
        if (-not (Test-Path -LiteralPath $smokeScript)) {
            Fail "smoke.ps1 não encontrado em $smokeScript."
        }
        $expectedVersion = $Tag -replace '^v', ''
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
        Write-Host "  Dados:      $DataDir"
        Write-Host "  Logs:       $LogsDir"
        Write-Host "  Versão:     $Tag"
        Write-Host "  Backup:     tarefa NexusBackup (diária, 02:00)"
        Write-Host "  Atualizar:  .\atualizar.ps1 -Tag <nova-tag>"
        Write-Host ""
    }
}
finally {
    Stop-NexusTranscript
}
