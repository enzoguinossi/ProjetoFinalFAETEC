# Funções compartilhadas da instalação do Nexus no Windows.
# Compatível com Windows PowerShell 5.1 (não use sintaxe de PowerShell 7).
#
# Este arquivo é dot-sourced pelos demais scripts:
#   . (Join-Path $PSScriptRoot "common.ps1")

$script:NexusScriptRoot = $PSScriptRoot
$script:NexusProgramRoot = "C:\Program Files\Nexus"
$script:NexusAppDir = Join-Path $script:NexusProgramRoot "app"
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
$script:NexusMySqlRoot = "C:\ProgramData\MySQL\MySQL Server 8.4"
$script:NexusMySqlDataDir = Join-Path $script:NexusMySqlRoot "Data"
$script:NexusMySqlConfig = Join-Path $script:NexusMySqlRoot "my.ini"

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

function Install-Msi {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [string]$Label = "MSI"
    )
    if (-not (Test-Path -LiteralPath $Path)) {
        Fail "Arquivo $Label não encontrado: $Path"
    }
    $msiexec = Join-Path $env:SystemRoot "System32\msiexec.exe"
    $arguments = @("/i", ('"{0}"' -f $Path), "/qn", "/norestart")
    $process = Start-Process -FilePath $msiexec -ArgumentList $arguments -Wait -PassThru
    if ($process.ExitCode -notin @(0, 3010, 1638)) {
        Fail "Instalação de $Label falhou (msiexec código $($process.ExitCode))."
    }
    if ($process.ExitCode -eq 3010) {
        Write-Warn "$Label instalado; o Windows pedirá reinicialização."
    }
    Write-Ok "$Label instalado."
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
        if ($response.Content) {
            try {
                $json = $response.Content | ConvertFrom-Json
                if ($json.PSObject.Properties.Name -contains "db") {
                    $result.Db = [bool]$json.db
                }
                if ($json.PSObject.Properties.Name -contains "versao") {
                    $result.Versao = [string]$json.versao
                }
            }
            catch {
                # A rota /login devolve HTML; não é JSON e não precisa ser.
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
        [string[]]$ReadIdentities = @()
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

function Get-CurrentTag {
    param([string]$RepoPath = $script:NexusAppDir)
    if (-not (Test-Path -LiteralPath (Join-Path $RepoPath ".git"))) {
        return ""
    }
    $git = Get-Command git.exe -ErrorAction SilentlyContinue
    if (-not $git) {
        return ""
    }
    $tag = & $git.Source -C $RepoPath describe --tags --exact-match 2>$null
    if ($LASTEXITCODE -ne 0 -or -not $tag) {
        $tag = & $git.Source -C $RepoPath describe --tags --abbrev=0 2>$null
    }
    if ($LASTEXITCODE -eq 0 -and $tag) {
        return ([string]($tag | Select-Object -First 1)).Trim()
    }
    return ""
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

function Test-Internet {
    return (Test-TcpPort -ComputerName "nodejs.org" -Port 443 -TimeoutMs 5000)
}

function Get-FreeSpaceGB {
    param([string]$Drive = "C")
    $item = Get-PSDrive -Name $Drive -ErrorAction SilentlyContinue
    if (-not $item) { return 0 }
    return [math]::Round(($item.Free / 1GB), 1)
}

function Update-SessionPath {
    $machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
    $parts = @($machinePath, $userPath) | Where-Object { $_ }
    $env:Path = ($parts -join ";")

    # Garante os caminhos padrão mesmo quando o instalador não atualizou o PATH.
    foreach ($known in @("C:\Program Files\nodejs", "C:\Program Files\Git\cmd")) {
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

function Assert-MysqlRootPassword {
    param([string]$Plain)
    if (-not $Plain -or $Plain.Length -lt 1) {
        Fail "A senha do root do MySQL não pode ficar vazia."
    }
    if ($Plain -match "[`r`n]") {
        Fail "A senha do root do MySQL contém caracteres inválidos."
    }
}

function Assert-SafeAppPassword {
    param(
        [string]$Plain,
        [string]$Label = "Senha de nexus_app"
    )
    if (-not $Plain -or $Plain.Length -lt 12) {
        Fail "$Label deve ter pelo menos 12 caracteres."
    }
    if ($Plain.Length -gt 64) {
        Fail "$Label deve ter no máximo 64 caracteres."
    }
    if ($Plain -notmatch '^[A-Za-z0-9._-]+$') {
        Fail "$Label deve usar apenas letras, números, ponto, hífen e sublinhado (sem @, :, /, espaços ou aspas)."
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

function Resolve-LatestGitForWindows {
    Enable-Tls12
    try {
        $release = Invoke-RestMethod -Uri "https://api.github.com/repos/git-for-windows/git/releases/latest" `
            -Headers @{ "User-Agent" = "NexusDeploy" } -UseBasicParsing -TimeoutSec 60
    }
    catch {
        Fail "Não foi possível consultar a última versão do Git for Windows. Defina git.url no manifesto."
    }
    $asset = $release.assets | Where-Object { $_.name -match '^Git-.*-64-bit\.exe$' } | Select-Object -First 1
    if (-not $asset) {
        Fail "O release do Git for Windows não contém o instalador 64-bit esperado."
    }
    return [pscustomobject]@{
        Version = [string]$release.tag_name
        Url     = [string]$asset.browser_download_url
    }
}

function Resolve-LatestCaddy {
    Enable-Tls12
    try {
        $release = Invoke-RestMethod -Uri "https://api.github.com/repos/caddyserver/caddy/releases/latest" `
            -Headers @{ "User-Agent" = "NexusDeploy" } -UseBasicParsing -TimeoutSec 60
    }
    catch {
        Fail "Não foi possível consultar a última versão do Caddy. Defina caddy.url no manifesto."
    }
    $asset = $release.assets | Where-Object { $_.name -match '^caddy_.*_windows_amd64\.zip$' } | Select-Object -First 1
    if (-not $asset) {
        Fail "O release do Caddy não contém o pacote windows_amd64 esperado."
    }
    return [pscustomobject]@{
        Version = [string]$release.tag_name
        Url     = [string]$asset.browser_download_url
    }
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
