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
┌─────────────────────┐        ┌──────────────────────┐        ┌──────────────────┐
│ NexusCaddy (Caddy)  │ ─────► │ NexusApp (Next.js)   │ ─────► │ MySQL84          │
│ 0.0.0.0:80/443      │  HTTP  │ 127.0.0.1:3000       │  3306  │ 127.0.0.1:3306   │
└─────────────────────┘        └──────────────────────┘        └──────────────────┘
        ▲                                ▲
        │ caddy trust (CA local)         │ .env + UPLOADS_DIR
        │                                ▼
        │                        C:\ProgramData\Nexus\uploads
        │
   C:\ProgramData\Nexus\logs  ·  C:\ProgramData\Nexus\backups
```

| Peça | Papel |
| --- | --- |
| `NexusSetup-<versão>.exe` | instalador **Inno Setup 7**; não embute o código da aplicação — o bootstrap clona a tag do GitHub durante a instalação |
| [`bootstrap.ps1`](../../deploy/windows/bootstrap.ps1) | instalação em **8 fases (0–7)**, idempotente e retomável; estado em `C:\ProgramData\Nexus\bootstrap.state.json` |
| [`pos-instalacao-mysql.ps1`](../../deploy/windows/pos-instalacao-mysql.ps1) | ajusta o `my.ini`, cria `nexus_prod` e o usuário `nexus_app` |
| [`atualizar.ps1`](../../deploy/windows/atualizar.ps1) | atualização com backup, troca de versão e rollback da aplicação |
| [`backup.ps1`](../../deploy/windows/backup.ps1) | backup do banco, dos uploads e do `.env` |
| [`smoke.ps1`](../../deploy/windows/smoke.ps1) | smoke test dos serviços, do health e do HTTPS |
| [`desinstalar.ps1`](../../deploy/windows/desinstalar.ps1) | remove serviços, tarefas e arquivos instalados; **preserva** `C:\ProgramData\Nexus` |
| `NexusTray` | bandeja em **.NET 8** (WinForms, self-contained) para acompanhar o serviço e reiniciá-lo |
| [`common.ps1`](../../deploy/windows/common.ps1) | funções e caminhos compartilhados pelos scripts |

### 1.1 Versões e componentes

| Componente | Versão/origem | Onde está definido |
| --- | --- | --- |
| Node.js | **24.19.0** (instalação exata; outra versão é substituída) | `manifesto.json` |
| NSSM | **2.24** | `manifesto.json` |
| MySQL | **8.4 LTS**, edição **Server only**, serviço `MySQL84` | instalado manualmente no instalador da Oracle |
| VC++ Redistributable | **14.x** (`vc_redist.x64.exe`) | `manifesto.json` |
| Caddy | **latest** (manifesto sem URL) ou a URL fixada no manifesto | `manifesto.json` |
| Git for Windows | já instalado ou **latest** (manifesto sem URL) | `manifesto.json` |
| Bandeja | **.NET 8**, `win-x64`, self-contained, single-file | `NexusTray/NexusTray.csproj` |
| Instalador | **Inno Setup 7**; se o `ISCC.exe` não existir, baixa o pacote NuGet **7.1.0** | `build-instalador.ps1` |

> **Atenção:** os campos `sha256` do `manifesto.json` estão vazios para Node, NSSM e VC++;
> Caddy e Git caem no "latest" quando a URL não está fixada. Os downloads são protegidos
> apenas pelo TLS — não há verificação de hash. Ver §15.

---

## 2. Caminhos reais

### 2.1 `C:\Program Files\Nexus`

| Caminho | Conteúdo |
| --- | --- |
| `app\` | clone Git da tag em produção; `.env`, `node_modules`, `.next` |
| `Instalador\` | scripts entregues pelo `.exe`: `bootstrap.ps1`, `atualizar.ps1`, `backup.ps1`, `smoke.ps1`, `common.ps1`, `desinstalar.ps1`, `instalar-gui.ps1`, `build-instalador.ps1`, `Caddyfile`, `manifesto.json`, `NexusTray.exe` |
| `scripts\` | `backup.ps1` e `common.ps1` copiados pelo bootstrap; usados pela tarefa `NexusBackup` e pela bandeja |
| `NexusTray\` | `NexusTray.exe` e `tray.json` (caminhos reais, sem segredos) |
| `caddy\` | `caddy.exe` |
| `tools\nssm\` | `nssm.exe` |
| `app.prev-<tag>\` | versão anterior mantida pelo `atualizar.ps1` (até duas) |
| `app.failed-<tag>\` | versão que falhou na atualização, mantida para diagnóstico |
| `app.prev-manual-<timestamp>\` | diretório antigo movido pelo `bootstrap.ps1 -Force` |

### 2.2 `C:\ProgramData\Nexus`

| Caminho | Conteúdo |
| --- | --- |
| `bootstrap.state.json` | fase concluída, hostname, tag e pausa do bootstrap |
| `uploads\` | raiz física dos uploads; é o valor de `UPLOADS_DIR` |
| `logs\` | `app.out.log`/`app.err.log`, `caddy.out.log`/`caddy.err.log`, `bootstrap-*.log`, `instalador-*.log`, `deploy-*.log`, `desinstalar-*.log` |
| `backups\db\` | dumps `nexus_prod-<timestamp>.zip` |
| `backups\uploads\` | cópia dos uploads |
| `backups\config\` | `.env-<timestamp>` e backups do `my.ini` (`my.ini-<timestamp>.bak`) |
| `config\Caddyfile` | Caddyfile gerado a partir do template, com o hostname real |
| `config\backup.cnf` | credenciais do `nexus_app` para o `mysqldump` (ACL restrita) |
| `caddy\data\` | dados do Caddy (`XDG_DATA_HOME`); a CA local fica em `caddy\data\caddy\pki\authorities\local\` |
| `caddy\config\` | configuração do Caddy (`XDG_CONFIG_HOME`) |

### 2.3 Fora de `Nexus`

| Caminho | Conteúdo |
| --- | --- |
| `C:\ProgramData\Caddy\logs\access.log` | log de acesso do Caddy (roll de 10 MiB, mantém 5) |
| `C:\Program Files\MySQL\MySQL Server 8.4\` | instalação do MySQL e `mysql.exe`/`mysqldump.exe` |
| `C:\ProgramData\MySQL\MySQL Server 8.4\my.ini` | configuração do MySQL ajustada pelo pós-instalação |

> `C:\ProgramData\Caddy` é removido na desinstalação; `C:\ProgramData\Nexus` **não** é.
> Ver §13.

---

## 3. Serviços, tarefas e portas

### 3.1 Serviços

| Nome | Criado por | Conta | Início | Depende de | Logs |
| --- | --- | --- | --- | --- | --- |
| `MySQL84` | MySQL Installer 8.4 LTS | conta do serviço MySQL | automático | — | log do MySQL |
| `NexusApp` | `bootstrap.ps1` (NSSM) | `NT AUTHORITY\NetworkService` | automático | `MySQL84` | `C:\ProgramData\Nexus\logs\app.out.log` e `app.err.log` |
| `NexusCaddy` | `bootstrap.ps1` (NSSM) | `NT AUTHORITY\NetworkService` | automático | `NexusApp` | `caddy.out.log`/`caddy.err.log` + access log em `C:\ProgramData\Caddy\logs` |

O NSSM configura `AppExit Default Restart` (reinício após 5 s), rotação de log em 10 MiB e
parada com 15 s para o console. Se o `NexusApp` não subir, o `NexusCaddy` também não sobe
por causa da dependência.

### 3.2 Tarefas agendadas

| Nome | Gatilho | Conta | Comando |
| --- | --- | --- | --- |
| `NexusBackup` | diário às **02:00** (executa no próximo boot se a máquina estiver desligada) | `SYSTEM` | `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Program Files\Nexus\scripts\backup.ps1" -RetentionDays 30` |
| `NexusTray` | **logon do usuário que executou a instalação** | esse usuário, `RunLevel Highest` | `C:\Program Files\Nexus\NexusTray\NexusTray.exe` |

A bandeja roda elevada (`requireAdministrator`) para reiniciar o serviço via NSSM sem pedir
UAC. Ela **não** é registrada para "todos os usuários" — ver §9 e §15.

### 3.3 Portas

| Porta | Serviço | Escuta | Observação |
| --- | --- | --- | --- |
| `3306` | `MySQL84` | `127.0.0.1` | `bind-address=127.0.0.1`; X Plugin desligado (`mysqlx=0`) |
| `3000` | `NexusApp` | `127.0.0.1` | `next start -H 127.0.0.1 -p 3000` |
| `80`/`443` | `NexusCaddy` | todas as interfaces | HTTPS com CA interna; a 80 atende o redirecionamento automático do Caddy |
| `2019` | Caddy (admin) | `localhost` | usado pelo `caddy trust`; **não** deve ser exposto na rede |

O `bootstrap.ps1` verifica 3306, 3000, 80 e 443 antes de instalar. A **2019 não é
verificada** — ver §15.

---

## 4. Pré-requisitos

- Windows **64 bits** (Windows 10/11 ou Windows Server compatível), com PowerShell 5.1.
- Execução em **PowerShell elevado** (Administrador): a instalação, a atualização e a
  desinstalação exigem elevação; o backup manual também, por causa da ACL do `backup.cnf`.
- Pelo menos **5 GB livres em `C:`**.
- **Internet** durante a instalação/atualização: o `bootstrap` baixa Node, Git, NSSM,
  Caddy, VC++ e clona a tag do GitHub. A checagem inicial usa `nodejs.org:443`; acesso ao
  GitHub também é necessário.
- Relógio do servidor com no máximo **10 minutos** de diferença do horário da internet.
- **Hostname DNS** válido (ex.: `nexus.galpao.local`), sem `http://`, porta ou caminho.
  Ele precisa resolver **no próprio servidor** e nas estações clientes.
- Portas 3306, 3000, 80 e 443 livres (ou já usadas pelos próprios serviços do Nexus).
- Acesso à internet e à tag do GitHub no momento da instalação — o pacote do instalador
  **não** contém o código da aplicação.

> **Firewall:** os scripts **não criam regras de firewall**. Se as estações vão acessar o
> servidor pela rede, libere TCP 80 e 443 no Windows Firewall (a 3000 e a 3306 devem
> continuar locais). Ver §12.

---

## 5. Instalação pelo instalador (`NexusSetup-<versão>.exe`)

### 5.1 O que o wizard pergunta

1. Verifica se o Windows é **64 bits**; se não for, aborta.
2. Pede o **hostname** (nome DNS), com o valor inicial `nexus.galpao.local`. O campo aceita
   apenas letras, números, ponto e hífen; é convertido para minúsculas.
3. Permite marcar o ícone na **Área de Trabalho** (opcional). O diretório de instalação é
   fixo: `C:\Program Files\Nexus\Instalador`.
4. Ao concluir os arquivos, executa o `instalar-gui.ps1` em uma janela visível (o bootstrap
   precisa do console para pedir as senhas do MySQL) e aguarda o término.

O `instalar-gui.ps1` grava o andamento em
`C:\ProgramData\Nexus\logs\instalador-<timestamp>.log` e mostra MessageBox de sucesso,
falha ou pausa para o MySQL. O bootstrap grava o log detalhado em
`C:\ProgramData\Nexus\logs\bootstrap-<timestamp>.log`.

> **Atenção:** o `[Run]` do Inno Setup não verifica o código de saída do
> `instalar-gui.ps1`; o assistente pode chegar ao fim mesmo quando o bootstrap falha. O
> sinal real é a MessageBox de erro e o log — não confie apenas na tela final. Ver §15.

### 5.2 Pausa para o MySQL 8.4 LTS

O MySQL **não** é instalado pelo Nexus. Quando a fase 2 não encontra o serviço `MySQL84`,
o bootstrap grava o estado e sai com **código 2**. O `instalar-gui.ps1` mostra uma caixa
"MySQL 8.4 necessário":

1. Baixe o **MySQL Installer 8.4 LTS** em <https://dev.mysql.com/downloads/installer/>.
2. Escolha **MySQL Server 8.4 (Server only)** e conclua o instalador gráfico.
3. Defina e guarde a senha do **root**. Mantenha o nome de serviço padrão **`MySQL84`**.
4. Volte à janela do instalador e clique em **Sim**; ele chama
   `bootstrap.ps1 -Resume` e continua da fase 2.
5. Se clicar em **Não**, a instalação é cancelada; nada é perdido e o estado permanece.

O pós-instalação ajusta o `my.ini` (backup em
`C:\ProgramData\Nexus\backups\config\my.ini-<timestamp>.bak`):

```ini
[mysqld]
bind-address=127.0.0.1
mysqlx=0
character-set-server=utf8mb4
collation-server=utf8mb4_0900_ai_ci
default-time-zone='-03:00'
```

Depois reinicia o `MySQL84`, cria o banco `nexus_prod` (utf8mb4/utf8mb4_0900_ai_ci) e o
usuário `nexus_app@localhost` com `GRANT ALL PRIVILEGES ON nexus_prod.*`, e valida a
conexão do `nexus_app` por TCP em `127.0.0.1:3306`.

### 5.3 Senhas

| Senha | Regra real | Onde é usada |
| --- | --- | --- |
| **root do MySQL** | não vazia, sem quebra de linha; passada por arquivo de opções temporário, nunca por `-p` | criação do banco/usuário e restauração |
| **`nexus_app`** | **12 a 64 caracteres**, apenas letras, números, ponto, hífen e sublinhado — **sem `@`, `:`, `/`, espaço, aspas ou acento** | `DATABASE_URL`, `backup.cnf` e `mysqldump` |

A restrição do `nexus_app` existe porque a `DATABASE_URL` é montada como
`mysql://nexus_app:<senha>@127.0.0.1:3306/nexus_prod` e o parser de `src/lib/prisma.ts`
usa `:` e `@` como separadores. A senha do root **não** entra nessa URL; por isso não tem a
mesma restrição de caracteres.

As senhas são lidas com `Read-Host -AsSecureString`; o transcript é suspenso durante a
leitura e os arquivos temporários do MySQL nascem com ACL restrita. O `backup.cnf` fica
com acesso apenas para Administrators/SYSTEM.

### 5.4 O que o bootstrap faz (fases 0–7)

| Fase | O que faz |
| --- | --- |
| **0 — Pré-checagem** | confere Administrador, 64 bits, 5 GB livres em `C:`, internet (`nodejs.org:443`), portas 3306/3000/80/443 e relógio (tolerância de 10 min) |
| **1 — Runtime** | instala VC++ x64, **Node.js 24.19.0** (se a versão instalada for diferente) e Git for Windows (se ausente); atualiza o PATH da sessão |
| **2 — MySQL** | exige o serviço `MySQL84`; pausa com código 2 se ele não existir; inicia o serviço, testa o `nexus_app` com o `backup.cnf` existente e, se necessário, pede as senhas e roda o `pos-instalacao-mysql.ps1`; grava `backup.cnf` |
| **3 — Ferramentas, diretórios e ACLs** | instala **NSSM 2.24** e **Caddy**; gera o `Caddyfile` a partir do template com o hostname; valida o Caddyfile; cria os diretórios e aplica ACLs para o `NetworkService` |
| **4 — Aplicação** | clona/atualiza a tag do GitHub em `C:\Program Files\Nexus\app`; grava o `.env` (`DATABASE_URL`, `UPLOADS_DIR`, `NODE_ENV=production`, `PORT=3000`, `JWT_SECRET` gerado se ausente); roda `npm ci`, `db:generate`, `build`, `db:push` e `db:seed`; ajusta ACLs do `.env` e do cache |
| **5 — Serviços** | cria/reconfigura `NexusApp` e `NexusCaddy` via NSSM; inicia o app; valida `http://127.0.0.1:3000/api/health` com `db=true`; inicia o Caddy; executa `caddy trust` (até 15 tentativas) e valida `https://<hostname>/login` |
| **6 — Bandeja e backup** | copia `backup.ps1`/`common.ps1` para `C:\Program Files\Nexus\scripts`; registra `NexusBackup` (diária, 02:00); copia o `NexusTray.exe` e grava o `tray.json`; registra `NexusTray` no logon do usuário atual |
| **7 — Smoke e resumo** | roda o `smoke.ps1` com a versão esperada (tag sem o `v`) e imprime URL, caminhos, versão e o comando de atualização |

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
& "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" `
  -NoProfile -ExecutionPolicy Bypass `
  -File "C:\Program Files\Nexus\Instalador\smoke.ps1" `
  -Hostname nexus.galpao.local -ExpectedVersion 1.02.11.2026
```

O smoke test confere:

- `MySQL84`, `NexusApp` e `NexusCaddy` em execução;
- `GET http://127.0.0.1:3000/api/health` → HTTP 200 com `db=true`;
- `https://<hostname>/login` → HTTP 200 (com validação de certificado; exige `caddy trust`);
- versão do health igual à esperada, quando `-ExpectedVersion` é informado.

Saída esperada: `SMOKE: OK` e código 0. Qualquer falha retorna código 1 e lista os itens.
O mesmo teste pode ser rodado depois, a qualquer momento, em qualquer PowerShell (não exige
elevação).

---

## 6. Instalação manual (sem o `.exe`)

O `.exe` é apenas um empacotador dos scripts. A instalação manual usa o `bootstrap.ps1`
diretamente, a partir de `C:\Program Files\Nexus\Instalador` (instalação já existente) ou
de um checkout do repositório (`deploy\windows`).

```powershell
# PowerShell elevado
cd "C:\Program Files\Nexus\Instalador"   # ou o checkout: cd deploy\windows
powershell -NoProfile -ExecutionPolicy Bypass -File .\bootstrap.ps1 `
  -Hostname nexus.galpao.local
```

Parâmetros:

| Parâmetro | Efeito |
| --- | --- |
| `-Hostname` | obrigatório; nome DNS usado pelo Caddy |
| `-Resume` | retoma da última fase concluída (exige `bootstrap.state.json`) |
| `-Force` | ignora o estado e reinstala sobre o diretório existente; permite trocar o hostname |
| `-SkipTray` | não copia nem registra a bandeja |
| `-TrayExe` | caminho explícito do `NexusTray.exe`; se informado e ausente, falha |
| `-RepoUrl` | URL do repositório; padrão: `manifesto.json` |
| `-Tag` | tag a instalar; padrão: `manifesto.json` |

Exemplo de retomada após instalar o MySQL:

```powershell
.\bootstrap.ps1 -Hostname nexus.galpao.local -Resume
```

Se o diretório `C:\Program Files\Nexus\app` existir, não for um repositório Git e tiver
arquivos, o bootstrap recusa continuar sem `-Force`; com `-Force`, move o diretório para
`C:\Program Files\Nexus\app.prev-manual-<timestamp>` e reinstala.

Logs: `C:\ProgramData\Nexus\logs\bootstrap-<timestamp>.log` e o resumo no console. A
instalação manual **não** copia `atualizar.ps1`/`smoke.ps1` para
`C:\Program Files\Nexus\scripts` — apenas `backup.ps1` e `common.ps1`; os demais continuam
no checkout de origem.

---

## 7. Atualização

### 7.1 Antes de atualizar

1. Leia o `CHANGELOG.md` da versão e confirme se há mudança de schema, script de preparação
   ou variável de ambiente nova.
2. Confirme que a tag existe no GitHub (`git ls-remote --tags origin vN.DD.MM.YYYY`); o
   `atualizar.ps1` clona a tag, não um branch.
3. Rode um backup manual e copie o resultado para fora do servidor (§8).
4. Agende uma **janela de manutenção**: o `NexusApp` é parado durante o build; o Caddy
   continua no ar, mas o upstream fica indisponível (erro 502/503 para os usuários).
5. Tenha o plano de rollback (§7.4) e o dump mais recente à mão.

### 7.2 Comando

```powershell
# PowerShell elevado, em C:\Program Files\Nexus\Instalador
.\atualizar.ps1 -Tag v1.03.11.2026
```

`-RepoUrl` sobrescreve a URL (padrão: `remote origin` da instalação atual ou
`manifesto.json`). `-SkipBackup` pula o backup — **não recomendado**.

### 7.3 O que o `atualizar.ps1` faz

1. Confere `C:\Program Files\Nexus\app\package.json` e o serviço `NexusApp`.
2. Descobre o hostname no `bootstrap.state.json` (ou no `Caddyfile`).
3. Roda o `backup.ps1`; se o backup falhar, **cancela antes de alterar a aplicação**.
4. Para o `NexusApp`.
5. Move a aplicação atual para `C:\Program Files\Nexus\app.prev-<tag-atual>`.
6. Clona a nova tag em `C:\Program Files\Nexus\app`.
7. Copia o `.env` da versão anterior e reaplica a ACL restrita.
8. Executa `npm ci`, `db:generate`, `build`, `db:push` e `db:seed`.
9. Ajusta ACLs do cache (`Modify`) e da aplicação (`ReadAndExecute`).
10. Inicia `NexusApp` e `NexusCaddy`; valida o health local com `db=true`, o
    `https://<hostname>/login` e o `smoke.ps1` com a versão da tag.
11. Mantém a versão anterior e mais uma `app.prev-*`; remove as mais antigas. A versão
    atual nunca é apagada.

Log: `C:\ProgramData\Nexus\logs\deploy-<tag>.log`.

### 7.4 Rollback

Se qualquer etapa falhar, o `atualizar.ps1`:

1. para o `NexusApp`;
2. move a versão com falha para `C:\Program Files\Nexus\app.failed-<tag>`;
3. restaura `app.prev-<tag-atual>` como `app`;
4. inicia `NexusApp` e `NexusCaddy` e tenta o health da versão anterior.

O **banco não é restaurado automaticamente**. Se o `db push`/`db:seed` alterou dados, pare
o serviço e restaure o dump mais recente de `C:\ProgramData\Nexus\backups\db` (§8.5).

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
do zero (fases 0–7). Ele preserva o `.env` e o `JWT_SECRET` e reconfigura os serviços, mas
**não faz backup automático** e não tem o rollback do `atualizar.ps1`. Use o `.exe` para a
primeira instalação ou para recuperação; para atualização rotineira, prefira o
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
`Get-ScheduledTaskInfo -TaskName NexusBackup`.

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
| Banco `nexus_prod` | `C:\ProgramData\Nexus\backups\db\nexus_prod-<timestamp>.zip` | dump `mysqldump` (`--single-transaction --routines --triggers --no-tablespaces --databases nexus_prod`) compactado; o `.sql` intermediário é apagado |
| Uploads | `C:\ProgramData\Nexus\backups\uploads\` | cópia com `robocopy /E` |
| `.env` | `C:\ProgramData\Nexus\backups\config\.env-<timestamp>` | cópia com ACL restrita |

Também em `backups\config` (mas **fora** do `backup.ps1`) ficam os backups do `my.ini`
(`my.ini-<timestamp>.bak`), criados pelo `pos-instalacao-mysql.ps1`.

O `backup.ps1` retorna código diferente de zero quando o dump falha, quando o arquivo do
dump fica vazio, quando o `robocopy` falha (código ≥ 8) ou quando o `.env` não é encontrado.

### 8.4 Retenção e verificação

A retenção remove, por `LastWriteTime`, os `*.zip` de `backups\db` e os `.env-*` de
`backups\config` mais antigos que `RetentionDays`.

> **Atenção:** a retenção **não** poda `backups\uploads` nem os `my.ini-*.bak`; a cópia de
> uploads não é podada e pode crescer sem limite. Monitore o espaço em
> `C:\ProgramData\Nexus\backups` e limpe manualmente o excedente. Ver §15.

Verificação rápida:

```powershell
Get-ChildItem C:\ProgramData\Nexus\backups\db -Filter *.zip |
  Sort-Object LastWriteTime -Descending | Select-Object -First 3 Name, Length, LastWriteTime

# confira o conteúdo do dump mais recente
$zip = Get-ChildItem C:\ProgramData\Nexus\backups\db -Filter *.zip |
  Sort-Object LastWriteTime -Descending | Select-Object -First 1
Expand-Archive $zip.FullName -DestinationPath "$env:TEMP\nexus-backup-check" -Force
Select-String -Path "$env:TEMP\nexus-backup-check\*.sql" -Pattern "CREATE TABLE" |
  Select-Object -First 1
```

Copie os backups para fora do servidor (NAS, unidade de rede ou nuvem) — o script não faz
isso. Sem cópia externa, um defeito de disco perde banco, uploads e configuração juntos.

### 8.5 Restauração em produção

> **Pare o `NexusApp` antes de restaurar.** O Caddy pode continuar no ar; os usuários verão
> erro até o app voltar. O dump foi feito com `--databases nexus_prod`, então contém
> `CREATE DATABASE`/`USE nexus_prod` — a importação **substitui as tabelas incluídas no dump**
> no banco de produção. Tabelas criadas depois do dump e que não estão nele **permanecem**;
> para voltar a um ponto exato, importe em um banco vazio ou recrie o `nexus_prod` antes.

1. Pare o serviço:

   ```powershell
   Stop-Service NexusApp -Force
   ```

2. Extraia o dump escolhido:

   ```powershell
   $zip = "C:\ProgramData\Nexus\backups\db\nexus_prod-20261102-020000.zip"
   New-Item -ItemType Directory -Force -Path "D:\restore" | Out-Null
   Expand-Archive $zip -DestinationPath "D:\restore" -Force
   ```

3. Crie um arquivo de opções do MySQL com as credenciais do **root** (o `nexus_app` não tem
   privilégio para recriar o banco). Use o mesmo formato do `backup.cnf` e proteja o arquivo:

   ```powershell
   . "C:\Program Files\Nexus\scripts\common.ps1"
   $root = Read-Host -AsSecureString "Senha do root do MySQL"
   $plain = ConvertFrom-SecureStringPlain -Secure $root
   Write-Utf8NoBom -Path "C:\ProgramData\Nexus\config\restore.cnf" -Lines @(
     "[client]", "user=root", "host=127.0.0.1", "port=3306",
     ("password=" + (ConvertTo-MysqlOptionValue $plain)), "default-character-set=utf8mb4", ""
   )
   Protect-File -Path "C:\ProgramData\Nexus\config\restore.cnf"
   ```

4. Importe o dump. O `Start-Process` com `-RedirectStandardInput` evita o problema de
   aspas do `cmd /c` e é o mesmo padrão usado pelos scripts:

   ```powershell
   $mysql = "C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe"
   $dump  = "D:\restore\nexus_prod-20261102-020000.sql"
   $process = Start-Process -FilePath $mysql -Wait -NoNewWindow -PassThru `
     -RedirectStandardInput $dump `
     -ArgumentList @(
       "--defaults-extra-file=C:\ProgramData\Nexus\config\restore.cnf",
       "-h", "127.0.0.1", "-P", "3306"
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

7. Remova o `restore.cnf` e reinicie/valide:

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
| **Reiniciar aplicação** | `nssm restart NexusApp`; o Caddy **não** é reiniciado |
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
  "backupScript": "C:\\Program Files\\Nexus\\scripts\\backup.ps1"
}
```

Se o arquivo faltar ou estiver inválido, a bandeja usa os padrões do código. **Atenção:** o
padrão de `backupScript` aponta para `C:\ProgramData\Nexus\scripts\backup.ps1`, que não
existe (o script real fica em `C:\Program Files\Nexus\scripts`). Mantenha o `tray.json` no
lugar para o botão de backup funcionar. Ver §15.

### 9.4 Limitações

- A tarefa `NexusTray` é registrada no **logon do usuário que executou a instalação**, com
  `RunLevel Highest`; outros usuários do servidor não veem a bandeja.
- O executável tem `requireAdministrator`; abrir manualmente sem elevação pede UAC.
- O reinício afeta apenas o `NexusApp`; para o Caddy, use `Restart-Service NexusCaddy`.
- Falhas fatais da bandeja vão para `%LOCALAPPDATA%\NexusTray\tray.log` (do usuário), não
  para `C:\ProgramData\Nexus\logs`.

---

## 10. Health check e smoke test

### 10.1 `GET /api/health`

Rota pública (não exige sessão; `src/proxy.ts`), `force-dynamic`, runtime Node:

```json
{ "status": "ok", "db": true, "versao": "1.02.11.2026" }
```

- HTTP **200** quando `SELECT 1` no banco responde.
- HTTP **503** com `{ "status": "degraded", "db": false, "versao": "..." }` quando o banco
  não responde. A resposta não expõe mensagem, stack ou credencial.
- `versao` vem de `NEXT_PUBLIC_APP_VERSION`, definida no build a partir do `package.json`
  (`next.config.ts`). Por isso a versão do `package.json` deve ser igual à da tag.

### 10.2 `smoke.ps1`

```powershell
# PowerShell elevado ou não; não altera nada
cd "C:\Program Files\Nexus\Instalador"
.\smoke.ps1 -Hostname nexus.galpao.local -ExpectedVersion 1.02.11.2026
```

Confere os três serviços, o health local com `db=true`, `https://<hostname>/login` e a
versão. **Não ignora erro de certificado**: o HTTPS só passa se a CA do Caddy estiver
confiada no Windows (`caddy trust`). Saída `SMOKE: OK` (código 0) ou `SMOKE: FALHOU
(n verificação(ões))` (código 1).

### 10.3 Testes manuais

```powershell
Invoke-RestMethod http://127.0.0.1:3000/api/health | ConvertTo-Json
Invoke-WebRequest https://nexus.galpao.local/login -UseBasicParsing | Select-Object StatusCode
Get-Service MySQL84, NexusApp, NexusCaddy | Select-Object Name, Status, StartType
Get-ScheduledTask NexusBackup, NexusTray | Select-Object TaskName, State
```

---

## 11. Solução de problemas

| Sintoma | Causa provável | O que fazer |
| --- | --- | --- |
| bootstrap para com código 2 e "O serviço MySQL84 ainda não existe" | MySQL 8.4 LTS não instalado | instale **Server only** com o serviço `MySQL84` e rode `bootstrap.ps1 -Hostname ... -Resume` |
| `MySQL84 não iniciou` / não aceita 3306 | `my.ini` inválido, instância em outra porta ou serviço corrompido | restaure o backup em `C:\ProgramData\Nexus\backups\config\my.ini-<timestamp>.bak`, confira o log do MySQL e `Test-NetConnection 127.0.0.1 -Port 3306` |
| `mysql.exe não encontrado` | MySQL fora de `C:\Program Files\MySQL\MySQL Server 8.4` | instale no caminho padrão ou inclua o `bin` do MySQL no PATH |
| fase 5/7 falha em `https://<hostname>/login` | hostname não resolve no servidor ou DNS ainda não propagou | crie o registro A no DNS ou uma entrada em `C:\Windows\System32\drivers\etc\hosts`; teste `Resolve-DnsName <hostname>` |
| HTTPS com aviso de certificado nas estações | a CA interna do Caddy só foi confiada no servidor | exporte `C:\ProgramData\Nexus\caddy\data\caddy\pki\authorities\local\root.crt` e instale em **Autoridades de Certificação Raiz Confiáveis** nas estações |
| `caddy trust falhou` | Caddy não está rodando, admin API ocupada ou sem elevação | confira `NexusCaddy`, a porta 2019 e o `caddy.err.log`; rode `caddy trust` em PowerShell elevado |
| porta 80/443/3000/3306 em uso | outro processo/serviço ocupa a porta | `Get-NetTCPConnection -LocalPort 80,443,3000,3306 -State Listen`; pare o processo ou ajuste o serviço |
| `NexusApp` não sobe | `.env` ausente/ilegível, build incompleto ou `node_modules` corrompido | veja `C:\ProgramData\Nexus\logs\app.err.log`; confira `C:\Program Files\Nexus\app\.env` e a ACL; refaça `npm ci && npm run build` na pasta do app |
| health responde 503 (`db=false`) | MySQL parado, senha divergente ou `nexus_prod` ausente | `Get-Service MySQL84`; teste `& "C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe" --defaults-extra-file="C:\ProgramData\Nexus\config\backup.cnf" -h 127.0.0.1 -P 3306 -D nexus_prod -e "SELECT 1"`; se a senha mudou, rode a fase 2 com `-Resume` |
| `NexusCaddy` não sobe | Caddyfile inválido, porta ocupada ou CA | `& "C:\Program Files\Nexus\caddy\caddy.exe" validate --config "C:\ProgramData\Nexus\config\Caddyfile" --adapter caddyfile` e `caddy.err.log` |
| bandeja vermelha com serviço rodando | health inacessível ou banco fora | confira o health local e o `app.err.log`; a bandeja mostra "banco indisponível" quando `db=false` |
| bandeja não aparece | tarefa registrada para outro usuário ou não houve logon | veja `Get-ScheduledTask NexusTray`; rode `C:\Program Files\Nexus\NexusTray\NexusTray.exe` elevado ou registre a tarefa para o usuário desejado |
| "Fazer backup agora" falha | `tray.json` ausente/inválido (fallback aponta para `C:\ProgramData\Nexus\scripts`) | restaure o `tray.json` ou aponte `backupScript` para `C:\Program Files\Nexus\scripts\backup.ps1` |
| backup falha no `mysqldump` | `backup.cnf` ausente, senha do `nexus_app` mudou ou MySQL fora | rode a fase 2 do bootstrap; confira o erro redigido no console |
| atualização falha e volta a versão anterior | build, `db push`, health ou smoke falharam | leia `deploy-<tag>.log` e `app.failed-<tag>`; se o banco mudou, restaure o dump (§8.5) |
| atualização não encontra hostname | `bootstrap.state.json` e `Caddyfile` ausentes | rode o bootstrap ou informe o hostname no `Caddyfile`; o `atualizar.ps1` não aceita `-Hostname` |
| instalador termina como sucesso, mas o sistema não funciona | falha do bootstrap não altera o código do Inno `[Run]` | confira `instalador-*.log` e `bootstrap-*.log`; não confie só na tela final |
| disco enche | `backups\uploads` e `my.ini-*.bak` sem retenção; `app.failed-*` acumulam | limpe manualmente os diretórios antigos após conferir os backups |

### 11.1 Onde olhar primeiro

| Arquivo | Para quê |
| --- | --- |
| `C:\ProgramData\Nexus\logs\app.err.log` | erro da aplicação Next |
| `C:\ProgramData\Nexus\logs\app.out.log` | saída da aplicação |
| `C:\ProgramData\Nexus\logs\caddy.err.log` | erro do Caddy |
| `C:\ProgramData\Nexus\logs\bootstrap-*.log` | instalação |
| `C:\ProgramData\Nexus\logs\instalador-*.log` | andamento do `.exe` |
| `C:\ProgramData\Nexus\logs\deploy-*.log` | atualização |
| `C:\ProgramData\Nexus\logs\desinstalar-*.log` | desinstalação |
| `C:\ProgramData\Caddy\logs\access.log` | requisições HTTP |
| Visualizador de Eventos → Windows Logs → System | erros de serviço/NSSM |
| `%LOCALAPPDATA%\NexusTray\tray.log` | falha fatal da bandeja (usuário) |

---

## 12. Segurança

### 12.1 ACLs e segredos

- **`.env`** (`C:\Program Files\Nexus\app\.env`): herança desabilitada; **Administrators**
  (S-1-5-32-544) e **SYSTEM** (S-1-5-18) com controle total; **NetworkService**
  (S-1-5-20) somente leitura. O serviço `NexusApp` roda como NetworkService.
- **`backup.cnf`** (`C:\ProgramData\Nexus\config\backup.cnf`): somente
  Administrators/SYSTEM; guarda a senha do `nexus_app`.
- **`restore.cnf`** (criado manualmente para restauração): mesma proteção; apague depois do
  uso.
- **Arquivos temporários do MySQL** (opções, SQL e saída): criados com `Protect-File` e
  removidos ao final; erros do `mysqldump` são redigidos (`password`/`identified by`).
- **Transcripts**: suspensos durante a leitura das senhas; não registram a digitação.
- **`JWT_SECRET`**: gerado com 48 bytes aleatórios (base64) quando ausente; preservado nas
  atualizações. Nunca reutilize o segredo de desenvolvimento.
- **Senhas**: `nexus_app` com 12–64 caracteres do conjunto seguro; root sem quebra de linha.
  Não use `-p<senha>` na linha de comando.

### 12.2 Exposição de rede

- O **Next** escuta apenas em `127.0.0.1:3000`; o **MySQL** apenas em `127.0.0.1:3306`.
- O **Caddy** é a única porta exposta (80/443) e usa **CA interna** (`tls internal`).
- O admin do Caddy (`localhost:2019`) deve permanecer local.
- **Não há regra de firewall criada pelos scripts.** Libere 80/443 manualmente e mantenha
  3000/3306/2019 bloqueadas para a rede.
- O MySQL usa `utf8mb4`/`utf8mb4_0900_ai_ci` e fuso `-03:00`; o X Plugin (`mysqlx`) fica
  desligado.

### 12.3 Backups

Os backups contêm banco, uploads e o `.env` (com `DATABASE_URL` e `JWT_SECRET`). Proteja
`C:\ProgramData\Nexus\backups` como dado sensível, copie para fora do servidor e restrinja
quem acessa a pasta. O `NexusBackup` roda como SYSTEM; o acesso manual exige elevação.

### 12.4 CA interna

O `caddy trust` instala a CA local no repositório de confiança do Windows **no servidor**.
Para as estações, distribua o `root.crt` por GPO/script e instale em **Autoridades de
Certificação Raiz Confiáveis**. A desinstalação **não** remove essa CA do trust store — ver
§13.

---

## 13. Desinstalação

Use **Configurações → Aplicativos → Nexus → Desinstalar** (ou o atalho "Desinstalar Nexus"
no Menu Iniciar). O Inno executa o `desinstalar.ps1` e depois remove os arquivos que ele
próprio instalou.

### 13.1 O que é removido

- Serviços **`NexusCaddy`** e **`NexusApp`** (parados e removidos; usa NSSM se disponível,
  senão `sc.exe`).
- Tarefas agendadas **`NexusTray`** e **`NexusBackup`**.
- Processo da bandeja em execução.
- `C:\Program Files\Nexus\caddy`
- `C:\Program Files\Nexus\tools` (NSSM)
- `C:\Program Files\Nexus\scripts`
- `C:\Program Files\Nexus\NexusTray`
- `C:\Program Files\Nexus\app`
- `C:\ProgramData\Caddy` (logs de acesso)
- O diretório do instalador (`C:\Program Files\Nexus\Instalador`) é removido pelo Inno.

### 13.2 O que é preservado

- **`C:\ProgramData\Nexus` inteiro**: `uploads`, `logs`, `backups`, `config`
  (`Caddyfile`, `backup.cnf`), `caddy\data` (CA/chaves) e `bootstrap.state.json`.
- **MySQL 8.4**, o banco `nexus_prod`, o usuário `nexus_app` e o serviço `MySQL84`.
- **Node.js**, **Git** e o VC++ Redistributable.
- A **CA interna** no repositório de confiança do Windows (o `root.crt` continua confiado).

Para uma remoção **total** (depois de copiar o que precisa):

1. Rode a desinstalação normal.
2. Apague `C:\ProgramData\Nexus` manualmente (isso apaga banco lógico, uploads e backups).
3. Desinstale o MySQL 8.4, o Node.js e o Git, se não forem usados por outro sistema.
4. Remova a CA da Caddy de **Autoridades de Certificação Raiz Confiáveis**
   (`certlm.msc`) — procure o certificado da CA local da Caddy e exclua.
5. Remova `C:\Program Files\Nexus\Instalador`, se ele ainda existir (desinstalação manual).

> A desinstalação manual (fora do Inno) é:
> `powershell -NoProfile -ExecutionPolicy Bypass -File "C:\Program Files\Nexus\Instalador\desinstalar.ps1"`.
> Ela não remove o próprio diretório `Instalador`.

---

## 14. Checklist de release de produção

- [ ] Entregas aprovadas (reviewer sem bloqueante; QA verde) e `CHANGELOG.md` atualizado.
- [ ] Documentação de `/docs` atualizada (incluindo este runbook, se o processo mudou).
- [ ] Versão **DateVer** `N.DD.MM.YYYY` no `package.json` e tag `vN.DD.MM.YYYY` no Git.
      O health reporta a versão do `package.json` e o smoke a compara com a tag — mantenha
      os dois iguais.
- [ ] Commit de release na `main`; tag criada e **enviada ao GitHub** (o bootstrap e o
      `atualizar.ps1` clonam a tag; sem ela, a instalação falha).
- [ ] Branch local **`producao`** avançada por **fast-forward** até o commit da release
      (worktree de produção; hoje a branch não tem upstream configurado — o push, se houver,
      é manual).
- [ ] Se a bandeja mudou: `deploy\windows\NexusTray\build.ps1` (requer **.NET 8 SDK**;
      `dist\NexusTray.exe` é ignorado pelo Git e é gerado no build).
- [ ] Instalador gerado: `deploy\windows\build-instalador.ps1` → `out\NexusSetup-<versão>.exe`
      (Inno Setup 7; baixa o ISCC 7.1.0 do NuGet se necessário). Confira o tamanho e o log
      do `ISCC`.
- [ ] Ensaio em **VM Windows limpa** (10/11 x64, sem Node/Git/MySQL): instalação completa,
      pausa do MySQL, primeira execução/Super Admin, `smoke.ps1`, login e uma operação
      básica. Teste também a atualização a partir da tag anterior e a desinstalação
      preservando `C:\ProgramData\Nexus`.
- [ ] **Backup manual** da produção + cópia para fora do servidor; confira o dump mais
      recente (§8.4).
- [ ] Janela de manutenção comunicada; plano de rollback definido (`app.prev-*` + dump).
- [ ] Atualização executada com `atualizar.ps1 -Tag v...`; acompanhe o `deploy-<tag>.log`.
- [ ] Pós-release: `smoke.ps1`, `/api/health` com `db=true`, login, versão exibida, tarefa
      `NexusBackup` e bandeja no estado verde.
- [ ] Evidências registradas (data, tag, commit, resultado do smoke e do backup).

> **Dívida de release:** o `db push` ainda é o mecanismo de schema. Antes de uma release
> com mudança destrutiva ou nova constraint única, revise o `CHANGELOG`, rode o script de
> preparação indicado (ex.: `db:dedupe-notas`) e ensaie em banco de teste. O caminho alvo é
> SQL revisado/migrations versionadas.

---

## 15. Atenções conhecidas (divergências entre scripts)

Estas são divergências **reais** encontradas nos scripts desta branch. Nenhuma foi
corrigida aqui (documentação não altera código de produto); elas estão registradas para a
operação e para uma correção futura.

1. **Fallback do backup na bandeja aponta para o lugar errado.**
   `NexusTray/TrayConfig.cs` usa `C:\ProgramData\Nexus\scripts\backup.ps1` como padrão, mas
   o bootstrap copia o script para `C:\Program Files\Nexus\scripts\backup.ps1`. O
   `tray.json` gerado corrige o caminho; se ele faltar/estiver inválido, "Fazer backup
   agora" falha.

2. **A retenção do backup não cobre uploads.**
   `backup.ps1` poda apenas `backups\db\*.zip` e `backups\config\.env-*`. A cópia de
   `backups\uploads` (e os `my.ini-*.bak`) não é podada e pode crescer sem limite.

3. **O backup não inclui o Caddy.**
   Não há cópia do `Caddyfile` nem de `C:\ProgramData\Nexus\caddy\data` (CA e chave
   privada). Após uma perda total, o Caddy gera uma CA nova e as estações precisam confiar
   nela de novo.

4. **O instalador não transforma falha do bootstrap em falha do wizard.**
   O `[Run]` do `instalador.iss` chama o `instalar-gui.ps1` com `waituntilterminated`, mas
   não verifica o código de saída. O assistente pode exibir a conclusão mesmo quando o
   bootstrap retornou erro; o sinal confiável é a MessageBox e o log.

5. **A bandeja é registrada só para o usuário que instalou.**
   `NexusTray` usa `AtLogOn -User $currentUser`; outros usuários do servidor não a veem.

6. **O `.env` não é mesclado na atualização.**
   `atualizar.ps1` copia o `.env` anterior inteiro. Variáveis novas introduzidas por uma
   release não são adicionadas automaticamente; compare com `.env.example` e ajuste à mão
   (reaplicando a ACL).

7. **`app.failed-*` e `app.prev-manual-*` não são limpos.**
   O `atualizar.ps1` mantém a versão anterior e mais uma `app.prev-*`, mas não remove
   `app.failed-*`; o bootstrap também deixa `app.prev-manual-*`. Monitore o disco.

8. **Hashes do manifesto vazios.**
   `manifesto.json` tem `sha256: ""` para Node, NSSM e VC++; Caddy/Git usam "latest" quando
   a URL não está fixada. A instalação depende do TLS, sem verificação de integridade.
   Preencha os hashes para instalações reproduzíveis.

9. **Nenhuma regra de firewall é criada.**
   Os scripts não chamam `New-NetFirewallRule`/`netsh`. Sem liberar TCP 80/443, as estações
   não acessam o sistema.

10. **O hostname precisa resolver no próprio servidor.**
    A fase 5 e o `smoke.ps1` testam `https://<hostname>/login`; os scripts não criam entrada
    em `hosts` nem registro DNS. Sem resolução, a instalação falha no fim.

11. **A porta 2019 (admin do Caddy) não é verificada.**
    A pré-checagem cobre 3306/3000/80/443. Se a 2019 estiver ocupada, o Caddy e o
    `caddy trust` podem falhar.

12. **`db push` não é migration.**
    O `atualizar.ps1` aplica `prisma db push` e roda `db:seed` em toda atualização. Mudanças
    destrutivas podem exigir `--accept-data-loss`/SQL revisado e scripts de preparação; o
    caminho alvo é SQL revisado em releases futuras.

13. **A desinstalação preserva a CA no trust store.**
    `desinstalar.ps1` remove `C:\ProgramData\Caddy`, mas preserva
    `C:\ProgramData\Nexus\caddy` e não remove o certificado raiz da Caddy do repositório de
    confiança do Windows. Para remoção total, exclua-o manualmente (§13).

---

## 16. Referências

| Assunto | Arquivo |
| --- | --- |
| instalador | [`deploy/windows/instalador.iss`](../../deploy/windows/instalador.iss) e [`build-instalador.ps1`](../../deploy/windows/build-instalador.ps1) |
| instalação | [`bootstrap.ps1`](../../deploy/windows/bootstrap.ps1) e [`instalar-gui.ps1`](../../deploy/windows/instalar-gui.ps1) |
| MySQL | [`pos-instalacao-mysql.ps1`](../../deploy/windows/pos-instalacao-mysql.ps1) |
| atualização | [`atualizar.ps1`](../../deploy/windows/atualizar.ps1) |
| backup | [`backup.ps1`](../../deploy/windows/backup.ps1) |
| validação | [`smoke.ps1`](../../deploy/windows/smoke.ps1) e [`src/app/api/health/route.ts`](../../src/app/api/health/route.ts) |
| uploads | [`src/lib/uploads.ts`](../../src/lib/uploads.ts) |
| bandeja | [`deploy/windows/NexusTray/`](../../deploy/windows/NexusTray/) |
| desinstalação | [`desinstalar.ps1`](../../deploy/windows/desinstalar.ps1) |
| versão e changelog | [`VERSIONAMENTO.md`](VERSIONAMENTO.md) |
| regras do projeto | [`AGENTS.md`](../../AGENTS.md) |
