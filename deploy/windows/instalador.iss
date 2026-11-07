; Instalador do Nexus para Windows (Inno Setup 7).
;
; Compile com build-instalador.ps1. O pacote é AUTOCONTIDO: Node.js portátil,
; MySQL 8.4, Caddy, VC++, NSSM, a aplicação standalone (app.zip) e o SQL de
; produção entram no payload. O destino não usa Git, npm, Prisma nem internet.
;
; Parâmetros de compilação:
;   /DMyAppVersion=<versão>   (ex.: 1.02.11.2026)
;   /DPayloadDir=<pasta>      (padrão: payload)

#ifndef MyAppVersion
  #define MyAppVersion "0.0.0"
#endif
#ifndef PayloadDir
  #define PayloadDir "payload"
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
Source: "aplicar-sql.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "backup.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "bootstrap.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "build-instalador.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "common.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "desinstalar.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "instalar-mysql.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "pos-instalacao-mysql.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "restart.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "smoke.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "Caddyfile"; DestDir: "{app}"; Flags: ignoreversion
Source: "manifesto.json"; DestDir: "{app}"; Flags: ignoreversion
; Payload autocontido: Node portátil, MySQL, Caddy, VC++, NSSM, app.zip e SQL.
; Sem ele o bootstrap falha na fase 0 com mensagem clara.
Source: "{#PayloadDir}\*"; DestDir: "{app}\payload"; Flags: ignoreversion recursesubdirs createallsubdirs
; SQL também fora do payload, no caminho usado por aplicar-sql.ps1 ({app}\sql).
Source: "{#PayloadDir}\sql\*"; DestDir: "{app}\sql"; Flags: ignoreversion recursesubdirs createallsubdirs
; Obrigatório: a bandeja é copiada pelo bootstrap para {commonpf}\Nexus\NexusTray.
Source: "NexusTray\dist\NexusTray.exe"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\Nexus"; Filename: "https://{code:GetHostname}"; Comment: "Abrir o Nexus"
Name: "{group}\Desinstalar Nexus"; Filename: "{uninstallexe}"
Name: "{autodesktop}\Nexus"; Filename: "https://{code:GetHostname}"; Comment: "Abrir o Nexus"; Tasks: desktopicon

[Code]
var
  HostnamePage: TInputQueryWizardPage;
  PasswordPage: TInputQueryWizardPage;
  CredentialsFile: String;
  ProgressFile: String;
  ProgressForm: TSetupForm;
  ProgressBar: TNewProgressBar;
  ProgressTitle: TNewStaticText;
  ProgressDetail: TNewStaticText;
  ProgressHint: TNewStaticText;
  ProgressHint2: TNewStaticText;
  ProgressTimer: UINT_PTR;
  ProgressTicks: Integer;
  ProgressExitCode: Integer;
  ProgressTimedOut: Boolean;
  ProgressNeverStarted: Boolean;
  ProgressAllowClose: Boolean;
  ProgressSeen: Boolean;
  BootstrapSucceeded: Boolean;

function SetTimer(hWnd: HWND; nIDEvent: UINT_PTR; uElapse: UINT; lpTimerFunc: NativeInt): UINT_PTR;
external 'SetTimer@user32.dll stdcall';

function KillTimer(hWnd: HWND; uIDEvent: UINT_PTR): Boolean;
external 'KillTimer@user32.dll stdcall';

function IsUpgradeInstall: Boolean;
begin
  Result := FileExists(ExpandConstant('{commonappdata}\Nexus\config\backup.cnf'));
end;

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

function IsValidAppPassword(const Value: String): Boolean;
var
  I: Integer;
  C: Char;
begin
  Result := False;
  if (Value = '') or (Length(Value) > 256) then
    Exit;
  for I := 1 to Length(Value) do
  begin
    C := Value[I];
    if (C < #32) or (C = #127) then
      Exit;
    if (C = '@') or (C = '/') or (C = '?') or (C = '#') or (C = '"') or
       (C = '\') or (C = ';') or (C = ' ') then
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
    'Versão {#MyAppVersion}.');
  HostnamePage.Add('Hostname:', False);
  HostnamePage.Values[0] := 'nexus.galpao.local';

  PasswordPage := CreateInputQueryPage(
    HostnamePage.ID,
    'Credenciais do MySQL',
    'Informe as senhas do MySQL dedicado do Nexus.',
    'As senhas serão criadas agora no MySQL dedicado.');
  PasswordPage.Add('Senha do root do MySQL:', True);
  PasswordPage.Add('Confirme a senha do root:', True);
  PasswordPage.Add('Senha do nexus_app:', True);
  PasswordPage.Add('Confirme a senha do nexus_app:', True);
end;

function ValidatePasswordPage: Boolean;
var
  Root, RootConfirm, App, AppConfirm: String;
  AllEmpty: Boolean;
begin
  Result := True;
  Root := PasswordPage.Values[0];
  RootConfirm := PasswordPage.Values[1];
  App := PasswordPage.Values[2];
  AppConfirm := PasswordPage.Values[3];
  AllEmpty := (Root = '') and (RootConfirm = '') and (App = '') and (AppConfirm = '');

  { Upgrade: em branco reutiliza as credenciais atuais do backup.cnf. }
  if IsUpgradeInstall and AllEmpty then
    Exit;

  if Root = '' then
  begin
    MsgBox('Informe a senha do root do MySQL.', mbError, MB_OK);
    Result := False;
    Exit;
  end;
  if Root <> RootConfirm then
  begin
    MsgBox('A confirmação da senha do root não confere.', mbError, MB_OK);
    Result := False;
    Exit;
  end;
  if App = '' then
  begin
    MsgBox('Informe a senha do nexus_app.', mbError, MB_OK);
    Result := False;
    Exit;
  end;
  if App <> AppConfirm then
  begin
    MsgBox('A confirmação da senha do nexus_app não confere.', mbError, MB_OK);
    Result := False;
    Exit;
  end;
  if not IsValidAppPassword(App) then
  begin
    MsgBox('Senha de nexus_app inválida. Use no máximo 256 caracteres e não use ' +
           '@, /, ?, #, ", \, ;, espaço, tab nem caracteres de controle.', mbError, MB_OK);
    Result := False;
  end;
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
  if (PasswordPage <> nil) and (CurPageID = PasswordPage.ID) then
  begin
    if not ValidatePasswordPage then
      Result := False;
  end;
end;

function GetHostname(Param: String): String;
begin
  if HostnamePage <> nil then
    Result := Lowercase(Trim(HostnamePage.Values[0]))
  else
    Result := 'nexus.galpao.local';
end;

function PhaseCaption(Step: Integer): String;
begin
  case Step of
    0: Result := 'Fase 0/7 - Pré-checagem (offline)';
    1: Result := 'Fase 1/7 - Runtime embutido (VC++, Node, NSSM, Caddy)';
    2: Result := 'Fase 2/7 - MySQL 8.4 dedicado';
    3: Result := 'Fase 3/7 - Diretórios e ACLs';
    4: Result := 'Fase 4/7 - Banco e aplicação';
    5: Result := 'Fase 5/7 - Serviços NexusApp e NexusCaddy';
    6: Result := 'Fase 6/7 - Bandeja e backup diário';
    7: Result := 'Fase 7/7 - Smoke test e resumo';
    8: Result := 'Concluído';
  else
    Result := 'Instalando o Nexus...';
  end;
end;

procedure ProgressCloseQuery(Sender: TObject; var CanClose: Boolean);
begin
  CanClose := ProgressAllowClose;
end;

procedure CreateProgressForm;
begin
  ProgressForm := CreateCustomForm(ScaleX(420), ScaleY(150), False, False);
  ProgressForm.Caption := 'Instalando o Nexus';
  ProgressForm.BorderIcons := [];
  ProgressForm.BorderStyle := bsDialog;
  ProgressForm.Position := poScreenCenter;
  ProgressAllowClose := False;
  ProgressForm.OnCloseQuery := @ProgressCloseQuery;

  ProgressTitle := TNewStaticText.Create(ProgressForm);
  ProgressTitle.Parent := ProgressForm;
  ProgressTitle.AutoSize := False;
  ProgressTitle.Left := ScaleX(14);
  ProgressTitle.Top := ScaleY(12);
  ProgressTitle.Width := ScaleX(392);
  ProgressTitle.Height := ScaleY(18);
  ProgressTitle.Caption := 'Instalando o Nexus...';

  ProgressDetail := TNewStaticText.Create(ProgressForm);
  ProgressDetail.Parent := ProgressForm;
  ProgressDetail.AutoSize := False;
  ProgressDetail.WordWrap := True;
  ProgressDetail.Left := ScaleX(14);
  ProgressDetail.Top := ScaleY(38);
  ProgressDetail.Width := ScaleX(392);
  ProgressDetail.Height := ScaleY(24);
  ProgressDetail.Caption := PhaseCaption(0);

  ProgressBar := TNewProgressBar.Create(ProgressForm);
  ProgressBar.Parent := ProgressForm;
  ProgressBar.Left := ScaleX(14);
  ProgressBar.Top := ScaleY(64);
  ProgressBar.Width := ScaleX(392);
  ProgressBar.Height := ScaleY(18);
  ProgressBar.Min := 0;
  ProgressBar.Max := 8;
  ProgressBar.Position := 0;

  ProgressHint := TNewStaticText.Create(ProgressForm);
  ProgressHint.Parent := ProgressForm;
  ProgressHint.AutoSize := False;
  ProgressHint.WordWrap := True;
  ProgressHint.Left := ScaleX(14);
  ProgressHint.Top := ScaleY(90);
  ProgressHint.Width := ScaleX(392);
  ProgressHint.Height := ScaleY(30);
  ProgressHint.Caption := 'Não feche esta janela. A instalação pode levar vários minutos.';

  ProgressHint2 := TNewStaticText.Create(ProgressForm);
  ProgressHint2.Parent := ProgressForm;
  ProgressHint2.AutoSize := False;
  ProgressHint2.Left := ScaleX(14);
  ProgressHint2.Top := ScaleY(124);
  ProgressHint2.Width := ScaleX(392);
  ProgressHint2.Height := ScaleY(16);
  ProgressHint2.Caption := 'Logs: C:\ProgramData\Nexus\logs';
end;

function RestrictCredentialsFile(const FileName: String): Boolean;
var
  ResultCode: Integer;
  Params: String;
begin
  Params := Format('"%s" /inheritance:r /grant:r "*S-1-5-32-544:F" "*S-1-5-18:F"', [FileName]);
  Result := Exec(ExpandConstant('{sys}\icacls.exe'), Params, '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Result := Result and (ResultCode = 0);
end;

procedure ProgressTimerProc(Arg1: HWND; Arg2: UINT; Arg3: UINT_PTR; Arg4: DWORD);
var
  Step: Integer;
  Done: Integer;
  ExitCode: Integer;
begin
  if (ProgressForm = nil) or (ProgressBar = nil) or (ProgressDetail = nil) then
    Exit;

  Inc(ProgressTicks);
  if FileExists(ProgressFile) then
  begin
    ProgressSeen := True;
    ProgressNeverStarted := False;
    Step := GetIniInt('progress', 'step', 0, 0, 8, ProgressFile);
    Done := GetIniInt('progress', 'done', 0, 0, 1, ProgressFile);
    ExitCode := GetIniInt('progress', 'exit', 1, 0, 1, ProgressFile);
    ProgressBar.Position := Step;
    ProgressDetail.Caption := PhaseCaption(Step);
    if Done = 1 then
    begin
      ProgressExitCode := ExitCode;
      ProgressAllowClose := True;
      KillTimer(0, ProgressTimer);
      ProgressTimer := 0;
      ProgressForm.Close;
      Exit;
    end;
  end;

  { 120 ticks x 500 ms = 60 s sem nenhum progresso: o bootstrap não iniciou. }
  if (not ProgressSeen) and (ProgressTicks > 120) then
  begin
    ProgressTimedOut := True;
    ProgressNeverStarted := True;
    ProgressAllowClose := True;
    ProgressExitCode := -1;
    KillTimer(0, ProgressTimer);
    ProgressTimer := 0;
    ProgressForm.Close;
    Exit;
  end;

  { Segurança: 14400 ticks x 500 ms = 2 horas. }
  if ProgressTicks > 14400 then
  begin
    ProgressTimedOut := True;
    ProgressAllowClose := True;
    ProgressExitCode := -1;
    KillTimer(0, ProgressTimer);
    ProgressTimer := 0;
    ProgressForm.Close;
  end;
end;

procedure ShowBootstrapProgress;
begin
  ProgressTicks := 0;
  ProgressExitCode := -1;
  ProgressTimedOut := False;
  ProgressNeverStarted := False;
  ProgressSeen := False;
  ProgressAllowClose := False;
  CreateProgressForm;
  ProgressTimer := SetTimer(0, 0, 500, CreateCallback(@ProgressTimerProc));
  try
    ProgressForm.ShowModal;
  finally
    if ProgressTimer <> 0 then
    begin
      KillTimer(0, ProgressTimer);
      ProgressTimer := 0;
    end;
    ProgressAllowClose := True;
    ProgressForm.Release;
    ProgressForm := nil;
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  ResultCode: Integer;
  Cmd: String;
  Message: String;
  RootPassword: String;
  AppPassword: String;
  Lines: TArrayOfString;
begin
  if CurStep = ssPostInstall then
  begin
    BootstrapSucceeded := False;
    CredentialsFile := ExpandConstant('{tmp}\nexus-mysql-credentials.txt');
    ProgressFile := ExpandConstant('{tmp}\nexus-bootstrap-progress.ini');

    if (not FileExists(ExpandConstant('{app}\bootstrap.ps1'))) or
       (not FileExists(ExpandConstant('{app}\common.ps1'))) or
       (not FileExists(ExpandConstant('{app}\manifesto.json'))) then
    begin
      MsgBox('O setup está incompleto: bootstrap.ps1, common.ps1 ou manifesto.json ' +
             'não foi encontrado em ' + ExpandConstant('{app}') + '.' + #13#10 + #13#10 +
             'Reinstale o Nexus com o setup oficial.', mbError, MB_OK);
      Abort;
    end;

    DeleteFile(CredentialsFile);
    DeleteFile(ProgressFile);

    Cmd := Format('-NoProfile -ExecutionPolicy Bypass -File "%s\bootstrap.ps1" -Hostname "%s" -TrayExe "%s\NexusTray.exe" -ProgressFile "%s" -NoPrompt', [ExpandConstant('{app}'), GetHostname(''), ExpandConstant('{app}'), ProgressFile]);

    RootPassword := PasswordPage.Values[0];
    AppPassword := PasswordPage.Values[2];
    if (RootPassword <> '') or (AppPassword <> '') then
    begin
      if (RootPassword = '') or (AppPassword = '') then
      begin
        MsgBox('Informe as senhas do root e do nexus_app para configurar o MySQL.', mbError, MB_OK);
        Abort;
      end;

      SetArrayLength(Lines, 2);
      Lines[0] := 'root=' + RootPassword;
      Lines[1] := 'app=' + AppPassword;
      if not SaveStringsToUTF8FileWithoutBOM(CredentialsFile, Lines, False) then
      begin
        SetArrayLength(Lines, 0);
        MsgBox('Não foi possível gravar o arquivo temporário de credenciais. ' +
               'A instalação foi interrompida.', mbError, MB_OK);
        DeleteFile(CredentialsFile);
        Abort;
      end;
      SetArrayLength(Lines, 0);

      if not RestrictCredentialsFile(CredentialsFile) then
      begin
        MsgBox('Não foi possível restringir o acesso ao arquivo temporário de credenciais. ' +
               'A instalação foi interrompida.', mbError, MB_OK);
        DeleteFile(CredentialsFile);
        Abort;
      end;

      Cmd := Cmd + Format(' -CredentialsFile "%s"', [CredentialsFile]);
    end;

    ResultCode := -1;
    if not Exec(ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe'), Cmd, '',
      SW_HIDE, ewNoWait, ResultCode) then
    begin
      RootPassword := '';
      AppPassword := '';
      MsgBox('Não foi possível iniciar a instalação do Nexus.' + #13#10 + #13#10 +
             'Consulte os logs em C:\ProgramData\Nexus\logs antes de tentar novamente.',
             mbError, MB_OK);
      DeleteFile(CredentialsFile);
      Abort;
    end;

    { As senhas não permanecem na memória do wizard depois de entregues. }
    RootPassword := '';
    AppPassword := '';
    PasswordPage.Values[0] := '';
    PasswordPage.Values[1] := '';
    PasswordPage.Values[2] := '';
    PasswordPage.Values[3] := '';

    ShowBootstrapProgress;

    DeleteFile(CredentialsFile);
    DeleteFile(ProgressFile);

    if ProgressExitCode = 0 then
      BootstrapSucceeded := True
    else
    begin
      if ProgressNeverStarted then
        Message := 'O bootstrap não iniciou: nenhum progresso foi registrado em 60 segundos.'
      else if ProgressTimedOut then
        Message := 'A instalação do Nexus excedeu o tempo limite (código -1).'
      else
        Message := 'A instalação do Nexus não foi concluída (código ' + IntToStr(ProgressExitCode) + ').';
      Message := Message + #13#10 + #13#10 +
        'Consulte os logs em C:\ProgramData\Nexus\logs antes de tentar novamente.';
      MsgBox(Message, mbError, MB_OK);
    end;
  end;
end;

procedure CurPageChanged(CurPageID: Integer);
begin
  if (PasswordPage <> nil) and (CurPageID = PasswordPage.ID) then
  begin
    if IsUpgradeInstall then
      PasswordPage.SubCaptionLabel.Caption :=
        'Já existe uma instalação do Nexus. Deixe as senhas em branco para ' +
        'reutilizar as credenciais atuais.'
    else
      PasswordPage.SubCaptionLabel.Caption := 'As senhas serão criadas agora no MySQL dedicado.';
  end;

  if CurPageID = wpFinished then
  begin
    if BootstrapSucceeded then
      WizardForm.FinishedLabel.Caption :=
        'O Nexus foi instalado e validado.' + #13#10 + #13#10 +
        'Acesse: https://' + GetHostname('') + #13#10 + #13#10 +
        'Abra pelo atalho do Menu Iniciar, da Área de Trabalho ou pela bandeja do Nexus.'
    else
      WizardForm.FinishedLabel.Caption :=
        'A instalação do Nexus não foi concluída. Consulte os logs em ' +
        'C:\ProgramData\Nexus\logs e execute o setup novamente.';
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
