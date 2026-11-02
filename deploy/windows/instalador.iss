; Instalador do Nexus para Windows (Inno Setup 7).
;
; Compile com build-instalador.ps1. O pacote NÃO embute o código da aplicação:
; o bootstrap clona a tag do GitHub durante a instalação (requer internet).
;
; Parâmetros de compilação:
;   /DMyAppVersion=<versão>   (ex.: 1.02.11.2026)
;   /DMyAppTag=<tag>          (ex.: v1.02.11.2026)

#ifndef MyAppVersion
  #define MyAppVersion "0.0.0"
#endif
#ifndef MyAppTag
  #define MyAppTag "v0.0.0"
#endif

[Setup]
AppId={{9858FE5B-AE6F-4534-B544-09673035ADA7}
AppName=Nexus
AppVersion={#MyAppVersion}
AppVerName=Nexus {#MyAppVersion}
AppPublisher=Projeto Nexus - FAETEC
DefaultDirName={autopf}\Nexus\Instalador
DefaultGroupName=Nexus
DisableDirPage=yes
PrivilegesRequired=admin
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
WizardStyle=modern
Compression=lzma2/ultra64
SolidCompression=yes
OutputDir=out
OutputBaseFilename=NexusSetup-{#MyAppVersion}
SetupLogging=yes
UninstallDisplayName=Nexus

[Languages]
Name: "brazilianportuguese"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"

[Files]
Source: "atualizar.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "backup.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "bootstrap.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "build-instalador.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "common.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "desinstalar.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "instalar-gui.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "pos-instalacao-mysql.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "restart.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "smoke.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "Caddyfile"; DestDir: "{app}"; Flags: ignoreversion
Source: "manifesto.json"; DestDir: "{app}"; Flags: ignoreversion
; Obrigatório: a bandeja é copiada pelo bootstrap para {commonpf}\Nexus\NexusTray.
Source: "NexusTray\dist\NexusTray.exe"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\Nexus"; Filename: "https://{code:GetHostname}"; Comment: "Abrir o Nexus"
Name: "{group}\Desinstalar Nexus"; Filename: "{uninstallexe}"
Name: "{autodesktop}\Nexus"; Filename: "https://{code:GetHostname}"; Comment: "Abrir o Nexus"; Tasks: desktopicon

[Code]
var
  HostnamePage: TInputQueryWizardPage;

function InitializeSetup(): Boolean;
begin
  Result := True;
  if not IsWin64 then
  begin
    MsgBox('O Nexus requer Windows de 64 bits (x64).', mbError, MB_OK);
    Result := False;
  end;
end;

function IsValidHostname(const Value: String): Boolean;
var
  I: Integer;
  C: Char;
begin
  Result := False;
  if (Value = '') or (Length(Value) > 253) then
    Exit;
  if (Value[1] = '.') or (Value[1] = '-') then
    Exit;
  if (Value[Length(Value)] = '.') or (Value[Length(Value)] = '-') then
    Exit;
  if (Pos('..', Value) > 0) or (Pos('.-', Value) > 0) or (Pos('-.', Value) > 0) then
    Exit;
  for I := 1 to Length(Value) do
  begin
    C := Value[I];
    if not (((C >= 'a') and (C <= 'z')) or
            ((C >= 'A') and (C <= 'Z')) or
            ((C >= '0') and (C <= '9')) or
            (C = '-') or (C = '.')) then
      Exit;
  end;
  Result := True;
end;

procedure InitializeWizard;
begin
  HostnamePage := CreateInputQueryPage(
    wpSelectProgramGroup,
    'Endereço do Nexus',
    'Informe o nome pelo qual o sistema será acessado na rede.',
    'Use um nome DNS válido, sem http://, porta ou caminho (ex.: nexus.galpao.local). ' +
    'Versão {#MyAppVersion} (tag {#MyAppTag}).');
  HostnamePage.Add('Hostname:', False);
  HostnamePage.Values[0] := 'nexus.galpao.local';
end;

function NextButtonClick(CurPageID: Integer): Boolean;
var
  Value: String;
begin
  Result := True;
  if (HostnamePage <> nil) and (CurPageID = HostnamePage.ID) then
  begin
    Value := Trim(HostnamePage.Values[0]);
    if Value = '' then
    begin
      MsgBox('Informe o hostname pelo qual o Nexus será acessado.', mbError, MB_OK);
      Result := False;
      Exit;
    end;
    if not IsValidHostname(Value) then
    begin
      MsgBox('Hostname inválido: use apenas letras, números, ponto e hífen, ' +
             'sem espaços, http://, porta ou caminho.', mbError, MB_OK);
      Result := False;
      Exit;
    end;
    HostnamePage.Values[0] := Lowercase(Value);
  end;
end;

function GetHostname(Param: String): String;
begin
  if HostnamePage <> nil then
    Result := Lowercase(Trim(HostnamePage.Values[0]))
  else
    Result := 'nexus.galpao.local';
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  ResultCode: Integer;
  Cmd: String;
  Message: String;
begin
  if CurStep = ssPostInstall then
  begin
    Cmd := Format('-NoProfile -ExecutionPolicy Bypass -File "%s\instalar-gui.ps1" -Hostname "%s" -TrayExe "%s\NexusTray.exe" -Tag "%s"', [ExpandConstant('{app}'), GetHostname(''), ExpandConstant('{app}'), '{#MyAppTag}']);
    ResultCode := -1;
    if (not Exec(ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe'), Cmd, '', SW_SHOWNORMAL, ewWaitUntilTerminated, ResultCode)) or (ResultCode <> 0) then
    begin
      Message := 'A instalação do Nexus não foi concluída (código ' + IntToStr(ResultCode) + ').';
      Message := Message + #13#10 + #13#10 + 'Consulte os logs em C:\ProgramData\Nexus\logs antes de tentar novamente.';
      MsgBox(Message, mbError, MB_OK);
    end;
  end;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  ResultCode: Integer;
  Cmd: String;
  Message: String;
begin
  if CurUninstallStep = usUninstall then
  begin
    Cmd := Format('-NoProfile -ExecutionPolicy Bypass -File "%s\desinstalar.ps1"', [ExpandConstant('{app}')]);
    ResultCode := -1;
    if (not Exec(ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe'), Cmd, '', SW_HIDE, ewWaitUntilTerminated, ResultCode)) or (ResultCode <> 0) then
    begin
      Message := 'A desinstalação do Nexus não foi concluída (código ' + IntToStr(ResultCode) + ').';
      Message := Message + #13#10 + #13#10 + 'Consulte os logs em C:\ProgramData\Nexus\logs antes de tentar novamente.';
      MsgBox(Message, mbError, MB_OK);
    end;
  end;
end;
