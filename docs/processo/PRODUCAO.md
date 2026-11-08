# Produção — instalador autocontido 1.08 (Windows)

Runbook da instalação do **Nexus** em um servidor Windows usando o pacote
**`NexusSetup-1.08.11.2026.exe`**. O instalador é **autocontido**: Node.js portátil, MySQL
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
| `NexusSetup-1.08.11.2026.exe` | instalador **Inno Setup 7** autocontido (419,4 MB / 439.748.699 bytes, com o agente); embute o payload, pede as senhas do MySQL no wizard e executa o bootstrap com janela de progresso |
| [`bootstrap.ps1`](../../deploy/windows/bootstrap.ps1) | instalação em **8 fases (0–7)**, idempotente e retomável; estado em `C:\ProgramData\Nexus\bootstrap.state.json` |
| [`instalar-mysql.ps1`](../../deploy/windows/instalar-mysql.ps1) | instala o MySQL 8.4.13 embutido, migra o `Data` legado e cria o serviço `NexusMySQL84` na 3214 |
| [`pos-instalacao-mysql.ps1`](../../deploy/windows/pos-instalacao-mysql.ps1) | ajusta o `my.ini`, cria `nexus_prod` e o usuário `nexus_app` |
| [`aplicar-sql.ps1`](../../deploy/windows/aplicar-sql.ps1) | aplica `schema.sql`/`seed.sql` (Fresh) ou todas as migrações de `migracoes\*.sql` em ordem + seed (Update), sem Prisma |
| [`atualizar.ps1`](../../deploy/windows/atualizar.ps1) | atualização por **pacote** (`app\app.zip` + `sql\`), com backup e rollback |
| [`backup.ps1`](../../deploy/windows/backup.ps1) | backup do banco, uploads, `.env` e `Caddyfile`; aceita `-AgentProgress`/`-RequireMysql` quando chamado pelo agente |
| `NexusAgent` | serviço **.NET 10** self-contained (`LocalSystem`, automático) com a API local de backup/restauração; agenda substitui a tarefa `NexusBackup` |
| [`progresso/index.html`](../../deploy/windows/progresso/index.html) | página estática servida pelo Caddy em `/progresso/` com o andamento do job |
| [`restart.ps1`](../../deploy/windows/restart.ps1) | reinício controlado do `NexusApp`; usado pela bandeja |
| [`smoke.ps1`](../../deploy/windows/smoke.ps1) | smoke test de runtime, serviços, porta, ACLs, firewall, health e HTTPS |
| [`desinstalar.ps1`](../../deploy/windows/desinstalar.ps1) | remove serviços, runtimes, tarefas, regras e app; preserva `C:\ProgramData\Nexus` |
| `NexusTray` | bandeja **.NET 10** self-contained; status dos três serviços, iniciar/encerrar o Nexus, reinício, backup e pastas |
| [`common.ps1`](../../deploy/windows/common.ps1) | caminhos e funções compartilhadas |

### 1.1 Versões e componentes

| Componente | Versão/origem | Onde está definido |
| --- | --- | --- |
| App Next | **standalone**, `server.js` + `.next/static` + `public` + client Prisma; versão `1.08.11.2026` | `next.config.ts`, `package.json`, `app.zip` |
| Node.js | **24.19.0** portátil, ZIP `node-v24.19.0-win-x64.zip` | `manifesto.json` / payload |
| MySQL | **8.4.13 LTS**, ZIP `mysql-8.4.13-winx64.zip` (MD5) | `manifesto.json` / payload |
| Serviço MySQL | **`NexusMySQL84`**, porta **3214**, bind `127.0.0.1` | `instalar-mysql.ps1` |
| Caddy | **2.11.9**, ZIP `caddy_2.11.9_windows_amd64.zip` (SHA-512) | `manifesto.json` / payload |
| NSSM | **2.24**, `nssm.exe` (SHA-256) | `manifesto.json` / payload |
| VC++ Redistributable | **14.x**, `vc_redist.x64.exe` | `manifesto.json` / payload |
| Bandeja | **.NET 10**, `win-x64`, self-contained, single-file | `NexusTray/NexusTray.csproj` |
| Agente | **.NET 10**, `win-x64`, self-contained, single-file (`NexusAgent.exe` ~99 MB) | `NexusAgent/NexusAgent.csproj` |
| Instalador | **Inno Setup 7**; `ISCC.exe` local ou NuGet **7.1.0** no build | `build-instalador.ps1` |
| Setup | **419,4 MB** (`NexusSetup-1.08.11.2026.exe`, 439.748.699 bytes, já com o agente) | `deploy/windows/out/` |

> O tamanho do setup cresce com o `NexusAgent.exe` (~99 MB). O valor acima é o build real
> com o agente embutido.

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
| `scripts\` | `backup.ps1`, `common.ps1`, `restart.ps1`, `iniciar-nexus.ps1`, `encerrar-nexus.ps1` e `abrir-bandeja.vbs` copiados pelo bootstrap |
| `NexusTray\` | `NexusTray.exe` e `tray.json` |
| `NexusAgent\` | `NexusAgent.exe` (serviço de backup/restauração), copiado pelo bootstrap |
| `Instalador\` | scripts do instalador e `payload\` (Node, MySQL, Caddy, VC++, NSSM, `app\app.zip`, `sql`) |
| `Instalador\sql\` | cópia de `schema.sql`, `seed.sql` e de toda a pasta `migracoes\` (001, 002, ...) |
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
| `logs\` | `app.out/err.log`, `bootstrap-*.log`, `deploy-*.log`, `backup-*.log`, `restore-*.log`, `restart-*.log`, `desinstalar-*.log` |
| `backups\db\` | dumps `nexus_prod-<timestamp>.zip` ou `.sql` (acima de ~1,8 GB) |
| `backups\uploads\<timestamp>\` | snapshot dos uploads de cada backup (mesmo timestamp do dump); o `backups\uploads` legado, com arquivos soltos, é preservado |
| `backups\config\` | `.env-<timestamp>`, `Caddyfile-<timestamp>`, `my.ini-*.bak` |
| `config\Caddyfile` | Caddyfile gerado com o hostname; leitura para `LocalService` |
| `config\backup.cnf` | credenciais do `nexus_app` para o `mysqldump`; **sem leitura pelo app** |
| `config\agent.secret` | segredo do NexusAgent (48 bytes); **só Administrators/SYSTEM** leem |
| `config\nexus-state.json` | `nexusStopped` e `updatedAt`; escrito por `iniciar-nexus.ps1`/`encerrar-nexus.ps1` e lido pela bandeja |
| `agent\` | `jobs.json` (histórico de até 100 jobs) e `schedule.json` (agenda do backup) |
| `caddy\progresso\` | `index.html` (página estática) e `status.json` (job atual, sem segredos) |
| `caddy\{data,config,logs}\` | dados, configuração e logs do Caddy; a CA local fica em `caddy\data\caddy\pki\authorities\local\` |

> O log do próprio Inno Setup fica em `%TEMP%\Setup Log*.txt` (o `.iss` usa
> `SetupLogging=yes`). Não existe mais `C:\ProgramData\Nexus\logs\instalador-*.log`; o
> andamento do bootstrap continua em `bootstrap-*.log`.

### 2.3 Legado (somente migração)

| Caminho | Uso |
| --- | --- |
| `C:\ProgramData\MySQL\MySQL Server 8.4\Data` | dados do MySQL da instalação anterior (10.02); o `instalar-mysql.ps1` copia para `C:\ProgramData\Nexus\mysql\data` e **preserva o original** |
| `C:\Program Files\MySQL\MySQL Server 8.4` | se existir, é uma instalação MySQL independente (por exemplo, 3306); o Nexus **não a instala, para nem altera** |

> `C:\ProgramData\MySQL\MySQL Server 8.4` **não é caminho ativo** do Nexus 1.08: serve apenas
> de origem para a migração do `Data`. O caminho ativo é `C:\ProgramData\Nexus\mysql\data`.

---

## 3. Serviços, tarefas, portas e firewall

### 3.1 Serviços

| Nome | Criado por | Conta | Início | Depende de | Logs |
| --- | --- | --- | --- | --- | --- |
| `NexusMySQL84` | `instalar-mysql.ps1` | `NT AUTHORITY\NetworkService` | automático | — | `C:\ProgramData\Nexus\mysql\data\*.err` |
| `NexusApp` | `bootstrap.ps1` (NSSM) | `NT AUTHORITY\NetworkService` | automático | `NexusMySQL84` | `C:\ProgramData\Nexus\logs\app.out.log` e `app.err.log` |
| `NexusCaddy` | `bootstrap.ps1` (NSSM) | `NT AUTHORITY\LocalService` | automático | — | `C:\ProgramData\Nexus\caddy\logs\caddy.out.log`/`caddy.err.log` + `access.log` |
| `NexusAgent` | `bootstrap.ps1` (`New-Service`) | `LocalSystem` | automático | — (sem dependência do MySQL) | `C:\ProgramData\Nexus\agent\jobs.json` e `logs\backup-*/restore-*.log` |

O NSSM configura `AppExit Default Restart` (reinício após 5 s), rotação de log em 10 MiB e
parada com 15 s para o console. Se o `NexusMySQL84` não subir, o `NexusApp` não sobe. O
`NexusCaddy` **não depende** do app: continua no ar durante a parada/reinício do `NexusApp`
(é ele que serve `/progresso/` e o HTTPS), e o `NexusApp` é quem depende do MySQL. O
`NexusAgent` é criado com `New-Service` (`LocalSystem`,
início automático) e reinício em falha (`restart` 5 s/10 s/30 s, reset diário); o
`BINARY_PATH_NAME` guarda o caminho **entre aspas** (`"...\NexusAgent.exe"`), e o upgrade
atualiza o binPath via `sc.exe config` com as aspas literais, conferidas por `sc.exe qc`.
Ele não depende do MySQL porque trata o banco parado e reporta o estado em `/v1/health`.

### 3.2 Tarefas agendadas

| Nome | Gatilho | Conta | Comando |
| --- | --- | --- | --- |
| `NexusTray` | **logon do usuário que executou a instalação** | esse usuário, `RunLevel Highest` | `C:\Program Files\Nexus\NexusTray\NexusTray.exe` |

A tarefa **`NexusBackup`** não existe mais: o bootstrap a remove (`Unregister-ScheduledTask`) e
o **NexusAgent** passa a agendar o backup em `C:\ProgramData\Nexus\agent\schedule.json`
(padrão **02:00**, todos os dias, retenção **30 dias**, com uploads). A agenda é editável pela
**engrenagem da topbar (Backup)** e vale no fuso `America/Sao_Paulo`; se o horário passar com a máquina
desligada, o agente não recupera o dia perdido — o próximo backup é no horário seguinte.

A bandeja roda elevada (`requireAdministrator`) para executar `restart.ps1`, `iniciar-nexus.ps1`
e `encerrar-nexus.ps1` (que usam serviços/NSSM) sem pedir UAC. Ela não é registrada para "todos
os usuários" — ver §9 e §15. **Não há watchdog**: se a bandeja fechar/cair, o Nexus continua e
o usuário reabre pelo atalho **Bandeja do Nexus**; os serviços sobem com o Windows
independentemente da sessão.

### 3.3 Portas

| Porta | Serviço | Escuta | Observação |
| --- | --- | --- | --- |
| `3214` | `NexusMySQL84` | `127.0.0.1` | `bind-address=127.0.0.1`; `mysqlx=0` |
| `3000` | `NexusApp` | `127.0.0.1` | `node.exe server.js` com `HOSTNAME=127.0.0.1` |
| `3215` | `NexusAgent` | `127.0.0.1` | API `/v1/*` com `Authorization: Bearer <agent.secret>`; só loopback |
| `80`/`443` | `NexusCaddy` | todas as interfaces | HTTPS com CA interna; a 80 atende o redirecionamento do Caddy |

O bootstrap verifica **3214**, 3000, 80 e 443 na fase 0; a **3215** é aberta pelo agente e
bloqueada na LAN pelo firewall. A porta **3306** não é usada pelo Nexus e pode estar ocupada por
outro MySQL.

### 3.4 Firewall

O bootstrap recria cinco regras de entrada (`Set-NexusFirewallRules`); o `smoke.ps1` valida
nome, direção, ação, porta e `LocalSubnet`; o `desinstalar.ps1` as remove.

| Regra | Porta | Ação | Escopo |
| --- | --- | --- | --- |
| `Nexus HTTP` | `80` | **Allow** | `LocalSubnet` |
| `Nexus HTTPS` | `443` | **Allow** | `LocalSubnet` |
| `Nexus MySQL (LAN)` | `3214` | **Block** | `LocalSubnet` |
| `Nexus Next (LAN)` | `3000` | **Block** | `LocalSubnet` |
| `Nexus Agent (LAN)` | `3215` | **Block** | `LocalSubnet` |

As regras são de **entrada**, perfil `Any`. O acesso ao sistema é somente por 80/443; a 3214,
a 3000 e a 3215 ficam bloqueadas para a sub-rede. Se as estações estiverem fora do
`LocalSubnet`, as regras precisam ser revistas.

---

## 4. Pré-requisitos

- Windows **64 bits** (10/11 ou Server compatível), com Windows PowerShell 5.1.
- **PowerShell elevado** para instalar, atualizar, desinstalar e restaurar.
- Pelo menos **5 GB livres em `C:`** (o payload ocupa ~408 MB e o MySQL cresce depois).
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

## 5. Instalação pelo instalador (`NexusSetup-1.08.11.2026.exe`)

### 5.1 O que o wizard pergunta

1. Verifica se o Windows é **64 bits**; se não for, aborta.
2. Pede o **hostname** (nome DNS), com valor inicial `nexus.galpao.local`. Aceita apenas
   letras, números, ponto e hífen; converte para minúsculas.
3. Pede as **credenciais do MySQL**: senha do root e do `nexus_app`, cada uma com
   confirmação. Em uma **instalação nova** (sem `C:\ProgramData\Nexus\config\backup.cnf`),
   as quatro senhas são obrigatórias. Em **upgrade** (com `backup.cnf`), deixar os quatro
   campos vazios reutiliza as credenciais atuais; se qualquer campo for preenchido, os
   quatro são obrigatórios. O `nexus_app` é validado no wizard com a mesma regra do
   bootstrap e o root só não pode ser vazio. Não há console nem prompt de senha.
4. Permite marcar o ícone na **Área de Trabalho** (opcional). O diretório é fixo:
   `C:\Program Files\Nexus\Instalador`.
5. Ao concluir os arquivos, `CurStepChanged(ssPostInstall)` executa o
   `bootstrap.ps1` **diretamente**, com `-NoPrompt`, `-ProgressFile` em `{tmp}` e, quando
   há senhas, `-CredentialsFile` em `{tmp}` (UTF-8 sem BOM, ACL restrita). O bootstrap roda
   oculto e grava o progresso; o wizard mostra uma **janela modal com barra e fase atual**,
   lendo o INI a cada 500 ms. A janela não fecha por Alt+F4 (`OnCloseQuery`/`ProgressAllowClose`);
   ela fecha quando o bootstrap termina e interrompe após **60 s sem progresso inicial**
   (`ProgressSeen`/`ProgressNeverStarted`) ou **2 h no total** (`ProgressTicks`). Ao final, os
   arquivos temporários são apagados.
6. Em falha, o wizard mostra o código e o caminho dos logs; em sucesso, a página final é
   personalizada com `https://<hostname>`.

O `.iss` **não usa `[Run]`** e **não tem `[UninstallDelete]`**: instalação e desinstalação
ficam no `[Code]`, para checar o `ResultCode`. O bootstrap grava
`C:\ProgramData\Nexus\logs\bootstrap-<timestamp>.log`; o Inno registra o próprio log em
`%TEMP%\Setup Log*.txt`. Não existe mais `instalar-gui.ps1` nem `instalador-*.log`.

O setup não baixa nada. O payload é copiado para `Instalador\payload` e o SQL também para
`Instalador\sql`.

### 5.2 Fases do bootstrap

| Fase | O que faz |
| --- | --- |
| **0 — Pré-checagem offline** | confere Administrador, payload obrigatório, 64 bits, 5 GB livres, portas 3214/3000/80/443; cria entrada no `hosts` se o hostname não resolver; **não acessa a internet** |
| **1 — Runtime embutido** | instala VC++ (se ausente), extrai Node 24.19.0 para `C:\Program Files\Nexus\node`, reaproveita NSSM 2.24/Caddy 2.11.9 se já estão na versão do payload (senão para e reinicia `NexusCaddy`/`NexusApp` antes de copiar) |
| **2 — MySQL dedicado** | usa as credenciais da página do wizard (ou o `backup.cnf` no upgrade) e chama `instalar-mysql.ps1`: extrai MySQL 8.4.13, migra o `Data` legado, grava `C:\ProgramData\Nexus\mysql\my.ini`, cria/reconfigura `NexusMySQL84` na 3214; depois o `pos-instalacao-mysql.ps1` cria `nexus_prod`/`nexus_app` e o bootstrap grava o `backup.cnf` |
| **3 — Diretórios e ACLs** | cria `ProgramData\Nexus\{mysql,uploads,logs,backups,config,caddy}`, aplica ACLs restritas, gera o `Caddyfile` e cria as cinco regras de firewall |
| **4 — Banco e aplicação** | para o Caddy e o App; extrai `app.zip` em `C:\Program Files\Nexus\app` (preserva `.env`), grava/atualiza o `.env`, aplica o SQL de produção (`aplicar-sql.ps1`, modo Auto) e ajusta o cache |
| **5 — Serviços** | configura `NexusApp` (`node.exe server.js`, env, dependência do MySQL) e `NexusCaddy`; valida health local, inicia o Caddy, instala a CA com `certutil` e valida HTTPS |
| **6 — Agente, bandeja e backup** | copia `backup.ps1`/`common.ps1`/`restart.ps1`/`iniciar-nexus.ps1`/`encerrar-nexus.ps1`/`abrir-bandeja.vbs`; copia `NexusAgent.exe` para `Program Files\Nexus\NexusAgent`, gera/preserva `config\agent.secret`, grava `AGENT_SECRET`/`AGENT_URL` no `.env`, publica `caddy\progresso\index.html`, cria/atualiza o serviço `NexusAgent` (`LocalSystem`, automático, sem dependência), bloqueia a 3215 na LAN, remove a tarefa `NexusBackup` e valida `/v1/health`; copia o tray .NET 10, grava `tray.json` (três serviços e scripts de liga/desliga) e registra/inicia `NexusTray` no logon do usuário; **sem watchdog** |
| **7 — Smoke e resumo** | roda o `smoke.ps1` com a versão do `package.json` do app e imprime URL, caminhos, versão e o comando de atualização |

O estado fica em `C:\ProgramData\Nexus\bootstrap.state.json`. A instalação é idempotente e
retomável com `-Resume`; se o hostname mudar, o bootstrap recusa continuar sem `-Force`.

O wizard chama o bootstrap com `-Hostname`, `-TrayExe`, `-ProgressFile`, `-NoPrompt` e,
quando as senhas foram preenchidas, `-CredentialsFile`. O `-ProgressFile` recebe
`[progress] step=0..8`, `done=0|1` e `exit=0|1`; `-CredentialsFile` é o único transporte das
senhas (nunca a linha de comando). O `-NoPrompt` faz o bootstrap falhar rápido, com mensagem
clara, se precisar de uma senha que não recebeu.

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

**Senhas:** as senhas do root e do `nexus_app` vêm da página de credenciais do wizard, são
entregues ao bootstrap por um arquivo temporário e nunca aparecem na linha de comando nem
nos logs. Em um upgrade com `backup.cnf` válido, deixar os quatro campos vazios reutiliza as
credenciais atuais; se o `backup.cnf` não conectar (ou o serviço/banco precisar ser criado),
o bootstrap não pede senha no console (roda com `-NoPrompt`) e falha com mensagem clara —
execute o setup novamente preenchendo as senhas. Não há pausa para instalar o MySQL.

> **Atenção:** `C:\ProgramData\MySQL\MySQL Server 8.4` é o caminho do MySQL antigo (10.02) e
> pode coincidir com uma instalação MySQL 8.4 comum. Não rode o Nexus nessa máquina sem
> backup/isolamento da instância existente. Ver §15.

### 5.4 SQL de produção, seed e migração

Em uma instalação nova, o banco é criado vazio pelo `pos-instalacao-mysql.ps1`; em um upgrade
o banco existente é reutilizado. O `bootstrap` chama o
[`aplicar-sql.ps1`](../../deploy/windows/aplicar-sql.ps1) com `-Mode Auto`:

- **Fresh** (banco sem tabelas): aplica `schema.sql` (DDL completo, 49 tabelas) e
  `seed.sql`;
- **Update** (banco com tabelas, como no 10.02): aplica todas as migrações de
  `migracoes\*.sql` em ordem (001, 002, ...) e depois `seed.sql`.

O SQL usa `mysql.exe` com `--defaults-extra-file` (senha nunca em `-p`). Ao final valida:

- **89 permissões**;
- **2 perfis** (`Operador` e `Auxiliar`);
- **3 conversões** `UNIDADE` (fator 1, padrão), `PCT10` (10) e `CX50` (50).

A migração 001 renomeia `PACOTE`→`PCT10` e `CAIXA`→`CX50`, preservando `ID_conversao` e os
vínculos de produto. A migração 002 cria o cadastro `tipo_destinatario`, adiciona
`destinatario.ID_tipo_destinatario` (opcional), mapeia o enum antigo pelo código, cria a FK
`ON DELETE SET NULL` e remove a coluna enum. Ambas são idempotentes e rodam antes do seed. O
seed é idempotente e não cria usuários, produtos, pedidos nem dados operacionais.

> ⚠️ **A migração 002 é irreversível.** Ela remove a coluna enum `destinatario.tipo_destinatario`;
> depois disso, o rollback do `atualizar.ps1` (que restaura **somente o app**) não devolve o
> schema anterior — a aplicação antiga não funciona sobre o banco já migrado. Se precisar
> voltar, restaure o **backup do banco**. Por isso, garanta o dump antes de rodar
> `aplicar-sql.ps1` (o `atualizar.ps1` já roda o `backup.ps1` antes de alterar; em execução
> manual, faça o backup primeiro).
>
> Em **banco de desenvolvimento** que já tenha destinatários, rode a migração 002 **antes** do
> `prisma db push` (`npm run db:push`): o `db push` recria a coluna do enum vazia e a
> classificação existente se perde.

`Fresh` recusa sobrescrever banco com tabelas; `Update` não recria tabelas. Mudanças de schema
em releases futuras exigem uma **nova migração** — ver §15.

### 5.5 Aplicação standalone e serviço `NexusApp`

O `app.zip` contém `server.js` na raiz, `.next/static`, `public` sem `uploads`, `node_modules`
e o client Prisma. O pacote inclui `node_modules/sharp` e `node_modules/@img` **completos**,
inclusive as DLLs do libvips (`libvips-42.dll`); o rastro do Next sozinho perde essas DLLs e o
app instalado falha com `ERR_DLOPEN_FAILED`. Ao parar/iniciar o `NexusApp`, os scripts de
`common.ps1` liberam a porta 3000 de um node órfão do Nexus (nunca de outro processo) antes de
subir o serviço, evitando o serviço `Paused`. O bootstrap para o `NexusCaddy`, move a aplicação anterior para
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
AGENT_SECRET="<segredo do agente>"
AGENT_URL=http://127.0.0.1:3215
```

O serviço `NexusApp` executa **`C:\Program Files\Nexus\node\node.exe server.js`**, com
`AppDirectory` `C:\Program Files\Nexus\app`, as mesmas variáveis no ambiente do NSSM e
`NEXT_TELEMETRY_DISABLED=1`. **Não usa `next start`** e não precisa de Node global/PATH.

O setup também instala a bandeja **.NET 10** em `C:\Program Files\Nexus\NexusTray` e os
scripts `iniciar-nexus.ps1`/`encerrar-nexus.ps1` em `C:\Program Files\Nexus\scripts`. A
bandeja é auxiliar: o app e os serviços não dependem dela para subir.

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
  -Hostname nexus.galpao.local -ExpectedVersion 1.08.11.2026
```

O smoke confere:

- Node portátil `v24.19.0` e `mysqld.exe` embutido;
- serviços `NexusMySQL84`, `NexusApp`, `NexusCaddy` e `NexusAgent`;
- porta **3214** e `/v1/health` do agente (`status=ok` com o segredo);
- ausência da tarefa `NexusBackup`;
- ACLs de `backups`, `config` e `app\.env` sem `BUILTIN\Users`;
- as cinco regras de firewall;
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
| `-SkipTray` | não copia/registra a bandeja; a fase 6 continua e instala/atualiza o `NexusAgent` |
| `-TrayExe` | caminho explícito do `NexusTray.exe`; se informado e ausente, falha |
| `-RootPassword` / `-AppPassword` | `SecureString` opcional; se ausentes, o console pede |
| `-CredentialsFile` | arquivo UTF-8 sem BOM com `root=<senha>` e `app=<senha>`; substitui a leitura no console e é apagado ao final |
| `-ProgressFile` | INI de progresso (`[progress] step=0..8, done=0|1, exit=0|1`); opcional |
| `-NoPrompt` | não abre `Read-Host`; sem as senhas, falha com mensagem clara (usado pelo instalador) |
| `-Force` | ignora o estado e reinstala sobre o diretório existente |

Na instalação manual, **sem** `-CredentialsFile` e **sem** `-NoPrompt`, o bootstrap continua
pedindo as senhas no console com `Read-Host -AsSecureString`. O `-ProgressFile` também é
opcional: sem ele, nada é gravado e o andamento aparece no console.

O bootstrap **não aceita `-Tag`, `-RepoUrl`, Git ou download**: a versão vem do `app.zip` do
payload. Sem payload, a fase 0 falha. A fase 6 também exige o `NexusAgent.exe`
(`NexusAgent\dist\NexusAgent.exe`, gerado por `NexusAgent\build.ps1`) e
`progresso\index.html` ao lado do `bootstrap.ps1`; sem eles a instalação para ali com mensagem
clara. Logs em `C:\ProgramData\Nexus\logs\bootstrap-<timestamp>.log`.

---

## 7. Atualização

### 7.1 Upgrade 10.02 → 1.07 (troca de runtime)

A mudança de 10.02 para 1.07 instala Node portátil, troca o MySQL para o `Data` em
`C:\ProgramData\Nexus\mysql`, aplica o SQL e cria os serviços. Use o
**`NexusSetup-1.07.11.2026.exe`** (ou o `bootstrap.ps1` com o payload):

1. Faça backup do banco/uploads e copie para fora do servidor.
2. Rode o setup em PowerShell elevado, com a janela visível.
3. Confirme o hostname; o bootstrap instala/migra o MySQL, aplica as migrações + seed e
   reconfigura os serviços.
4. Valide com `smoke.ps1` e o primeiro acesso.

O upgrade real 10.02→1.07 foi validado na máquina de teste: health 1.07, HTTPS 200, os três
serviços `Running`, bandeja presente e contagens **89 permissões / 2 perfis / 3 conversões**
(a base antiga tinha 82; entram 3 permissões `tipo_destinatario.*` e 4 `backup.*` pelo seed).

O bootstrap não sobrescreve `nssm.exe`/`caddy.exe` em uso quando o hash/versão já confere
(caminho normal do upgrade); em divergência, para e reinicia os serviços antes da cópia. Se a
fase 1 falhar, os serviços são reiniciados e o wizard mostra o código e os logs.

### 7.2 Atualização de aplicação/SQL por pacote

Para uma instalação já em 1.07, use o `atualizar.ps1` com um pacote (sem Git):

```text
<pacote>\
├── app\app.zip        (ou app.zip na raiz)
└── sql\
    ├── schema.sql
    ├── seed.sql
    └── migracoes\
        ├── 001-unidades-pct10-cx50.sql
        └── 002-tipos-destinatario.sql
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
6. aplica o SQL (`Auto`: todas as migrações em ordem + seed em banco existente) com `nexus_app`;
7. ajusta ACLs, inicia o app, valida health, HTTPS e `smoke.ps1`;
8. mantém a versão anterior e mais uma `app.prev-*`.

Log: `C:\ProgramData\Nexus\logs\deploy-<versão>.log`.

**Não atualiza** Node, MySQL, Caddy, NSSM, scripts, bandeja, **NexusAgent** nem firewall — o
pacote só contém `app.zip` e SQL. O agente de backup é atualizado apenas pelo
setup/`bootstrap.ps1`. Para trocar runtimes ou corrigir firewall, use o setup/`bootstrap.ps1`.

Em falha, o app anterior é restaurado e a versão nova fica em `app.failed-<versão>`; o banco
**não** é restaurado automaticamente. O `atualizar.ps1` não atualiza o `bootstrap.state`; o
rollback restaura apenas a aplicação — runtimes e scripts/configuração do setup permanecem
como estão. **Depois da migração 002** (que remove a coluna enum), esse rollback de app não
basta: a versão anterior não opera sobre o banco migrado e é preciso **restaurar o backup do
banco** feito antes da atualização.

### 7.3 Reinstalar pelo setup

Rodar o `NexusSetup` sobre uma instalação existente executa o bootstrap novamente (fases
0–7), preserva o `.env` e reconfigura runtime, MySQL, bancos, serviços, firewall e bandeja.
Ele **não faz backup automático** e não tem o rollback do `atualizar.ps1`; faça backup manual
antes. É o caminho para migrar de 10.02, trocar versão de Node/MySQL/Caddy ou recuperar
serviços.

---

## 8. Backup e restauração

O backup deixou de ser uma tarefa agendada: quem executa é o serviço **NexusAgent**, com uma
API local que o app consome pela **engrenagem da topbar (Backup)**. O `backup.ps1` continua sendo o
executor do dump e dos uploads.

### 8.1 Serviço `NexusAgent` e API local

- `NexusAgent.exe` fica em `C:\Program Files\Nexus\NexusAgent\NexusAgent.exe`, roda como
  **`LocalSystem`** (início automático, sem dependência do MySQL) e reinicia em falha. Foi
  criado por `sc.exe` no bootstrap — **não** é gerenciado pelo NSSM.
- A API escuta **somente** `http://127.0.0.1:3215` (sem HTTPS). Todas as rotas `/v1/*` —
  inclusive `/v1/health` — exigem `Authorization: Bearer <segredo>`; o segredo é
  `C:\ProgramData\Nexus\config\agent.secret` (48 bytes, só Administrators/SYSTEM leem) e é
  comparado em tempo constante.
- Rotas:

  | Método | Rota | Uso |
  | --- | --- | --- |
  | `GET` | `/v1/health` | `{ status, version, mysql, agentDir }` |
  | `GET` | `/v1/status` | job atual, último concluído e agenda |
  | `POST` | `/v1/backup` | inicia o backup imediatamente (`requestedBy`) |
  | `POST` | `/v1/restore` | inicia a restauração (`fileName`, `includeUploads`, `requestedBy`) |
  | `GET` | `/v1/jobs?limit=50` | histórico (mais recente primeiro) |
  | `GET` | `/v1/jobs/{id}` | job com `steps[]` |
  | `GET` | `/v1/backups` | manifesto dos dumps disponíveis |
  | `GET`/`PUT` | `/v1/schedule` | lê/grava a agenda |

- **Um job por vez**: um segundo pedido responde **409** com o job ativo. O histórico fica em
  `C:\ProgramData\Nexus\agent\jobs.json` (até **100** jobs) e o andamento em
  `C:\ProgramData\Nexus\caddy\progresso\status.json` (atômico, sem segredos).
- Se o serviço reiniciar no meio de uma operação, o job `QUEUED`/`RUNNING` do histórico vira
  **`FAILED`** (“interrompido pelo reinício do serviço”) e o `status.json` recebe `done:true`;
  a UI para de consultar após 10 ciclos se o job monitorado desaparecer.
- O app lê `AGENT_SECRET`/`AGENT_URL` do `.env` no start. O bootstrap grava as duas variáveis
  na fase 6 e reinicia o `NexusApp`; um `.env` antigo sem elas mostra “agente indisponível” até
  o próximo setup/restart.

### 8.2 Agenda

A agenda fica em `C:\ProgramData\Nexus\agent\schedule.json`:

```json
{ "enabled": true, "time": "02:00", "weekdays": [0,1,2,3,4,5,6], "retentionDays": 30, "includeUploads": true }
```

- O agente verifica a cada **30 s**, no fuso `America/Sao_Paulo`, e dispara quando o horário
  passa em um dia marcado e ainda **não houve backup `SUCCESS` naquele dia**.
- Se a tentativa agendada falhar, o dia continua sem backup: a nova tentativa espera **30 min**
  em vez de repetir a cada verificação.
- `retentionDays` aceita **1–365**, `weekdays` não pode repetir dia e `time` é `HH:mm`.
- A agenda é editável pela **engrenagem da topbar (Backup)** (`backup.agendar`) e substitui a antiga
  tarefa `NexusBackup`, que o bootstrap remove. Se o horário passar com a máquina desligada, o
  backup daquele dia **não** é recuperado.

### 8.3 Backup pela UI, progresso e manual

**Engrenagem da topbar → Backup** (`/administracao/backup`):

- a tela exige `backup.listar`; **Executar backup** exige `backup.executar`, a agenda exige
  `backup.agendar` e a restauração exige `backup.restaurar` (são 4 permissões `backup.*`);
- a página lê o agente no servidor (`src/lib/agent.ts`); agente fora do ar não derruba a tela,
  que mostra o aviso e o último estado conhecido;
- a solicitação de backup (`SOLICITAR_BACKUP`), a mudança de agenda (`ALTERAR_AGENDA`) e a
  restauração (`RESTAURAR`) entram em `registro_auditoria` com o usuário e os dados antes/depois.

Depois de iniciar um job, a UI leva para **`https://<hostname>/progresso/`**: página estática
(`progresso\index.html`) servida pelo Caddy a partir de `C:\ProgramData\Nexus\caddy\progresso`,
com barra, passos e mensagem, lendo `status.json` a cada 1 s. Ao terminar, redireciona para
`/administracao/backup` (sucesso) ou mostra o erro. O Caddy **não** é parado durante a
restauração — é ele que mantém a página no ar.

Pela bandeja (**Fazer backup agora**) ou em PowerShell elevado, a partir de
`C:\Program Files\Nexus\Instalador`:

```powershell
.\backup.ps1                 # retenção padrão de 30 dias
.\backup.ps1 -RetentionDays 60
.\backup.ps1 -SkipUploads    # não copia uploads
```

O backup manual precisa ser elevado porque lê `C:\ProgramData\Nexus\config\backup.cnf`, que
só Administrators/SYSTEM acessam. `-AgentProgress` (linhas `##PROGRESS`) e `-RequireMysql`
(falha com MySQL parado em vez de sair 0) são usados **pelo agente**; sem eles, o script mantém
o comportamento antigo da bandeja/console. `-NoRetention` preserva dumps, configurações e
snapshots de uploads — o agente o usa no **backup de segurança** que antecede a restauração,
para a retenção não apagar o backup escolhido.

### 8.4 O que é gerado

| Item | Destino | Formato |
| --- | --- | --- |
| Banco `nexus_prod` | `C:\ProgramData\Nexus\backups\db\nexus_prod-<timestamp>.zip` | `mysqldump` **do binário dedicado** na 3214, compactado; `.sql` intermediário apagado |
| Banco grande | `...\backups\db\nexus_prod-<timestamp>.sql` | acima de ~1,8 GB o `.sql` é mantido sem compactar |
| Uploads | `C:\ProgramData\Nexus\backups\uploads\<timestamp>\` | `robocopy /E` em um snapshot por backup, com o mesmo timestamp do dump |
| Marcador de backup | `...\backups\db\nexus_prod-<timestamp>.zip.incomplete` (ou `.sql.incomplete`) | criado antes do dump e removido só no sucesso final; enquanto existir, o arquivo não aparece em `/v1/backups` nem pode ser restaurado |
| `.env` | `...\backups\config\.env-<timestamp>` | cópia com ACL restrita |
| `Caddyfile` | `...\backups\config\Caddyfile-<timestamp>` | cópia com ACL restrita |
| Log | `C:\ProgramData\Nexus\logs\backup-<timestamp>.log` | transcript |

Em `backups\config` também ficam os `my.ini-<timestamp>.bak` criados pelo pós-instalação.
O `backup.ps1` usa o `mysqldump` do binário dedicado; se ele faltar, o `Find-MysqldumpExe`
tem fallback para uma instalação 8.0/8.4 padrão, mas a conexão continua na 3214. O
`backup.ps1` exige `backup.cnf` na porta **3214**; se a porta estiver diferente, aborta
pedindo a fase 2 do bootstrap.

### 8.5 Retenção e verificação

A retenção remove, por `LastWriteTime`, `*.zip`/`*.sql` de `backups\db`, `.env-*`/
`Caddyfile-*` de `backups\config` e os snapshots `backups\uploads\<timestamp>` mais antigos
que `RetentionDays`. Um snapshot de uploads **sem dump correspondente** é órfão e pode ser
podado em qualquer idade; o marcador `.incomplete` acompanha o dump e é removido junto. O
inverso **não** é podado: um dump sem snapshot é legítimo (`-SkipUploads`) e permanece.
O diretório **legado** `backups\uploads` (arquivos soltos na raiz, de versões anteriores)
**não** é podado — apague-o manualmente quando não precisar mais dele.
`-NoRetention` desliga a poda por completo (o backup de segurança do restore usa esse modo).

> **Atenção:** a retenção **não** poda os `my.ini-*.bak`. Dumps grandes ficam como `.sql` sem
> compactação. Copie os backups para fora do servidor. Ver §15.

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

### 8.6 Restauração

> A restauração **substitui o banco e os uploads** e derruba o `NexusApp` por alguns minutos.
> O `NexusMySQL84` e o `NexusCaddy` continuam no ar (é o Caddy que serve `/progresso/`).

**Pela UI (recomendado)** — **engrenagem da topbar (Backup)**:

1. exige `backup.restaurar`; escolha um arquivo do manifesto, marque **incluir uploads** e
   digite `RESTAURAR` + a própria senha (revalidada no servidor);
2. a auditoria `RESTAURAR` é gravada **antes** de chamar o agente, porque o app pode encerrar
   durante a operação;
3. o agente **copia o arquivo escolhido** para `agent\tmp\restore-<job>` e **valida** o dump
   (`.zip` com um `.sql` legível e não vazio, ou `.sql` não vazio) antes de tocar em qualquer
   coisa; se for inválido, a restauração é cancelada e o app continua no ar;
4. se **incluir uploads**, o backup precisa ter o snapshot `backups\uploads\<timestamp>`; sem
   ele o pedido é **recusado com 400** (e a UI desabilita a opção) antes de parar o app;
5. o agente faz um **backup de segurança obrigatório** (banco + uploads) com `-NoRetention`
   antes de parar o app — a poda não pode apagar o arquivo escolhido; se ele falhar, a
   restauração é cancelada e o app continua no ar;
6. para **somente o `NexusApp`** (até 60 s) e mantém o Caddy servindo o progresso;
7. banco: o dump é lido da cópia de trabalho, `.zip` aberto em streaming,
   `CREATE DATABASE`/`USE` descartados e o `.sql` vai para o `mysql.exe` com
   `--defaults-extra-file=backup.cnf` (usuário `nexus_app`) em `nexus_prod`; se o `mysql.exe`
   falhar, o **backup de segurança é restaurado automaticamente** (rollback) antes de religar
   o app; se o rollback também falhar, o job termina `FAILED` com mensagem **crítica**;
8. uploads (quando marcado): `robocopy /MIR` de `backups\uploads\<timestamp>` para `uploads`,
   voltando ao ponto daquele backup (nunca o snapshot de outro backup);
9. inicia o `NexusApp` e espera o health **`db=true`** por até **180 s**; em qualquer falha o
   app é religado e o job termina `FAILED` com a mensagem. O `NexusCaddy` só é garantido no ar
   se já estava `Running` antes da operação; se estava parado de propósito, continua parado;
10. **`.env` e `Caddyfile` não são restaurados** pelo agente (ficam fora do escopo) — use o
    procedimento manual abaixo se precisar voltá-los;
11. **a auditoria volta ao ponto do backup**: `registro_auditoria` está em `nexus_prod` e é
    substituído pelo dump, então o próprio registro `RESTAURAR` some. A trilha da operação fica
    em `agent\jobs.json`, `caddy\progresso\status.json` e no log `restore-<timestamp>.log`
    (`C:\ProgramData\Nexus\logs`).

**Manual (emergência)** — em **PowerShell elevado**:

> O dump foi feito com `--databases nexus_prod`, então contém `CREATE DATABASE`/`USE
> nexus_prod`; a importação **substitui as tabelas do dump**. Tabelas criadas depois do dump e
> que não estão nele permanecem.

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

5. Restaure os uploads do snapshot daquele backup (o `/MIR` remove o que não existe no
   snapshot — comportamento desejado para voltar ao ponto do dump):

   ```powershell
   robocopy "C:\ProgramData\Nexus\backups\uploads\20261107-020000" "C:\ProgramData\Nexus\uploads" `
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

### 8.7 Restauração em banco de teste

Use **outra instância MySQL** (porta 3307 ou uma VM) e importe o dump; na instância de teste,
o `CREATE DATABASE nexus_prod`/`USE nexus_prod` cria o banco local dela. Aponte um `.env` de
desenvolvimento para essa instância e rode a aplicação localmente. Nunca aponte o teste para
o `nexus_prod` de produção; se precisar do mesmo servidor, edite o dump para outro nome.

---

## 9. Bandeja (`NexusTray`)

Executável **.NET 10** self-contained em `C:\Program Files\Nexus\NexusTray\NexusTray.exe`,
com instância única (mutex global) e `tray.json` ao lado. A bandeja é **auxiliar**: liga e
desliga o Nexus, mas não é pré-requisito para os serviços, que são **Automatic** e sobem com
o Windows.

### 9.1 Estados

| Ícone | Estado | Condição |
| --- | --- | --- |
| verde | em execução | os três serviços rodando e health 200 com `status=ok` e `db=true` |
| amarelo | degradado | `NexusApp` rodando, health responde, mas sem `ok`/`db=true` (ex.: banco fora) |
| vermelho | fora do ar | algum serviço parado/não instalado ou health inacessível |
| cinza | parado intencionalmente | os três parados e `nexus-state.json` com `nexusStopped=true` |

Polling a cada **20 s**; a transição gera balão. Tooltip: `Nexus — estado · v<versão>`.

O estado fica em `C:\ProgramData\Nexus\config\nexus-state.json`:

```json
{ "nexusStopped": true, "updatedAt": "2026-11-07T14:07:00.0000000-03:00" }
```

A bandeja só usa `nexusStopped` quando os **três** serviços estão parados; se algum estiver
rodando, o estado real vence (estado antigo é ignorado).

### 9.2 Menu

| Item | Ação |
| --- | --- |
| **Iniciar Nexus** | habilitado quando nem tudo está rodando; executa `iniciar-nexus.ps1` (MySQL → App → Caddy, health) |
| **Abrir Nexus** | só com os três serviços rodando e health ok; abre `https://<hostname>` via `explorer.exe` |
| **Status** | `MySQL ... · App ... · Caddy ... · Banco ... · v...` (desabilitado) |
| **Reiniciar aplicação** | só com tudo rodando; executa `restart.ps1` (para o Caddy, reinicia o App, espera health, inicia o Caddy) |
| **Fazer backup agora** | só com tudo rodando; executa `backup.ps1` |
| **Abrir logs** | abre `C:\ProgramData\Nexus\logs` |
| **Abrir pasta de dados** | abre `C:\ProgramData\Nexus` |
| **Fechar bandeja** | com qualquer serviço rodando pede confirmação e executa `encerrar-nexus.ps1`; com tudo parado fecha direto |

Não existe mais **Sair**: o único fechamento é **Fechar bandeja**, com a regra abaixo.

### 9.3 Fechar a bandeja e encerrar o Nexus

- **Com qualquer serviço rodando**, `MessageBox` Yes/No (padrão **Não**): “Fechar a bandeja e
  encerrar o Nexus? Isso vai parar o Node, o Caddy e o MySQL agora. Para abrir de novo, use o
  atalho Bandeja do Nexus na Área de Trabalho.”
  - **Não** → a bandeja permanece aberta.
  - **Sim** → `encerrar-nexus.ps1` para **Caddy → App → MySQL**; se exit 0, a bandeja fecha;
    se falhar, mostra o erro e **não** fecha.
- **Com tudo parado** → fecha direto, sem confirmação e sem executar script.
- **Decisão 1A:** os serviços continuam **Automatic** e voltam no próximo boot. O
  `encerrar-nexus.ps1` **não** muda o start type para Manual.
- O atalho **Bandeja do Nexus** na Área de Trabalho executa `abrir-bandeja.vbs` com
  `wscript.exe`; o `.vbs` roda a tarefa agendada `NexusTray` oculta, **sem UAC** e **sem
  iniciar serviços**. O atalho **Nexus** continua abrindo o site.
- O alvo do atalho continua sendo `wscript.exe` **de propósito**: a tarefa `NexusTray` roda
  elevada (`RunLevel Highest`), então abrir o `.exe` direto pediria UAC. Como o alvo não é o
  executável, o ícone do Nexus no atalho vem de `NexusTray.ico` (copiado para `{app}` pelo
  setup); o mesmo `.ico` é embutido no `NexusTray.exe` por `<ApplicationIcon>`, gerado de
  `public/logo.svg` com `node scripts/gerar-icone-tray.mjs` (16, 24, 32, 48, 64, 128 e 256).

### 9.4 `tray.json`

```json
{
  "baseUrl": "https://nexus.galpao.local",
  "healthUrl": "http://127.0.0.1:3000/api/health",
  "serviceName": "NexusApp",
  "mysqlService": "NexusMySQL84",
  "caddyService": "NexusCaddy",
  "nssmPath": "C:\\Program Files\\Nexus\\tools\\nssm\\nssm.exe",
  "logsDir": "C:\\ProgramData\\Nexus\\logs",
  "dataDir": "C:\\ProgramData\\Nexus",
  "backupScript": "C:\\Program Files\\Nexus\\scripts\\backup.ps1",
  "restartScript": "C:\\Program Files\\Nexus\\scripts\\restart.ps1",
  "stopScript": "C:\\Program Files\\Nexus\\scripts\\encerrar-nexus.ps1",
  "startScript": "C:\\Program Files\\Nexus\\scripts\\iniciar-nexus.ps1",
  "stateFile": "C:\\ProgramData\\Nexus\\config\\nexus-state.json"
}
```

Se faltar ou estiver inválido, a bandeja usa os padrões do código (já apontam para
`C:\Program Files\Nexus\scripts`). Mantenha o arquivo para preservar os caminhos.

### 9.5 Limitações

- Registrada no **logon do usuário que instalou**, com `RunLevel Highest`; outros usuários
  não a veem.
- `requireAdministrator`; abrir diretamente o `.exe` sem elevação pede UAC. O atalho
  **Bandeja do Nexus** não pede UAC porque usa a tarefa `NexusTray` já registrada.
- **Sem watchdog**: se a bandeja fechar ou cair, o Nexus continua; reabra pelo atalho.
- O `restart.ps1` afeta **Caddy e App**; se o App não voltar ao health, o Caddy fica parado
  até intervenção. O `NexusMySQL84` **não** é reiniciado por ele.
- **Fechar a bandeja** encerra os três serviços **agora**, mas eles continuam Automatic e
  voltam no próximo boot; não há auto-login obrigatório.
- Falhas fatais vão para `%LOCALAPPDATA%\NexusTray\tray.log` (do usuário).

---

## 10. Health check e smoke test

### 10.1 `GET /api/health`

Rota pública (`src/proxy.ts`), `force-dynamic`, runtime Node:

```json
{ "status": "ok", "db": true, "versao": "1.08.11.2026" }
```

- HTTP **200** quando `SELECT 1` responde;
- HTTP **503** com `{"status":"degraded","db":false,"versao":"..."}` quando o banco não
  responde; sem stack/credencial;
- `versao` vem de `NEXT_PUBLIC_APP_VERSION`, definida no build a partir do `package.json`.

### 10.2 `smoke.ps1`

```powershell
# PowerShell elevado; exemplo de versão
cd "C:\Program Files\Nexus\Instalador"
.\smoke.ps1 -Hostname nexus.galpao.local -ExpectedVersion 1.08.11.2026
```

Confere Node portátil, `mysqld.exe`, os quatro serviços (`NexusMySQL84`, `NexusApp`,
`NexusCaddy` e `NexusAgent`), a porta 3214, as ACLs de `backups`/`config`/`app\.env`, as cinco
regras de firewall, o health com `db=true`, `https://<hostname>/login` e a versão. No agente,
chama `/v1/health` com o segredo de `config\agent.secret` e exige `status=ok`; também falha se
a tarefa legada `NexusBackup` ainda existir. **Não ignora erro de certificado**: o HTTPS exige
a CA do Caddy confiada. Saída `SMOKE: OK` (0) ou `SMOKE: FALHOU` (1). A bandeja é verificada
apenas como **aviso** (processo/tarefa `NexusTray`); ausência de sessão não falha o smoke.

### 10.3 Testes manuais

```powershell
Invoke-RestMethod http://127.0.0.1:3000/api/health | ConvertTo-Json
Invoke-WebRequest https://nexus.galpao.local/login -UseBasicParsing | Select-Object StatusCode
Get-Service NexusMySQL84, NexusApp, NexusCaddy, NexusAgent | Select-Object Name, Status, StartType
Get-ScheduledTask NexusTray | Select-Object TaskName, State
Get-ScheduledTask NexusBackup -ErrorAction SilentlyContinue   # deve ser vazio
$secret = (Get-Content C:\ProgramData\Nexus\config\agent.secret -Raw).Trim()
Invoke-RestMethod http://127.0.0.1:3215/v1/health -Headers @{ Authorization = "Bearer $secret" } | ConvertTo-Json
Get-Process NexusTray -ErrorAction SilentlyContinue
Get-Content C:\ProgramData\Nexus\config\nexus-state.json -ErrorAction SilentlyContinue
Get-NetFirewallRule -DisplayName "Nexus *" | Select-Object DisplayName, Enabled, Action
```

---

## 11. Solução de problemas

| Sintoma | Causa provável | O que fazer |
| --- | --- | --- |
| setup falha na fase 0 com "payload ausente" | `Instalador\payload` incompleto | gere o setup com `build-instalador.ps1` (que chama `preparar-payload.ps1`); confira `payload\node`, `mysql`, `caddy`, `vcredist`, `nssm`, `app\app.zip`, `sql` |
| wizard fica na janela de progresso sem avançar | bootstrap não iniciou, falhou antes de gravar o progresso ou ficou preso | confira `%TEMP%\Setup Log*.txt`, `C:\ProgramData\Nexus\logs\bootstrap-*.log` e `%TEMP%\nexus-fail.log`; a janela fecha após **60 s sem progresso inicial** (“O bootstrap não iniciou”) ou **2 h no total** |
| wizard recusa as senhas | campos incompletos, confirmação divergente ou `nexus_app` com caractere proibido | preencha os quatro campos (ou deixe todos vazios no upgrade); o `nexus_app` não aceita `@`, `/`, `?`, `#`, `"`, `\`, `;`, espaço/tab/controle |
| bootstrap falha pedindo senha em um upgrade com campos vazios | `backup.cnf` existe, mas não conecta ou o serviço/banco precisa ser criado | execute o setup novamente e preencha as quatro senhas (o bootstrap roda com `-NoPrompt`) |
| arquivo temporário de credenciais não pôde ser protegido | `icacls` falhou (ACL/política) | o setup aborta antes de iniciar o bootstrap; confira as permissões de `%TEMP%` e repita |
| `app.zip` inválido/`server.js` ausente | pacote standalone não foi gerado | rode `npm run build:standalone` e `npm run package:standalone`; o `empacotar-standalone.mjs` precisa de `.next/standalone`, `.next/static` e `server.js` |
| MySQL `NexusMySQL84` não inicia / 3214 fechada | `my.ini`, `Data` ou serviço | confira `C:\ProgramData\Nexus\mysql\my.ini`, o erro em `...\mysql\data\*.err`, `Get-Service NexusMySQL84` e `Test-NetConnection 127.0.0.1 -Port 3214`; restaure `my.ini-*.bak` |
| migração do Data não aconteceu | `C:\ProgramData\Nexus\mysql\data` já tinha conteúdo | o `instalar-mysql.ps1` só copia para destino vazio; faça backup e esvazie/renomeie o destino se for migrar |
| SQL falha em Fresh | banco já tem tabelas | use `-Mode Update` (migrações + seed) ou um banco vazio; confira `aplicar-sql.ps1` |
| SQL falha nas contagens | seed/migração incompletos ou banco divergente | rode `aplicar-sql.ps1` manualmente e confira 89 permissões, 2 perfis, 3 conversões (`PCT10`/`CX50`); veja o log |
| `NexusApp` não sobe | Node/`server.js`/`.env`/dependência MySQL | confira `C:\Program Files\Nexus\node\node.exe`, `app\server.js`, `app\.env` e `DATABASE_URL` na 3214; veja `app.err.log` |
| health 503 (`db=false`) | `NexusMySQL84` parado, senha/banco ausente | `Get-Service NexusMySQL84`; teste com `C:\Program Files\Nexus\mysql\bin\mysql.exe --defaults-extra-file="C:\ProgramData\Nexus\config\backup.cnf" -h 127.0.0.1 -P 3214 -D nexus_prod -e "SELECT 1"` |
| HTTPS falha/CA não confiada | Caddy/CA/ACL/hostname | veja `C:\ProgramData\Nexus\caddy\logs\caddy.err.log`; confira `certutil -addstore -f Root "C:\ProgramData\Nexus\caddy\data\caddy\pki\authorities\local\root.crt"` e o `hosts`/DNS |
| firewall ausente/divergente | bootstrap não aplicou ou política alterada | `Get-NetFirewallRule -DisplayName "Nexus *"`; reaplique com o bootstrap `-Force` (ou `New-NetFirewallRule`) e valide com `smoke.ps1` |
| smoke falha em ACL `BUILTIN\Users` | ACL herdada/alterada | rode `smoke`/bootstrap elevado; reaplique `Set-AclRestricted`/`Protect-File`; confira com `icacls` |
| atualização por pacote falha | `app.zip`/`sql` ausente, `server.js` ausente, health/smoke | confira o layout `app\app.zip` + `sql\`; veja `deploy-<versão>.log` e `app.failed-<versão>`; o banco não volta automaticamente |
| atualização de 10.02 para 1.07 não conclui | pacote de app não instala runtime/MySQL | use o **setup**/bootstrap 1.07; o `atualizar.ps1` só troca app+SQL |
| bandeja não aparece | tarefa de outro usuário/logon | `Get-ScheduledTask NexusTray`; abra pelo atalho **Bandeja do Nexus** ou rode o exe elevado; ela inicia no logon do usuário que instalou |
| **Iniciar Nexus** falha | serviço parado com dependência/porta/health | veja `iniciar-nexus-<timestamp>.log`, `app.err.log` e `Get-Service NexusMySQL84, NexusApp, NexusCaddy`; confira a 3214 e o health local |
| **Fechar bandeja** não encerra | script/serviço preso | veja `encerrar-nexus-<timestamp>.log`; a bandeja permanece aberta de propósito quando o script retorna != 0 |
| backup falha | `backup.cnf` ausente/porta errada/MySQL fora | confira a porta 3214 no `backup.cnf`; rode a fase 2 do bootstrap; veja `backup-<timestamp>.log` e o job em `C:\ProgramData\Nexus\agent\jobs.json` |
| backup deixou de rodar às 02:00 | serviço `NexusAgent` parado, agenda desabilitada ou tarefa `NexusBackup` removida (esperado) | `Get-Service NexusAgent`; valide a agenda em `/administracao/backup` ou em `agent\schedule.json`; veja `/v1/health` e `jobs.json` |
| `/administracao/backup` diz “agente indisponível” | serviço parado, segredo ausente/diferente ou `AGENT_SECRET` fora do ambiente do app | `Get-Service NexusAgent`; confira `config\agent.secret`; com o `.env` correto, reinicie o `NexusApp` para ele reler o arquivo |
| `/progresso/` responde 404/403 | `caddy\progresso` ausente, `index.html` ausente ou ACL sem `LocalService` | rode a fase 6 do bootstrap; confira `Set-AclRestricted`/`Protect-File` e reinicie o `NexusCaddy` |
| restauração cancela antes de começar | o backup de segurança obrigatório falhou | veja `backup-<timestamp>.log` e `restore-<timestamp>.log`; o app permanece no ar |
| restauração falha no banco | dump inválido, `backup.cnf`/porta errada ou `mysql.exe` ocupado | veja `restore-<timestamp>.log`; o app é religado e o backup de segurança de `backups\db` preserva o estado anterior |
| disco enche | uploads/my.ini antigos, `.sql` grande, `app.failed-*` | limpe `backups\uploads\<timestamp>`/`.sql` antigos e versões `app.failed-*` após conferir os backups |
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
| `%TEMP%\Setup Log*.txt` | log do próprio Inno Setup (`SetupLogging=yes`) |
| `%TEMP%\nexus-bootstrap-progress.ini` | progresso lido pelo wizard (apagado ao final) |
| `%TEMP%\nexus-fail.log` | última falha do bootstrap |
| `C:\ProgramData\Nexus\logs\deploy-*.log` | atualização por pacote |
| `C:\ProgramData\Nexus\logs\backup-*.log` | backup |
| `C:\ProgramData\Nexus\logs\restore-*.log` | restauração (agente) |
| `C:\ProgramData\Nexus\agent\jobs.json` | histórico dos jobs de backup/restauração |
| `C:\ProgramData\Nexus\agent\schedule.json` | agenda do backup |
| `C:\ProgramData\Nexus\logs\restart-*.log` | reinício pela bandeja |
| `C:\ProgramData\Nexus\logs\iniciar-nexus-*.log` | ligar o Nexus pela bandeja |
| `C:\ProgramData\Nexus\logs\encerrar-nexus-*.log` | fechar a bandeja/encerrar o Nexus |
| `C:\ProgramData\Nexus\logs\desinstalar-*.log` | desinstalação |
| `%LOCALAPPDATA%\NexusTray\tray.log` | falha fatal da bandeja |

---

## 12. Segurança

### 12.1 ACLs e segredos

O bootstrap remove a herança de `C:\ProgramData` e aplica ACLs explícitas:

| Caminho | Permissão |
| --- | --- |
| `C:\ProgramData\Nexus` (raiz) | Administrators (S-1-5-32-544) e SYSTEM (S-1-5-18) Full; **usuário que instalou: Modify** |
| `C:\ProgramData\Nexus\uploads` | `NetworkService` (S-1-5-20) `Modify` + Administrators/SYSTEM Full + **usuário que instalou: Modify** |
| `C:\ProgramData\Nexus\logs` | `NetworkService` `Modify` + Administrators/SYSTEM Full + **usuário que instalou: Modify** |
| `C:\ProgramData\Nexus\backups` e `config` | Administrators/SYSTEM Full + **usuário que instalou: Modify** |
| `C:\ProgramData\Nexus\mysql` e `mysql\data` | Administrators/SYSTEM Full + `NetworkService` `Modify` + **usuário que instalou: Modify** |
| `C:\ProgramData\Nexus\mysql\my.ini` | `NetworkService` somente leitura + Administrators/SYSTEM Full + **usuário que instalou: Modify** |
| `C:\ProgramData\Nexus\caddy\{data,config,logs}` | `LocalService` (S-1-5-19) `Modify` + Administrators/SYSTEM Full + **usuário que instalou: Modify** |
| `C:\ProgramData\Nexus\caddy\progresso` | `LocalService` somente leitura + Administrators/SYSTEM Full (o agente escreve `status.json` como SYSTEM) |
| `C:\ProgramData\Nexus\config\Caddyfile` | `LocalService` somente leitura + Administrators/SYSTEM Full + **usuário que instalou: Modify** |
| `C:\ProgramData\Nexus\config\agent.secret` | Administrators/SYSTEM Full; **nenhum outro** (nem `NetworkService`/`LocalService`; o app lê o valor do `.env`) |
| `C:\Program Files\Nexus\node` e `mysql` | `ReadAndExecute` para `NetworkService` |
| `C:\Program Files\Nexus\app\.env` | **continua restrito**: `NetworkService` somente leitura + Administrators/SYSTEM Full; **não** recebe o usuário da instalação |
| `C:\Program Files\Nexus\app` | `ReadAndExecute` para `NetworkService`; `.next\cache` com `Modify` |
| `C:\ProgramData\Nexus\config\backup.cnf` | Administrators/SYSTEM Full + **usuário que instalou: Modify**; **o app não lê** |

- O **usuário que instalou** é o dono do processo elevado
  (`[Security.Principal.WindowsIdentity]::GetCurrent().User.Value`, por exemplo
  `S-1-5-21-…-1001`), não `BUILTIN\Users`; ele recebe `Modify` na árvore de dados para
  operar backups, logs e configuração sem elevação.
- `NexusApp` e `NexusMySQL84` rodam como **NetworkService**; `NexusCaddy` como
  **LocalService**.
- `backup.cnf` guarda a senha do `nexus_app` e a porta 3214; quem o usa é o `bootstrap`
  (teste da fase 2), o `backup.ps1` (SYSTEM/elevado) e o `NexusAgent` (SYSTEM, no backup e na
  restauração).
- `agent.secret` é gerado com 48 bytes aleatórios na fase 6 e **preservado** nos upgrades; ele
  nunca é impresso em log, mensagem ou documento. O `.env` guarda uma cópia para o app
  (`AGENT_SECRET`) com leitura para `NetworkService`.
- `restore.cnf` (manual) tem a mesma proteção; apague após o uso.
- Arquivos temporários do MySQL/SQL nascem com `Protect-File`; erros do `mysqldump` são
  redigidos.
- Transcripts são suspensos durante a leitura das senhas.
- **Arquivo temporário de credenciais do wizard:** o Inno grava `root=<senha>` e
  `app=<senha>` em `{tmp}\nexus-mysql-credentials.txt` (UTF-8 sem BOM), aplica
  `icacls /inheritance:r` com FullControl apenas para Administrators (S-1-5-32-544) e SYSTEM
  (S-1-5-18) e só inicia o bootstrap se a ACL for aplicada. O bootstrap lê o arquivo, valida
  as senhas e o apaga; o wizard também o apaga ao final (inclusive em falha). As senhas
  nunca vão para a linha de comando, `MsgBox`, transcript ou log.
- `JWT_SECRET` é gerado com 48 bytes aleatórios quando ausente e preservado nas atualizações.
- Senhas: o `nexus_app` aceita até 256 caracteres e recusa `@`, `/`, `?`, `#`, `"`, `\`,
  `;`, espaço/tab e caracteres de controle (sem mínimo nem composição); o root só não pode
  ser vazio nem ter quebra de linha; nunca use `-p<senha>` na linha de comando.

O `smoke.ps1` verifica que `backups`, `config` e `app\.env` não tenham ACE para
`BUILTIN\Users` (S-1-5-32-545); rode-o elevado.

### 12.2 Exposição de rede

- Node escuta apenas `127.0.0.1:3000`; MySQL apenas `127.0.0.1:3214`; o `NexusAgent` apenas
  `127.0.0.1:3215` (API bearer); a 3306 é independente.
- Caddy é a única porta exposta (80/443), com CA interna e `admin off` (sem API administrativa).
- O firewall cria Allow de 80/443 e Block de 3214/3000/3215 para `LocalSubnet`; valide com
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

- Serviços **`NexusCaddy`**, **`NexusApp`**, **`NexusAgent`** e **`NexusMySQL84`**.
- Tarefas **`NexusTray`** e **`NexusBackup`** (legada, se ainda existir); processo da bandeja.
- `C:\Program Files\Nexus\app`, `node`, `mysql`, `caddy`, `tools`, `scripts`, `payload`,
  `sql`, `NexusTray`, `NexusAgent` e versões `app.prev-*`/`app.failed-*`/`app.prev-manual-*`.
- As cinco regras de firewall `Nexus *` (quando `NetSecurity` está disponível).
- `C:\ProgramData\Caddy` legado, se existir.
- O diretório `Instalador` é removido pelo Inno.

Se serviços/tarefas não forem removidos, o script para antes de apagar o runtime e preserva
app, tray, versões antigas e binários; o Inno mostra o erro.

### 13.2 O que é preservado

- **`C:\ProgramData\Nexus` inteiro**, incluindo `mysql\data`, `mysql\my.ini`, uploads, config,
  backups, **agent** (`jobs.json`/`schedule.json`), **`agent.secret`** e logs.
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

## 14. Checklist de release do instalador 1.08

> **Build em um comando (Windows):** `npm run deploy:windows` executa, em ordem:
> `prisma generate` → geração de `deploy/sql` → lint → build/empacotamento do app →
> `NexusTray` → `NexusAgent` → payload → **ISCC** → cópia do setup + `.sha256`.
>
> ```powershell
> npm run deploy:windows                                  # deixa em deploy\windows\out
> npm run deploy:windows -- -OutputPath "D:\Entregas"     # copia para a pasta
> npm run deploy:windows -- "C:\Temp\NexusSetup.exe"      # copia com outro nome
> ```
>
> Opções: `-SkipSql`, `-SkipLint`, `-SkipApp`, `-SkipTray`, `-SkipAgent`, `-WithTests`
> (roda `npm test`; exige `nexus_test`) e `-Force`. O script é
> [`scripts/deploy-windows.ps1`](../../scripts/deploy-windows.ps1); ele **não** instala o
> setup, apenas compila e copia. No fim imprime versão, tamanho, SHA-256 e o `.sha256`.

### 14.1 Build do app standalone

- [ ] `npm ci` na máquina de build.
- [ ] `npm run build:standalone` (Next com `output: "standalone"`).
- [ ] `npm run package:standalone` → `out/standalone/app.zip`; confira `server.js` na raiz,
      `.next/static` e ausência de `.env`/`uploads`.
- [ ] A versão do `package.json` é `1.08.11.2026` (ou a versão da release) e aparece no
      `app.zip`.

### 14.2 Payload e setup

- [ ] `deploy/windows/tools/nssm/nssm.exe` existe (fonte do NSSM embutido).
- [ ] `deploy/windows/NexusAgent/build.ps1` gerou `NexusAgent\dist\NexusAgent.exe` (~99 MB);
      sem ele o `build-instalador.ps1` falha antes do ISCC.
- [ ] `deploy/windows/progresso/index.html` existe (vai para `{app}\progresso`).
- [ ] `scripts/preparar-payload.ps1` monta `deploy/windows/payload` com Node 24.19.0, MySQL
      8.4.13, Caddy 2.11.9, VC++, NSSM, `app\app.zip`, `sql\{schema,seed}` e toda a pasta
      `sql\migracoes`; os hashes definidos no manifesto são verificados.
- [ ] `deploy/windows/build-instalador.ps1` (chama `preparar-payload`) gera
      `deploy/windows/out/NexusSetup-1.08.11.2026.exe`; confira o tamanho (419,4 MB /
      439.748.699 bytes, já com o agente).
- [ ] O setup contém `payload\`, `sql\`, `NexusAgent.exe` e `progresso\index.html`; nenhum
      download/Git/npm/Prisma é necessário no destino.

### 14.3 Testes obrigatórios

- [ ] **Wizard de senhas e progresso:** instalação nova exige as quatro senhas; confirmações
      divergentes e caractere proibido no `nexus_app` são recusados no wizard; upgrade com
      os quatro campos vazios reutiliza o `backup.cnf`; a janela modal mostra a fase atual e
      a barra avança até 8; falha do bootstrap mostra o código e os logs e não restaura o
      banco.
- [ ] **Bandeja .NET 10:** abrir pelo logon/atalho; status dos três serviços; fechar com o
      Nexus rodando pede confirmação e para **Caddy→App→MySQL** (serviços seguem Automatic);
      fechar com tudo parado não pede confirmação; reabrir pelo atalho **Bandeja do Nexus**
      sem UAC; `Iniciar Nexus` sobe na ordem e valida health; matar a bandeja não para o
      Nexus; reboot sobe os serviços; backup com MySQL parado sai 0.
- [ ] VM Windows limpa (10/11 x64, sem Node/Git/MySQL): instalação completa, hostname,
      MySQL 8.4.13 dedicado, SQL, serviços, tray, firewall e `smoke.ps1`.
- [ ] **Upgrade 10.02→1.07** na máquina de teste: dados migrados de
      `C:\ProgramData\MySQL\MySQL Server 8.4\Data` para `C:\ProgramData\Nexus\mysql\data`,
      health 1.07, HTTPS 200, serviços Running, tray e **89/2/3**.
- [ ] Verificar que o MySQL existente na 3306 (se houver) não foi parado/alterado.
- [ ] Testar `atualizar.ps1 -Package` em uma instalação 1.07 (app+SQL) e o rollback.
- [ ] Testar backup/restauração e desinstalação preservando `C:\ProgramData\Nexus`.
- [ ] **NexusAgent:** serviço `Running`, `/v1/health` `status=ok` com o segredo, tarefa
      `NexusBackup` ausente, firewall `Nexus Agent (LAN)` Block, `/progresso/` abre pela URL
      HTTPS e a página `/administracao/backup` lista jobs/agenda com as 4 permissões `backup.*`.
- [ ] Testar um backup manual pela UI (progresso → `/administracao/backup`) e uma restauração
      com backup de segurança, sem restaurar `.env`/`Caddyfile`.
- [ ] Testar acesso de uma estação ao HTTPS e a CA do Caddy.
- [ ] Registrar evidências (data, versão, setup, health, contagens e logs).

> O app não recebe tag nem clona Git: a versão vem do `package.json`/`app.zip` e o setup do
> payload. A release do repositório pode ter sua tag DateVer, mas ela não é usada pelo
> instalador.

---

## 15. Atenções conhecidas (limitações reais)

1. **A retenção cobre db, config e snapshots de uploads.**
   `backup.ps1` poda `backups\db\*.zip`/`.sql`, `.env-*`/`Caddyfile-*` e
   `backups\uploads\<timestamp>`; o diretório **legado** `backups\uploads` (arquivos soltos na
   raiz) e os `my.ini-*.bak` não são podados e podem crescer sem limite — remova-os à mão.

2. **O backup é lógico, não inclui os arquivos do MySQL nem a CA.**
   O dump cobre `nexus_prod`, uploads, `.env` e `Caddyfile`; `C:\ProgramData\Nexus\mysql\data`
   e `caddy\data` (CA/chave privada) não entram no backup. Após perda total, o Caddy gera
   outra CA.

3. **A bandeja é registrada só para o usuário que instalou.**
   `NexusTray` usa `AtLogOn -User $currentUser`; outros usuários não a veem nem reabrem pelo
   atalho. O atalho **Bandeja do Nexus** usa a tarefa `NexusTray` e não pede UAC.

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

7. **`atualizar.ps1` não atualiza runtimes, scripts, bandeja, agente nem firewall.**
   O pacote de atualização contém apenas `app.zip` + SQL. Node, MySQL, Caddy, NSSM, scripts,
   tray, `NexusAgent`, regras de firewall e o `bootstrap.state.json` só mudam com o
   setup/bootstrap.

8. **Atualização de schema aplica todas as migrações da pasta.**
   O caminho Update aplica `migracoes\*.sql` em ordem (001, 002, ...) + seed. Mudanças de
   schema em releases futuras exigem uma nova migração em `deploy/sql/migracoes`; não use
   `db push` nem Prisma no destino.

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
    O `NexusSetup-1.08.11.2026.exe` fica em 419,4 MB (439.748.699 bytes) com o
    `NexusAgent.exe` (~99 MB);
    `deploy/windows/payload` é ignorado pelo Git e precisa ser montado no build. O destino é
    offline, mas o build exige internet e os arquivos de origem (app.zip, NSSM, SQL, agente).

13. **Instalação silenciosa não é suportada.**
    O Inno não é executado com `/SILENT`/`/VERYSILENT` em produção: a página de credenciais é
    obrigatória na instalação nova e o wizard precisa do progresso. Para automatizar, use a
    instalação manual do §6 com `-CredentialsFile` (arquivo protegido e apagado) ou
    `-RootPassword`/`-AppPassword` em `SecureString` — nunca a senha na linha de comando.

14. **O usuário que instalou tem Modify na árvore de dados.**
    `C:\ProgramData\Nexus` e subpastas (`config`, `mysql`, `caddy`, `backups`, `logs`,
    `uploads`) dão `Modify` ao SID do usuário que executou o setup, além de
    Administrators/SYSTEM Full e do acesso dos serviços. Isso permite operar
    backup/restauração, logs e configuração sem elevação; os demais usuários continuam
    precisando de elevação. `C:\Program Files\Nexus` e `app\.env` **não** recebem esse
    acesso.

15. **Fechar a bandeja encerra o Nexus agora; não é desligamento permanente.**
    O `encerrar-nexus.ps1` para Caddy→App→MySQL, mas os três serviços continuam
    **Automatic** e voltam no próximo boot — não há watchdog, auto-login obrigatório nem
    mudança para Manual. Para religar sem reboot, use **Iniciar Nexus** ou o atalho
    **Bandeja do Nexus**. O `backup.ps1` com o MySQL parado apenas registra e sai 0.

16. **Agenda do agente não recupera dia perdido e não tem log próprio do serviço.**
    O `NexusAgent` dispara no horário/dia marcado e não repete o backup de um dia cujo horário
    passou com a máquina desligada; após falha, tenta de novo em 30 min. O `ILogger` não grava
    em arquivo: o diagnóstico fica em `agent\jobs.json`, `caddy\progresso\status.json` e nos
    logs `backup-*`/`restore-*`. A restauração não devolve `.env`/`Caddyfile` e a auditoria
    volta ao ponto do dump (a própria solicitação `RESTAURAR` é substituída).

---

## 16. Referências

| Assunto | Arquivo |
| --- | --- |
| instalador | [`deploy/windows/instalador.iss`](../../deploy/windows/instalador.iss) e [`build-instalador.ps1`](../../deploy/windows/build-instalador.ps1) |
| payload | [`scripts/preparar-payload.ps1`](../../scripts/preparar-payload.ps1) e [`deploy/windows/manifesto.json`](../../deploy/windows/manifesto.json) |
| app standalone | [`scripts/empacotar-standalone.mjs`](../../scripts/empacotar-standalone.mjs) e [`next.config.ts`](../../next.config.ts) |
| instalação | [`bootstrap.ps1`](../../deploy/windows/bootstrap.ps1) e [`instalador.iss`](../../deploy/windows/instalador.iss) |
| MySQL | [`instalar-mysql.ps1`](../../deploy/windows/instalar-mysql.ps1) e [`pos-instalacao-mysql.ps1`](../../deploy/windows/pos-instalacao-mysql.ps1) |
| SQL/seed | [`deploy/sql/`](../../deploy/sql/) e [`aplicar-sql.ps1`](../../deploy/windows/aplicar-sql.ps1) |
| atualização | [`atualizar.ps1`](../../deploy/windows/atualizar.ps1) |
| backup | [`backup.ps1`](../../deploy/windows/backup.ps1) |
| agente de backup | [`deploy/windows/NexusAgent/`](../../deploy/windows/NexusAgent/) |
| progresso do job | [`deploy/windows/progresso/index.html`](../../deploy/windows/progresso/index.html) |
| UI de backup | [`src/app/administracao/backup/`](../../src/app/administracao/backup/) e [`src/lib/agent.ts`](../../src/lib/agent.ts) |
| reinício | [`restart.ps1`](../../deploy/windows/restart.ps1) |
| validação | [`smoke.ps1`](../../deploy/windows/smoke.ps1) e [`src/app/api/health/route.ts`](../../src/app/api/health/route.ts) |
| uploads | [`src/lib/uploads.ts`](../../src/lib/uploads.ts) |
| bandeja | [`deploy/windows/NexusTray/`](../../deploy/windows/NexusTray/) |
| desinstalação | [`desinstalar.ps1`](../../deploy/windows/desinstalar.ps1) |
| versão e changelog | [`VERSIONAMENTO.md`](VERSIONAMENTO.md) |
| regras do projeto | [`AGENTS.md`](../../AGENTS.md) |
