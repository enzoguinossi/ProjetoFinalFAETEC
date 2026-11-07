#Requires -Version 5.1
<#
.SYNOPSIS
    Smoke test da instalação do Nexus.

.DESCRIPTION
    Verifica os serviços NexusMySQL84/NexusApp/NexusCaddy, a porta 3214, o
    health local com db=true, a página https://<hostname>/login, as regras de
    firewall e, opcionalmente, a versão. Não ignora validação de certificado:
    o HTTPS exige a CA do Caddy confiada no repositório do Windows.

.PARAMETER Hostname
    Nome DNS configurado no Caddyfile.

.PARAMETER ExpectedVersion
    Versão esperada (ex.: 1.02.11.2026 ou v1.02.11.2026).
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$Hostname,
    [string]$ExpectedVersion = ""
)

$ErrorActionPreference = "Continue"
. (Join-Path $PSScriptRoot "common.ps1")

$Hostname = $Hostname.Trim().ToLowerInvariant()
if ($Hostname -notmatch '^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$') {
    Write-Host "[ERRO] Hostname inválido: '$Hostname'." -ForegroundColor Red
    exit 1
}

$failures = New-Object System.Collections.Generic.List[string]

function Add-Failure {
    param([Parameter(Mandatory = $true)][string]$Message)
    $script:failures.Add($Message)
}

function Test-UsersAce {
    param([Parameter(Mandatory = $true)][string]$Path)
    try {
        $acl = Get-Acl -LiteralPath $Path
        foreach ($rule in $acl.Access) {
            $sid = $null
            if ($rule.IdentityReference -is [System.Security.Principal.SecurityIdentifier]) {
                $sid = $rule.IdentityReference.Value
            }
            else {
                try {
                    $sid = $rule.IdentityReference.Translate(
                        [System.Security.Principal.SecurityIdentifier]
                    ).Value
                }
                catch {
                    $sid = [string]$rule.IdentityReference
                }
            }
            if ($sid -eq "S-1-5-32-545") { return $true }
        }
        return $false
    }
    catch {
        # Na dúvida, trate como exposto: o smoke deve falhar.
        return $true
    }
}

Write-Step "Smoke test do Nexus"

$manifest = Get-Manifest

$nodeExe = $script:NexusNodeExe
if (Test-Path -LiteralPath $nodeExe -PathType Leaf) {
    $nodeVersion = ([string](& $nodeExe "--version" 2>$null | Select-Object -First 1)).Trim()
    $expectedNode = "v" + [string]$manifest.node.version
    if ($nodeVersion -eq $expectedNode) {
        Write-Ok "Node.js portátil: $nodeVersion em $nodeExe."
    }
    else {
        Write-Warn "Node.js portátil: '$nodeVersion'; esperado '$expectedNode' ($nodeExe)."
        Add-Failure "Node.js portátil em versão diferente da esperada"
    }
}
else {
    Write-Warn "Node.js portátil não encontrado em $nodeExe."
    Add-Failure "Node.js portátil ausente"
}

$mysqldExe = Join-Path $script:NexusMySqlDir "bin\mysqld.exe"
if (Test-Path -LiteralPath $mysqldExe -PathType Leaf) {
    Write-Ok "MySQL embutido: $mysqldExe."
}
else {
    Write-Warn "mysqld.exe não encontrado em $mysqldExe."
    Add-Failure "binários do MySQL dedicado ausentes"
}

foreach ($serviceName in @($script:NexusMySqlService, "NexusApp", "NexusCaddy")) {
    $service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
    if ($service -and $service.Status.ToString() -eq "Running") {
        Write-Ok "$serviceName em execução."
    }
    else {
        $status = "não encontrado"
        if ($service) { $status = $service.Status.ToString() }
        Write-Warn "${serviceName}: $status."
        Add-Failure "serviço $serviceName não está em execução"
    }
}

if (Test-TcpPort -Port $script:NexusMySqlPort -TimeoutMs 2000) {
    Write-Ok "MySQL dedicado aceitando conexões em 127.0.0.1:$($script:NexusMySqlPort)."
}
else {
    Write-Warn "A porta $($script:NexusMySqlPort) não está aceitando conexões."
    Add-Failure "porta $($script:NexusMySqlPort) não está ouvindo"
}

$aclChecks = @(
    @{ Path = $script:NexusBackupsDir; Label = "backups"; Recursive = $true },
    @{ Path = $script:NexusConfigDir; Label = "config"; Recursive = $true },
    @{ Path = (Join-Path $script:NexusAppDir ".env"); Label = "app\.env"; Recursive = $false }
)
foreach ($check in $aclChecks) {
    if (-not (Test-Path -LiteralPath $check.Path)) {
        Write-Warn "ACL: $($check.Label) não encontrado em $($check.Path)."
        Add-Failure "caminho ausente para verificação de ACL: $($check.Label)"
        continue
    }

    $paths = @($check.Path)
    if ($check.Recursive) {
        $item = Get-Item -LiteralPath $check.Path -Force
        if ($item.PSIsContainer) {
            $paths += @(Get-ChildItem -LiteralPath $check.Path -Recurse -Force -ErrorAction SilentlyContinue |
                ForEach-Object { $_.FullName })
        }
    }

    $offenders = @($paths | Where-Object { Test-UsersAce -Path $_ })
    if ($offenders.Count -gt 0) {
        Write-Warn "ACL de $($check.Label) contém BUILTIN\Users (S-1-5-32-545): $($offenders -join ', ')."
        Add-Failure "ACL de $($check.Label) permite BUILTIN\Users"
    }
    else {
        Write-Ok "ACL restrita: $($check.Label)."
    }
}

$firewallChecks = @(
    @{ Name = "Nexus HTTP"; Port = 80; Action = "Allow" },
    @{ Name = "Nexus HTTPS"; Port = 443; Action = "Allow" },
    @{ Name = "Nexus MySQL (LAN)"; Port = $script:NexusMySqlPort; Action = "Block" },
    @{ Name = "Nexus Next (LAN)"; Port = 3000; Action = "Block" }
)
if (-not (Get-Command Get-NetFirewallRule -ErrorAction SilentlyContinue)) {
    Write-Warn "NetSecurity indisponível; não foi possível validar as regras de firewall."
    Add-Failure "módulo NetSecurity indisponível para validar firewall"
}
else {
    foreach ($check in $firewallChecks) {
        $rule = Get-NetFirewallRule -DisplayName $check.Name -ErrorAction SilentlyContinue |
            Select-Object -First 1
        if (-not $rule) {
            Write-Warn "Regra de firewall ausente: $($check.Name)."
            Add-Failure "regra de firewall ausente: $($check.Name)"
            continue
        }

        $portFilter = $rule | Get-NetFirewallPortFilter
        $addressFilter = $rule | Get-NetFirewallAddressFilter
        $remote = @($addressFilter.RemoteAddress)
        $ruleOk = ([string]$rule.Enabled -eq "True") -and
            ([string]$rule.Direction -eq "Inbound") -and
            ([string]$rule.Action -eq $check.Action) -and
            ([string]$portFilter.LocalPort -eq [string]$check.Port) -and
            ($remote -contains "LocalSubnet")

        if ($ruleOk) {
            Write-Ok "Firewall: $($check.Name) $($check.Action) na porta $($check.Port) para LocalSubnet."
        }
        else {
            Write-Warn "Firewall: $($check.Name) não corresponde ao esperado ($($check.Action), porta $($check.Port), LocalSubnet)."
            Add-Failure "regra de firewall divergente: $($check.Name)"
        }
    }
}

$local = Test-Health -Url "http://127.0.0.1:3000/api/health" -ExpectDb
if ($local.Ok) {
    Write-Ok "Health local: HTTP 200, db=true, versão $($local.Versao)."
}
else {
    Write-Warn "Health local: falhou (HTTP $($local.StatusCode), db=$($local.Db))."
    Add-Failure "health local não respondeu 200 com db=true"
}

$public = Test-Health -Url ("https://{0}/login" -f $Hostname)
if ($public.Ok) {
    Write-Ok "https://$Hostname/login: HTTP 200."
}
else {
    Write-Warn "https://$Hostname/login: falhou (HTTP $($public.StatusCode)). Verifique a CA do Caddy, o DNS e o NexusCaddy."
    Add-Failure "HTTPS /login não respondeu 200"
}

if ($ExpectedVersion) {
    $expected = $ExpectedVersion.Trim() -replace '^v', ''
    if ($local.Ok -and $local.Versao -eq $expected) {
        Write-Ok "Versão esperada: $expected."
    }
    else {
        Write-Warn "Versão encontrada '$($local.Versao)'; esperada '$expected'."
        Add-Failure "versão diferente da esperada"
    }
}

# A bandeja é auxiliar: ausência de sessão/processo não falha o smoke.
$trayProcess = Get-Process -Name "NexusTray" -ErrorAction SilentlyContinue
$trayTask = $null
if (Get-Command Get-ScheduledTask -ErrorAction SilentlyContinue) {
    $trayTask = Get-ScheduledTask -TaskName "NexusTray" -ErrorAction SilentlyContinue
}
if ($trayProcess) {
    Write-Ok "Bandeja NexusTray em execução."
}
elseif ($trayTask) {
    Write-Warn "Bandeja NexusTray registrada no logon, mas não está em execução nesta sessão."
}
else {
    Write-Warn "Bandeja NexusTray não registrada (auxiliar; o Nexus não depende dela)."
}

Write-Host ""
if ($failures.Count -eq 0) {
    Write-Host "SMOKE: OK" -ForegroundColor Green
    exit 0
}

Write-Host ("SMOKE: FALHOU ({0} verificação(ões))" -f $failures.Count) -ForegroundColor Red
foreach ($failure in $failures) {
    Write-Host ("  - " + $failure) -ForegroundColor Red
}
exit 1
