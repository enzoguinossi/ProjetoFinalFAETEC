# Produção — instalador autocontido 1.07 (Windows)

Runbook da instalação do **Nexus** em um servidor Windows usando o pacote
**`NexusSetup-1.07.11.2026.exe`**. O instalador é **autocontido**: Node.js portátil, MySQL
8.4.13, Caddy, VC++, NSSM, a aplicação Next **standalone** e o SQL de produção entram no
payload. **Nada é baixado na máquina de destino** e não há Git, npm, `next build`, `db push`
nem Prisma CLI no servidor.

Este documento descreve **o que os scripts de [`deploy/windows/`](../../deploy/windows/)
fazem hoje**; se um script mudar, ele precisa ser revisto.

> **Escopo.** Servidor Windows 64 bits. O desenvolvimento local continua em
> [`README.md`](../../README.md) e as convenções do projeto em [`AGENTS.md`](../../AGENTS.md).
> Regras de negócio não são repetidas aqui: consulte
> [`docs/dominio/REGRAS_NEGOCIO.md`](../dominio/REGRAS_NEGOCIO.md).

---

## 1. Visão geral

```text
estações da rede
      │  HTTPS 443 (CA interna do Caddy)
      ▼
┌─────────────────────┐        ┌──────────────────────────┐        ┌──────────────────────┐
│ NexusCaddy (Caddy)  │ ─────► │ NexusApp                 │ ─────► │ NexusMySQL84         │
│ 0.0.0.0:80/443      │  HTTP  │ node.exe server.js       │  3214  │ 127.0.0.1:3214       │
│ LocalService        │        │ 127.0.0.1:3000           │        │ NetworkService       │
└─────────────────────┘        └──────────────────────────┘        └──────────────────────┘
        ▲                                ▲
        │ certutil -addstore -f Root     │ .env + UPLOADS_DIR
        │ (CA local)                     ▼
        │                        C:\ProgramData\Nexus\uploads
        │
   C:\ProgramData\Nexus\{logs,backups,caddy,mysql}
```

| Peça | Papel |
| --- | --- |
| `NexusSetup-1.07.11.2026.exe` | instalador **Inno Setup 7** autocontido (~393,8 MB); embute o payload e executa o bootstrap |
| [`bootstrap.ps1`](../../deploy/windows/bootstrap.ps1) | instalação em **8 fases (0–7)**, idempotente e retomável; estado em `C:\ProgramData\Nexus\bootstrap.state.json` |
| [`instalar-gui.ps1`](../../deploy/windows/instalar-gui.ps1) | wrapper do instalador; executa o bootstrap em janela visível e mostra sucesso/falha |
| [`instalar-mysql.ps1`](../../deploy/windows/instalar-mysql.ps1) | instala o MySQL 8.4.13 embutido, migra o `Data` legado e cria o serviço `NexusMySQL84` na 3214 |
| [`pos-instalacao-mysql.ps1`](../../deploy/windows/pos-instalacao-mysql.ps1) | ajusta o `my.ini`, cria `nexus_prod` e o usuário `nexus_app` |
| [`aplicar-sql.ps1`](../../deploy/windows/aplicar-sql.ps1) | aplica `schema.sql`/`seed.sql` (Fresh) ou migração 001 + seed (Update), sem Prisma |
| [`atualizar.ps1`](../../deploy/windows/atualizar.ps1) | atualização por **pacote** (`app\app.zip` + `sql\`), com backup e rollback |
| [`backup.ps1`](../../deploy/windows/backup.ps1) | backup do banco, uploads, `.env` e `Caddyfile` |
| [`restart.ps1`](../../deploy/windows/restart.ps1) | reinício controlado do `NexusApp`; usado pela bandeja |
| [`smoke.ps1`](../../deploy/windows/smoke.ps1) | smoke test de runtime, serviços, porta, ACLs, firewall, health e HTTPS |
| [`desinstalar.ps1`](../../deploy/windows/desinstalar.ps1) | remove serviços, runtimes, tarefas, regras e app; preserva `C:\ProgramData\Nexus` |
| `NexusTray` | bandeja .NET 8 self-contained; status, reinício, backup e pastas |
| [`common.ps1`](../../deploy/windows/common.ps1) | caminhos e funções compartilhadas |

### 1.1 Versões e componentes

| Componente | Versão/origem | Onde está definido |
| --- | --- | --- |
| App Next | **standalone**, `server.js` + `.next/static` + `public` + client Prisma; versão `1.07.11.2026` | `next.config.ts`, `package.json`, `app.zip` |
| Node.js | **24.19.0** portátil, ZIP `node-v24.19.0-win-x64.zip` | `manifesto.json` / payload |
| MySQL | **8.4.13 LTS**, ZIP `mysql-8.4.13-winx64.zip` (MD5) | `manifesto.json` / payload |
| Serviço MySQL | **`NexusMySQL84`**, porta **3214**, bind `127.0.0.1` | `instalar-mysql.ps1` |
| Caddy | **2.11.9**, ZIP `caddy_2.11.9_windows_amd64.zip` (SHA-512) | `manifesto.json` / payload |
| NSSM | **2.24**, `nssm.exe` (SHA-256) | `manifesto.json` / payload |
| VC++ Redistributable | **14.x**, `vc_redist.x64.exe` | `manifesto.json` / payload |
| Bandeja | **.NET 8**, `win-x64`, self-contained, single-file | `NexusTray/NexusTray.csproj` |
| Instalador | **Inno Setup 7**; `ISCC.exe` local ou NuGet **7.1.0** no build | `build-instalador.ps1` |
| Setup | **393,8 MB** (`NexusSetup-1.07.11.2026.exe`); payload ~400 MB | `deploy/windows/out/` |

> O destino **não usa** Git, npm, `next build`, `db push` ou Prisma CLI. O cliente Prisma já
> vem no `app.zip`; o schema é aplicado por SQL com `mysql.exe`.

---

## 2. Caminhos reais

### 2.1 `C:\Program Files\Nexus`

| Caminho | Conteúdo |
| --- | --- |
| `app\` | aplicação standalone extraída de `app.zip`: `server.js`, `.next`, `node_modules`, `public`, `package.json` e `.env` |
| `node\` | Node.js 24.19.0 portátil (`node.exe`) |
| `mysql\` | binários do MySQL 8.4.13 (`bin\mysqld.exe`, `bin\mysql.exe`, `bin\mysqldump.exe`) |
| `caddy\` | `caddy.exe` (2.11.9) |
| `tools\nssm\` | `nssm.exe` (2.24) |
| `scripts\` | `backup.ps1`, `common.ps1` e `restart.ps1` copiados pelo bootstrap |
| `NexusTray\` | `NexusTray.exe` e `tray.json` |
| `Instalador\` | scripts do instalador e `payload\` (Node, MySQL, Caddy, VC++, NSSM, `app\app.zip`, `sql`) |
| `Instalador\sql\` | cópia de `schema.sql`, `seed.sql` e `migracoes\001-unidades-pct10-cx50.sql` |
| `app.prev-<versão>\` | versão anterior mantida pelo `atualizar.ps1` (até duas) |
| `app.prev-manual-<timestamp>\` | aplicação anterior movida pelo bootstrap/instalação |
| `app.failed-<versão>\` | versão que falhou na atualização, para diagnóstico |

### 2.2 `C:\ProgramData\Nexus`

| Caminho | Conteúdo |
| --- | --- |
| `bootstrap.state.json` | fase concluída, hostname, versão do app e estado |
| `mysql\data\` | diretório de dados do `NexusMySQL84` |
| `mysql\my.ini` | configuração do `NexusMySQL84` (porta 3214, bind local, utf8mb4, fuso `-03:00`) |
| `uploads\` | raiz física dos uploads (`UPLOADS_DIR`) |
| `logs\` | `app.out/err.log`, `bootstrap-*.log`, `instalador-*.log`, `deploy-*.log`, `backup-*.log`, `restart-*.log`, `desinstalar-*.log` |
| `backups\db\` | dumps `nexus_prod-<timestamp>.zip` ou `.sql` (acima de ~1,8 GB) |
| `backups\uploads\` | cópia dos uploads |
| `backups\config\` | `.env-<timestamp>`, `Caddyfile-<timestamp>`, `my.ini-*.bak` |
| `config\Caddyfile` | Caddyfile gerado com o hostname; leitura para `LocalService` |
| `config\backup.cnf` | credenciais do `nexus_app` para o `mysqldump`; **sem leitura pelo app** |
| `caddy\{data,config,logs}\` | dados, configuração e logs do Caddy; a CA local fica em `caddy\data\caddy\pki\authorities\local\` |

### 2.3 Legado (somente migração)

| Caminho | Uso |
| --- | --- |
| `C:\ProgramData\MySQL\MySQL Server 8.4\Data` | dados do MySQL da instalação anterior (10.02); o `instalar-mysql.ps1` copia para `C:\ProgramData\Nexus\mysql\data` e **preserva o original** |
| `C:\Program Files\MySQL\MySQL Server 8.4` | se existir, é uma instalação MySQL independente (por exemplo, 3306); o Nexus **não a instala, para nem altera** |

> `C:\ProgramData\MySQL\MySQL Server 8.4` **não é caminho ativo** do Nexus 1.07: serve apenas
> de origem para a migração do `Data`. O caminho ativo é `C:\ProgramData\Nexus\mysql\data`.

---

## 3. Serviços, tarefas, portas e firewall

### 3.1 Serviços

| Nome | Criado por | Conta | Início | Depende de | Logs |
| --- | --- | --- | --- | --- | --- |
| `NexusMySQL84` | `instalar-mysql.ps1` | `NT AUTHORITY\NetworkService` | automático | — | `C:\ProgramData\Nexus\mysql\data\*.err` |
| `NexusApp` | `bootstrap.ps1` (NSSM) | `NT AUTHORITY\NetworkService` | automático | `NexusMySQL84` | `C:\ProgramData\Nexus\logs\app.out.log` e `app.err.log` |
| `NexusCaddy` | `bootstrap.ps1` (NSSM) | `NT AUTHORITY\LocalService` | automático | `NexusApp` | `C:\ProgramData\Nexus\caddy\logs\caddy.out.log`/`caddy.err.log` + `access.log` |

O NSSM configura `AppExit Default Restart` (reinício após 5 s), rotação de log em 10 MiB e
parada com 15 s para o console. Se o `NexusMySQL84` não subir, o `NexusApp` não sobe; sem o
app, o `NexusCaddy` também não sobe.

### 3.2 Tarefas agendadas

| Nome | Gatilho | Conta | Comando |
| --- | --- | --- | --- |
| `NexusBackup` | diário às **02:00** (executa no próximo boot se a máquina estiver desligada) | `SYSTEM` | `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Program Files\Nexus\scripts\backup.ps1" -RetentionDays 30` |
| `NexusTray` | **logon do usuário que executou a instalação** | esse usuário, `RunLevel Highest` | `C:\Program Files\Nexus\NexusTray\NexusTray.exe` |

A bandeja roda elevada (`requireAdministrator`) para executar o `restart.ps1` (que usa NSSM)
sem pedir UAC. Ela não é registrada para "todos os usuários" — ver §9 e §15.

### 3.3 Portas

| Porta | Serviço | Escuta | Observação |
| --- | --- | --- | --- |
| `3214` | `NexusMySQL84` | `127.0.0.1` | `bind-address=127.0.0.1`; `mysqlx=0` |
| `3000` | `NexusApp` | `127.0.0.1` | `node.exe server.js` com `HOSTNAME=127.0.0.1` |
| `80`/`443` | `NexusCaddy` | todas as interfaces | HTTPS com CA interna; a 80 atende o redirecionamento do Caddy |

O bootstrap verifica **3214**, 3000, 80 e 443. A porta **3306** não é usada pelo Nexus e pode
estar ocupada por outro MySQL.

### 3.4 Firewall

O bootstrap recria quatro regras de entrada (`Set-NexusFirewallRules`); o `smoke.ps1` valida
nome, direção, ação, porta e `LocalSubnet`; o `desinstalar.ps1` as remove.

| Regra | Porta | Ação | Escopo |
| --- | --- | --- | --- |
| `Nexus HTTP` | `80` | **Allow** | `LocalSubnet` |
| `Nexus HTTPS` | `443` | **Allow** | `LocalSubnet` |
| `Nexus MySQL (LAN)` | `3214` | **Block** | `LocalSubnet` |
| `Nexus Next (LAN)` | `3000` | **Block** | `LocalSubnet` |

As regras são de **entrada**, perfil `Any`. O acesso ao sistema é somente por 80/443; a 3214
e a 3000 ficam bloqueadas para a sub-rede. Se as estações estiverem fora do `LocalSubnet`,
as regras precisam ser revistas.

---

## 4. Pré-requisitos

- Windows **64 bits** (10/11 ou Server compatível), com Windows PowerShell 5.1.
- **PowerShell elevado** para instalar, atualizar, desinstalar e restaurar.
- Pelo menos **5 GB livres em `C:`** (o payload ocupa ~400 MB e o MySQL cresce depois).
- Portas **3214**, 3000, 80 e 443 livres (ou já usadas pelos próprios serviços do Nexus).
  A 3306 é independente e pode estar ocupada.
- **Hostname DNS** válido, sem `http://`, porta ou caminho. O bootstrap cria uma entrada
  `127.0.0.1 <hostname>` no `hosts` do servidor quando o nome não resolve; as estações
  precisam de DNS/hosts próprio.
- **Sem internet no destino**: o setup carrega Node, MySQL, Caddy, VC++, NSSM, app e SQL.
- Senhas do **root do MySQL dedicado** (não vazia, sem quebra de linha) e do **`nexus_app`**
  (até 256 caracteres; sem `@`, `/`, `?`, `#`, `"`, `\`, `;`, espaço/tab ou caracteres de
  controle; não há mínimo nem exigência de composição).
- Um MySQL existente na **3306** não precisa ser removido nem parado; o Nexus usa a 3214.

> **Payload:** a instalação depende de `C:\Program Files\Nexus\Instalador\payload` (ou
> `payload\` ao lado do `bootstrap.ps1`). Sem ele, a fase 0 falha com mensagem clara.

---

## 5. Instalação pelo instalador (`NexusSetup-1.07.11.2026.exe`)

### 5.1 O que o wizard pergunta

1. Verifica se o Windows é **64 bits**; se não for, aborta.
2. Pede o **hostname** (nome DNS), com valor inicial `nexus.galpao.local`. Aceita apenas
   letras, números, ponto e hífen; converte para minúsculas.
3. Permite marcar o ícone na **Área de Trabalho** (opcional). O diretório é fixo:
   `C:\Program Files\Nexus\Instalador`.
4. Ao concluir os arquivos, `CurStepChanged(ssPostInstall)` executa o `instalar-gui.ps1` em
   janela visível com `Exec`/`ewWaitUntilTerminated`; o código de saída é verificado e uma
   falha mostra `MsgBox` com o código e o caminho dos logs.

O `.iss` **não usa `[Run]`** e **não tem `[UninstallDelete]`**: instalação e desinstalação
ficam no `[Code]`, para checar o `ResultCode`. O `instalar-gui.ps1` grava
`C:\ProgramData\Nexus\logs\instalador-<timestamp>.log`; o bootstrap grava
`bootstrap-<timestamp>.log`.

O setup não baixa nada. O payload é copiado para `Instalador\payload` e o SQL também para
`Instalador\sql`.

### 5.2 Fases do bootstrap

| Fase | O que faz |
| --- | --- |
| **0 — Pré-checagem offline** | confere Administrador, payload obrigatório, 64 bits, 5 GB livres, portas 3214/3000/80/443; cria entrada no `hosts` se o hostname não resolver; **não acessa a internet** |
| **1 — Runtime embutido** | instala VC++ (se ausente), extrai Node 24.19.0 para `C:\Program Files\Nexus\node`, copia NSSM 2.24 e Caddy 2.11.9 do payload |
| **2 — MySQL dedicado** | pede as senhas quando necessário e chama `instalar-mysql.ps1`: extrai MySQL 8.4.13, migra o `Data` legado, grava `C:\ProgramData\Nexus\mysql\my.ini`, cria/reconfigura `NexusMySQL84` na 3214; depois o `pos-instalacao-mysql.ps1` cria `nexus_prod`/`nexus_app` e o bootstrap grava o `backup.cnf` |
| **3 — Diretórios e ACLs** | cria `ProgramData\Nexus\{mysql,uploads,logs,backups,config,caddy}`, aplica ACLs restritas, gera o `Caddyfile` e cria as quatro regras de firewall |
| **4 — Banco e aplicação** | para o Caddy e o App; extrai `app.zip` em `C:\Program Files\Nexus\app` (preserva `.env`), grava/atualiza o `.env`, aplica o SQL de produção (`aplicar-sql.ps1`, modo Auto) e ajusta o cache |
| **5 — Serviços** | configura `NexusApp` (`node.exe server.js`, env, dependência do MySQL) e `NexusCaddy`; valida health local, inicia o Caddy, instala a CA com `certutil` e valida HTTPS |
| **6 — Bandeja e backup** | copia scripts, registra `NexusBackup` (02:00), copia o tray, grava `tray.json` e registra/inicia `NexusTray` no logon do usuário |
| **7 — Smoke e resumo** | roda o `smoke.ps1` com a versão do `package.json` do app e imprime URL, caminhos, versão e o comando de atualização |

O estado fica em `C:\ProgramData\Nexus\bootstrap.state.json`. A instalação é idempotente e
retomável com `-Resume`; se o hostname mudar, o bootstrap recusa continuar sem `-Force`.

### 5.3 MySQL 8.4.13 dedicado e migração do legado

O `instalar-mysql.ps1`:

1. Extrai o ZIP **embutido** (`payload\mysql\mysql-8.4.13-winx64.zip`) para
   `C:\Program Files\Nexus\mysql`, validando o **MD5** do manifesto.
2. Se `C:\ProgramData\MySQL\MySQL Server 8.4\Data` existir e o novo
   `C:\ProgramData\Nexus\mysql\data` estiver vazio, copia o `Data` legado com `robocopy /E`
   e **preserva o original**.
3. Grava `C:\ProgramData\Nexus\mysql\my.ini` com `port=3214`, `bind-address=127.0.0.1`,
   `mysqlx=0`, `basedir`, `datadir`, utf8mb4 e `default-time-zone='-03:00'`.
4. Inicializa o `Data` novo com `--initialize-insecure` quando vazio; se o `Data` foi migrado,
   mantém a senha existente.
5. Cria o serviço `NexusMySQL84` pelo SCM (`New-Service`, pois MySQL 8.4 removeu
   `mysqld --install`), configura `NT AUTHORITY\NetworkService`, inicia e espera a 3214.
6. Define a senha do root pelo `mysql.exe` com arquivo temporário protegido; nunca por `-p`.

Quando o banco precisa ser criado/reconfigurado, o `pos-instalacao-mysql.ps1` ajusta o
`my.ini` (com backup em `C:\ProgramData\Nexus\backups\config\my.ini-<timestamp>.bak`),
reinicia o `NexusMySQL84`, cria o banco `nexus_prod` e o usuário `nexus_app@localhost` com
`GRANT ALL PRIVILEGES ON nexus_prod.*`, valida a conexão na 3214; em seguida o bootstrap
grava o `backup.cnf`.

**Senhas:** o bootstrap pede root/app no console com `Read-Host -AsSecureString` quando o
serviço/banco precisa ser criado. Em um upgrade 10.02→1.07 com `Data` legado e `backup.cnf`
válido, as credenciais existentes podem ser reutilizadas; se o `backup.cnf` não conectar, as
senhas são pedidas. Não há pausa para instalar o MySQL.

> **Atenção:** `C:\ProgramData\MySQL\MySQL Server 8.4` é o caminho do MySQL antigo (10.02) e
> pode coincidir com uma instalação MySQL 8.4 comum. Não rode o Nexus nessa máquina sem
> backup/isolamento da instância existente. Ver §15.

### 5.4 SQL de produção, seed e migração

Em uma instalação nova, o banco é criado vazio pelo `pos-instalacao-mysql.ps1`; em um upgrade
o banco existente é reutilizado. O `bootstrap` chama o
[`aplicar-sql.ps1`](../../deploy/windows/aplicar-sql.ps1) com `-Mode Auto`:

- **Fresh** (banco sem tabelas): aplica `schema.sql` (DDL completo, 48 tabelas) e
  `seed.sql`;
- **Update** (banco com tabelas, como no 10.02): aplica
  `migracoes\001-unidades-pct10-cx50.sql` e depois `seed.sql`.

O SQL usa `mysql.exe` com `--defaults-extra-file` (senha nunca em `-p`). Ao final valida:

- **81 permissões**;
- **2 perfis** (`Operador` e `Auxiliar`);
- **3 conversões** `UNIDADE` (fator 1, padrão), `PCT10` (10) e `CX50` (50).

A migração 001 renomeia `PACOTE`→`PCT10` e `CAIXA`→`CX50`, preservando `ID_conversao` e os
vínculos de produto; é idempotente e roda antes do seed. O seed é idempotente e não cria
usuários, produtos, pedidos nem dados operacionais.

`Fresh` recusa sobrescrever banco com tabelas; `Update` não recria tabelas. Mudanças de schema
em releases futuras exigem uma **nova migração** — ver §15.

### 5.5 Aplicação standalone e serviço `NexusApp`

O `app.zip` contém `server.js` na raiz, `.next/static`, `public` sem `uploads`, `node_modules`
e o client Prisma. O bootstrap para o `NexusCaddy`, move a aplicação anterior para
`app.prev-manual-<timestamp>`, extrai o novo `app.zip` e preserva o `.env` anterior quando
existe.

O `.env` fica em `C:\Program Files\Nexus\app\.env` com ACL restrita e contém:

```text
DATABASE_URL="mysql://nexus_app:<senha>@127.0.0.1:3214/nexus_prod"
UPLOADS_DIR=C:\ProgramData\Nexus\uploads
NODE_ENV=production
PORT=3000
HOSTNAME=127.0.0.1
JWT_SECRET="<segredo>"
```

O serviço `NexusApp` executa **`C:\Program Files\Nexus\node\node.exe server.js`**, com
`AppDirectory` `C:\Program Files\Nexus\app`, as mesmas variáveis no ambiente do NSSM e
`NEXT_TELEMETRY_DISABLED=1`. **Não usa `next start`** e não precisa de Node global/PATH.

### 5.6 Primeira execução e Super Admin

O seed não cria usuários. Acesse `https://<hostname>`:

1. Sem administrador, o `/login` redireciona para `/primeiro-acesso`.
2. Preencha nome, login e senha (mínimo 4 caracteres). A ação cria o `super_admin` e autentica.
3. Depois, `/primeiro-acesso` redireciona para `/login`.

O Super Admin tem todas as permissões e ignora as verificações normais (ver `AGENTS.md` §12).

### 5.7 Validação da instalação

O bootstrap executa o smoke com a versão do `package.json` do app:

```powershell
& "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" `
  -NoProfile -ExecutionPolicy Bypass `
  -File "C:\Program Files\Nexus\Instalador\smoke.ps1" `
  -Hostname nexus.galpao.local -ExpectedVersion 1.07.11.2026
```

O smoke confere:

- Node portátil `v24.19.0` e `mysqld.exe` embutido;
- serviços `NexusMySQL84`, `NexusApp` e `NexusCaddy`;
- porta **3214**;
- ACLs de `backups`, `config` e `app\.env` sem `BUILTIN\Users`;
- as quatro regras de firewall;
- `GET http://127.0.0.1:3000/api/health` com `db=true`;
- `https://<hostname>/login` com certificado válido (CA do Caddy);
- versão do health igual à esperada.

Saída esperada: `SMOKE: OK` (código 0). Falha retorna 1 e lista as verificações. Rode o smoke
em **PowerShell elevado** para ler as ACLs restritas.

---

## 6. Instalação manual (sem o `.exe`)

O `.exe` é um empacotador; a instalação manual usa o `bootstrap.ps1` e o **payload** ao lado
dele (`Instalador\payload` ou `deploy\windows\payload`). Rode em PowerShell elevado:

```powershell
cd "C:\Program Files\Nexus\Instalador"   # ou o checkout: cd deploy\windows
powershell -NoProfile -ExecutionPolicy Bypass -File .\bootstrap.ps1 `
  -Hostname nexus.galpao.local
```

Parâmetros:

| Parâmetro | Efeito |
| --- | --- |
| `-Hostname` | obrigatório; nome DNS do Caddy |
| `-Resume` | retoma da última fase concluída |
| `-SkipTray` | não copia/registra a bandeja |
| `-TrayExe` | caminho explícito do `NexusTray.exe`; se informado e ausente, falha |
| `-RootPassword` / `-AppPassword` | `SecureString` opcional; se ausentes, o console pede |
| `-Force` | ignora o estado e reinstala sobre o diretório existente |

O bootstrap **não aceita `-Tag`, `-RepoUrl`, Git ou download**: a versão vem do `app.zip` do
payload. Sem payload, a fase 0 falha. Logs em
`C:\ProgramData\Nexus\logs\bootstrap-<timestamp>.log`.

---

## 7. Atualização

### 7.1 Upgrade 10.02 → 1.07 (troca de runtime)

A mudança de 10.02 para 1.07 instala Node portátil, troca o MySQL para o `Data` em
`C:\ProgramData\Nexus\mysql`, aplica o SQL e cria os serviços. Use o
**`NexusSetup-1.07.11.2026.exe`** (ou o `bootstrap.ps1` com o payload):

1. Faça backup do banco/uploads e copie para fora do servidor.
2. Rode o setup em PowerShell elevado, com a janela visível.
3. Confirme o hostname; o bootstrap instala/migra o MySQL, aplica migração 001 + seed e
   reconfigura os serviços.
4. Valide com `smoke.ps1` e o primeiro acesso.

O upgrade real 10.02→1.07 foi validado na máquina de teste: health 1.07, HTTPS 200, os três
serviços `Running`, bandeja presente e contagens **81 permissões / 2 perfis / 3 conversões**.

### 7.2 Atualização de aplicação/SQL por pacote

Para uma instalação já em 1.07, use o `atualizar.ps1` com um pacote (sem Git):

```text
<pacote>\
├── app\app.zip        (ou app.zip na raiz)
└── sql\
    ├── schema.sql
    ├── seed.sql
    └── migracoes\001-unidades-pct10-cx50.sql
```

```powershell
# PowerShell elevado, em C:\Program Files\Nexus\Instalador
.\atualizar.ps1 -Package D:\nexus-update-1.08
```

Parâmetros: `-Package` (pasta), `-AppZip` (alternativo), `-Sql` (diretório SQL alternativo),
`-Version` (senão lê `package.json` de dentro do `app.zip`) e `-SkipBackup` (não recomendado).

O `atualizar.ps1`:

1. valida `app.zip` (precisa de `server.js` na raiz) e o SQL;
2. roda o `backup.ps1`; se falhar, cancela antes de alterar a aplicação;
3. para `NexusCaddy` e `NexusApp`;
4. move a aplicação atual para `app.prev-<versão-atual>`;
5. extrai o novo `app.zip`, preserva o `.env`, garante `UPLOADS_DIR`, `NODE_ENV`, `PORT` e
   `HOSTNAME` e reaplica a ACL;
6. aplica o SQL (`Auto`: migração 001 + seed em banco existente) com `nexus_app`;
7. ajusta ACLs, inicia o app, valida health, HTTPS e `smoke.ps1`;
8. mantém a versão anterior e mais uma `app.prev-*`.

Log: `C:\ProgramData\Nexus\logs\deploy-<versão>.log`.

**Não atualiza** Node, MySQL, Caddy, NSSM, scripts, bandeja nem firewall — o pacote só contém
`app.zip` e SQL. Para trocar runtimes ou corrigir firewall, use o setup/`bootstrap.ps1`.

Em falha, o app anterior é restaurado e a versão nova fica em `app.failed-<versão>`; o banco
**não** é restaurado automaticamente. O `atualizar.ps1` não atualiza o `bootstrap.state`; o
rollback restaura apenas a aplicação — runtimes e scripts/configuração do setup permanecem
como estão.

### 7.3 Reinstalar pelo setup

Rodar o `NexusSetup` sobre uma instalação existente executa o bootstrap novamente (fases
0–7), preserva o `.env` e reconfigura runtime, MySQL, bancos, serviços, firewall e bandeja.
Ele **não faz backup automático** e não tem o rollback do `atualizar.ps1`; faça backup manual
antes. É o caminho para migrar de 10.02, trocar versão de Node/MySQL/Caddy ou recuperar
serviços.

---

## 8. Backup e restauração

### 8.1 Backup agendado

`NexusBackup` roda diariamente às **02:00** como `SYSTEM`, com retenção de **30 dias**:

```text
powershell.exe -NoProfile -ExecutionPolicy Bypass `
  -File "C:\Program Files\Nexus\scripts\backup.ps1" -RetentionDays 30
```

`StartWhenAvailable` roda no próximo boot se o servidor estiver desligado. Log:
`C:\ProgramData\Nexus\logs\backup-<timestamp>.log`.

### 8.2 Backup manual

Pela bandeja (**Fazer backup agora**) ou em PowerShell elevado, a partir de
`C:\Program Files\Nexus\Instalador`:

```powershell
.\backup.ps1                 # retenção padrão de 30 dias
.\backup.ps1 -RetentionDays 60
.\backup.ps1 -SkipUploads    # não copia uploads
```

O backup manual precisa ser elevado porque lê `C:\ProgramData\Nexus\config\backup.cnf`, que
só Administrators/SYSTEM acessam.

### 8.3 O que é gerado

| Item | Destino | Formato |
| --- | --- | --- |
| Banco `nexus_prod` | `C:\ProgramData\Nexus\backups\db\nexus_prod-<timestamp>.zip` | `mysqldump` **do binário dedicado** na 3214, compactado; `.sql` intermediário apagado |
| Banco grande | `...\backups\db\nexus_prod-<timestamp>.sql` | acima de ~1,8 GB o `.sql` é mantido sem compactar |
| Uploads | `C:\ProgramData\Nexus\backups\uploads\` | `robocopy /E` |
| `.env` | `...\backups\config\.env-<timestamp>` | cópia com ACL restrita |
| `Caddyfile` | `...\backups\config\Caddyfile-<timestamp>` | cópia com ACL restrita |
| Log | `C:\ProgramData\Nexus\logs\backup-<timestamp>.log` | transcript |

Em `backups\config` também ficam os `my.ini-<timestamp>.bak` criados pelo pós-instalação.
O `backup.ps1` usa o `mysqldump` do binário dedicado; se ele faltar, o `Find-MysqldumpExe`
tem fallback para uma instalação 8.0/8.4 padrão, mas a conexão continua na 3214. O
`backup.ps1` exige `backup.cnf` na porta **3214**; se a porta estiver diferente, aborta
pedindo a fase 2 do bootstrap.

### 8.4 Retenção e verificação

A retenção remove, por `LastWriteTime`, `*.zip`/`*.sql` de `backups\db` e `.env-*`/
`Caddyfile-*` de `backups\config` mais antigos que `RetentionDays`.

> **Atenção:** a retenção **não** poda `backups\uploads` nem os `my.ini-*.bak`; a cópia de
> uploads não é podada e pode crescer sem limite. Dumps grandes ficam como `.sql` sem
> compactação. Ver §15.

Verificação rápida:

```powershell
Get-ChildItem C:\ProgramData\Nexus\backups\db -File |
  Sort-Object LastWriteTime -Descending | Select-Object -First 3 Name, Length, LastWriteTime

$latest = Get-ChildItem C:\ProgramData\Nexus\backups\db -File |
  Sort-Object LastWriteTime -Descending | Select-Object -First 1
if ($latest.Extension -eq ".zip") {
  Expand-Archive $latest.FullName -DestinationPath "$env:TEMP\nexus-backup-check" -Force
  $sql = Get-ChildItem "$env:TEMP\nexus-backup-check\*.sql" | Select-Object -First 1
} else {
  $sql = $latest
}
Select-String -Path $sql.FullName -Pattern "CREATE TABLE" | Select-Object -First 1
```

Copie os backups para fora do servidor (NAS, unidade de rede ou nuvem). Sem cópia externa,
um defeito de disco perde banco, uploads e configuração juntos.

### 8.5 Restauração em produção

> **Pare o `NexusApp` antes de restaurar.** Todo o procedimento é em **PowerShell elevado**.
> O `NexusMySQL84` pode continuar no ar. O dump foi feito com `--databases nexus_prod`,
> então contém `CREATE DATABASE`/`USE nexus_prod`; a importação **substitui as tabelas do
> dump**. Tabelas criadas depois do dump e que não estão nele permanecem.

1. Pare o serviço:

   ```powershell
   Stop-Service NexusApp -Force
   ```

2. Prepare o dump (`.zip` ou `.sql`):

   ```powershell
   $dump = "C:\ProgramData\Nexus\backups\db\nexus_prod-20261107-020000.zip"
   New-Item -ItemType Directory -Force -Path "D:\restore" | Out-Null
   if ($dump.EndsWith(".zip")) {
     Expand-Archive $dump -DestinationPath "D:\restore" -Force
     $sql = Get-ChildItem "D:\restore\*.sql" | Select-Object -First 1
   } else {
     $sql = Get-Item $dump
   }
   ```

3. Crie um arquivo de opções do MySQL com o **root** (o `nexus_app` não tem privilégio para
   recriar o banco); proteja o arquivo:

   ```powershell
   . "C:\Program Files\Nexus\scripts\common.ps1"
   $root = Read-Host -AsSecureString "Senha do root do MySQL dedicado"
   $plain = ConvertFrom-SecureStringPlain -Secure $root
   Write-Utf8NoBom -Path "C:\ProgramData\Nexus\config\restore.cnf" -Lines @(
     "[client]", "user=root", "host=127.0.0.1", "port=3214",
     ("password=" + (ConvertTo-MysqlOptionValue $plain)), "default-character-set=utf8mb4", ""
   )
   Protect-File -Path "C:\ProgramData\Nexus\config\restore.cnf"
   ```

4. Importe com o `mysql.exe` **dedicado**:

   ```powershell
   $mysql = "C:\Program Files\Nexus\mysql\bin\mysql.exe"
   $process = Start-Process -FilePath $mysql -Wait -NoNewWindow -PassThru `
     -RedirectStandardInput $sql.FullName `
     -ArgumentList @(
       "--defaults-extra-file=C:\ProgramData\Nexus\config\restore.cnf",
       "-h", "127.0.0.1", "-P", "3214"
     )
   if ($process.ExitCode -ne 0) { throw "mysql falhou (código $($process.ExitCode))" }
   ```

5. Restaure os uploads (o `/MIR` remove o que não existe no backup — comportamento desejado
   para voltar ao ponto do dump):

   ```powershell
   robocopy "C:\ProgramData\Nexus\backups\uploads" "C:\ProgramData\Nexus\uploads" `
     /MIR /COPY:DAT /R:2 /W:2 /NP
   ```

6. Se necessário, restaure o `.env` de `backups\config\.env-<timestamp>` em
   `C:\Program Files\Nexus\app\.env` e reaplique a ACL:

   ```powershell
   Copy-Item "C:\ProgramData\Nexus\backups\config\.env-20261107-020000" `
     "C:\Program Files\Nexus\app\.env" -Force
   . "C:\Program Files\Nexus\scripts\common.ps1"
   Protect-File -Path "C:\Program Files\Nexus\app\.env" -ReadIdentities @("S-1-5-20")
   ```

7. Se necessário, restaure o `Caddyfile` de `backups\config\Caddyfile-<timestamp>` e proteja:

   ```powershell
   Copy-Item "C:\ProgramData\Nexus\backups\config\Caddyfile-20261107-020000" `
     "C:\ProgramData\Nexus\config\Caddyfile" -Force
   Protect-File -Path "C:\ProgramData\Nexus\config\Caddyfile" -ReadIdentities @("S-1-5-19")
   ```

8. Remova o `restore.cnf` e reinicie/valide:

   ```powershell
   Remove-Item "C:\ProgramData\Nexus\config\restore.cnf" -Force
   Start-Service NexusApp
   Start-Service NexusCaddy
   & "C:\Program Files\Nexus\Instalador\smoke.ps1" -Hostname nexus.galpao.local
   ```

Se o dump for de uma versão anterior (10.02), depois da importação rode o SQL de atualização
para renomear as unidades e reaplicar o seed:

```powershell
.\aplicar-sql.ps1 -MysqlExe "C:\Program Files\Nexus\mysql\bin\mysql.exe" `
  -AppPassword (Read-Host -AsSecureString "Senha de nexus_app") -Mode Update
```

### 8.6 Restauração em banco de teste

Use **outra instância MySQL** (porta 3307 ou uma VM) e importe o dump; na instância de teste,
o `CREATE DATABASE nexus_prod`/`USE nexus_prod` cria o banco local dela. Aponte um `.env` de
desenvolvimento para essa instância e rode a aplicação localmente. Nunca aponte o teste para
o `nexus_prod` de produção; se precisar do mesmo servidor, edite o dump para outro nome.

---

## 9. Bandeja (`NexusTray`)

Executável .NET 8 self-contained em `C:\Program Files\Nexus\NexusTray\NexusTray.exe`, com
instância única (mutex global) e `tray.json` ao lado.

### 9.1 Estados

| Ícone | Estado | Condição |
| --- | --- | --- |
| verde | em execução | `NexusApp` rodando e health 200 com `status=ok` e `db=true` |
| amarelo | degradado | serviço rodando, health responde, mas sem `ok`/`db=true` (ex.: banco fora) |
| vermelho | fora do ar | serviço parado/não instalado ou health inacessível |

Polling a cada **20 s**; a transição gera balão. Tooltip: `Nexus — estado · v<versão>`.

### 9.2 Menu

| Item | Ação |
| --- | --- |
| **Abrir Nexus** | abre `https://<hostname>` (via `explorer.exe`, fora do processo elevado) |
| **Status** | `Serviço: ... · Banco: ... · v...` |
| **Reiniciar aplicação** | executa `restart.ps1`: para o Caddy, reinicia o App, espera health, inicia o Caddy e confere o health; log `restart-<timestamp>.log` |
| **Abrir logs** | abre `C:\ProgramData\Nexus\logs` |
| **Fazer backup agora** | roda `C:\Program Files\Nexus\scripts\backup.ps1` |
| **Abrir pasta de dados** | abre `C:\ProgramData\Nexus` |
| **Sair** | encerra só a bandeja; serviços continuam |

### 9.3 `tray.json`

```json
{
  "baseUrl": "https://nexus.galpao.local",
  "healthUrl": "http://127.0.0.1:3000/api/health",
  "serviceName": "NexusApp",
  "nssmPath": "C:\\Program Files\\Nexus\\tools\\nssm\\nssm.exe",
  "logsDir": "C:\\ProgramData\\Nexus\\logs",
  "dataDir": "C:\\ProgramData\\Nexus",
  "backupScript": "C:\\Program Files\\Nexus\\scripts\\backup.ps1",
  "restartScript": "C:\\Program Files\\Nexus\\scripts\\restart.ps1"
}
```

Se faltar ou estiver inválido, a bandeja usa os padrões do código (já apontam para
`C:\Program Files\Nexus\scripts`). Mantenha o arquivo para preservar os caminhos.

### 9.4 Limitações

- Registrada no **logon do usuário que instalou**, com `RunLevel Highest`; outros usuários
  não a veem.
- `requireAdministrator`; abrir sem elevação pede UAC.
- O `restart.ps1` afeta **Caddy e App**; se o App não voltar ao health, o Caddy fica parado
  até intervenção. O `NexusMySQL84` **não** é reiniciado pelo script.
- Falhas fatais vão para `%LOCALAPPDATA%\NexusTray\tray.log` (do usuário).

---

## 10. Health check e smoke test

### 10.1 `GET /api/health`

Rota pública (`src/proxy.ts`), `force-dynamic`, runtime Node:

```json
{ "status": "ok", "db": true, "versao": "1.07.11.2026" }
```

- HTTP **200** quando `SELECT 1` responde;
- HTTP **503** com `{"status":"degraded","db":false,"versao":"..."}` quando o banco não
  responde; sem stack/credencial;
- `versao` vem de `NEXT_PUBLIC_APP_VERSION`, definida no build a partir do `package.json`.

### 10.2 `smoke.ps1`

```powershell
# PowerShell elevado; exemplo de versão
cd "C:\Program Files\Nexus\Instalador"
.\smoke.ps1 -Hostname nexus.galpao.local -ExpectedVersion 1.07.11.2026
```

Confere Node portátil, `mysqld.exe`, os três serviços, a porta 3214, as ACLs de
`backups`/`config`/`app\.env`, as quatro regras de firewall, o health com `db=true`,
`https://<hostname>/login` e a versão. **Não ignora erro de certificado**: o HTTPS exige a CA
do Caddy confiada. Saída `SMOKE: OK` (0) ou `SMOKE: FALHOU` (1).

### 10.3 Testes manuais

```powershell
Invoke-RestMethod http://127.0.0.1:3000/api/health | ConvertTo-Json
Invoke-WebRequest https://nexus.galpao.local/login -UseBasicParsing | Select-Object StatusCode
Get-Service NexusMySQL84, NexusApp, NexusCaddy | Select-Object Name, Status, StartType
Get-ScheduledTask NexusBackup, NexusTray | Select-Object TaskName, State
Get-NetFirewallRule -DisplayName "Nexus *" | Select-Object DisplayName, Enabled, Action
```

---

## 11. Solução de problemas

| Sintoma | Causa provável | O que fazer |
| --- | --- | --- |
| setup falha na fase 0 com "payload ausente" | `Instalador\payload` incompleto | gere o setup com `build-instalador.ps1` (que chama `preparar-payload.ps1`); confira `payload\node`, `mysql`, `caddy`, `vcredist`, `nssm`, `app\app.zip`, `sql` |
| `app.zip` inválido/`server.js` ausente | pacote standalone não foi gerado | rode `npm run build:standalone` e `npm run package:standalone`; o `empacotar-standalone.mjs` precisa de `.next/standalone`, `.next/static` e `server.js` |
| MySQL `NexusMySQL84` não inicia / 3214 fechada | `my.ini`, `Data` ou serviço | confira `C:\ProgramData\Nexus\mysql\my.ini`, o erro em `...\mysql\data\*.err`, `Get-Service NexusMySQL84` e `Test-NetConnection 127.0.0.1 -Port 3214`; restaure `my.ini-*.bak` |
| migração do Data não aconteceu | `C:\ProgramData\Nexus\mysql\data` já tinha conteúdo | o `instalar-mysql.ps1` só copia para destino vazio; faça backup e esvazie/renomeie o destino se for migrar |
| SQL falha em Fresh | banco já tem tabelas | use `-Mode Update` (migração 001 + seed) ou um banco vazio; confira `aplicar-sql.ps1` |
| SQL falha nas contagens | seed/migração incompletos ou banco divergente | rode `aplicar-sql.ps1` manualmente e confira 81 permissões, 2 perfis, 3 conversões (`PCT10`/`CX50`); veja o log |
| `NexusApp` não sobe | Node/`server.js`/`.env`/dependência MySQL | confira `C:\Program Files\Nexus\node\node.exe`, `app\server.js`, `app\.env` e `DATABASE_URL` na 3214; veja `app.err.log` |
| health 503 (`db=false`) | `NexusMySQL84` parado, senha/banco ausente | `Get-Service NexusMySQL84`; teste com `C:\Program Files\Nexus\mysql\bin\mysql.exe --defaults-extra-file="C:\ProgramData\Nexus\config\backup.cnf" -h 127.0.0.1 -P 3214 -D nexus_prod -e "SELECT 1"` |
| HTTPS falha/CA não confiada | Caddy/CA/ACL/hostname | veja `C:\ProgramData\Nexus\caddy\logs\caddy.err.log`; confira `certutil -addstore -f Root "C:\ProgramData\Nexus\caddy\data\caddy\pki\authorities\local\root.crt"` e o `hosts`/DNS |
| firewall ausente/divergente | bootstrap não aplicou ou política alterada | `Get-NetFirewallRule -DisplayName "Nexus *"`; reaplique com o bootstrap `-Force` (ou `New-NetFirewallRule`) e valide com `smoke.ps1` |
| smoke falha em ACL `BUILTIN\Users` | ACL herdada/alterada | rode `smoke`/bootstrap elevado; reaplique `Set-AclRestricted`/`Protect-File`; confira com `icacls` |
| atualização por pacote falha | `app.zip`/`sql` ausente, `server.js` ausente, health/smoke | confira o layout `app\app.zip` + `sql\`; veja `deploy-<versão>.log` e `app.failed-<versão>`; o banco não volta automaticamente |
| atualização de 10.02 para 1.07 não conclui | pacote de app não instala runtime/MySQL | use o **setup**/bootstrap 1.07; o `atualizar.ps1` só troca app+SQL |
| bandeja não aparece | tarefa de outro usuário/logon | `Get-ScheduledTask NexusTray`; rode o exe elevado ou registre no usuário desejado |
| backup falha | `backup.cnf` ausente/porta errada/MySQL fora | confira a porta 3214 no `backup.cnf`; rode a fase 2 do bootstrap; veja `backup-<timestamp>.log` |
| disco enche | uploads/my.ini antigos, `.sql` grande, `app.failed-*` | limpe `backups\uploads`/`.sql` antigos e versões `app.failed-*` após conferir os backups |
| desinstalação falha e preserva runtime | serviço/tarefa não removido | veja `desinstalar-*.log`; corrija serviço/tarefa e rode de novo |

### 11.1 Onde olhar primeiro

| Arquivo | Para quê |
| --- | --- |
| `C:\ProgramData\Nexus\logs\app.err.log` | erro do Next standalone |
| `C:\ProgramData\Nexus\logs\app.out.log` | saída do app |
| `C:\ProgramData\Nexus\mysql\data\*.err` | erro do MySQL |
| `C:\ProgramData\Nexus\caddy\logs\caddy.err.log` | erro do Caddy |
| `C:\ProgramData\Nexus\caddy\logs\access.log` | requisições HTTP |
| `C:\ProgramData\Nexus\logs\bootstrap-*.log` | instalação |
| `C:\ProgramData\Nexus\logs\instalador-*.log` | andamento do `.exe` |
| `C:\ProgramData\Nexus\logs\deploy-*.log` | atualização por pacote |
| `C:\ProgramData\Nexus\logs\backup-*.log` | backup |
| `C:\ProgramData\Nexus\logs\restart-*.log` | reinício pela bandeja |
| `C:\ProgramData\Nexus\logs\desinstalar-*.log` | desinstalação |
| `%LOCALAPPDATA%\NexusTray\tray.log` | falha fatal da bandeja |

---

## 12. Segurança

### 12.1 ACLs e segredos

O bootstrap remove a herança de `C:\ProgramData` e aplica ACLs explícitas:

| Caminho | Permissão |
| --- | --- |
| `C:\ProgramData\Nexus` (raiz) | Administrators (S-1-5-32-544) e SYSTEM (S-1-5-18) |
| `C:\ProgramData\Nexus\uploads` | `NetworkService` (S-1-5-20) `Modify` + Administrators/SYSTEM |
| `C:\ProgramData\Nexus\logs` | `NetworkService` `Modify` + Administrators/SYSTEM |
| `C:\ProgramData\Nexus\backups` e `config` | somente Administrators/SYSTEM |
| `C:\ProgramData\Nexus\mysql` e `mysql\data` | somente Administrators/SYSTEM + `NetworkService` `Modify` |
| `C:\ProgramData\Nexus\mysql\my.ini` | `NetworkService` somente leitura |
| `C:\ProgramData\Nexus\caddy\{data,config,logs}` | `LocalService` (S-1-5-19) `Modify` + Administrators/SYSTEM |
| `C:\ProgramData\Nexus\config\Caddyfile` | `LocalService` somente leitura |
| `C:\Program Files\Nexus\node` e `mysql` | `ReadAndExecute` para `NetworkService` |
| `C:\Program Files\Nexus\app\.env` | `NetworkService` somente leitura; Administrators/SYSTEM total |
| `C:\Program Files\Nexus\app` | `ReadAndExecute` para `NetworkService`; `.next\cache` com `Modify` |
| `C:\ProgramData\Nexus\config\backup.cnf` | somente Administrators/SYSTEM; **o app não lê** |

- `NexusApp` e `NexusMySQL84` rodam como **NetworkService**; `NexusCaddy` como
  **LocalService**.
- `backup.cnf` guarda a senha do `nexus_app` e a porta 3214; quem o usa é o `bootstrap`
  (teste da fase 2) e o `backup.ps1` (SYSTEM/elevado).
- `restore.cnf` (manual) tem a mesma proteção; apague após o uso.
- Arquivos temporários do MySQL/SQL nascem com `Protect-File`; erros do `mysqldump` são
  redigidos.
- Transcripts são suspensos durante a leitura das senhas.
- `JWT_SECRET` é gerado com 48 bytes aleatórios quando ausente e preservado nas atualizações.
- Senhas: o `nexus_app` aceita até 256 caracteres e recusa `@`, `/`, `?`, `#`, `"`, `\`,
  `;`, espaço/tab e caracteres de controle (sem mínimo nem composição); o root só não pode
  ser vazio nem ter quebra de linha; nunca use `-p<senha>` na linha de comando.

O `smoke.ps1` verifica que `backups`, `config` e `app\.env` não tenham ACE para
`BUILTIN\Users` (S-1-5-32-545); rode-o elevado.

### 12.2 Exposição de rede

- Node escuta apenas `127.0.0.1:3000`; MySQL apenas `127.0.0.1:3214`; a 3306 é independente.
- Caddy é a única porta exposta (80/443), com CA interna e `admin off` (sem API administrativa).
- O firewall cria Allow de 80/443 e Block de 3214/3000 para `LocalSubnet`; valide com
  `smoke.ps1`.
- MySQL dedicado usa utf8mb4/utf8mb4_0900_ai_ci, fuso `-03:00` e `mysqlx=0`.

### 12.3 Payload e integridade

O build do payload verifica os hashes do manifesto: Node (SHA-256), MySQL (MD5), Caddy
(SHA-512) e NSSM (SHA-256). O `vc_redist` não tem SHA-256 preenchido e o `app.zip`/SQL não têm
hash próprio. No destino, o bootstrap valida a presença do payload, o MD5 do MySQL e o
SHA-256 do NSSM; Node/Caddy/VC++ não são re-hashados. Guarde o setup e valide seu tamanho/hash
por um canal confiável. O setup não tem assinatura Authenticode configurada.

### 12.4 CA interna

O bootstrap instala a CA local com `certutil -addstore -f Root` a partir de
`C:\ProgramData\Nexus\caddy\data\caddy\pki\authorities\local\root.crt`. Distribua esse
`root.crt` às estações (GPO/script) e instale em **Autoridades de Certificação Raiz
Confiáveis**. A desinstalação não remove a CA do trust store.

---

## 13. Desinstalação

Use **Configurações → Aplicativos → Nexus → Desinstalar** (ou o atalho). O `.iss` não tem
`[UninstallRun]` nem `[UninstallDelete]`; o `desinstalar.ps1` roda em
`CurUninstallStepChanged(usUninstall)`, o `ResultCode` é verificado e uma falha mostra
`MsgBox`.

### 13.1 O que é removido

- Serviços **`NexusCaddy`**, **`NexusApp`** e **`NexusMySQL84`**.
- Tarefas **`NexusTray`** e **`NexusBackup`**; processo da bandeja.
- `C:\Program Files\Nexus\app`, `node`, `mysql`, `caddy`, `tools`, `scripts`, `payload`,
  `sql`, `NexusTray` e versões `app.prev-*`/`app.failed-*`/`app.prev-manual-*`.
- As quatro regras de firewall `Nexus *` (quando `NetSecurity` está disponível).
- `C:\ProgramData\Caddy` legado, se existir.
- O diretório `Instalador` é removido pelo Inno.

Se serviços/tarefas não forem removidos, o script para antes de apagar o runtime e preserva
app, tray, versões antigas e binários; o Inno mostra o erro.

### 13.2 O que é preservado

- **`C:\ProgramData\Nexus` inteiro**, incluindo `mysql\data`, `mysql\my.ini`, uploads, config,
  backups e logs.
- **`C:\ProgramData\MySQL\MySQL Server 8.4`** (dados do MySQL legado), se existir.
- Node.js, MySQL e Git **do sistema**, se instalados; o Nexus usava runtimes embutidos.
- A CA interna no trust store do Windows.

Para remoção total, depois de copiar o que precisa:

1. rode a desinstalação normal;
2. apague `C:\ProgramData\Nexus` (isso apaga o banco lógico, uploads e backups);
3. apague `C:\ProgramData\MySQL\MySQL Server 8.4` se ele for exclusivo do Nexus antigo;
4. remova a CA da Caddy em `certlm.msc`;
5. remova `C:\Program Files\Nexus\Instalador`, se ainda existir.

> Desinstalação manual:
> `powershell -NoProfile -ExecutionPolicy Bypass -File "C:\Program Files\Nexus\Instalador\desinstalar.ps1"`.
> Ela não remove o próprio `Instalador`.

---

## 14. Checklist de release do instalador 1.07

### 14.1 Build do app standalone

- [ ] `npm ci` na máquina de build.
- [ ] `npm run build:standalone` (Next com `output: "standalone"`).
- [ ] `npm run package:standalone` → `out/standalone/app.zip`; confira `server.js` na raiz,
      `.next/static` e ausência de `.env`/`uploads`.
- [ ] A versão do `package.json` é `1.07.11.2026` (ou a versão da release) e aparece no
      `app.zip`.

### 14.2 Payload e setup

- [ ] `deploy/windows/tools/nssm/nssm.exe` existe (fonte do NSSM embutido).
- [ ] `scripts/preparar-payload.ps1` monta `deploy/windows/payload` com Node 24.19.0, MySQL
      8.4.13, Caddy 2.11.9, VC++, NSSM, `app\app.zip`, `sql\{schema,seed,migracoes\001}`;
      os hashes definidos no manifesto são verificados.
- [ ] `deploy/windows/build-instalador.ps1` (chama `preparar-payload`) gera
      `deploy/windows/out/NexusSetup-1.07.11.2026.exe`; confira o tamanho (~393,8 MB).
- [ ] O setup contém `payload\` e `sql\`; nenhum download/Git/npm/Prisma é necessário no
      destino.

### 14.3 Testes obrigatórios

- [ ] VM Windows limpa (10/11 x64, sem Node/Git/MySQL): instalação completa, hostname,
      MySQL 8.4.13 dedicado, SQL, serviços, tray, firewall e `smoke.ps1`.
- [ ] **Upgrade 10.02→1.07** na máquina de teste: dados migrados de
      `C:\ProgramData\MySQL\MySQL Server 8.4\Data` para `C:\ProgramData\Nexus\mysql\data`,
      health 1.07, HTTPS 200, serviços Running, tray e **81/2/3**.
- [ ] Verificar que o MySQL existente na 3306 (se houver) não foi parado/alterado.
- [ ] Testar `atualizar.ps1 -Package` em uma instalação 1.07 (app+SQL) e o rollback.
- [ ] Testar backup/restauração e desinstalação preservando `C:\ProgramData\Nexus`.
- [ ] Testar acesso de uma estação ao HTTPS e a CA do Caddy.
- [ ] Registrar evidências (data, versão, setup, health, contagens e logs).

> O app não recebe tag nem clona Git: a versão vem do `package.json`/`app.zip` e o setup do
> payload. A release do repositório pode ter sua tag DateVer, mas ela não é usada pelo
> instalador.

---

## 15. Atenções conhecidas (limitações reais)

1. **Retenção do backup não cobre uploads.**
   `backup.ps1` poda `backups\db\*.zip`/`.sql` e `.env-*`/`Caddyfile-*`; `backups\uploads` e
   `my.ini-*.bak` não são podados e podem crescer sem limite.

2. **O backup é lógico, não inclui os arquivos do MySQL nem a CA.**
   O dump cobre `nexus_prod`, uploads, `.env` e `Caddyfile`; `C:\ProgramData\Nexus\mysql\data`
   e `caddy\data` (CA/chave privada) não entram no backup. Após perda total, o Caddy gera
   outra CA.

3. **A bandeja é registrada só para o usuário que instalou.**
   `NexusTray` usa `AtLogOn -User $currentUser`; outros usuários não a veem.

4. **O `.env` não é mesclado na atualização por pacote.**
   `atualizar.ps1` copia o `.env` anterior e garante `UPLOADS_DIR`/`NODE_ENV`/`PORT`/`HOSTNAME`;
   variáveis novas de uma release não são adicionadas automaticamente. Compare com
   `.env.example` e ajuste à mão (reaplicando a ACL).

5. **`app.failed-*` e `app.prev-manual-*` acumulam.**
   O `atualizar.ps1` mantém a versão anterior e mais uma `app.prev-*`, mas não remove
   `app.failed-*`; o bootstrap deixa `app.prev-manual-*`. A desinstalação os remove, mas
   durante a operação monitore o disco.

6. **Hashes do payload incompletos.**
   Node/Caddy/NSSM têm SHA-256/SHA-512 e MySQL tem MD5; o `vc_redist` está sem SHA-256 e o
   `app.zip`/SQL não têm hash no manifesto. O destino só revalida MySQL e NSSM. O setup não
   tem assinatura Authenticode configurada.

7. **`atualizar.ps1` não atualiza runtimes, scripts, bandeja nem firewall.**
   O pacote de atualização contém apenas `app.zip` + SQL. Node, MySQL, Caddy, NSSM, scripts,
   tray, regras de firewall e o `bootstrap.state.json` só mudam com o setup/bootstrap.

8. **Atualização de schema só tem a migração 001.**
   O caminho Update aplica `001-unidades-pct10-cx50.sql` + seed. Mudanças de schema em
   releases futuras exigem uma nova migração em `deploy/sql/migracoes`; não use `db push` nem
   Prisma no destino.

9. **Hostname nas estações.**
   O bootstrap adiciona `127.0.0.1 <hostname>` ao `hosts` do servidor quando o DNS não
   resolve; as estações ainda precisam de DNS/hosts para acessar o Nexus.

10. **Fixtures do Figma usam unidades antigas.**
    `tools/figma-export/fixtures.ts` ainda usa `CAIXA`/`PACOTE`, enquanto o seed de produção
    usa `PCT10`/`CX50`. A exportação de telas pode exibir os nomes antigos; não altera o banco.

11. **A desinstalação preserva a CA no disco e no trust store.**
    O `desinstalar.ps1` preserva `C:\ProgramData\Nexus\caddy` (dados, configuração e a CA) e
    não remove o certificado raiz da Caddy do repositório de confiança do Windows. Para
    remoção total, apague `C:\ProgramData\Nexus` e exclua a CA em `certlm.msc`.

12. **O setup é grande e o payload não é versionado.**
    O `NexusSetup-1.07.11.2026.exe` tem ~393,8 MB; `deploy/windows/payload` é ignorado pelo
    Git e precisa ser montado no build. O destino é offline, mas o build exige internet e os
    arquivos de origem (app.zip, NSSM, SQL).

---

## 16. Referências

| Assunto | Arquivo |
| --- | --- |
| instalador | [`deploy/windows/instalador.iss`](../../deploy/windows/instalador.iss) e [`build-instalador.ps1`](../../deploy/windows/build-instalador.ps1) |
| payload | [`scripts/preparar-payload.ps1`](../../scripts/preparar-payload.ps1) e [`deploy/windows/manifesto.json`](../../deploy/windows/manifesto.json) |
| app standalone | [`scripts/empacotar-standalone.mjs`](../../scripts/empacotar-standalone.mjs) e [`next.config.ts`](../../next.config.ts) |
| instalação | [`bootstrap.ps1`](../../deploy/windows/bootstrap.ps1) e [`instalar-gui.ps1`](../../deploy/windows/instalar-gui.ps1) |
| MySQL | [`instalar-mysql.ps1`](../../deploy/windows/instalar-mysql.ps1) e [`pos-instalacao-mysql.ps1`](../../deploy/windows/pos-instalacao-mysql.ps1) |
| SQL/seed | [`deploy/sql/`](../../deploy/sql/) e [`aplicar-sql.ps1`](../../deploy/windows/aplicar-sql.ps1) |
| atualização | [`atualizar.ps1`](../../deploy/windows/atualizar.ps1) |
| backup | [`backup.ps1`](../../deploy/windows/backup.ps1) |
| reinício | [`restart.ps1`](../../deploy/windows/restart.ps1) |
| validação | [`smoke.ps1`](../../deploy/windows/smoke.ps1) e [`src/app/api/health/route.ts`](../../src/app/api/health/route.ts) |
| uploads | [`src/lib/uploads.ts`](../../src/lib/uploads.ts) |
| bandeja | [`deploy/windows/NexusTray/`](../../deploy/windows/NexusTray/) |
| desinstalação | [`desinstalar.ps1`](../../deploy/windows/desinstalar.ps1) |
| versão e changelog | [`VERSIONAMENTO.md`](VERSIONAMENTO.md) |
| regras do projeto | [`AGENTS.md`](../../AGENTS.md) |
