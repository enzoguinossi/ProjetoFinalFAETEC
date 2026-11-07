# Funções compartilhadas da instalação do Nexus no Windows.
# Compatível com Windows PowerShell 5.1 (não use sintaxe de PowerShell 7).
#
# Este arquivo é dot-sourced pelos demais scripts:
#   . (Join-Path $PSScriptRoot "common.ps1")

$script:NexusScriptRoot = $PSScriptRoot
$script:NexusProgramRoot = "C:\Program Files\Nexus"
$script:NexusAppDir = Join-Path $script:NexusProgramRoot "app"
$script:NexusPayloadDir = Join-Path $script:NexusScriptRoot "payload"
$script:NexusNodeDir = Join-Path $script:NexusProgramRoot "node"
$script:NexusNodeExe = Join-Path $script:NexusNodeDir "node.exe"
$script:NexusDataDir = "C:\ProgramData\Nexus"
$script:NexusLogsDir = Join-Path $script:NexusDataDir "logs"
$script:NexusConfigDir = Join-Path $script:NexusDataDir "config"
$script:NexusBackupsDir = Join-Path $script:NexusDataDir "backups"
$script:NexusUploadsDir = Join-Path $script:NexusDataDir "uploads"
$script:NexusCaddyDir = Join-Path $script:NexusDataDir "caddy"
$script:NexusCaddyDataDir = Join-Path $script:NexusCaddyDir "data"
$script:NexusCaddyConfigDir = Join-Path $script:NexusCaddyDir "config"
$script:NexusCaddyLogsDir = Join-Path $script:NexusCaddyDir "logs"
$script:NexusMySqlPort = 3214
$script:NexusMySqlService = "NexusMySQL84"
$script:NexusMySqlDir = Join-Path $script:NexusProgramRoot "mysql"
$script:NexusMySqlRoot = Join-Path $script:NexusDataDir "mysql"
$script:NexusMySqlDataDir = Join-Path $script:NexusMySqlRoot "data"
$script:NexusMySqlConfig = Join-Path $script:NexusMySqlRoot "my.ini"
# Caminho criado pelo instalador antigo (MySQL instalado pelo MSI). Só é usado
# para migrar os dados; o Nexus nunca volta a gravar nele.
$script:NexusMySqlLegacyRoot = "C:\ProgramData\MySQL\MySQL Server 8.4"
$script:NexusMySqlLegacyDataDir = Join-Path $script:NexusMySqlLegacyRoot "Data"

$script:NexusTranscriptPath = $null
$script:NexusTranscriptActive = $false

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
    try {
        $failLog = Join-Path $env:TEMP "nexus-fail.log"
        Add-Content -LiteralPath $failLog -Value ("[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Message) -Encoding UTF8 -ErrorAction Stop
    }
    catch {
        # O log de erro não pode mascarar a falha original.
    }
    exit 1
}

function Assert-Admin {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal -ArgumentList $identity
    if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        Fail "Execute este script em um PowerShell elevado (Executar como administrador)."
    }
}

function Enable-Tls12 {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
}

function Invoke-Download {
    param(
        [Parameter(Mandatory = $true)][string]$Url,
        [Parameter(Mandatory = $true)][string]$Destination,
        [string]$Sha256 = "",
        [string]$Sha512 = "",
        [string]$Md5 = "",
        [string]$Label = "arquivo",
        [int]$Attempts = 3
    )

    Enable-Tls12
    $parent = Split-Path -Parent $Destination
    if ($parent -and -not (Test-Path -LiteralPath $parent)) {
        New-Item -ItemType Directory -Force -Path $parent | Out-Null
    }
    if (Test-Path -LiteralPath $Destination) {
        Remove-Item -LiteralPath $Destination -Force
    }

    $oldProgress = $ProgressPreference
    $ProgressPreference = "SilentlyContinue"
    try {
        $downloaded = $false
        for ($attempt = 1; $attempt -le $Attempts; $attempt++) {
            try {
                Invoke-WebRequest -Uri $Url -OutFile $Destination -UseBasicParsing -TimeoutSec 600
                $downloaded = $true
                break
            }
            catch {
                if ($attempt -ge $Attempts) {
                    Fail "Falha ao baixar $Label de $Url após $Attempts tentativa(s)."
                }
                Write-Warn "Download de $Label falhou (tentativa $attempt). Repetindo..."
                Start-Sleep -Seconds ($attempt * 5)
            }
        }
        if (-not $downloaded) {
            Fail "Download de $Label não concluído."
        }
    }
    finally {
        $ProgressPreference = $oldProgress
    }

    if (-not (Test-Path -LiteralPath $Destination)) {
        Fail "Download de $Label não gerou o arquivo esperado."
    }
    Unblock-File -LiteralPath $Destination -ErrorAction SilentlyContinue

    if ($Sha256) {
        $expected = $Sha256.Trim().ToLowerInvariant()
        $actual = (Get-FileHash -LiteralPath $Destination -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($actual -ne $expected) {
            Remove-Item -LiteralPath $Destination -Force -ErrorAction SilentlyContinue
            Fail "Hash SHA-256 de $Label não confere. Esperado: $expected; obtido: $actual."
        }
        Write-Ok "Hash de $Label verificado."
    }

    if ($Sha512) {
        $expected = $Sha512.Trim().ToLowerInvariant()
        $actual = (Get-FileHash -LiteralPath $Destination -Algorithm SHA512).Hash.ToLowerInvariant()
        if ($actual -ne $expected) {
            Remove-Item -LiteralPath $Destination -Force -ErrorAction SilentlyContinue
            Fail "Hash SHA-512 de $Label não confere. Esperado: $expected; obtido: $actual."
        }
        Write-Ok "Hash SHA-512 de $Label verificado."
    }

    if ($Md5) {
        $expected = $Md5.Trim().ToLowerInvariant()
        $actual = (Get-FileHash -LiteralPath $Destination -Algorithm MD5).Hash.ToLowerInvariant()
        if ($actual -ne $expected) {
            Remove-Item -LiteralPath $Destination -Force -ErrorAction SilentlyContinue
            Fail "Hash MD5 de $Label não confere. Esperado: $expected; obtido: $actual."
        }
        Write-Ok "MD5 de $Label verificado."
    }
}

function Install-Exe {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [string]$Arguments = "/install /quiet /norestart",
        [string]$Label = "programa"
    )
    if (-not (Test-Path -LiteralPath $Path)) {
        Fail "Instalador de $Label não encontrado: $Path"
    }
    $process = Start-Process -FilePath $Path -ArgumentList $Arguments -Wait -PassThru
    if ($process.ExitCode -notin @(0, 3010, 1638)) {
        Fail "Instalação de $Label falhou (código $($process.ExitCode))."
    }
    if ($process.ExitCode -eq 3010) {
        Write-Warn "$Label instalado; o Windows pedirá reinicialização."
    }
    Write-Ok "$Label instalado."
}

function Wait-ServiceState {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [string]$Status = "Running",
        [int]$TimeoutSeconds = 60
    )
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    do {
        $service = Get-Service -Name $Name -ErrorAction SilentlyContinue
        if ($service -and $service.Status.ToString() -eq $Status) {
            return $true
        }
        Start-Sleep -Seconds 2
    } while ((Get-Date) -lt $deadline)
    return $false
}

function Test-Health {
    param(
        [Parameter(Mandatory = $true)][string]$Url,
        [switch]$ExpectDb
    )

    $result = [pscustomobject]@{
        Ok         = $false
        StatusCode = 0
        Db         = $null
        Versao     = $null
        Error      = $null
    }

    $oldProgress = $ProgressPreference
    $ProgressPreference = "SilentlyContinue"
    try {
        $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 20
        $result.StatusCode = [int]$response.StatusCode
        $text = ([string]$response.Content).TrimStart()
        if ($text.StartsWith("{")) {
            try {
                $json = $text | ConvertFrom-Json
                if ($json.PSObject.Properties.Name -contains "db") {
                    $result.Db = [bool]$json.db
                }
                if ($json.PSObject.Properties.Name -contains "versao") {
                    $result.Versao = [string]$json.versao
                }
            }
            catch {
                # Conteúdo JSON inválido; a checagem de status continua valendo.
            }
        }
        $result.Ok = ($result.StatusCode -eq 200)
        if ($ExpectDb -and $result.Db -ne $true) {
            $result.Ok = $false
        }
    }
    catch {
        $response = $_.Exception.Response
        if ($response) {
            try { $result.StatusCode = [int]$response.StatusCode } catch { }
        }
        $result.Error = "sem resposta"
        $result.Ok = $false
    }
    finally {
        $ProgressPreference = $oldProgress
    }

    return $result
}

function Stop-NexusAppProcess {
    <#
    .SYNOPSIS
        Para o serviço NexusApp e libera a porta 3000 de um node órfão do Nexus.

    .DESCRIPTION
        O serviço pode ficar Paused (ou Stopped) com um node antigo ainda
        escutando em 127.0.0.1:3000. Só encerra processos comprovadamente do
        Nexus: o node portátil da instalação e/ou `server.js` em `app`/`app.prev`.
        Nunca mata outro processo apenas por ocupar a porta. Quando um processo
        na porta não pode ser inspecionado, registra aviso e retorna $false.

    .OUTPUTS
        $true quando o serviço está parado e a porta 3000 está livre; $false caso
        contrário (o chamador decide falhar).
    #>
    $service = Get-Service -Name "NexusApp" -ErrorAction SilentlyContinue
    if ($service -and $service.Status.ToString() -ne "Stopped") {
        Write-Ok "Parando o serviço NexusApp ($($service.Status))..."
        try {
            Stop-Service -Name "NexusApp" -Force -ErrorAction Stop
        }
        catch {
            Write-Warn "Não foi possível parar o serviço NexusApp: $($_.Exception.Message)"
        }
        if (-not (Wait-ServiceState -Name "NexusApp" -Status "Stopped" -TimeoutSeconds 60)) {
            Write-Warn "O serviço NexusApp não chegou a Stopped em 60 segundos."
            return $false
        }
        Write-Ok "Serviço NexusApp parado."
    }

    $failed = $false
    $connections = @(Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue)
    foreach ($connection in $connections) {
        $ownerId = [int]$connection.OwningProcess
        $process = Get-CimInstance -ClassName Win32_Process -Filter ("ProcessId={0}" -f $ownerId) -ErrorAction SilentlyContinue
        if (-not $process) {
            Write-Warn "A porta 3000 está ocupada pelo PID $ownerId, mas o processo não pôde ser inspecionado; ele não será encerrado."
            $failed = $true
            continue
        }

        $executable = [string]$process.ExecutablePath
        $commandLine = [string]$process.CommandLine
        $isNexusNode = ($executable -and ($executable -ieq $script:NexusNodeExe)) -or
            ($commandLine -and ($commandLine.IndexOf($script:NexusNodeExe, [System.StringComparison]::OrdinalIgnoreCase) -ge 0))
        $isNexusApp = $commandLine -and (
            ($commandLine.IndexOf("server.js", [System.StringComparison]::OrdinalIgnoreCase) -ge 0) -or
            ($commandLine.IndexOf($script:NexusAppDir, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) -or
            ($commandLine.IndexOf("app.prev", [System.StringComparison]::OrdinalIgnoreCase) -ge 0))
        if (-not ($isNexusNode -and $isNexusApp)) {
            Write-Warn "A porta 3000 está ocupada pelo PID $ownerId ($executable), que não é o node do Nexus; ele não será encerrado."
            $failed = $true
            continue
        }

        try {
            Stop-Process -Id $ownerId -Force -ErrorAction Stop
            Write-Ok "Encerrado node órfão do Nexus na porta 3000 (PID $ownerId)."
        }
        catch {
            Write-Warn "Não foi possível encerrar o PID ${ownerId}: $($_.Exception.Message)"
            $failed = $true
        }
    }

    # Espera a porta 3000 ficar livre (até 30 s), mesmo quando não havia órfão.
    $deadline = (Get-Date).AddSeconds(30)
    $listening = @(Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue)
    while ($listening.Count -gt 0 -and (Get-Date) -lt $deadline) {
        Start-Sleep -Seconds 1
        $listening = @(Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue)
    }
    if ($listening.Count -gt 0) {
        Write-Warn "A porta 3000 continua ocupada após 30 segundos."
        return $false
    }
    if ($failed) {
        return $false
    }
    return $true
}

function Start-NexusApp {
    <#
    .SYNOPSIS
        Inicia o serviço NexusApp com a porta 3000 livre e valida o health local.

    .DESCRIPTION
        Um NexusApp em Paused (o node novo recebeu EACCES na 3000) é parado com
        Stop-Service -Force. Em seguida Stop-NexusAppProcess limpa qualquer node
        órfão do Nexus, o serviço volta a Automatic e é iniciado. Lança erro se
        não chegar a Running ou se o health local não responder 200 com db=true;
        nunca retorna sucesso com o serviço Paused.

    .PARAMETER TimeoutSeconds
        Tempo máximo de espera pelo health local (padrão 180 segundos).
    #>
    param([int]$TimeoutSeconds = 180)

    $service = Get-Service -Name "NexusApp" -ErrorAction SilentlyContinue
    if (-not $service) {
        throw "O serviço NexusApp não existe."
    }

    if ($service.Status.ToString() -eq "Paused") {
        Write-Warn "O serviço NexusApp está Paused; reiniciando do zero..."
        Stop-Service -Name "NexusApp" -Force -ErrorAction SilentlyContinue
        if (-not (Wait-ServiceState -Name "NexusApp" -Status "Stopped" -TimeoutSeconds 60)) {
            throw "O serviço NexusApp não parou (estava Paused)."
        }
    }

    if (-not (Stop-NexusAppProcess)) {
        throw "Não foi possível liberar a porta 3000 antes de iniciar o NexusApp."
    }

    Set-Service -Name "NexusApp" -StartupType Automatic -ErrorAction SilentlyContinue
    $service = Get-Service -Name "NexusApp" -ErrorAction SilentlyContinue
    if (-not $service -or $service.Status.ToString() -ne "Running") {
        Start-Service -Name "NexusApp" -ErrorAction Stop
    }
    if (-not (Wait-ServiceState -Name "NexusApp" -Status "Running" -TimeoutSeconds 120)) {
        $status = "não encontrado"
        $current = Get-Service -Name "NexusApp" -ErrorAction SilentlyContinue
        if ($current) { $status = $current.Status.ToString() }
        throw "O serviço NexusApp não iniciou (status $status). Veja $script:NexusLogsDir\app.err.log."
    }

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    $health = $null
    do {
        $health = Test-Health -Url "http://127.0.0.1:3000/api/health" -ExpectDb
        if ($health.Ok) { break }
        Start-Sleep -Seconds 3
    } while ((Get-Date) -lt $deadline)
    if (-not $health -or -not $health.Ok) {
        throw "O health local do NexusApp não respondeu 200 com db=true. Veja $script:NexusLogsDir\app.err.log."
    }

    Write-Ok "NexusApp em execução; health local OK (versão $($health.Versao))."
}

function Get-AccessIdentity {
    param([Parameter(Mandatory = $true)][string]$Identity)
    if ($Identity -match '^S-\d-\d+(-\d+)+$') {
        return (New-Object System.Security.Principal.SecurityIdentifier -ArgumentList $Identity)
    }
    try {
        return (New-Object System.Security.Principal.NTAccount -ArgumentList $Identity).Translate(
            [System.Security.Principal.SecurityIdentifier]
        )
    }
    catch {
        Fail "Não foi possível resolver a identidade '$Identity' para uma ACL."
    }
}

function Set-AclModify {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [string]$Identity = "NT AUTHORITY\NetworkService"
    )
    if (-not (Test-Path -LiteralPath $Path)) {
        Fail "Caminho não encontrado para ACL: $Path"
    }

    $item = Get-Item -LiteralPath $Path -Force
    if ($item.PSIsContainer) {
        $inheritance = [Security.AccessControl.InheritanceFlags]"ContainerInherit, ObjectInherit"
    }
    else {
        $inheritance = [Security.AccessControl.InheritanceFlags]::None
    }

    $acl = Get-Acl -LiteralPath $Path
    $rule = New-Object Security.AccessControl.FileSystemAccessRule -ArgumentList @(
        (Get-AccessIdentity -Identity $Identity),
        [Security.AccessControl.FileSystemRights]::Modify,
        $inheritance,
        [Security.AccessControl.PropagationFlags]::None,
        [Security.AccessControl.AccessControlType]::Allow
    )
    $acl.SetAccessRule($rule)
    Set-Acl -LiteralPath $Path -AclObject $acl
}

function Set-AclReadExecute {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [string]$Identity = "NT AUTHORITY\NetworkService"
    )
    if (-not (Test-Path -LiteralPath $Path)) {
        Fail "Caminho não encontrado para ACL: $Path"
    }

    $item = Get-Item -LiteralPath $Path -Force
    if ($item.PSIsContainer) {
        $inheritance = [Security.AccessControl.InheritanceFlags]"ContainerInherit, ObjectInherit"
    }
    else {
        $inheritance = [Security.AccessControl.InheritanceFlags]::None
    }

    $acl = Get-Acl -LiteralPath $Path
    $rule = New-Object Security.AccessControl.FileSystemAccessRule -ArgumentList @(
        (Get-AccessIdentity -Identity $Identity),
        [Security.AccessControl.FileSystemRights]"ReadAndExecute",
        $inheritance,
        [Security.AccessControl.PropagationFlags]::None,
        [Security.AccessControl.AccessControlType]::Allow
    )
    $acl.SetAccessRule($rule)
    Set-Acl -LiteralPath $Path -AclObject $acl
}

function Set-AclRestricted {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [string[]]$ModifyIdentities = @(),
        [string[]]$ReadIdentities = @()
    )
    if (-not (Test-Path -LiteralPath $Path)) {
        Fail "Caminho não encontrado para ACL: $Path"
    }

    $item = Get-Item -LiteralPath $Path -Force
    if ($item.PSIsContainer) {
        $inheritance = [Security.AccessControl.InheritanceFlags]"ContainerInherit, ObjectInherit"
    }
    else {
        $inheritance = [Security.AccessControl.InheritanceFlags]::None
    }

    $acl = Get-Acl -LiteralPath $Path
    # Remove a herança de C:\ProgramData e qualquer ACE explícita anterior.
    $acl.SetAccessRuleProtection($true, $false)
    foreach ($rule in @($acl.Access)) {
        [void]$acl.RemoveAccessRule($rule)
    }

    $fullIdentities = @("S-1-5-32-544", "S-1-5-18")
    foreach ($identity in ($fullIdentities | Select-Object -Unique)) {
        $fullRule = New-Object Security.AccessControl.FileSystemAccessRule -ArgumentList @(
            (Get-AccessIdentity -Identity $identity),
            [Security.AccessControl.FileSystemRights]::FullControl,
            $inheritance,
            [Security.AccessControl.PropagationFlags]::None,
            [Security.AccessControl.AccessControlType]::Allow
        )
        $acl.AddAccessRule($fullRule)
    }

    foreach ($identity in ($ModifyIdentities | Where-Object { $_ } | Select-Object -Unique)) {
        $modifyRule = New-Object Security.AccessControl.FileSystemAccessRule -ArgumentList @(
            (Get-AccessIdentity -Identity $identity),
            [Security.AccessControl.FileSystemRights]::Modify,
            $inheritance,
            [Security.AccessControl.PropagationFlags]::None,
            [Security.AccessControl.AccessControlType]::Allow
        )
        $acl.AddAccessRule($modifyRule)
    }

    foreach ($identity in ($ReadIdentities | Where-Object { $_ } | Select-Object -Unique)) {
        $readRule = New-Object Security.AccessControl.FileSystemAccessRule -ArgumentList @(
            (Get-AccessIdentity -Identity $identity),
            [Security.AccessControl.FileSystemRights]::Read,
            $inheritance,
            [Security.AccessControl.PropagationFlags]::None,
            [Security.AccessControl.AccessControlType]::Allow
        )
        $acl.AddAccessRule($readRule)
    }

    Set-Acl -LiteralPath $Path -AclObject $acl
}

function Protect-File {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [string[]]$ReadIdentities = @(),
        [string[]]$ModifyIdentities = @()
    )
    if (-not (Test-Path -LiteralPath $Path)) {
        Fail "Arquivo não encontrado para proteger: $Path"
    }

    $acl = Get-Acl -LiteralPath $Path
    $acl.SetAccessRuleProtection($true, $false)
    foreach ($rule in @($acl.Access)) {
        [void]$acl.RemoveAccessRule($rule)
    }

    # SIDs bem conhecidos: funcionam em Windows localizado (evita "Administrators").
    $fullIdentities = @("S-1-5-32-544", "S-1-5-18")
    foreach ($identity in ($fullIdentities | Select-Object -Unique)) {
        $fullRule = New-Object Security.AccessControl.FileSystemAccessRule -ArgumentList @(
            (Get-AccessIdentity -Identity $identity),
            [Security.AccessControl.FileSystemRights]::FullControl,
            [Security.AccessControl.AccessControlType]::Allow
        )
        $acl.AddAccessRule($fullRule)
    }

    # Modify para o usuário da instalação (arquivo: sem herança).
    foreach ($identity in ($ModifyIdentities | Where-Object { $_ } | Select-Object -Unique)) {
        $modifyRule = New-Object Security.AccessControl.FileSystemAccessRule -ArgumentList @(
            (Get-AccessIdentity -Identity $identity),
            [Security.AccessControl.FileSystemRights]::Modify,
            [Security.AccessControl.InheritanceFlags]::None,
            [Security.AccessControl.PropagationFlags]::None,
            [Security.AccessControl.AccessControlType]::Allow
        )
        $acl.AddAccessRule($modifyRule)
    }

    foreach ($identity in ($ReadIdentities | Where-Object { $_ } | Select-Object -Unique)) {
        $readRule = New-Object Security.AccessControl.FileSystemAccessRule -ArgumentList @(
            (Get-AccessIdentity -Identity $identity),
            [Security.AccessControl.FileSystemRights]::Read,
            [Security.AccessControl.AccessControlType]::Allow
        )
        $acl.AddAccessRule($readRule)
    }

    Set-Acl -LiteralPath $Path -AclObject $acl
}

function Write-Utf8NoBom {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][AllowEmptyCollection()][AllowEmptyString()][string[]]$Lines
    )
    $encoding = New-Object System.Text.UTF8Encoding -ArgumentList $false
    [System.IO.File]::WriteAllLines($Path, [string[]]$Lines, $encoding)
}

function Get-EnvValue {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Key
    )
    if (-not (Test-Path -LiteralPath $Path)) {
        return $null
    }
    foreach ($line in [System.IO.File]::ReadAllLines($Path)) {
        $trimmed = $line.Trim()
        if (-not $trimmed -or $trimmed.StartsWith("#")) { continue }
        $index = $trimmed.IndexOf("=")
        if ($index -lt 1) { continue }
        $name = $trimmed.Substring(0, $index).Trim()
        if ($name -ne $Key) { continue }
        $value = $trimmed.Substring($index + 1).Trim()
        if ($value.Length -ge 2) {
            if (($value.StartsWith('"') -and $value.EndsWith('"')) -or
                ($value.StartsWith("'") -and $value.EndsWith("'"))) {
                $value = $value.Substring(1, $value.Length - 2)
            }
        }
        return $value
    }
    return $null
}

function Set-EnvFile {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Key,
        [Parameter(Mandatory = $true)][AllowEmptyString()][string]$Value,
        [string[]]$ReadIdentities = @()
    )
    $output = New-Object System.Collections.Generic.List[string]
    $updated = $false
    $pattern = '^\s*' + [regex]::Escape($Key) + '\s*='

    if (Test-Path -LiteralPath $Path) {
        foreach ($line in [System.IO.File]::ReadAllLines($Path)) {
            if ($line -match $pattern) {
                if (-not $updated) {
                    $output.Add("$Key=$Value")
                    $updated = $true
                }
            }
            else {
                $output.Add($line)
            }
        }
    }
    if (-not $updated) {
        $output.Add("$Key=$Value")
    }

    $parent = Split-Path -Parent $Path
    if ($parent -and -not (Test-Path -LiteralPath $parent)) {
        New-Item -ItemType Directory -Force -Path $parent | Out-Null
    }

    # O arquivo nasce vazio e protegido; o conteúdo (que pode ter segredo) só
    # é gravado depois da ACL restrita.
    if (-not (Test-Path -LiteralPath $Path)) {
        Write-Utf8NoBom -Path $Path -Lines @("")
    }
    Protect-File -Path $Path -ReadIdentities $ReadIdentities
    Write-Utf8NoBom -Path $Path -Lines ([string[]]$output.ToArray())
}

function Get-CnfValue {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Section,
        [Parameter(Mandatory = $true)][string]$Key
    )
    if (-not (Test-Path -LiteralPath $Path)) {
        return $null
    }

    $currentSection = ""
    foreach ($line in [System.IO.File]::ReadAllLines($Path)) {
        $trimmed = $line.Trim()
        if ($trimmed -match '^\[(.+)\]$') {
            $currentSection = $matches[1].Trim()
            continue
        }
        if ($currentSection -ne $Section) { continue }
        if ($trimmed -match ('^' + [regex]::Escape($Key) + '\s*=\s*(.*)$')) {
            $value = $matches[1].Trim()
            if ($value.Length -ge 2 -and $value.StartsWith('"') -and $value.EndsWith('"')) {
                $value = $value.Substring(1, $value.Length - 2)
            }
            return $value
        }
    }
    return $null
}

function Get-Manifest {
    param([string]$Path = (Join-Path $script:NexusScriptRoot "manifesto.json"))
    if (-not (Test-Path -LiteralPath $Path)) {
        Fail "Manifesto não encontrado: $Path"
    }
    try {
        return (Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json)
    }
    catch {
        Fail "Manifesto inválido: $Path"
    }
}

function Test-TcpPort {
    param(
        [string]$ComputerName = "127.0.0.1",
        [Parameter(Mandatory = $true)][int]$Port,
        [int]$TimeoutMs = 1500
    )
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $async = $client.BeginConnect($ComputerName, $Port, $null, $null)
        if (-not $async.AsyncWaitHandle.WaitOne($TimeoutMs, $false)) {
            return $false
        }
        $client.EndConnect($async)
        return $true
    }
    catch {
        return $false
    }
    finally {
        $client.Close()
    }
}

function Get-FreeSpaceGB {
    param([string]$Drive = "C")
    $item = Get-PSDrive -Name $Drive -ErrorAction SilentlyContinue
    if (-not $item) { return 0 }
    return [math]::Round(($item.Free / 1GB), 1)
}

function Update-SessionPath {
    # O destino não instala Node/Git no sistema: apenas os runtimes embutidos
    # em C:\Program Files\Nexus entram no PATH desta sessão.
    foreach ($known in @($script:NexusNodeDir, (Join-Path $script:NexusMySqlDir "bin"))) {
        if ((Test-Path -LiteralPath $known) -and ($env:Path -notlike ("*" + $known + "*"))) {
            $env:Path = $known + ";" + $env:Path
        }
    }
}

function Find-MysqlExe {
    $fixed = Join-Path $script:NexusMySqlDir "bin\mysql.exe"
    if (Test-Path -LiteralPath $fixed) { return $fixed }

    $fixed = "C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe"
    if (Test-Path -LiteralPath $fixed) { return $fixed }

    $base = "C:\Program Files\MySQL"
    if (Test-Path -LiteralPath $base) {
        $candidate = Get-ChildItem -Path $base -Directory -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -match '^MySQL Server 8\.(4|0)' } |
            Sort-Object Name -Descending |
            ForEach-Object { Join-Path $_.FullName "bin\mysql.exe" } |
            Where-Object { Test-Path -LiteralPath $_ } |
            Select-Object -First 1
        if ($candidate) { return $candidate }
    }

    $command = Get-Command mysql.exe -ErrorAction SilentlyContinue
    if ($command) { return $command.Source }
    Fail "mysql.exe não encontrado em $script:NexusMySqlDir\bin nem em instalações padrão do MySQL 8.0/8.4."
}

function Find-MysqldumpExe {
    $fixed = Join-Path $script:NexusMySqlDir "bin\mysqldump.exe"
    if (Test-Path -LiteralPath $fixed) { return $fixed }

    $fixed = "C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqldump.exe"
    if (Test-Path -LiteralPath $fixed) { return $fixed }

    $base = "C:\Program Files\MySQL"
    if (Test-Path -LiteralPath $base) {
        $candidate = Get-ChildItem -Path $base -Directory -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -match '^MySQL Server 8\.(4|0)' } |
            Sort-Object Name -Descending |
            ForEach-Object { Join-Path $_.FullName "bin\mysqldump.exe" } |
            Where-Object { Test-Path -LiteralPath $_ } |
            Select-Object -First 1
        if ($candidate) { return $candidate }
    }

    $command = Get-Command mysqldump.exe -ErrorAction SilentlyContinue
    if ($command) { return $command.Source }
    Fail "mysqldump.exe não encontrado em $script:NexusMySqlDir\bin nem em instalações padrão do MySQL 8.0/8.4."
}

function ConvertFrom-SecureStringPlain {
    param([Parameter(Mandatory = $true)][Security.SecureString]$Secure)
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Secure)
    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
}

function ConvertTo-MysqlOptionValue {
    param([Parameter(Mandatory = $true)][string]$Value)
    if ($Value -match "[`r`n]") {
        Fail "Valor inválido para arquivo de opções do MySQL."
    }
    $escaped = $Value.Replace("\", "\\").Replace('"', '\"')
    return ('"{0}"' -f $escaped)
}

function Test-MysqlRootPassword {
    param([string]$Plain)
    if ([string]::IsNullOrEmpty($Plain)) {
        return "A senha do root do MySQL não pode ficar vazia."
    }
    if ($Plain -match "[`r`n]") {
        return "A senha do root do MySQL não pode conter quebra de linha."
    }
    return $null
}

function Assert-MysqlRootPassword {
    param([string]$Plain)
    $message = Test-MysqlRootPassword -Plain $Plain
    if ($message) { Fail $message }
}

function Test-SafeAppPassword {
    param(
        [string]$Plain,
        [string]$Label = "Senha de nexus_app"
    )
    if ([string]::IsNullOrEmpty($Plain)) {
        return "$Label não pode ficar vazia."
    }
    if ($Plain.Length -gt 256) {
        return "$Label deve ter no máximo 256 caracteres."
    }
    if ($Plain -match '[\x00-\x1F\x7F]') {
        return ($Label + ' não pode conter espaço, tab ou caracteres de controle.')
    }
    if ($Plain -match '[@/?#"\\; ]') {
        return ($Label + ' não pode conter @, /, ?, #, ", \, ;, espaço, tab ou caracteres de controle.')
    }
    return $null
}

function Assert-SafeAppPassword {
    param(
        [string]$Plain,
        [string]$Label = "Senha de nexus_app"
    )
    $message = Test-SafeAppPassword -Plain $Plain -Label $Label
    if ($message) { Fail $message }
}

function Read-MySqlCredentials {
    param(
        [Security.SecureString]$RootPassword,
        [Security.SecureString]$AppPassword,
        [switch]$NoPrompt
    )

    if ($NoPrompt) {
        if (-not $RootPassword) {
            Fail ("A senha do root do MySQL não foi informada. " +
                "Execute o instalador novamente e preencha a página de credenciais.")
        }
        if (-not $AppPassword) {
            Fail ("A senha do nexus_app não foi informada. " +
                "Execute o instalador novamente e preencha a página de credenciais.")
        }
    }

    Suspend-Transcript
    try {
        $root = $RootPassword
        while ($true) {
            if (-not $root) {
                $root = Read-Host -AsSecureString "Senha do usuário root do MySQL dedicado (Ctrl+C para cancelar)"
            }
            $plain = ConvertFrom-SecureStringPlain -Secure $root
            $message = Test-MysqlRootPassword -Plain $plain
            $plain = $null
            if (-not $message) { break }
            if ($NoPrompt) { Fail $message }
            Write-Warn $message
            Write-Host "Tente novamente (Ctrl+C para cancelar)." -ForegroundColor Yellow
            $root = $null
        }

        $app = $AppPassword
        while ($true) {
            if (-not $app) {
                $app = Read-Host -AsSecureString 'Senha do usuário nexus_app (sem mínimo; não use @ / ? # " \ ; espaço, tab ou controle)'
            }
            $plain = ConvertFrom-SecureStringPlain -Secure $app
            $message = Test-SafeAppPassword -Plain $plain -Label "Senha de nexus_app"
            $plain = $null
            if (-not $message) { break }
            if ($NoPrompt) { Fail $message }
            Write-Warn $message
            Write-Host "Tente novamente (Ctrl+C para cancelar)." -ForegroundColor Yellow
            $app = $null
        }

        return @{ Root = $root; App = $app }
    }
    finally {
        Resume-Transcript
    }
}

function New-RandomSecret {
    param([int]$Bytes = 48)
    $buffer = New-Object byte[] $Bytes
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $rng.GetBytes($buffer)
    }
    finally {
        $rng.Dispose()
    }
    return [Convert]::ToBase64String($buffer)
}

function ConvertTo-SafeName {
    param([string]$Value)
    if (-not $Value) { return "desconhecida" }
    return ($Value -replace '[^A-Za-z0-9._-]', '_')
}

function Start-NexusTranscript {
    param([Parameter(Mandatory = $true)][string]$Path)
    $parent = Split-Path -Parent $Path
    if ($parent -and -not (Test-Path -LiteralPath $parent)) {
        New-Item -ItemType Directory -Force -Path $parent | Out-Null
    }
    $script:NexusTranscriptPath = $Path
    try {
        Start-Transcript -Path $Path -Append -Force | Out-Null
        $script:NexusTranscriptActive = $true
    }
    catch {
        Write-Warn "Não foi possível iniciar o log da sessão em $Path."
    }
}

function Suspend-Transcript {
    if ($script:NexusTranscriptActive) {
        try { Stop-Transcript | Out-Null } catch { }
        $script:NexusTranscriptActive = $false
    }
}

function Resume-Transcript {
    if ($script:NexusTranscriptPath -and -not $script:NexusTranscriptActive) {
        try {
            Start-Transcript -Path $script:NexusTranscriptPath -Append | Out-Null
            $script:NexusTranscriptActive = $true
        }
        catch { }
    }
}

function Stop-NexusTranscript {
    Suspend-Transcript
}
