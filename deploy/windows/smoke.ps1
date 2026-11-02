#Requires -Version 5.1
<#
.SYNOPSIS
    Smoke test da instalação do Nexus.

.DESCRIPTION
    Verifica os serviços MySQL84/NexusApp/NexusCaddy, o health local com
    db=true, a página https://<hostname>/login e, opcionalmente, a versão.
    Não ignora validação de certificado: o HTTPS exige a CA do Caddy confiada
    (caddy trust).

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

Write-Step "Smoke test do Nexus"

foreach ($serviceName in @("MySQL84", "NexusApp", "NexusCaddy")) {
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
    Write-Warn "https://$Hostname/login: falhou (HTTP $($public.StatusCode)). Verifique 'caddy trust', o DNS e o NexusCaddy."
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
