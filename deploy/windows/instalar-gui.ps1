#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Executa o bootstrap do Nexus em uma janela visível.

.DESCRIPTION
    O bootstrap pede as senhas do MySQL via Read-Host, por isso precisa de um
    console visível (nunca -WindowStyle Hidden). Este wrapper registra o
    andamento em C:\ProgramData\Nexus\logs\instalador-<timestamp>.log e mostra
    MessageBox de sucesso, de falha ou de pausa para instalar o MySQL 8.4 LTS.

.PARAMETER Hostname
    Nome DNS usado pelo Caddy (ex.: nexus.galpao.local).

.PARAMETER TrayExe
    Caminho do NexusTray.exe extraído pelo instalador.

.PARAMETER RepoUrl
    URL do repositório. Padrão: manifesto.json.

.PARAMETER Tag
    Tag a instalar (o instalador passa a tag do build).
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$Hostname,
    [string]$TrayExe = "",
    [string]$RepoUrl = "",
    [string]$Tag = ""
)

$ErrorActionPreference = "Stop"

$script:WinFormsReady = $false
try {
    Add-Type -AssemblyName System.Windows.Forms -ErrorAction Stop
    $script:WinFormsReady = $true
}
catch {
    # Sem WinForms, o fallback de console em Show-Message é usado.
}

$Hostname = $Hostname.Trim().ToLowerInvariant()
$LogsDir = "C:\ProgramData\Nexus\logs"
$LogPath = Join-Path $LogsDir ("instalador-" + (Get-Date -Format "yyyyMMdd-HHmmss") + ".log")
$Bootstrap = Join-Path $PSScriptRoot "bootstrap.ps1"
$PsExe = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"

function Write-Log {
    param([Parameter(Mandatory = $true)][string]$Message)
    $line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Message
    try {
        Add-Content -LiteralPath $LogPath -Value $line -Encoding UTF8 -ErrorAction Stop
    }
    catch {
        # O log não pode impedir a instalação.
    }
}

function Show-Message {
    param(
        [Parameter(Mandatory = $true)][string]$Text,
        [string]$Title = "Nexus",
        [string]$Icon = "Information",
        [string]$Buttons = "OK"
    )
    if (-not $script:WinFormsReady) {
        Write-Host ""
        Write-Host "$Title`: $Text"
        if ($Buttons -eq "YesNo") {
            $answer = Read-Host "Continuar? (S/N)"
            if ($answer -match '^(s|sim|y|yes)$') { return "Yes" }
            return "No"
        }
        return "OK"
    }
    try {
        $buttonValue = [System.Windows.Forms.MessageBoxButtons]$Buttons
        $iconValue = [System.Windows.Forms.MessageBoxIcon]$Icon
        return [System.Windows.Forms.MessageBox]::Show($Text, $Title, $buttonValue, $iconValue)
    }
    catch {
        Write-Host ""
        Write-Host "$Title`: $Text"
        return "OK"
    }
}

function Invoke-Bootstrap {
    param([switch]$Resume)

    $argumentLine = '-NoProfile -ExecutionPolicy Bypass -File "{0}" -Hostname "{1}"' -f $Bootstrap, $Hostname
    if ($TrayExe) { $argumentLine += ' -TrayExe "{0}"' -f $TrayExe }
    if ($RepoUrl) { $argumentLine += ' -RepoUrl "{0}"' -f $RepoUrl }
    if ($Tag) { $argumentLine += ' -Tag "{0}"' -f $Tag }
    if ($Resume) { $argumentLine += ' -Resume' }

    Write-Log ("Executando bootstrap{0}." -f $(if ($Resume) { " (-Resume)" } else { "" }))
    $process = Start-Process -FilePath $PsExe -ArgumentList $argumentLine `
        -WorkingDirectory $PSScriptRoot -WindowStyle Normal -PassThru -Wait
    Write-Log ("Bootstrap terminou com código {0}." -f $process.ExitCode)
    return [int]$process.ExitCode
}

try {
    if (-not (Test-Path -LiteralPath $LogsDir)) {
        New-Item -ItemType Directory -Force -Path $LogsDir | Out-Null
    }
}
catch {
    # A instalação continua; o bootstrap também grava o próprio log.
}

Write-Log "Instalador do Nexus iniciado."
Write-Log ("Hostname: {0}" -f $Hostname)
if ($Tag) { Write-Log ("Tag: {0}" -f $Tag) }

if (-not (Test-Path -LiteralPath $Bootstrap -PathType Leaf)) {
    $message = "bootstrap.ps1 não encontrado em '$Bootstrap'.`n`nReinstale o Nexus com o instalador oficial."
    Write-Log $message
    Show-Message -Text $message -Title "Nexus - instalação" -Icon Error | Out-Null
    exit 1
}

Write-Host ""
Write-Host "Instalando o Nexus. Acompanhe a janela do bootstrap." -ForegroundColor Cyan
Write-Host "Log: $LogPath" -ForegroundColor DarkGray
Write-Host ""

try {
    $exitCode = Invoke-Bootstrap

    while ($exitCode -eq 2) {
        Write-Log "Bootstrap pausado: o serviço MySQL84 ainda não existe."
        $message = "O MySQL 8.4 LTS (Server only) ainda não está instalado.`n`n" +
            "Instale o MySQL Installer 8.4 LTS escolhendo apenas o MySQL Server 8.4 " +
            "(Server only), volte a esta janela e clique em Sim para continuar.`n`n" +
            "Clique em Não para cancelar a instalação."
        $answer = Show-Message -Text $message -Title "Nexus - MySQL 8.4 necessário" -Icon Warning -Buttons YesNo
        if ([string]$answer -ne "Yes") {
            Write-Log "Usuário cancelou a instalação na pausa do MySQL."
            $message = "Instalação cancelada: o MySQL 8.4 LTS (Server only) é obrigatório.`n`nLog: $LogPath"
            Show-Message -Text $message -Title "Nexus - instalação cancelada" -Icon Error | Out-Null
            exit 1
        }
        $exitCode = Invoke-Bootstrap -Resume
    }

    if ($exitCode -eq 0) {
        Write-Log "Instalação concluída com sucesso."
        $message = "Instalação concluída com sucesso!`n`n" +
            "Acesse: https://$Hostname`n`n" +
            "Abra pelo atalho do Menu Iniciar, da Área de Trabalho ou pela bandeja do Nexus.`n`n" +
            "Log: $LogPath"
        Show-Message -Text $message -Title "Nexus - instalação concluída" -Icon Information | Out-Null
        exit 0
    }

    Write-Log ("Instalação falhou com código {0}." -f $exitCode)
    $message = "Falha na instalação do Nexus (código $exitCode).`n`n" +
        "Consulte o log: $LogPath`n`n" +
        "Os logs detalhados do bootstrap ficam em $LogsDir (bootstrap-*.log)."
    Show-Message -Text $message -Title "Nexus - falha na instalação" -Icon Error | Out-Null
    exit $exitCode
}
catch {
    Write-Log ("Erro inesperado: {0}" -f $_.Exception.Message)
    $message = "Falha inesperada na instalação do Nexus.`n`n" +
        "Erro: $($_.Exception.Message)`n`nLog: $LogPath"
    Show-Message -Text $message -Title "Nexus - falha na instalação" -Icon Error | Out-Null
    exit 1
}
