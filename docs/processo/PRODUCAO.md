# Produção — instalação, atualização e operação (Windows)

Runbook da instalação do **Nexus** em um servidor Windows, cobrindo o instalador
`NexusSetup-<versão>.exe`, o `bootstrap.ps1`, os serviços do Windows, a bandeja, o backup
e a atualização. Ele descreve **o que os scripts de [`deploy/windows/`](../../deploy/windows/)
fazem hoje** — se um script mudar, este documento precisa ser revisto.

> **Escopo.** É o runbook do servidor de produção (Windows 64 bits). O desenvolvimento
> local continua em [`README.md`](../../README.md) e as convenções do projeto em
> [`AGENTS.md`](../../AGENTS.md). Regras de negócio não são repetidas aqui: consulte
> [`docs/dominio/REGRAS_NEGOCIO.md`](../dominio/REGRAS_NEGOCIO.md).

---

## 1. Visão geral

```text
estações da rede
      │  HTTPS 443 (CA interna do Caddy)
      ▼
┌─────────────────────┐        ┌──────────────────────┐        ┌──────────────────────┐
│ NexusCaddy (Caddy)  │ ─────► │ NexusApp (Next.js)   │ ─────► │ NexusMySQL84         │
│ 0.0.0.0:80/443      │  HTTP  │ 127.0.0.1:3000       │  3214  │ 127.0.0.1:3214       │
│ LocalService        │        │ NetworkService       │        │ NetworkService       │
└─────────────────────┘        └──────────────────────┘        └──────────────────────┘
        ▲                                ▲
        │ certutil -addstore -f Root     │ .env + UPLOADS_DIR
        │ (CA local)                     ▼
        │                        C:\ProgramData\Nexus\uploads
        │
   C:\ProgramData\Nexus\logs  ·  C:\ProgramData\Nexus\backups
   C:\ProgramData\Nexus\caddy\{data,config,logs}
```

> O MySQL existente na porta **3306** (se houver) **não é tocado**: o Nexus usa uma instância
> dedicada, `NexusMySQL84`, na **3214**. Ver §2.3, §5.2 e §15.

| Peça | Papel |
| --- | --- |
| `NexusSetup-<versão>.exe` | instalador **Inno Setup 7**; não embute o código da aplicação — o bootstrap clona a tag do GitHub durante a instalação |
| [`bootstrap.ps1`](../../deploy/windows/bootstrap.ps1) | instalação em **8 fases (0–7)**, idempotente e retomável; estado em `C:\ProgramData\Nexus\bootstrap.state.json` |
| [`instalar-mysql.ps1`](../../deploy/windows/instalar-mysql.ps1) | instala o **MySQL 8.4.13 LTS dedicado** (ZIP, `NexusMySQL84`, porta 3214) |
| [`pos-instalacao-mysql.ps1`](../../deploy/windows/pos-instalacao-mysql.ps1) | ajusta o `my.ini`, cria `nexus_prod` e o usuário `nexus_app` na instância dedicada |
| [`atualizar.ps1`](../../deploy/windows/atualizar.ps1) | atualização com indisponibilidade total, backup, cópia de scripts/configuração, validação de tag e rollback |
| [`backup.ps1`](../../deploy/windows/backup.ps1) | backup do banco (via `mysqldump` dedicado), dos uploads, do `.env` e do `Caddyfile` |
| [`restart.ps1`](../../deploy/windows/restart.ps1) | reinício controlado do `NexusApp` com o `NexusCaddy` parado; usado pela bandeja |
| [`smoke.ps1`](../../deploy/windows/smoke.ps1) | smoke test dos serviços, da porta 3214, das ACLs, do firewall, do health e do HTTPS |
| [`desinstalar.ps1`](../../deploy/windows/desinstalar.ps1) | remove serviços (incluindo `NexusMySQL84`), tarefas, binários e regras; **preserva** `C:\ProgramData\Nexus` e `C:\ProgramData\MySQL\MySQL Server 8.4` |
| `NexusTray` | bandeja em **.NET 8** (WinForms, self-contained) para acompanhar o serviço, reiniciá-lo e fazer backup |
| [`common.ps1`](../../deploy/windows/common.ps1) | funções e caminhos compartilhados pelos scripts |

### 1.1 Versões e componentes

| Componente | Versão/origem | Onde está definido |
| --- | --- | --- |
| Node.js | **24.19.0** (instalação exata; outra versão é substituída) | `manifesto.json` |
| NSSM | **2.24**, **embutido no instalador** (`tools\nssm\nssm.exe`); fallback URL/mirrors | `manifesto.json` + payload do Inno Setup |
| MySQL | **8.4.13 LTS**, **ZIP oficial** (`mysql-8.4.13-winx64.zip`), validado por **MD5** | `manifesto.json` |
| Serviço MySQL | **`NexusMySQL84`**, porta **3214**, bind `127.0.0.1` | `instalar-mysql.ps1` |
| VC++ Redistributable | **14.x** (`vc_redist.x64.exe`) | `manifesto.json` |
| Caddy | **latest** (manifesto sem URL) ou a URL fixada no manifesto | `manifesto.json` |
| Git for Windows | já instalado ou **latest** (manifesto sem URL) | `manifesto.json` |
| Bandeja | **.NET 8**, `win-x64`, self-contained, single-file | `NexusTray/NexusTray.csproj` |
| Instalador | **Inno Setup 7**; se o `ISCC.exe` não existir, baixa o pacote NuGet **7.1.0** | `build-instalador.ps1` |

> **Atenção:** os campos `sha256` do `manifesto.json` estão vazios para Node, VC++ e Caddy;
> o MySQL usa **MD5** para o ZIP; o NSSM tem `exe_sha256` e vai embutido no instalador, com
> fallback para a URL oficial e o mirror do repositório. Caddy e Git caem no "latest" quando a
> URL não está fixada. Os downloads sem hash são protegidos apenas pelo TLS. Ver §15.

---

## 2. Caminhos reais

### 2.1 `C:\Program Files\Nexus`

| Caminho | Conteúdo |
| --- | --- |
| `app\` | clone Git da tag em produção; `.env`, `node_modules`, `.next` |
| `Instalador\` | scripts entregues pelo `.exe`: `bootstrap.ps1`, `atualizar.ps1`, `backup.ps1`, `restart.ps1`, `smoke.ps1`, `common.ps1`, `desinstalar.ps1`, `instalar-gui.ps1`, `build-instalador.ps1`, `Caddyfile`, `manifesto.json`, `NexusTray.exe` |
| `scripts\` | `backup.ps1`, `common.ps1` e `restart.ps1` copiados pelo bootstrap; usados pela tarefa `NexusBackup` e pela bandeja |
| `NexusTray\` | `NexusTray.exe` e `tray.json` (caminhos reais, sem segredos) |
| `caddy\` | `caddy.exe` |
| `tools\nssm\` | `nssm.exe` |
| `app.prev-<tag>\` | versão anterior mantida pelo `atualizar.ps1` (até duas) |
| `app.failed-<tag>\` | versão que falhou na atualização, mantida para diagnóstico |
| `app.prev-manual-<timestamp>\` | diretório antigo movido pelo `bootstrap.ps1 -Force` |
| `mysql\` | binários do MySQL 8.4.13 dedicado (`mysqld.exe`, `mysql.exe`, `mysqldump.exe`) |

### 2.2 `C:\ProgramData\Nexus`

| Caminho | Conteúdo |
| --- | --- |
| `bootstrap.state.json` | fase concluída, hostname e tag |
| `uploads\` | raiz física dos uploads (`UPLOADS_DIR`); `NetworkService` pode modificar |
| `logs\` | `app.out.log`/`app.err.log`, `bootstrap-*.log`, `instalador-*.log`, `deploy-*.log`, `desinstalar-*.log`, `backup-*.log`, `restart-*.log`; `NetworkService` pode modificar |
| `backups\db\` | dumps `nexus_prod-<timestamp>.zip` ou, acima de ~1,8 GB, `nexus_prod-<timestamp>.sql` |
| `backups\uploads\` | cópia dos uploads |
| `backups\config\` | `.env-<timestamp>`, `Caddyfile-<timestamp>` e backups do `my.ini` (`my.ini-<timestamp>.bak`) |
| `config\Caddyfile` | Caddyfile gerado a partir do template, com o hostname real; leitura para `LocalService` |
| `config\backup.cnf` | credenciais do `nexus_app` para o `mysqldump`; **sem leitura pelo app** |
| `caddy\data\` | dados do Caddy (`XDG_DATA_HOME`); a CA local fica em `caddy\data\caddy\pki\authorities\local\` |
| `caddy\config\` | configuração do Caddy (`XDG_CONFIG_HOME`) |
| `caddy\logs\` | `caddy.out.log`, `caddy.err.log` e `access.log` |

O diretório raiz `C:\ProgramData\Nexus` é restrito a **Administrators/SYSTEM**; apenas
`uploads` e `logs` recebem `Modify` para o `NetworkService`, e `caddy\{data,config,logs}`
recebem `Modify` para o `LocalService`. `backups` e `config` continuam só para
Administrators/SYSTEM. Ver §12.1.

### 2.3 MySQL dedicado (fora de `Nexus`)

| Caminho | Conteúdo |
| --- | --- |
| `C:\Program Files\Nexus\mysql\` | binários do MySQL **8.4.13** dedicado (`bin\mysqld.exe`, `bin\mysql.exe`, `bin\mysqldump.exe`) |
| `C:\ProgramData\MySQL\MySQL Server 8.4\Data\` | diretório de dados do `NexusMySQL84` |
| `C:\ProgramData\MySQL\MySQL Server 8.4\my.ini` | configuração do `NexusMySQL84`: porta **3214**, bind `127.0.0.1`, `datadir`, `basedir`, utf8mb4 e fuso `-03:00` |

> O MySQL que já existir na porta **3306** (por exemplo, uma instalação em
> `C:\Program Files\MySQL\MySQL Server 8.4`) **não é instalado, parado nem alterado** pelo
> Nexus. O único ponto de contato é o caminho padrão de dados/configuração
> `C:\ProgramData\MySQL\MySQL Server 8.4`, que é o mesmo usado por um MySQL 8.4 comum — ver
> §15 se ele já existir.

> A desinstalação remove `C:\Program Files\Nexus\mysql` e `C:\ProgramData\Nexus\caddy`, mas
> **preserva** `C:\ProgramData\MySQL\MySQL Server 8.4` e o restante de
> `C:\ProgramData\Nexus`. Ver §13.

---

## 3. Serviços, tarefas e portas

### 3.1 Serviços

| Nome | Criado por | Conta | Início | Depende de | Logs |
| --- | --- | --- | --- | --- | --- |
| `NexusMySQL84` | `instalar-mysql.ps1` | `NT AUTHORITY\NetworkService` | automático | — | erro em `C:\ProgramData\MySQL\MySQL Server 8.4\Data\*.err` |
| `NexusApp` | `bootstrap.ps1` (NSSM) | `NT AUTHORITY\NetworkService` | automático | `NexusMySQL84` | `C:\ProgramData\Nexus\logs\app.out.log` e `app.err.log` |
| `NexusCaddy` | `bootstrap.ps1` (NSSM) | `NT AUTHORITY\LocalService` | automático | `NexusApp` | `C:\ProgramData\Nexus\caddy\logs\caddy.out.log`/`caddy.err.log` + `access.log` |

O NSSM configura `AppExit Default Restart` (reinício após 5 s), rotação de log em 10 MiB e
parada com 15 s para o console. Se o `NexusMySQL84` não subir, o `NexusApp` também não sobe
por causa da dependência; sem o app, o `NexusCaddy` não sobe.

O MySQL existente na **3306** não aparece nesta tabela: ele não é criado, parado nem alterado
pelo Nexus.

### 3.2 Tarefas agendadas

| Nome | Gatilho | Conta | Comando |
| --- | --- | --- | --- |
| `NexusBackup` | diário às **02:00** (executa no próximo boot se a máquina estiver desligada) | `SYSTEM` | `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Program Files\Nexus\scripts\backup.ps1" -RetentionDays 30` |
| `NexusTray` | **logon do usuário que executou a instalação** | esse usuário, `RunLevel Highest` | `C:\Program Files\Nexus\NexusTray\NexusTray.exe` |

A bandeja roda elevada (`requireAdministrator`) para executar o `restart.ps1` (que usa NSSM)
sem pedir UAC. Ela **não** é registrada para "todos os usuários" — ver §9 e §15.

### 3.3 Portas

| Porta | Serviço | Escuta | Observação |
| --- | --- | --- | --- |
| `3214` | `NexusMySQL84` | `127.0.0.1` | `bind-address=127.0.0.1`; X Plugin desligado (`mysqlx=0`) |
| `3000` | `NexusApp` | `127.0.0.1` | `next start -H 127.0.0.1 -p 3000` |
| `80`/`443` | `NexusCaddy` | todas as interfaces | HTTPS com CA interna; a 80 atende o redirecionamento automático do Caddy |

O Caddy usa `admin off`: **não há API administrativa**. O `bootstrap.ps1` verifica 3214,
3000, 80 e 443 antes de instalar. A porta **3306** é ignorada: pode estar ocupada por outro
MySQL.

### 3.4 Firewall

O `bootstrap.ps1` recria as quatro regras de entrada abaixo (`Set-NexusFirewallRules`); o
`smoke.ps1` valida nome, direção, ação, porta e `LocalSubnet`, e o `desinstalar.ps1` as
remove.

| Regra | Porta | Ação | Escopo |
| --- | --- | --- | --- |
| `Nexus HTTP` | `80` | **Allow** | `LocalSubnet` |
| `Nexus HTTPS` | `443` | **Allow** | `LocalSubnet` |
| `Nexus MySQL (LAN)` | `3214` | **Block** | `LocalSubnet` |
| `Nexus Next (LAN)` | `3000` | **Block** | `LocalSubnet` |

As regras são de **entrada**, perfil `Any`. O acesso ao sistema continua somente por 80/443;
a 3214 e a 3000 ficam bloqueadas para a sub-rede. Se as estações estiverem fora do
`LocalSubnet`, as regras precisam ser revistas.

---

## 4. Pré-requisitos

- Windows **64 bits** (Windows 10/11 ou Windows Server compatível), com PowerShell 5.1.
- Execução em **PowerShell elevado** (Administrador): a instalação, a atualização e a
  desinstalação exigem elevação; o backup manual também, por causa da ACL do `backup.cnf`.
- Pelo menos **5 GB livres em `C:`**.
- **Internet** durante a instalação/atualização: o `bootstrap` baixa Node, Git, Caddy, VC++ e
  clona a tag do GitHub. O **NSSM vai embutido no instalador**; a URL oficial e o mirror são
  apenas fallback. A checagem inicial usa `nodejs.org:443`; acesso ao GitHub também é
  necessário.
- Relógio do servidor com no máximo **10 minutos** de diferença do horário da internet.
- **Hostname DNS** válido (ex.: `nexus.galpao.local`), sem `http://`, porta ou caminho.
  Ele precisa resolver **no próprio servidor** e nas estações clientes.
- Portas **3214**, 3000, 80 e 443 livres (ou já usadas pelos próprios serviços do Nexus). A
  **3306** não é usada pelo Nexus e pode estar ocupada por outro MySQL.
- Acesso à internet e à tag do GitHub no momento da instalação — o pacote do instalador
  **não** contém o código da aplicação. O bootstrap manual exige `-Tag`.
- Um MySQL 8.4.13 dedicado é baixado como ZIP oficial e instalado pelo bootstrap; não é
  necessário instalar o MySQL Installer da Oracle.

> **Firewall:** o bootstrap **cria** as regras `Nexus HTTP`/`Nexus HTTPS` (Allow para
> `LocalSubnet`) e `Nexus MySQL (LAN)`/`Nexus Next (LAN)` (Block para `LocalSubnet`). O
> `smoke.ps1` valida as quatro; não é preciso liberar a 3214/3000. Ver §3.4.

---

## 5. Instalação pelo instalador (`NexusSetup-<versão>.exe`)

### 5.1 O que o wizard pergunta

1. Verifica se o Windows é **64 bits**; se não for, aborta.
2. Pede o **hostname** (nome DNS), com o valor inicial `nexus.galpao.local`. O campo aceita
   apenas letras, números, ponto e hífen; é convertido para minúsculas.
3. Permite marcar o ícone na **Área de Trabalho** (opcional). O diretório de instalação é
   fixo: `C:\Program Files\Nexus\Instalador`.
4. Ao concluir os arquivos, o `CurStepChanged(ssPostInstall)` do `instalador.iss` executa o
   `instalar-gui.ps1` em uma janela visível (o bootstrap precisa do console para pedir as
   senhas do MySQL) com `Exec`/`ewWaitUntilTerminated` e **verifica o `ResultCode`**: se o
   `Exec` falhar ou o código não for 0, mostra um `MsgBox` de erro com o código e o caminho
   dos logs.

O `.iss` **não usa `[Run]`**: a execução do `instalar-gui.ps1` — que chama o `bootstrap.ps1`
— fica no `[Code]`, em `CurStepChanged(ssPostInstall)`, justamente para poder checar o
código de saída.

O `instalar-gui.ps1` grava o andamento em
`C:\ProgramData\Nexus\logs\instalador-<timestamp>.log` e mostra MessageBox de sucesso ou de
falha. O bootstrap grava o log detalhado em
`C:\ProgramData\Nexus\logs\bootstrap-<timestamp>.log`. Não há pausa para instalar o MySQL:
o bootstrap instala a instância dedicada automaticamente e pede as senhas no console.

### 5.2 MySQL 8.4.13 LTS dedicado (automático)

O MySQL **não** precisa ser instalado antes, e o MySQL existente na **3306 não é tocado**.
A fase 2 do bootstrap chama o [`instalar-mysql.ps1`](../../deploy/windows/instalar-mysql.ps1):

1. Baixa o **ZIP oficial** `mysql-8.4.13-winx64.zip` e valida o **MD5** do manifesto.
2. Extrai os binários para `C:\Program Files\Nexus\mysql`.
3. Grava `C:\ProgramData\MySQL\MySQL Server 8.4\my.ini` com porta **3214**, bind
   `127.0.0.1`, `mysqlx=0`, `basedir`/`datadir`, utf8mb4 e fuso `-03:00`.
4. Se `Data` estiver vazio, inicializa com `mysqld --initialize-insecure`.
5. Cria o serviço **`NexusMySQL84`**, configura como `NT AUTHORITY\NetworkService`, inicia
   e espera aceitar conexões em `127.0.0.1:3214`.
6. Define a senha do **root** por SQL em arquivo temporário protegido; nunca por `-p`.
7. O `pos-instalacao-mysql.ps1` ajusta o `my.ini`, reinicia o `NexusMySQL84`, cria o banco
   `nexus_prod` e o usuário `nexus_app@localhost` e valida a conexão na 3214.

No console do bootstrap, são pedidas duas senhas — a do **root do MySQL dedicado** e a do
**`nexus_app`** (qualquer senha de até 256 caracteres; não pode conter `@`, `/`, `?`, `#`,
`"`, `\`, `;`, espaço, tab ou caracteres de controle). Elas só são pedidas quando o
serviço ainda não existe ou quando o `backup.cnf` existente não conecta; a instalação é
idempotente e **não há pausa** para instalar o MySQL. O `instalar-mysql.ps1` também pode ser
executado isoladamente em PowerShell elevado (ele instala/repara o serviço; o
`pos-instalacao-mysql.ps1` continua sendo necessário para criar o banco/usuário).

O backup do `my.ini` feito pelo pós-instalação fica em
`C:\ProgramData\Nexus\backups\config\my.ini-<timestamp>.bak`.

> **Atenção:** o caminho `C:\ProgramData\MySQL\MySQL Server 8.4` é o mesmo usado por uma
> instalação MySQL 8.4 comum. Se a máquina já tiver um MySQL 8.4 usando esse diretório,
> haverá conflito de `Data`/`my.ini`. Não rode o Nexus nessa máquina sem antes isolar/backup
> da instância existente — ver §15.

### 5.3 Senhas

| Senha | Regra real | Onde é usada |
| --- | --- | --- |
| **root do MySQL dedicado** | não vazia, sem quebra de linha; passada por arquivo de opções temporário, nunca por `-p` | inicialização do `NexusMySQL84`, criação do banco/usuário e restauração |
| **`nexus_app`** | **até 256 caracteres**, qualquer composição; **sem `@`, `/`, `?`, `#`, `"`, `\`, `;`, espaço, tab ou caracteres de controle** | `DATABASE_URL`, `backup.cnf` e `mysqldump` |

A restrição do `nexus_app` existe porque a senha entra na `DATABASE_URL`
(`mysql://nexus_app:<senha>@127.0.0.1:3214/nexus_prod`), no `.env` e no `backup.cnf`;
`@`, `/`, `?`, `#`, `"`, `\`, `;`, espaço/tab e caracteres de controle quebram esses
formatos. Os demais símbolos — incluindo `:`, `%`, `!`, `&`, `=`, `+` e acentos — são
permitidos. A senha do root **não** entra nessa URL; por isso exige apenas não ser vazia e
não conter quebra de linha.

As senhas são pedidas no console do bootstrap (`Read-Host -AsSecureString`), sem pausa e sem
caixa de diálogo; o transcript é suspenso durante a leitura e os arquivos temporários do
MySQL nascem com ACL restrita. O `backup.cnf` fica com acesso apenas para
Administrators/SYSTEM e grava a porta **3214**: o `NexusApp` (`NetworkService`) **não** o lê;
quem usa o arquivo é o `bootstrap.ps1` (teste da fase 2) e o `backup.ps1`, rodando como
`SYSTEM` ou em PowerShell elevado.

### 5.4 O que o bootstrap faz (fases 0–7)

| Fase | O que faz |
| --- | --- |
| **0 — Pré-checagem** | confere Administrador, 64 bits, 5 GB livres em `C:`, internet (`nodejs.org:443`), portas **3214**/3000/80/443 e relógio (tolerância de 10 min); a 3306 não é verificada |
| **1 — Runtime** | instala VC++ x64, **Node.js 24.19.0** (se a versão instalada for diferente) e Git for Windows (se ausente); atualiza o PATH da sessão |
| **2 — MySQL dedicado** | pede as senhas no console e chama o `instalar-mysql.ps1`: baixa o ZIP 8.4.13, valida MD5, instala em `C:\Program Files\Nexus\mysql`, cria `NexusMySQL84` na 3214 e define o root; em seguida roda o `pos-instalacao-mysql.ps1` para criar `nexus_prod`/`nexus_app`; grava `backup.cnf` com porta 3214. **Não há pausa**; a 3306 não é tocada |
| **3 — Ferramentas, diretórios e ACLs** | usa o **NSSM 2.24 embutido** (valida `exe_sha256`; se faltar, baixa da URL oficial/mirrors) e instala o **Caddy**; gera o `Caddyfile` com `admin off`; valida o Caddyfile; cria `C:\ProgramData\Nexus\caddy\{data,config,logs}`; aplica ACLs restritas (incluindo `C:\Program Files\Nexus\mysql` e `C:\ProgramData\MySQL\MySQL Server 8.4`) e cria as quatro regras de firewall |
| **4 — Aplicação** | clona/atualiza a tag do GitHub em `C:\Program Files\Nexus\app`; **valida que a tag contém `src/app/api/health/route.ts` e que o `package.json` bate com a tag**; grava o `.env` (`DATABASE_URL` na **3214**, `UPLOADS_DIR`, `NODE_ENV=production`, `PORT=3000`, `JWT_SECRET` gerado se ausente); roda `npm ci`, `db:generate`, `build`, `db:push` e `db:seed`; ajusta ACLs do `.env` e do cache |
| **5 — Serviços** | cria/reconfigura `NexusApp` (`NetworkService`, dependente de `NexusMySQL84`) e `NexusCaddy` (`LocalService`, dependente de `NexusApp`) via NSSM; inicia o app; valida `http://127.0.0.1:3000/api/health` com `db=true`; inicia o Caddy; instala a CA local com `certutil -addstore -f Root` (até 30 tentativas) e valida `https://<hostname>/login` |
| **6 — Bandeja e backup** | copia `backup.ps1`, `common.ps1` e `restart.ps1` para `C:\Program Files\Nexus\scripts`; registra `NexusBackup` (diária, 02:00); copia o `NexusTray.exe`, grava o `tray.json` (com `restartScript`), registra `NexusTray` no logon do usuário atual e **inicia a tarefa imediatamente** (em atualização, para tarefa/processo antes de copiar) |
| **7 — Smoke e resumo** | roda o `smoke.ps1` com a versão esperada (tag sem o `v`), incluindo `NexusMySQL84`/3214, ACLs e as quatro regras de firewall, e imprime URL, caminhos, versão e o comando de atualização |

O estado é gravado em `C:\ProgramData\Nexus\bootstrap.state.json` ao fim de cada fase. Se
algo falhar, corrija a causa e rode de novo com `-Resume`; se o hostname mudou, o bootstrap
recusa continuar sem `-Force`.

### 5.5 Primeira execução e Super Admin

O `db:seed` de referência **não cria usuários**: ele popula apenas tipos de código,
permissões, perfis-template (Operador/Auxiliar) e unidades de conversão. O Super Admin é
criado pelo próprio sistema:

1. Acesse `https://<hostname>`.
2. Sem administrador cadastrado, o `/login` redireciona para `/primeiro-acesso`.
3. Preencha **nome**, **login** e **senha** (mínimo de 4 caracteres). A ação cria o usuário
   com a flag `super_admin` e já autentica.
4. Depois disso, `/primeiro-acesso` redireciona para `/login` (já existe administrador) e
   o Super Admin entra normalmente.

O Super Admin tem todas as permissões e ignora as verificações normais; ele não é uma
permissão configurável na interface (ver `AGENTS.md` §12).

### 5.6 Validação da instalação

Ao final, o bootstrap executa:

```powershell
# exemplo; o bootstrap usa a versão da tag
& "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" `
  -NoProfile -ExecutionPolicy Bypass `
  -File "C:\Program Files\Nexus\Instalador\smoke.ps1" `
  -Hostname nexus.galpao.local -ExpectedVersion 3.02.11.2026
```

O smoke test confere:

- `NexusMySQL84`, `NexusApp` e `NexusCaddy` em execução;
- a porta **3214** aceitando conexões em `127.0.0.1`;
- ACLs de `backups`, `config` e `app\.env` **sem `BUILTIN\Users`** (S-1-5-32-545);
- as quatro regras de firewall (`Nexus HTTP`/`HTTPS` Allow; `Nexus MySQL (LAN)`/`Nexus Next
  (LAN)` Block, todas em `LocalSubnet`);
- `GET http://127.0.0.1:3000/api/health` → HTTP 200 com `db=true`;
- `https://<hostname>/login` → HTTP 200 (com validação de certificado; exige a CA do Caddy
  confiada no Windows via `certutil`);
- versão do health igual à esperada, quando `-ExpectedVersion` é informado.

Saída esperada: `SMOKE: OK` e código 0. Qualquer falha retorna código 1 e lista os itens.
O mesmo teste pode ser rodado depois, a qualquer momento; rode em **PowerShell elevado**
para conseguir ler as ACLs restritas de `backups` e `config`.

---

## 6. Instalação manual (sem o `.exe`)

O `.exe` é apenas um empacotador dos scripts. A instalação manual usa o `bootstrap.ps1`
diretamente, a partir de `C:\Program Files\Nexus\Instalador` (instalação já existente) ou
de um checkout do repositório (`deploy\windows`).

```powershell
# PowerShell elevado
cd "C:\Program Files\Nexus\Instalador"   # ou o checkout: cd deploy\windows
# tag de exemplo; use a tag publicada do release
powershell -NoProfile -ExecutionPolicy Bypass -File .\bootstrap.ps1 `
  -Hostname nexus.galpao.local -Tag v3.02.11.2026
```

O bootstrap instala o MySQL dedicado automaticamente e pede as senhas do root/`nexus_app`
no console; não há pausa nem instalador gráfico do MySQL. O MySQL existente na 3306 não é
tocado.

Parâmetros:

| Parâmetro | Efeito |
| --- | --- |
| `-Hostname` | obrigatório; nome DNS usado pelo Caddy |
| `-Resume` | retoma da última fase concluída (exige `bootstrap.state.json`) |
| `-Force` | ignora o estado e reinstala sobre o diretório existente; permite trocar o hostname |
| `-SkipTray` | não copia nem registra a bandeja |
| `-TrayExe` | caminho explícito do `NexusTray.exe`; se informado e ausente, falha |
| `-RepoUrl` | URL do repositório; padrão: `manifesto.json` |
| `-Tag` | obrigatória no bootstrap manual (ex.: `v3.02.11.2026`); o instalador passa a tag do build |

Exemplo de retomada:

```powershell
# use a mesma tag publicada do release
.\bootstrap.ps1 -Hostname nexus.galpao.local -Tag v3.02.11.2026 -Resume
```

Se o diretório `C:\Program Files\Nexus\app` existir, não for um repositório Git e tiver
arquivos, o bootstrap recusa continuar sem `-Force`; com `-Force`, move o diretório para
`C:\Program Files\Nexus\app.prev-manual-<timestamp>` e reinstala.

Logs: `C:\ProgramData\Nexus\logs\bootstrap-<timestamp>.log` e o resumo no console. A
instalação manual **não** copia `atualizar.ps1`/`smoke.ps1` para
`C:\Program Files\Nexus\scripts` — apenas `backup.ps1`, `common.ps1` e `restart.ps1`; os
demais continuam no checkout de origem.

---

## 7. Atualização

### 7.1 Antes de atualizar

1. Leia o `CHANGELOG.md` da versão e confirme se há mudança de schema, script de preparação
   ou variável de ambiente nova.
2. Confirme que a tag existe no GitHub (`git ls-remote --tags origin vN.DD.MM.YYYY`); o
   `atualizar.ps1` clona a tag, não um branch.
3. Rode um backup manual e copie o resultado para fora do servidor (§8).
4. Agende uma **janela de manutenção**: o `atualizar.ps1` para o `NexusCaddy` **e** o
   `NexusApp` antes de mexer na aplicação. O site fica **totalmente indisponível** durante o
   build (conexão recusada), não apenas com 502/503.
5. Tenha o plano de rollback (§7.4) e o dump mais recente à mão.
6. **Migração de MySQL/firewall:** se a instalação atual ainda usa a 3306 ou não tem as
   regras de firewall, o `atualizar.ps1` sozinho **não** regulariza — ele preserva o
   `.env`/`backup.cnf` antigos, não instala o `NexusMySQL84` e não executa
   `Set-NexusFirewallRules`. Nesse caso, rode o bootstrap/instalador (fase 2/3) ou ajuste
   `DATABASE_URL`/`backup.cnf` e crie as regras manualmente.

### 7.2 Comando

```powershell
# PowerShell elevado, em C:\Program Files\Nexus\Instalador
# exemplo de tag; use a tag publicada do release
.\atualizar.ps1 -Tag v3.02.11.2026
```

`-RepoUrl` sobrescreve a URL (padrão: `remote origin` da instalação atual ou
`manifesto.json`). `-SkipBackup` pula o backup — **não recomendado**.

### 7.3 O que o `atualizar.ps1` faz

1. Confere `C:\Program Files\Nexus\app\package.json` e o serviço `NexusApp`.
2. Descobre o hostname no `bootstrap.state.json` (ou no `Caddyfile`).
3. Roda o `backup.ps1`; se o backup falhar, **cancela antes de alterar a aplicação**.
4. Para o `NexusCaddy` e, em seguida, o `NexusApp` — **indisponibilidade total**.
5. Move a aplicação atual para `C:\Program Files\Nexus\app.prev-<tag-atual>`.
6. Clona a nova tag em `C:\Program Files\Nexus\app`.
7. Valida a tag: exige `src/app/api/health/route.ts` e `package.json` com a mesma versão da
   tag (sem o `v`); se não bater, falha antes de compilar.
8. Copia o `.env` da versão anterior e garante `UPLOADS_DIR` com a ACL do `NetworkService`
   (não altera a porta do `DATABASE_URL`; ver §7.1).
9. Se a versão anterior tiver `public\uploads`, migra o conteúdo para
   `C:\ProgramData\Nexus\uploads` com `robocopy /E`.
10. Copia os `*.ps1` da tag para `C:\Program Files\Nexus\Instalador`, o `Caddyfile` e o
    `manifesto.json`; copia `backup.ps1`, `common.ps1` e `restart.ps1` para
    `C:\Program Files\Nexus\scripts`; atualiza o `NexusTray.exe` se a tag trouxer
    `NexusTray\dist\NexusTray.exe`.
11. Regenera o `Caddyfile` com o hostname e reaplica a leitura para `LocalService`.
12. Executa `npm ci`, `db:generate`, `build`, `db:push` e `db:seed`.
13. Ajusta ACLs do cache (`Modify`) e da aplicação (`ReadAndExecute`).
14. Inicia o `NexusApp`, valida o health local com `db=true`, inicia o `NexusCaddy`, valida
    `https://<hostname>/login` e roda o `smoke.ps1` com a versão da tag.
15. Mantém a versão anterior e mais uma `app.prev-*`; remove as mais antigas. A versão
    atual nunca é apagada.

Log: `C:\ProgramData\Nexus\logs\deploy-<tag>.log`.

### 7.4 Rollback

Se qualquer etapa falhar, o `atualizar.ps1` usa flags para saber o que já foi alterado:

- **falha antes de mover a aplicação** (por exemplo, ao parar um serviço): a produção não é
  alterada; o script tenta religar `NexusApp` e `NexusCaddy` e informa que a versão em
  produção permaneceu;
- **falha depois de mover, mas antes/durante o clone**: se houver um clone parcial, ele vai
  para `C:\Program Files\Nexus\app.failed-<tag>`; o `app.prev-<tag-atual>` volta a ser
  `app`;
- **falha no build, `db push`, health, HTTPS ou smoke**: a versão nova vai para
  `C:\Program Files\Nexus\app.failed-<tag>` e a anterior é restaurada.

Depois de restaurar, ele religa o `NexusApp`, espera o health, religa o `NexusCaddy` e
confere o HTTPS. O **banco não é restaurado automaticamente**. Se o `db push`/`db:seed`
alterou dados, pare o serviço e restaure o dump mais recente de
`C:\ProgramData\Nexus\backups\db` (§8.5).

> **Atenção:** o rollback restaura a **aplicação**, não os arquivos copiados para
> `Instalador`, `scripts` ou o `Caddyfile`/`manifesto.json`; eles permanecem com a versão
> nova. O `app.failed-<tag>` fica para diagnóstico e não é limpo automaticamente.

### 7.5 `db push`, seed e mudanças destrutivas

O projeto **não usa migrations**: a atualização aplica `prisma db push`. Isso funciona para
mudanças aditivas, mas:

- mudanças destrutivas podem exigir `--accept-data-loss` ou intervenção manual; o
  `db push` pode falhar ou pedir confirmação;
- o `db:seed` roda em toda atualização e reaplica os dados de referência (permissões,
  perfis, tipos de código e unidades), inclusive removendo permissões obsoletas;
- releases com novas constraints únicas podem exigir o script de preparação documentado no
  `CHANGELOG` (por exemplo, `npm run db:dedupe-notas` com a URL explícita do banco) **antes**
  do `db push`.

**Dívida conhecida:** em releases futuras, o `db push` deve ser substituído por SQL revisado
(ou migrations versionadas) para o caminho de produção. Até lá, toda release que altere o
schema precisa de backup, ensaio em banco de teste e um roteiro de rollback.

### 7.6 Reinstalar pelo `.exe` em vez de atualizar

Rodar o `NexusSetup-<nova-versão>.exe` sobre uma instalação existente executa o bootstrap
do zero (fases 0–7). Ele preserva o `.env` e o `JWT_SECRET`, reconfigura os serviços
(inclusive instala/ajusta o `NexusMySQL84` na 3214) e **também valida a tag** (`/api/health`
+ versão do `package.json`), mas **não faz backup automático** e não tem o rollback do
`atualizar.ps1`. Use o `.exe`/bootstrap para a primeira instalação, para migrar da 3306 ou
para recuperação; para atualização rotineira de uma instalação já na 3214, prefira o
`atualizar.ps1`.

---

## 8. Backup e restauração

### 8.1 Backup agendado

A tarefa `NexusBackup` roda diariamente às **02:00** como `SYSTEM`, com retenção de
**30 dias**:

```text
powershell.exe -NoProfile -ExecutionPolicy Bypass `
  -File "C:\Program Files\Nexus\scripts\backup.ps1" -RetentionDays 30
```

`StartWhenAvailable` faz a tarefa rodar no próximo boot se o servidor estiver desligado no
horário. Ela não aparece na bandeja; confira em **Agendador de Tarefas** ou com
`Get-ScheduledTaskInfo -TaskName NexusBackup`. O log de cada execução fica em
`C:\ProgramData\Nexus\logs\backup-<timestamp>.log`.

### 8.2 Backup manual

Pela bandeja: menu **Fazer backup agora** (a bandeja roda elevada).

Ou em PowerShell elevado, a partir de `C:\Program Files\Nexus\Instalador`:

```powershell
.\backup.ps1                 # retenção padrão de 30 dias
.\backup.ps1 -RetentionDays 60
.\backup.ps1 -SkipUploads    # não copia uploads
```

O backup manual precisa ser elevado porque lê `C:\ProgramData\Nexus\config\backup.cnf`,
que só Administrators/SYSTEM acessam.

### 8.3 O que é gerado

| Item | Destino | Formato |
| --- | --- | --- |
| Banco `nexus_prod` | `C:\ProgramData\Nexus\backups\db\nexus_prod-<timestamp>.zip` | dump do `mysqldump` **do binário dedicado** (`C:\Program Files\Nexus\mysql\bin\mysqldump.exe`) na porta **3214** (`--single-transaction --routines --triggers --no-tablespaces --databases nexus_prod`) compactado; o `.sql` intermediário é apagado |
| Banco grande | `C:\ProgramData\Nexus\backups\db\nexus_prod-<timestamp>.sql` | acima de **~1,8 GB** (limite prático do `Compress-Archive` no PowerShell 5.1), o `.sql` é mantido **sem compactar** |
| Uploads | `C:\ProgramData\Nexus\backups\uploads\` | cópia com `robocopy /E` |
| `.env` | `C:\ProgramData\Nexus\backups\config\.env-<timestamp>` | cópia com ACL restrita |
| `Caddyfile` | `C:\ProgramData\Nexus\backups\config\Caddyfile-<timestamp>` | cópia com ACL restrita |
| Log | `C:\ProgramData\Nexus\logs\backup-<timestamp>.log` | transcript da execução |

Também em `backups\config` (mas **fora** do `backup.ps1`) ficam os backups do `my.ini`
(`my.ini-<timestamp>.bak`), criados pelo `pos-instalacao-mysql.ps1`.

O `backup.ps1` lê a porta do `backup.cnf` e **recusa** continuar se ela não for **3214**:
mensagem para rodar a fase 2 do bootstrap. Ele usa o `mysqldump` do binário dedicado; se ele
não existir, o `Find-MysqldumpExe` tem fallback para uma instalação 8.0/8.4 padrão (mas a
conexão continua na 3214).

O `backup.ps1` retorna código diferente de zero quando o dump falha, quando o arquivo do
dump fica vazio, quando o `robocopy` falha (código ≥ 8) ou quando o `.env` não é encontrado.
Se o `Caddyfile` não existir, ele avisa que o backup está incompleto, mas continua.

### 8.4 Retenção e verificação

A retenção remove, por `LastWriteTime`, os `*.zip` e `*.sql` de `backups\db` e os
`.env-*`/`Caddyfile-*` de `backups\config` mais antigos que `RetentionDays`.

> **Atenção:** a retenção **não** poda `backups\uploads` nem os `my.ini-*.bak`; a cópia de
> uploads não é podada e pode crescer sem limite. Monitore o espaço em
> `C:\ProgramData\Nexus\backups` e limpe manualmente o excedente. Dumps grandes ficam como
> `.sql` sem compactação e ocupam mais disco. Ver §15.

Verificação rápida:

```powershell
Get-ChildItem C:\ProgramData\Nexus\backups\db -File |
  Sort-Object LastWriteTime -Descending | Select-Object -First 3 Name, Length, LastWriteTime

# confira o conteúdo do dump mais recente (.zip ou .sql)
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

Copie os backups para fora do servidor (NAS, unidade de rede ou nuvem) — o script não faz
isso. Sem cópia externa, um defeito de disco perde banco, uploads e configuração juntos.

### 8.5 Restauração em produção

> **Pare o `NexusApp` antes de restaurar.** Todo o procedimento é em **PowerShell elevado**.
> O Caddy pode continuar no ar; os usuários verão erro até o app voltar. O dump foi feito com
> `--databases nexus_prod`, então contém `CREATE DATABASE`/`USE nexus_prod` — a importação
> **substitui as tabelas incluídas no dump** no banco de produção. Tabelas criadas depois do
> dump e que não estão nele **permanecem**; para voltar a um ponto exato, importe em um banco
> vazio ou recrie o `nexus_prod` antes.

1. Pare o serviço:

   ```powershell
   Stop-Service NexusApp -Force
   ```

2. Prepare o dump escolhido (`.zip` ou `.sql`):

   ```powershell
   $dump = "C:\ProgramData\Nexus\backups\db\nexus_prod-20261102-020000.zip"
   New-Item -ItemType Directory -Force -Path "D:\restore" | Out-Null
   if ($dump.EndsWith(".zip")) {
     Expand-Archive $dump -DestinationPath "D:\restore" -Force
     $sql = Get-ChildItem "D:\restore\*.sql" | Select-Object -First 1
   } else {
     $sql = Get-Item $dump
   }
   ```

3. Crie um arquivo de opções do MySQL com as credenciais do **root** (o `nexus_app` não tem
   privilégio para recriar o banco). Use o mesmo formato do `backup.cnf` e proteja o arquivo:

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

4. Importe o dump. O `Start-Process` com `-RedirectStandardInput` evita o problema de
   aspas do `cmd /c` e é o mesmo padrão usado pelos scripts:

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

5. Restaure os uploads (o `/MIR` remove o que não existe no backup — é o comportamento
   desejado para voltar ao ponto do dump):

   ```powershell
   robocopy "C:\ProgramData\Nexus\backups\uploads" "C:\ProgramData\Nexus\uploads" `
     /MIR /COPY:DAT /R:2 /W:2 /NP
   ```

6. Se necessário, restaure o `.env` de `backups\config\.env-<timestamp>` em
   `C:\Program Files\Nexus\app\.env` e reaplique a ACL:

   ```powershell
   Copy-Item "C:\ProgramData\Nexus\backups\config\.env-20261102-020000" `
     "C:\Program Files\Nexus\app\.env" -Force
   . "C:\Program Files\Nexus\scripts\common.ps1"
   Protect-File -Path "C:\Program Files\Nexus\app\.env" -ReadIdentities @("S-1-5-20")
   ```

7. Se necessário, restaure o `Caddyfile` de `backups\config\Caddyfile-<timestamp>` em
   `C:\ProgramData\Nexus\config\Caddyfile` e reaplique a leitura para o `LocalService`:

   ```powershell
   Copy-Item "C:\ProgramData\Nexus\backups\config\Caddyfile-20261102-020000" `
     "C:\ProgramData\Nexus\config\Caddyfile" -Force
   . "C:\Program Files\Nexus\scripts\common.ps1"
   Protect-File -Path "C:\ProgramData\Nexus\config\Caddyfile" -ReadIdentities @("S-1-5-19")
   ```

8. Remova o `restore.cnf` e reinicie/valide:

   ```powershell
   Remove-Item "C:\ProgramData\Nexus\config\restore.cnf" -Force
   Start-Service NexusApp
   Start-Service NexusCaddy
   & "C:\Program Files\Nexus\Instalador\smoke.ps1" -Hostname nexus.galpao.local
   ```

### 8.6 Restauração em banco de teste

Para ensaiar uma restauração sem tocar em `nexus_prod`:

1. Use **outra instância MySQL** (porta 3307 ou uma VM). O dump contém
   `CREATE DATABASE nexus_prod` e `USE nexus_prod`; na instância de teste isso cria o banco
   local dela, sem afetar produção.
2. Importe com o `mysql.exe` da instância de teste e credenciais dela.
3. Aponte um `.env` de desenvolvimento para a instância de teste (porta 3307) e rode a
   aplicação localmente.
4. Nunca aponte o teste para o mesmo `nexus_prod` da produção. Se precisar do mesmo
   servidor, edite o dump para outro nome de banco antes de importar.

---

## 9. Bandeja (`NexusTray`)

A bandeja é um executável .NET 8 self-contained (`C:\Program Files\Nexus\NexusTray\NexusTray.exe`),
com instância única (mutex global) e configuração em `tray.json`, ao lado do executável.

### 9.1 Estados

| Ícone | Estado | Condição |
| --- | --- | --- |
| verde | em execução | serviço `NexusApp` rodando e health HTTP 200 com `status=ok` e `db=true` |
| amarelo | degradado | serviço rodando, health responde, mas sem `status=ok`/`db=true` (ex.: banco indisponível) |
| vermelho | fora do ar | serviço parado/não instalado ou health inacessível |

O polling é a cada **20 s**; a transição de estado gera um balão. O tooltip mostra
`Nexus — estado · v<versão>`.

### 9.2 Menu

| Item | Ação |
| --- | --- |
| **Abrir Nexus** | abre `https://<hostname>` no navegador (via `explorer.exe`, fora do processo elevado) |
| **Status** | `Serviço: ... · Banco: ... · v...` (somente leitura) |
| **Reiniciar aplicação** | executa `C:\Program Files\Nexus\scripts\restart.ps1`: para o Caddy, reinicia o App, espera o health, inicia o Caddy e confere o health; log em `C:\ProgramData\Nexus\logs\restart-<timestamp>.log` |
| **Abrir logs** | abre `C:\ProgramData\Nexus\logs` |
| **Fazer backup agora** | roda `C:\Program Files\Nexus\scripts\backup.ps1` e informa o código de saída |
| **Abrir pasta de dados** | abre `C:\ProgramData\Nexus` |
| **Sair** | encerra apenas a bandeja; os serviços continuam |

### 9.3 `tray.json`

O bootstrap grava:

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

Se o arquivo faltar ou estiver inválido, a bandeja usa os padrões do código; os padrões de
`backupScript` e `restartScript` já apontam para `C:\Program Files\Nexus\scripts`. Mantenha
o `tray.json` no lugar para preservar os caminhos desta instalação.

### 9.4 Limitações

- A tarefa `NexusTray` é registrada no **logon do usuário que executou a instalação**, com
  `RunLevel Highest`; outros usuários do servidor não veem a bandeja.
- O executável tem `requireAdministrator`; abrir manualmente sem elevação pede UAC.
- O reinício usa o `restart.ps1` e afeta **Caddy e App**: se o App não voltar ao health, o
  Caddy permanece parado e o site fica fora do ar até uma intervenção; veja o log
  `restart-<timestamp>.log`. O `NexusMySQL84` **não** é reiniciado pelo `restart.ps1`.
- Falhas fatais da bandeja vão para `%LOCALAPPDATA%\NexusTray\tray.log` (do usuário), não
  para `C:\ProgramData\Nexus\logs`.

---

## 10. Health check e smoke test

### 10.1 `GET /api/health`

Rota pública (não exige sessão; `src/proxy.ts`), `force-dynamic`, runtime Node:

```json
{ "status": "ok", "db": true, "versao": "3.02.11.2026" }
```

- HTTP **200** quando `SELECT 1` no banco responde.
- HTTP **503** com `{ "status": "degraded", "db": false, "versao": "..." }` quando o banco
  não responde. A resposta não expõe mensagem, stack ou credencial.
- `versao` vem de `NEXT_PUBLIC_APP_VERSION`, definida no build a partir do `package.json`
  (`next.config.ts`). Por isso a versão do `package.json` deve ser igual à da tag.

### 10.2 `smoke.ps1`

```powershell
# PowerShell elevado; o smoke só lê o sistema
# exemplo de versão; use a versão da tag
cd "C:\Program Files\Nexus\Instalador"
.\smoke.ps1 -Hostname nexus.galpao.local -ExpectedVersion 3.02.11.2026
```

Confere `NexusMySQL84`/3214, os serviços `NexusApp`/`NexusCaddy`, as quatro regras de
firewall, as ACLs de `backups`/`config`/`app\.env` (sem `BUILTIN\Users`), o health local com
`db=true`, `https://<hostname>/login` e a versão. **Não ignora erro de certificado**: o HTTPS
só passa se a CA do Caddy estiver confiada no Windows. Saída `SMOKE: OK` (código 0) ou
`SMOKE: FALHOU (n verificação(ões))` (código 1).

### 10.3 Testes manuais

```powershell
Invoke-RestMethod http://127.0.0.1:3000/api/health | ConvertTo-Json
Invoke-WebRequest https://nexus.galpao.local/login -UseBasicParsing | Select-Object StatusCode
Get-Service NexusMySQL84, NexusApp, NexusCaddy | Select-Object Name, Status, StartType
Get-ScheduledTask NexusBackup, NexusTray | Select-Object TaskName, State
Get-NetFirewallRule -DisplayName "Nexus *" | Select-Object DisplayName, Enabled, Direction, Action
```

---

## 11. Solução de problemas

| Sintoma | Causa provável | O que fazer |
| --- | --- | --- |
| bootstrap falha na fase 2 (MySQL dedicado) | download/ZIP/MD5, `instalar-mysql.ps1` ou criação do serviço `NexusMySQL84` | leia o `bootstrap-*.log`; rode `instalar-mysql.ps1` isoladamente em PowerShell elevado; confira `C:\Program Files\Nexus\mysql\bin\mysqld.exe` e `C:\ProgramData\MySQL\MySQL Server 8.4\my.ini` |
| `NexusMySQL84` não iniciou / não aceita **3214** | `my.ini` inválido, `Data` corrompido ou serviço parado | restaure o backup `my.ini-<timestamp>.bak`, confira o erro em `C:\ProgramData\MySQL\MySQL Server 8.4\Data\*.err`, `Get-Service NexusMySQL84` e `Test-NetConnection 127.0.0.1 -Port 3214` |
| porta **3214** em uso | outro processo/serviço ocupa a porta | `Get-NetTCPConnection -LocalPort 3214 -State Listen`; pare o processo. A 3306 é independente e não precisa ser liberada |
| conflito de caminho do MySQL | já existe um MySQL 8.4 usando `C:\ProgramData\MySQL\MySQL Server 8.4` | não aponte duas instâncias para o mesmo `Data`/`my.ini`: faça backup e isole/renomeie a instância existente, ou use uma VM limpa; ver §15 |
| `mysql.exe`/`mysqldump.exe` não encontrado | binários dedicados ausentes em `C:\Program Files\Nexus\mysql` | rode o bootstrap/`instalar-mysql.ps1` de novo; não use o binário da 3306 para operar a 3214 |
| `NexusApp` não sobe | serviço `NexusMySQL84` parado (dependência), `.env`/ACL ou build | inicie `NexusMySQL84` e confira a 3214; veja `C:\ProgramData\Nexus\logs\app.err.log` e `app\.env` |
| health responde 503 (`db=false`) | `NexusMySQL84` parado, senha divergente, banco ausente ou `backup.cnf` antigo | `Get-Service NexusMySQL84`; teste `& "C:\Program Files\Nexus\mysql\bin\mysql.exe" --defaults-extra-file="C:\ProgramData\Nexus\config\backup.cnf" -h 127.0.0.1 -P 3214 -D nexus_prod -e "SELECT 1"`; se a senha/porta mudou, rode a fase 2 do bootstrap |
| regra de firewall ausente ou divergente | fase 3 não rodou, política alterada ou módulo `NetSecurity` indisponível | `Get-NetFirewallRule -DisplayName "Nexus *"`; reaplique as regras (bootstrap `-Force` ou `New-NetFirewallRule`) e valide com `smoke.ps1`; garanta que o `NetSecurity` está disponível no Windows PowerShell 5.1 |
| fase 5/7 falha em `https://<hostname>/login` | hostname não resolve no servidor ou DNS ainda não propagou | crie o registro A no DNS ou uma entrada em `C:\Windows\System32\drivers\etc\hosts`; teste `Resolve-DnsName <hostname>` |
| HTTPS com aviso de certificado nas estações | a CA interna do Caddy só foi confiada no servidor | exporte `C:\ProgramData\Nexus\caddy\data\caddy\pki\authorities\local\root.crt` e instale em **Autoridades de Certificação Raiz Confiáveis** nas estações |
| `bootstrap`/`smoke` falha ao confiar na CA | `root.crt` ainda não existe ou `certutil` falhou | confira `NexusCaddy`, `C:\ProgramData\Nexus\caddy\logs\caddy.err.log` e rode `certutil -addstore -f Root "C:\ProgramData\Nexus\caddy\data\caddy\pki\authorities\local\root.crt"` em PowerShell elevado |
| `NexusApp` não escreve uploads/logs | ACL de `uploads`/`logs` sem `NetworkService` | confira `icacls "C:\ProgramData\Nexus\uploads"` e `...\logs`; reaplique `Set-AclRestricted -ModifyIdentities S-1-5-20` ou rode o bootstrap |
| `NexusCaddy` não sobe | Caddyfile inválido, `LocalService` sem leitura do `Caddyfile`/pastas `caddy`, porta ocupada | `& "C:\Program Files\Nexus\caddy\caddy.exe" validate --config "C:\ProgramData\Nexus\config\Caddyfile" --adapter caddyfile`; confira `C:\ProgramData\Nexus\caddy\logs\caddy.err.log` e as ACLs de `caddy\{data,config,logs}`/`Caddyfile` |
| smoke falha em "ACL permite BUILTIN\Users" | `backups`, `config` ou `app\.env` herdaram `Users` | rode o `bootstrap`/`smoke` elevado; reaplique `Set-AclRestricted`/`Protect-File` (ou o bootstrap) e confira com `icacls` |
| bandeja vermelha com serviço rodando | health inacessível ou banco fora | confira o health local e o `app.err.log`; a bandeja mostra "banco indisponível" quando `db=false` |
| bandeja não aparece | tarefa registrada para outro usuário ou não houve logon | veja `Get-ScheduledTask NexusTray`; rode `C:\Program Files\Nexus\NexusTray\NexusTray.exe` elevado ou registre a tarefa para o usuário desejado |
| "Fazer backup agora" falha | `backup.ps1` ausente ou `tray.json` com `backupScript` inválido | confira `C:\Program Files\Nexus\scripts\backup.ps1`; o padrão do código já aponta para esse caminho — restaure o `tray.json` ou corrija o `backupScript` |
| "Reiniciar aplicação" falha e o site fica fora | `restart.ps1` não encontrado, health não voltou ou o `NexusCaddy` não religou | veja `C:\ProgramData\Nexus\logs\restart-<timestamp>.log`; o script para o Caddy antes e só o religa após o health — se falhar, religue manualmente `NexusCaddy` |
| backup falha com "backup.cnf usa a porta ..." | instalação antiga na 3306 ou `backup.cnf` desatualizado | rode a fase 2 do bootstrap (ou regrave o `backup.cnf` na 3214); confira `backup-<timestamp>.log` |
| backup falha no `mysqldump` | binário dedicado ausente, senha do `nexus_app` mudou ou `NexusMySQL84` fora | rode a fase 2 do bootstrap; confira o log `backup-<timestamp>.log` e o erro redigido no console |
| backup gera `.sql` grande e o disco enche | dump acima de ~1,8 GB é mantido sem compactar | confira `backups\db`; a retenção remove `.zip`/`.sql` antigos, mas não `backups\uploads`; limpe manualmente |
| atualização falha com "A tag ... não contém /api/health" ou versão divergente | tag antiga (`v1.02.11.2026`), `package.json` diferente da tag ou tag sem esta entrega | crie a nova tag DateVer, garanta `package.json` = tag e `-Tag` correto; veja `deploy-<tag>.log` |
| atualização falha e volta a versão anterior | build, `db push`, health, HTTPS ou smoke falharam | leia `deploy-<tag>.log` e `app.failed-<tag>`; se o banco mudou, restaure o dump (§8.5); scripts/Caddyfile copiados não são revertidos |
| atualização de uma instalação antiga (3306/sem firewall) não conclui | `atualizar.ps1` não migra o MySQL para a 3214 nem cria as regras de firewall | rode o bootstrap/instalador (fases 2/3), ou ajuste `DATABASE_URL`/`backup.cnf` e crie as regras antes |
| atualização não encontra hostname | `bootstrap.state.json` e `Caddyfile` ausentes | rode o bootstrap ou informe o hostname no `Caddyfile`; o `atualizar.ps1` não aceita `-Hostname` |
| instalador mostra `MsgBox` de erro ou o sistema não funciona após a instalação | o bootstrap não concluiu; o `instalador.iss` verifica o `ResultCode` e mostra `MsgBox` | confira `instalador-*.log` e `bootstrap-*.log`, corrija a causa e rode a instalação de novo |
| desinstalação mostra erro e preserva `app`/`NexusTray` | o `desinstalar.ps1` não conseguiu remover serviços/tarefas e abortou antes de apagar os diretórios | veja `desinstalar-*.log`; corrija o serviço/tarefa e rode de novo |
| disco enche | `backups\uploads` e `my.ini-*.bak` sem retenção; `app.failed-*` acumulam | limpe manualmente os diretórios antigos após conferir os backups |

### 11.1 Onde olhar primeiro

| Arquivo | Para quê |
| --- | --- |
| `C:\ProgramData\Nexus\logs\app.err.log` | erro da aplicação Next |
| `C:\ProgramData\Nexus\logs\app.out.log` | saída da aplicação |
| `C:\ProgramData\MySQL\MySQL Server 8.4\Data\*.err` | erro do `NexusMySQL84` |
| `C:\ProgramData\Nexus\caddy\logs\caddy.err.log` | erro do Caddy |
| `C:\ProgramData\Nexus\caddy\logs\access.log` | requisições HTTP |
| `C:\ProgramData\Nexus\logs\bootstrap-*.log` | instalação |
| `C:\ProgramData\Nexus\logs\instalador-*.log` | andamento do `.exe` |
| `C:\ProgramData\Nexus\logs\deploy-*.log` | atualização |
| `C:\ProgramData\Nexus\logs\backup-*.log` | backup |
| `C:\ProgramData\Nexus\logs\restart-*.log` | reinício pela bandeja |
| `C:\ProgramData\Nexus\logs\desinstalar-*.log` | desinstalação |
| Visualizador de Eventos → Windows Logs → System | erros de serviço/NSSM |
| `%LOCALAPPDATA%\NexusTray\tray.log` | falha fatal da bandeja (usuário) |

---

## 12. Segurança

### 12.1 ACLs e segredos

O `bootstrap.ps1` **remove a herança de `C:\ProgramData`** e aplica ACLs explícitas:

| Caminho | Permissão |
| --- | --- |
| `C:\ProgramData\Nexus` (raiz) | somente **Administrators** (S-1-5-32-544) e **SYSTEM** (S-1-5-18) |
| `C:\ProgramData\Nexus\uploads` | `NetworkService` (S-1-5-20) `Modify` + Administrators/SYSTEM |
| `C:\ProgramData\Nexus\logs` | `NetworkService` `Modify` + Administrators/SYSTEM |
| `C:\ProgramData\Nexus\backups` e `config` | somente Administrators/SYSTEM |
| `C:\ProgramData\Nexus\caddy\{data,config,logs}` | `LocalService` (S-1-5-19) `Modify` + Administrators/SYSTEM |
| `C:\ProgramData\Nexus\config\Caddyfile` | `LocalService` somente leitura (`Protect-File`) |
| `C:\Program Files\Nexus\app\.env` | `NetworkService` somente leitura; Administrators/SYSTEM controle total |
| `C:\ProgramData\Nexus\config\backup.cnf` | somente Administrators/SYSTEM; **o app não lê**; porta **3214** |
| `C:\Program Files\Nexus` e `app` | `ReadAndExecute` para `NetworkService`; `ProgramRoot` também para `LocalService`; `.next\cache` com `Modify` para `NetworkService` |
| `C:\Program Files\Nexus\mysql` | `ReadAndExecute` para `NetworkService` (binários do MySQL dedicado) |
| `C:\ProgramData\MySQL\MySQL Server 8.4` | somente Administrators/SYSTEM + `NetworkService` `Modify` (raiz e `Data`) |
| `C:\ProgramData\MySQL\MySQL Server 8.4\my.ini` | `NetworkService` somente leitura (`Protect-File`) |

- **`NexusApp`** roda como `NetworkService`; **`NexusCaddy`** como `LocalService`;
  **`NexusMySQL84`** como `NetworkService`.
- **`backup.cnf`** guarda a senha do `nexus_app` e a porta **3214**. Quem o usa é o
  `backup.ps1` (SYSTEM ou PowerShell elevado); o processo da aplicação não precisa e não
  consegue lê-lo.
- **`restore.cnf`** (criado manualmente para restauração): mesma proteção do `backup.cnf`;
  apague depois do uso.
- **Arquivos temporários do MySQL** (opções, SQL e saída): criados com `Protect-File` e
  removidos ao final; erros do `mysqldump` são redigidos (`password`/`identified by`).
- **Transcripts**: suspensos durante a leitura das senhas; não registram a digitação.
- **`JWT_SECRET`**: gerado com 48 bytes aleatórios (base64) quando ausente; preservado nas
  atualizações. Nunca reutilize o segredo de desenvolvimento.
- **Senhas**: `nexus_app` com até 256 caracteres, sem os símbolos que quebram URL/opções
  (`@`, `/`, `?`, `#`, `"`, `\`, `;`, espaço, tab ou controle); root sem quebra de linha.
  Não use `-p<senha>` na linha de comando.

O `smoke.ps1` verifica que `backups`, `config` e `app\.env` não tenham ACE para
`BUILTIN\Users` (S-1-5-32-545). Rode-o elevado para conseguir ler as ACLs restritas.

### 12.2 Exposição de rede

- O **Next** escuta apenas em `127.0.0.1:3000`; o **MySQL dedicado** apenas em
  `127.0.0.1:3214`. O MySQL existente na **3306** é independente e não é alterado.
- O **Caddy** é a única porta exposta (80/443) e usa **CA interna** (`tls internal`).
- O Caddy usa `admin off`: **não há API administrativa**.
- O bootstrap cria as quatro regras de entrada: `Nexus HTTP`/`Nexus HTTPS` Allow para
  `LocalSubnet`; `Nexus MySQL (LAN)` (3214) e `Nexus Next (LAN)` (3000) **Block** para
  `LocalSubnet`. O `smoke.ps1` valida as quatro. Ver §3.4.
- O MySQL dedicado usa `utf8mb4`/`utf8mb4_0900_ai_ci` e fuso `-03:00`; o X Plugin
  (`mysqlx`) fica desligado.

### 12.3 Backups

Os backups contêm banco (via `mysqldump` do MySQL dedicado, porta 3214), uploads, o `.env`
(com `DATABASE_URL` e `JWT_SECRET`) e o `Caddyfile`. Proteja
`C:\ProgramData\Nexus\backups` como dado sensível, copie para fora do servidor e restrinja
quem acessa a pasta. O `NexusBackup` roda como SYSTEM; o acesso manual exige elevação. A
pasta `caddy\data` (CA/chave privada) **não** entra no backup.

### 12.4 CA interna

O `bootstrap.ps1` instala a CA local com `certutil -addstore -f Root` a partir de
`C:\ProgramData\Nexus\caddy\data\caddy\pki\authorities\local\root.crt`. Para as estações,
distribua o `root.crt` por GPO/script e instale em **Autoridades de Certificação Raiz
Confiáveis**. A desinstalação **não** remove essa CA do trust store — ver §13.

---

## 13. Desinstalação

Use **Configurações → Aplicativos → Nexus → Desinstalar** (ou o atalho "Desinstalar Nexus"
no Menu Iniciar). O `.iss` **não tem `[UninstallRun]` nem `[UninstallDelete]`**: a remoção é
feita pelo `desinstalar.ps1`, chamado em `CurUninstallStepChanged(usUninstall)`. O Inno
verifica o `ResultCode` e mostra um `MsgBox` de erro se o script falhar.

### 13.1 O que é removido

- Serviços **`NexusCaddy`**, **`NexusApp`** e **`NexusMySQL84`** (parados e removidos; os
  dois primeiros usam NSSM se disponível, senão `sc.exe`; o MySQL usa `sc.exe`).
- Tarefas agendadas **`NexusTray`** e **`NexusBackup`**.
- Processo da bandeja em execução.
- `C:\Program Files\Nexus\app`
- `C:\Program Files\Nexus\NexusTray`
- `C:\Program Files\Nexus\caddy`
- `C:\Program Files\Nexus\tools` (NSSM)
- `C:\Program Files\Nexus\scripts`
- `C:\Program Files\Nexus\mysql` (binários do MySQL dedicado)
- Versões antigas `app.prev-*`, `app.failed-*` e `app.prev-manual-*`
- `C:\ProgramData\Nexus\caddy` (dados/configuração/logs e a CA local)
- As quatro regras de firewall `Nexus *` (quando o módulo `NetSecurity` está disponível;
  caso contrário, o log avisa e elas permanecem)
- O diretório do instalador (`C:\Program Files\Nexus\Instalador`) é removido pelo Inno.

O script só apaga `app`, `NexusTray`, o `mysql` e as versões antigas **depois** de remover
serviços e tarefas com sucesso. Se falhar antes disso, ele mostra erro e **preserva** esses
diretórios; o Inno ainda remove os arquivos do próprio `Instalador`.

### 13.2 O que é preservado

- **`C:\ProgramData\Nexus`**, exceto `caddy`: `uploads`, `logs`, `backups`, `config`
  (`Caddyfile`, `backup.cnf`) e `bootstrap.state.json`.
- **`C:\ProgramData\MySQL\MySQL Server 8.4`** (Data e `my.ini` do MySQL dedicado).
- **MySQL existente na 3306**, se houver e usar outro diretório de dados: serviço, dados e
  configuração não são tocados.
- **Node.js**, **Git** e o VC++ Redistributable.
- A **CA interna** no repositório de confiança do Windows (o `root.crt` continua confiado,
  embora os arquivos em `caddy\data` tenham sido removidos).

Para uma remoção **total** (depois de copiar o que precisa):

1. Rode a desinstalação normal.
2. Apague `C:\ProgramData\Nexus` manualmente (isso apaga banco lógico, uploads, backups e
   configuração restantes).
3. Se o `C:\ProgramData\MySQL\MySQL Server 8.4` for **exclusivo do Nexus**, apague-o também;
   se for de um MySQL 8.4 existente, **não** apague.
4. Desinstale o Node.js e o Git, se não forem usados por outro sistema; o MySQL da 3306, se
   existir, é independente.
5. Remova a CA da Caddy de **Autoridades de Certificação Raiz Confiáveis**
   (`certlm.msc`) — procure o certificado da CA local da Caddy e exclua.
6. Remova `C:\Program Files\Nexus\Instalador`, se ele ainda existir (desinstalação manual).

> A desinstalação manual (fora do Inno) é:
> `powershell -NoProfile -ExecutionPolicy Bypass -File "C:\Program Files\Nexus\Instalador\desinstalar.ps1"`.
> Ela não remove o próprio diretório `Instalador`.

---

## 14. Checklist de release de produção

- [ ] Entregas aprovadas (reviewer sem bloqueante; QA verde) e `CHANGELOG.md` atualizado.
- [ ] Documentação de `/docs` atualizada (incluindo este runbook, se o processo mudou).
- [ ] **Criar uma nova tag DateVer** `vN.DD.MM.YYYY` (a `v1.02.11.2026` não contém
      `/api/health`; a `v2.02.11.2026` não contém o MySQL 3214/firewall). Bump do
      `package.json` para a mesma versão da tag (o health reporta essa versão e o smoke a
      compara).
- [ ] `deploy/windows/manifesto.json` **não guarda tag**: o build do instalador passa
      `v<versão>` a partir do `package.json`; o bootstrap manual exige `-Tag`. Confira também
      `mysql.version` = **8.4.13**, `mysql.url` do ZIP oficial e `mysql.md5`.
- [ ] Commit de release na `main`; tag criada e **enviada ao GitHub** (o bootstrap e o
      `atualizar.ps1` clonam a tag; sem ela, a instalação falha).
- [ ] Branch local **`producao`** avançada por **fast-forward** até o commit da release
      (worktree de produção; hoje a branch não tem upstream configurado — o push, se houver,
      é manual).
- [ ] Se a bandeja mudou: `deploy\windows\NexusTray\build.ps1` (requer **.NET 8 SDK**;
      `dist\NexusTray.exe` é ignorado pelo Git e é gerado no build).
- [ ] Instalador gerado: `deploy\windows\build-instalador.ps1` → `out\NexusSetup-<versão>.exe`
      (Inno Setup 7; baixa o ISCC 7.1.0 do NuGet se necessário). Se a tag existir localmente
      e não tiver `/api/health`, o script **recusa** a compilação; se a tag não existir
      localmente, a validação fica para o clone.
- [ ] Ensaio em **VM Windows limpa** (10/11 x64, sem Node/Git/MySQL): instalação completa,
      MySQL 8.4.13 dedicado automático (sem pausa), primeira execução/Super Admin,
      `smoke.ps1`, login e uma operação básica. Teste também:
      - uma VM com **MySQL 8.4 já existente na 3306**, para confirmar que ele não é tocado;
      - o cenário de **conflito de caminho** (MySQL 8.4 usando
        `C:\ProgramData\MySQL\MySQL Server 8.4`) — ver §15;
      - a atualização a partir da tag anterior e a desinstalação preservando
        `C:\ProgramData\Nexus` e `C:\ProgramData\MySQL\MySQL Server 8.4`.
- [ ] **Backup manual** da produção + cópia para fora do servidor; confira o dump mais
      recente (§8.4) e o `backup.cnf` na **3214**.
- [ ] Janela de manutenção comunicada; planeje a **indisponibilidade total** durante a
      atualização e o rollback (`app.prev-*` + dump).
- [ ] Atualização executada com `atualizar.ps1 -Tag v...`; acompanhe o `deploy-<tag>.log`.
      Se a instalação ainda estiver na 3306, use o bootstrap/instalador para migrar (ver
      §7.1).
- [ ] Pós-release: `smoke.ps1` (serviços, 3214, firewall, ACLs, health), `/api/health` com
      `db=true`, login, versão exibida, tarefa `NexusBackup` e bandeja no estado verde.
- [ ] Evidências registradas (data, tag, commit, resultado do smoke e do backup).

> **Dívida de release:** o `db push` ainda é o mecanismo de schema. Antes de uma release
> com mudança destrutiva ou nova constraint única, revise o `CHANGELOG`, rode o script de
> preparação indicado (ex.: `db:dedupe-notas`) e ensaie em banco de teste. O caminho alvo é
> SQL revisado/migrations versionadas.

---

## 15. Atenções conhecidas (divergências entre scripts)

As divergências de ACL/conta, Caddy, reinício, atualização, backup e desinstalação foram
corrigidas no `RUN-20261102-23..25`; o firewall passou a ser criado nesta entrega. A lista
abaixo contém apenas o que permanece real nos scripts desta branch; correções de código são
feitas fora deste documento.

1. **A retenção do backup não cobre uploads.**
   `backup.ps1` poda `backups\db\*.zip`, `backups\db\*.sql` e
   `backups\config\.env-*`/`Caddyfile-*`. A cópia de `backups\uploads` (e os
   `my.ini-*.bak`) não é podada e pode crescer sem limite.

2. **O backup não inclui os dados do Caddy.**
   O `Caddyfile` é copiado, mas `C:\ProgramData\Nexus\caddy\data` (CA e chave privada) não
   entra no backup. Após uma perda total, o Caddy gera uma CA nova e as estações precisam
   confiar nela de novo.

3. **A bandeja é registrada só para o usuário que instalou.**
   `NexusTray` usa `AtLogOn -User $currentUser`; outros usuários do servidor não a veem.

4. **O `.env` não é mesclado na atualização.**
   `atualizar.ps1` copia o `.env` anterior inteiro e só garante `UPLOADS_DIR`. Variáveis
   novas introduzidas por uma release não são adicionadas automaticamente; compare com
   `.env.example` e ajuste à mão (reaplicando a ACL).

5. **`app.failed-*` e `app.prev-manual-*` não são limpos.**
   O `atualizar.ps1` mantém a versão anterior e mais uma `app.prev-*`, mas não remove
   `app.failed-*`; o bootstrap também deixa `app.prev-manual-*`. A desinstalação remove
   esses diretórios, mas durante a operação eles acumulam. Monitore o disco.

6. **Hashes do manifesto.**
   `manifesto.json` ainda tem `sha256: ""` para Node, VC++ e Caddy; o MySQL usa **MD5**; o
   NSSM tem `exe_sha256` e vai embutido. Caddy/Git usam "latest" quando a URL não está
   fixada. Preencha os hashes restantes para instalações reproduzíveis.

7. **Hostname e DNS.**
   O bootstrap adiciona `127.0.0.1 <hostname>` ao `hosts` do próprio servidor se o nome não
   resolver (necessário para o smoke HTTPS local). As estações clientes ainda precisam de
   DNS/hosts e da CA do Caddy confiável; isso não é feito pelo instalador.

8. **`db push` não é migration.**
   O `atualizar.ps1` aplica `prisma db push` e roda `db:seed` em toda atualização. Mudanças
   destrutivas podem exigir `--accept-data-loss`/SQL revisado e scripts de preparação; o
   caminho alvo é SQL revisado em releases futuras.

9. **A desinstalação preserva a CA no trust store.**
   `desinstalar.ps1` remove `C:\ProgramData\Nexus\caddy` (inclusive os arquivos da CA),
   mas não remove o certificado raiz da Caddy do repositório de confiança do Windows. Para
   remoção total, exclua-o manualmente (§13).

10. **Conflito de caminho com um MySQL 8.4 existente.**
    O Nexus usa `C:\ProgramData\MySQL\MySQL Server 8.4` para `Data`/`my.ini`. Se a máquina
    já tiver um MySQL 8.4 usando esse mesmo diretório, as duas instâncias disputam os mesmos
    arquivos (e o `instalar-mysql.ps1` pode sobrescrever o `my.ini`/usar o `Data` errado).
    Não instale o Nexus nessa máquina sem isolar/backup da instância existente; o MySQL na
    **3306** que usa outro `Data` não é afetado.

11. **O `atualizar.ps1` não migra o MySQL nem cria o firewall.**
    Ele preserva o `.env`/`backup.cnf` anteriores e não executa `instalar-mysql.ps1` nem
    `Set-NexusFirewallRules`. Para migrar da 3306 ou regularizar as regras, rode o
    bootstrap/instalador (fases 2/3) ou ajuste `DATABASE_URL`/`backup.cnf` e crie as regras
    manualmente.

---

## 16. Referências

| Assunto | Arquivo |
| --- | --- |
| instalador | [`deploy/windows/instalador.iss`](../../deploy/windows/instalador.iss) e [`build-instalador.ps1`](../../deploy/windows/build-instalador.ps1) |
| instalação | [`bootstrap.ps1`](../../deploy/windows/bootstrap.ps1) e [`instalar-gui.ps1`](../../deploy/windows/instalar-gui.ps1) |
| MySQL | [`instalar-mysql.ps1`](../../deploy/windows/instalar-mysql.ps1) e [`pos-instalacao-mysql.ps1`](../../deploy/windows/pos-instalacao-mysql.ps1) |
| atualização | [`atualizar.ps1`](../../deploy/windows/atualizar.ps1) |
| backup | [`backup.ps1`](../../deploy/windows/backup.ps1) |
| reinício | [`restart.ps1`](../../deploy/windows/restart.ps1) |
| validação | [`smoke.ps1`](../../deploy/windows/smoke.ps1) e [`src/app/api/health/route.ts`](../../src/app/api/health/route.ts) |
| uploads | [`src/lib/uploads.ts`](../../src/lib/uploads.ts) |
| bandeja | [`deploy/windows/NexusTray/`](../../deploy/windows/NexusTray/) |
| desinstalação | [`desinstalar.ps1`](../../deploy/windows/desinstalar.ps1) |
| versão e changelog | [`VERSIONAMENTO.md`](VERSIONAMENTO.md) |
| regras do projeto | [`AGENTS.md`](../../AGENTS.md) |
