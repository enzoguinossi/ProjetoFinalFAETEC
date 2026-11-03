#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Instalação do Nexus em Windows, do zero (sem Node, Git ou MySQL instalados).

.DESCRIPTION
    Executa as fases 0 a 7 com estado em
    C:\ProgramData\Nexus\bootstrap.state.json. É idempotente e retomável.

    A fase 2 instala automaticamente o MySQL 8.4.13 LTS dedicado do Nexus
    (serviço NexusMySQL84, porta 3214, bind 127.0.0.1), sem instalar nem
    alterar o MySQL existente na porta 3306.

.PARAMETER Hostname
    Nome DNS usado pelo Caddy (ex.: nexus.escola.local).

.PARAMETER RepoUrl
    URL do repositório. Padrão: manifesto.json.

.PARAMETER Tag
    Tag a instalar (obrigatória; ex.: v2.02.11.2026).

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
    [Security.SecureString]$RootPassword,
    [Security.SecureString]$AppPassword,
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

$Hostname = $Hostname.Trim().ToLowerInvariant()
if ($Hostname -notmatch '^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$') {
    Fail "Hostname inválido: '$Hostname'. Informe apenas o nome DNS, sem http://, porta ou caminho."
}

$manifest = Get-Manifest
if (-not $RepoUrl) { $RepoUrl = [string]$manifest.repo.url }
if (-not $RepoUrl) { Fail "repo.url não definido no manifesto." }
if (-not $Tag) { Fail "Informe a tag do release com -Tag (ex.: v2.02.11.2026)." }

$ProgramRoot = $script:NexusProgramRoot
$AppDir = $script:NexusAppDir
$DataDir = $script:NexusDataDir
$LogsDir = $script:NexusLogsDir
$ConfigDir = $script:NexusConfigDir
$BackupsDir = $script:NexusBackupsDir
$UploadsDir = $script:NexusUploadsDir
$CaddyDataDir = $script:NexusCaddyDataDir
$CaddyConfigDir = $script:NexusCaddyConfigDir
$CaddyLogsDir = $script:NexusCaddyLogsDir
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
    Protect-File -Path $BackupCnf
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

try {
    if ($startPhase -le 0) {
        Write-Step "Fase 0/7 - Pré-checagem"
        Assert-Admin
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

        if (-not (Test-Internet)) {
            Fail "Sem conectividade com a internet (nodejs.org:443). Verifique a rede/proxy."
        }
        Write-Ok "Internet disponível."

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
        Write-Step "Fase 2/7 - MySQL 8.4 dedicado"
        Assert-Admin

        $rootSecure = $null
        $appSecure = $null
        $appPlain = $null
        try {
            $mysqlService = Get-Service -Name $script:NexusMySqlService -ErrorAction SilentlyContinue
            $installedNow = $false
            if (-not $mysqlService) {
                $credentials = Read-MySqlCredentials -RootPassword $RootPassword -AppPassword $AppPassword
                $rootSecure = $credentials.Root
                $appSecure = $credentials.App
                Write-Ok "Instalando o MySQL dedicado (serviço $($script:NexusMySqlService), porta $($script:NexusMySqlPort))..."
                & (Join-Path $PSScriptRoot "instalar-mysql.ps1") `
                    -RootPassword $rootSecure `
                    -AppPassword $appSecure `
                    -Port $script:NexusMySqlPort
                if ($LASTEXITCODE -ne 0) {
                    Fail "A instalação do MySQL dedicado falhou (código $LASTEXITCODE). Consulte $LogsDir."
                }
                $installedNow = $true
                $mysqlService = Get-Service -Name $script:NexusMySqlService -ErrorAction SilentlyContinue
            }

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

            $mysqlExe = Join-Path $script:NexusMySqlDir "bin\mysql.exe"
            if (-not (Test-Path -LiteralPath $mysqlExe -PathType Leaf)) {
                Fail "mysql.exe não encontrado em $mysqlExe."
            }

            $needsSetup = $true
            if (-not $installedNow -and (Test-Path -LiteralPath $BackupCnf)) {
                $cnfPort = Get-CnfValue -Path $BackupCnf -Section "client" -Key "port"
                if ([string]$cnfPort -ne [string]$script:NexusMySqlPort) {
                    Write-Warn "O backup.cnf usa a porta '$cnfPort'; ele será regravado para $($script:NexusMySqlPort)."
                }
                else {
                    $testOut = Join-Path $env:TEMP ("nexus-mysql-test-" + [guid]::NewGuid().ToString("N") + ".out")
                    $testErr = Join-Path $env:TEMP ("nexus-mysql-test-" + [guid]::NewGuid().ToString("N") + ".err")
                    try {
                        $testArgs = "--defaults-extra-file=`"$BackupCnf`" --protocol=TCP -h 127.0.0.1 -P $script:NexusMySqlPort -D nexus_prod -e `"SELECT 1;`""
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
            }
            if ($installedNow) { $needsSetup = $true }

            if ($needsSetup) {
                if (-not $rootSecure) {
                    $credentials = Read-MySqlCredentials -RootPassword $RootPassword -AppPassword $AppPassword
                    $rootSecure = $credentials.Root
                    $appSecure = $credentials.App
                }
                if (-not $installedNow) {
                    Write-Ok "Verificando a instalação existente do MySQL dedicado..."
                    & (Join-Path $PSScriptRoot "instalar-mysql.ps1") `
                        -RootPassword $rootSecure `
                        -AppPassword $appSecure `
                        -Port $script:NexusMySqlPort
                    if ($LASTEXITCODE -ne 0) {
                        Fail "A verificação do MySQL dedicado falhou (código $LASTEXITCODE). Consulte $LogsDir."
                    }
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
                Write-Ok "Configuração do MySQL concluída; backup.cnf criado com ACL restrita."
            }

            $state.completedPhase = 2
            $state.paused = $false
            $state.pausedPhase = $null
            Save-BootstrapState -State $state
        }
        finally {
            $rootSecure = $null
            $appSecure = $null
            $appPlain = $null
        }
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
            $script:NexusCaddyDir,
            $CaddyDataDir,
            $CaddyConfigDir,
            $CaddyLogsDir
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
        $nssmVersion = [string]$manifest.nssm.version
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
        Write-Ok "Caddyfile gerado para $Hostname."

        # ACLs restritas: nada herda Users de C:\ProgramData.
        Set-AclReadExecute -Path $ProgramRoot
        Set-AclReadExecute -Path $ProgramRoot -Identity "S-1-5-19"
        Set-AclRestricted -Path $DataDir
        Set-AclRestricted -Path $UploadsDir -ModifyIdentities @("S-1-5-20")
        Set-AclRestricted -Path $LogsDir -ModifyIdentities @("S-1-5-20")
        Set-AclRestricted -Path $ConfigDir
        Set-AclRestricted -Path $BackupsDir
        foreach ($dir in @(
            (Join-Path $BackupsDir "db"),
            (Join-Path $BackupsDir "uploads"),
            (Join-Path $BackupsDir "config")
        )) {
            Set-AclRestricted -Path $dir
        }
        foreach ($dir in @(
            $script:NexusCaddyDir,
            $CaddyDataDir,
            $CaddyConfigDir,
            $CaddyLogsDir
        )) {
            Set-AclRestricted -Path $dir -ModifyIdentities @("S-1-5-19")
        }
        # O serviço LocalService do Caddy precisa ler o arquivo de configuração.
        Protect-File -Path $Caddyfile -ReadIdentities @("S-1-5-19")

        if (Test-Path -LiteralPath $script:NexusMySqlDir) {
            Set-AclReadExecute -Path $script:NexusMySqlDir -Identity "S-1-5-20"
        }
        if (Test-Path -LiteralPath $script:NexusMySqlRoot) {
            Set-AclRestricted -Path $script:NexusMySqlRoot -ModifyIdentities @("S-1-5-20")
            if (Test-Path -LiteralPath $script:NexusMySqlDataDir) {
                Set-AclRestricted -Path $script:NexusMySqlDataDir -ModifyIdentities @("S-1-5-20")
            }
            if (Test-Path -LiteralPath $script:NexusMySqlConfig) {
                Protect-File -Path $script:NexusMySqlConfig -ReadIdentities @("S-1-5-20")
            }
        }
        Set-NexusFirewallRules
        Write-Ok "ACLs restritas e regras de firewall aplicadas."

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

        $healthRoute = Join-Path $AppDir "src\app\api\health\route.ts"
        if (-not (Test-Path -LiteralPath $healthRoute)) {
            Fail "A tag $Tag não contém src/app/api/health/route.ts; crie a tag do release com a rota."
        }
        try {
            $packageInfo = Get-Content -LiteralPath (Join-Path $AppDir "package.json") -Raw -Encoding UTF8 | ConvertFrom-Json
        }
        catch {
            Fail "Não foi possível ler o package.json da tag $Tag`: $($_.Exception.Message)"
        }
        $expectedTagVersion = $Tag -replace '^v', ''
        if ([string]$packageInfo.version -ne $expectedTagVersion) {
            Fail "A versão do package.json da tag $Tag é '$([string]$packageInfo.version)', esperada '$expectedTagVersion'. Crie a tag a partir do release."
        }
        Write-Ok "Tag $Tag contém /api/health e versão $expectedTagVersion."

        $envPath = Join-Path $AppDir ".env"
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

            Set-EnvFile -Path $envPath -Key "DATABASE_URL" -Value ('"mysql://nexus_app:{0}@127.0.0.1:{1}/nexus_prod"' -f $appPasswordPlain, $script:NexusMySqlPort) -ReadIdentities @("S-1-5-20")
            Set-EnvFile -Path $envPath -Key "UPLOADS_DIR" -Value $UploadsDir -ReadIdentities @("S-1-5-20")
            Set-EnvFile -Path $envPath -Key "NODE_ENV" -Value "production" -ReadIdentities @("S-1-5-20")
            Set-EnvFile -Path $envPath -Key "PORT" -Value "3000" -ReadIdentities @("S-1-5-20")
            $jwtSecret = Get-EnvValue -Path $envPath -Key "JWT_SECRET"
            if (-not $jwtSecret) {
                $jwtSecret = New-RandomSecret -Bytes 48
                Set-EnvFile -Path $envPath -Key "JWT_SECRET" -Value ('"{0}"' -f $jwtSecret) -ReadIdentities @("S-1-5-20")
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
        Protect-File -Path $envPath -ReadIdentities @("S-1-5-20")
        Write-Ok "Arquivo .env criado com ACL restrita (NetworkService lê; Administrators/SYSTEM controlam)."

        # A aplicação em execução trava node_modules/.next durante npm ci/build.
        $runningApp = Get-Service -Name "NexusApp" -ErrorAction SilentlyContinue
        if ($runningApp -and $runningApp.Status.ToString() -ne "Stopped") {
            Write-Ok "Parando NexusApp/NexusCaddy para atualizar a aplicação..."
            Stop-Service -Name "NexusApp" -Force -ErrorAction SilentlyContinue
            if (-not (Wait-ServiceState -Name "NexusApp" -Status "Stopped" -TimeoutSeconds 60)) {
                Fail "O serviço NexusApp não parou para atualizar a aplicação."
            }
        }

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

        foreach ($dir in @($script:NexusCaddyDir, $CaddyDataDir, $CaddyConfigDir, $CaddyLogsDir)) {
            if (-not (Test-Path -LiteralPath $dir)) {
                New-Item -ItemType Directory -Force -Path $dir | Out-Null
            }
            Set-AclRestricted -Path $dir -ModifyIdentities @("S-1-5-19")
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
            -DependOnService $script:NexusMySqlService
        Write-Ok "Serviço NexusApp configurado (NT AUTHORITY\NetworkService)."

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
        Set-AclReadExecute -Path $scriptsDir

        $backupScript = Join-Path $scriptsDir "backup.ps1"
        $restartScript = Join-Path $scriptsDir "restart.ps1"
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
                    baseUrl      = ("https://{0}" -f $Hostname)
                    healthUrl    = "http://127.0.0.1:3000/api/health"
                    serviceName  = "NexusApp"
                    nssmPath     = $NssmExe
                    logsDir      = $LogsDir
                    dataDir      = $DataDir
                    backupScript = $backupScript
                    restartScript = $restartScript
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
