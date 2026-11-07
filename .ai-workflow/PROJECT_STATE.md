# PROJECT_STATE — Nexus

> Estado corrente do trabalho orquestrado. **Escritor único: Orquestrador.**
> Última consolidação: 2026-11-07 (release `1.07.11.2026`, tag `v1.07.11.2026`; instalador
> autocontido com Node/MySQL/Caddy/NSSM/app embutidos; wizard de senhas/progresso em
> `[Unreleased]`).

## Objetivo atual

Instalar o Nexus em máquinas Windows que já têm Node/Git/MySQL/NSSM/Caddy sem depender deles
(KAN-170): instalador autocontido com Node 24.19.0 portátil, MySQL 8.4.13, NSSM, Caddy, VC++ e
app Next standalone; schema/seed SQL sem Prisma; banco em `C:\ProgramData\Nexus\mysql`; bandeja
.NET 8. O release `1.07.11.2026` foi validado na máquina de teste (upgrade 10.02 → 1.07) e gerou
`NexusSetup-1.07.11.2026.exe` (393,8 MB).

## Produção Windows — instalador autocontido (KAN-170, 1.07)

1. **App standalone:** `next.config.ts` com `output: "standalone"`;
   `scripts/empacotar-standalone.mjs` gera `app.zip` com `server.js`, `.next/static`, `public`
   e client Prisma, sem `.env`/uploads. O serviço roda
   `C:\Program Files\Nexus\node\node.exe server.js`.
2. **Runtimes isolados:** Node 24.19.0 em `C:\Program Files\Nexus\node`; MySQL 8.4.13 em
   `C:\Program Files\Nexus\mysql`; dados/config em `C:\ProgramData\Nexus\mysql`; NSSM em
   `C:\Program Files\Nexus\tools\nssm`; Caddy em `C:\Program Files\Nexus\caddy`. O
   Node/Git/MySQL/NSSM/Caddy do sistema não é usado nem alterado.
3. **Serviços:** `NexusMySQL84` (3214, loopback), `NexusApp` (Node portátil + `server.js`, env
   `DATABASE_URL`/`JWT_SECRET`/`UPLOADS_DIR`/`PORT`/`HOSTNAME`) e `NexusCaddy` (80/443, CA
   interna via `certutil`, `admin off`).
4. **SQL:** `deploy/sql/schema.sql` (DDL do Prisma) e `seed.sql` (tipos, 81 permissões, 2
   perfis, vínculos e conversões) + `migracoes/001-unidades-pct10-cx50.sql`; `aplicar-sql.ps1`
   usa `mysql.exe` e detecta Fresh/Update; **sem Prisma no destino**.
5. **Conversões:** `UNIDADE` (padrão/1), `PCT10` (10) e `CX50` (50); a migração renomeia em
   linha, preservando IDs e vínculos.
6. **Payload/setup:** `scripts/preparar-payload.ps1` monta Node/MySQL/Caddy/VC++/NSSM/app/SQL
   em `deploy/windows/payload` (gitignored); `build-instalador.ps1` gera
   `NexusSetup-<versão>.exe` (~394 MB) com tudo embutido.
7. **Instalação sem ferramentas:** o bootstrap extrai o payload, migra o Data legado para
   `C:\ProgramData\Nexus\mysql` (se existir), aplica o SQL, extrai o app, configura os serviços,
   firewall/tray/backup e roda o smoke; sem Git/npm/`next build`/Prisma/downloads.
8. **Atualização:** `atualizar.ps1 -Package <pasta com app\ e sql\>`; backup, troca do pacote,
   SQL, smoke e rollback; sem Git.
9. **Desinstalação:** remove Node/MySQL/Caddy/NSSM/app, preservando `C:\ProgramData\Nexus`
   (mysql/data, uploads, logs, backups).
10. **Segurança:** ACLs restritas (backups/config; uploads/logs NetworkService; caddy
    LocalService); `.env` protegido; firewall 80/443 Allow e 3214/3000 Block.
11. **Validação real:** upgrade 10.02 → 1.07 na máquina de teste; health 1.07 `db=true`,
    HTTPS 200, serviços Running, bandeja, `UNIDADE/PCT10/CX50`, 81 permissões/2 perfis; setup
    1.07 compilado.

## Wizard de instalação — senhas e progresso (pós-1.07, `[Unreleased]`)

1. **Inno sem console:** `CurStepChanged(ssPostInstall)` chama o `bootstrap.ps1`
   diretamente com `-NoPrompt`, `-ProgressFile` e, quando há senhas, `-CredentialsFile`;
   `instalar-gui.ps1` foi removido do repositório e do `[Files]`.
2. **Credenciais no wizard:** página com root + confirmação e `nexus_app` + confirmação.
   Instalação nova exige as quatro; upgrade com `backup.cnf` aceita os quatro campos vazios
   para reutilizar as credenciais atuais. O `nexus_app` é validado no wizard com a mesma
   regra do bootstrap.
3. **Transporte:** arquivo UTF-8 sem BOM em `{tmp}`, ACL somente Administrators/SYSTEM via
   `icacls` (SIDs), apagado pelo bootstrap e pelo wizard; as senhas nunca vão para linha de
   comando, `MsgBox`, transcript ou log.
4. **Progresso:** INI `[progress] step=0..8 done=0|1 exit=0|1` lido a cada 500 ms; formulário
   modal com barra/fase, sem Alt+F4, timeout de 60 s sem progresso inicial e 2 h no total;
   pré-checagem de `bootstrap.ps1`/`common.ps1`/`manifesto.json`.
5. **Manual:** `bootstrap.ps1` sem `-NoPrompt`/`-CredentialsFile` continua pedindo as senhas
   no console; `-ProgressFile` é opcional.
6. **Validação:** ISCC 7 compila o setup (412.959.775 bytes, SHA-256 `1AE58E…`); as APIs de
   formulário/barra/timer foram exercitadas em um setup descartável; `icacls` com SIDs aplicou
   a ACL; o teste `-NoPrompt` sem senhas falha com mensagem clara. O wizard real foi executado
   no upgrade e encontrou um bug de NSSM em uso (corrigido; ver abaixo).

## ACL do usuário da instalação (pós-1.07, `[Unreleased]`)

1. **Aplicado na máquina (14:07):** `C:\ProgramData\Nexus` e **33 diretórios** receberam o
   SID `S-1-5-21-2571341639-2918594578-3694094283-1001` (`DESKTOP-FI6234O\Enzo`) com
   `Modify`; SYSTEM/Administrators seguem Full e os serviços mantêm o acesso. Os arquivos
   `config\backup.cnf`, `config\Caddyfile` e `mysql\my.ini` também receberam o usuário.
2. **Escopo:** raiz, `logs`, `uploads`, `backups` (incl. `db`/`uploads`/`config`), `config`,
   `mysql`/`data` e `caddy`; `C:\Program Files\Nexus` e `app\.env` **não** mudam (o `.env`
   continua NetworkService leitura + Administrators/SYSTEM). Não há ACE de `BUILTIN\Users`.
3. **Código:** `bootstrap.ps1` define `$script:NexusInstallUserSid` e inclui o SID nas ACLs
   da fase 3; `Protect-File` ganhou `-ModifyIdentities` para `backup.cnf`/`my.ini`/`Caddyfile`;
   a fase 5 reaplica o SID nos diretórios do Caddy.
4. **Validação:** sem elevação, `Get-ChildItem` funciona na raiz e em `logs`/`uploads`/
   `backups`/`config`/`mysql`/`caddy`; `backup.cnf`/`Caddyfile`/`my.ini` são acessíveis por
   metadados; serviços Running e health 1.07 `db=true`. O `smoke.ps1` continua válido porque
   o SID do usuário não é `BUILTIN\Users`.

## Skills .NET (vendorizadas)

- Repositório oficial **`dotnet/skills`**, commit `96c3d68dad2855e3ab5178aa1a262789d86a1466`,
  licença MIT; **17 skills** em `.opencode/skills/` além das 4 do Nexus. Origem e lista em
  `.opencode/skills/DOTNET-VENDOR.md`.
- **Tray:** `winforms-expert`, `analyzing-dotnet-performance`, `migrate-dotnet8-to-dotnet9`,
  `migrate-dotnet9-to-dotnet10`.
- **Agente/build:** `csharp-expert`, `scaffold-dotnet-test-project`, `writing-mstest-tests`,
  `run-tests`, `code-testing`, `build-perf-baseline`, `build-perf-diagnostics`,
  `incremental-build`, `directory-build-organization`, `binlog-generation`,
  `binlog-failure-analysis`, `check-bin-obj-clash`, `setup-local-sdk`.
- O SDK user-local 8 em `C:\Users\Enzo\.dotnet` foi removido; o SDK **10.0.403** foi
  instalado via winget em `C:\Program Files\dotnet\sdk` e o `dotnet --list-sdks` já o resolve.
  O build da bandeja/agente .NET 10 passa a usar o SDK 10 do PATH.

## Produção Windows — legado (até 11.02)

1. **Health e uploads:** `GET /api/health` público (200/`db=true`, 503 sem banco) e
   `UPLOADS_DIR` em `src/lib/uploads.ts` (fallback `public/uploads`); `/api/health` liberado
   no `proxy.ts`.
2. **Bootstrap do zero:** `bootstrap.ps1` em 8 fases, idempotente/retomável, instala VC++,
   Node 24.19.0, Git, NSSM e Caddy; instala o **MySQL 8.4.13 LTS dedicado** (`instalar-mysql.ps1`)
   na porta **3214**, serviço `NexusMySQL84`, binários em `C:\Program Files\Nexus\mysql` e
   dados/config em `C:\ProgramData\MySQL\MySQL Server 8.4`; **sem pausa** e sem tocar no
   MySQL existente na 3306. `pos-instalacao-mysql.ps1` cria `nexus_prod`/`nexus_app` e grava
   `backup.cnf`.
3. **Serviços:** `NexusApp` (NetworkService, dependente de `NexusMySQL84`) e `NexusCaddy`
   (LocalService) no NSSM, com auto-start, restart e logs rotativos; Next em
   `127.0.0.1:3000`; Caddy em 80/443 com CA interna via `certutil` e `admin off`.
4. **Bandeja:** `NexusTray` (.NET 8 self-contained) com status verde/amarelo/vermelho,
   abrir, reiniciar via `restart.ps1`, logs, backup e pasta de dados. A tarefa é registrada
   no logon do usuário que instalou e **iniciada ao final da fase 6**; em atualização, a
   tarefa/processo é parada antes de copiar o novo executável.
5. **Instalador:** Inno Setup 7, `NexusSetup-<versão>.exe`, wizard de hostname, execução do
   bootstrap com checagem de `ResultCode`, atalhos de URL e desinstalador que preserva
   `C:\ProgramData\Nexus`.
6. **Operação:** `atualizar.ps1` (backup, troca de tag, build, schema, smoke, rollback),
   `backup.ps1` (diário 02:00, log, dump/uploads/.env/Caddyfile) e `smoke.ps1`.
7. **Segurança:** ACLs restritas (`backups`/`config` só admins/system; `uploads`/`logs` para
   NetworkService; `caddy` para LocalService); `.env` protegido antes da escrita; sem tag
   chumbada no manifesto (o build passa `-Tag`).
8. **Documentação:** `docs/processo/PRODUCAO.md` (runbook) indexado em `docs/README.md`.
9. **MySQL 3214 e firewall:** MySQL 8.4.13 dedicado, dados/config na pasta padrão do MySQL 8.4,
   `DATABASE_URL`/`backup.cnf`/`mysqldump` na 3214; regras `Nexus HTTP`/`Nexus HTTPS`
   (Allow) e `Nexus MySQL (LAN)`/`Nexus Next (LAN)` (Block) para `LocalSubnet`, validadas
   pelo `smoke.ps1`.
10. **Senha do MySQL:** sem mínimo/composição (até 256); bloqueia apenas `@`, `/`, `?`, `#`,
    `"`, `\`, `;`, espaço/tab e caracteres de controle; o prompt repete em vez de encerrar
    quando a senha é inválida (root e `nexus_app`).
11. **NSSM embutido (KAN-170):** `nssm.exe` 2.24 (win64) vai no payload do Inno Setup
    (`tools\nssm\nssm.exe`), validado por SHA-256; o bootstrap usa o embutido e só baixa da
    URL oficial/mirrors se faltar. O mirror é a cópia versionada na tag do repositório.

## Entregue (runs `RUN-20261102-01..11`)

1. **Componentes:** `FichaRelatorio` e `RelatorioCadastro` em `src/components/relatorios/`
   + `src/types/relatorio.ts` e `src/lib/fichas-relatorio.ts` (adaptadores por entidade).
2. **Produtos:** Quantidade/Reservado/Qtd. livre e Un. de entrada/Un. de saída; foto
   opcional (1 anexo ativo) com quadro “Sem foto”; todos os códigos em grade de 4 colunas;
   totalizador Total/Livre.
3. **Funcionários:** CPF/Cargo/Condutor e E-mail/Telefone; foto opcional.
4. **Destinatários:** CNPJ/Tipo/Telefone e Endereço/E-mail; sem foto.
5. **Fornecedores:** CNPJ/Telefone e Endereço/E-mail; sem foto.
6. **Filtro “Listar códigos”** nos quatro relatórios, refletindo na tela e no CSV
   (coluna opcional “Códigos” com `TIPO: valor`).
7. **Filtro “Listar contatos”** em funcionários, destinatários e fornecedores
   (runs `RUN-20261102-02/03`): faixa “Contatos” entre o corpo e os códigos, com todos os
   e-mails e telefones ativos, principal primeiro e marcado, tipo do telefone e formatação.
   Com o filtro ligado, o corpo perde “E-mail”/“Telefone” (sem duplicação); o CSV
   **substitui** `E-mail`/`Telefone` por `E-mails`/`Telefones` na mesma posição.
8. **Movimentação e Extrato são relatórios separados** (runs `RUN-20261102-04/05`):
   - `/relatorios/movimentacao` é sempre a movimentação agrupada por documento (o filtro de
     produto apenas filtra; não vira extrato);
   - `/relatorios/extrato` é um relatório próprio, com período + produto(s) opcionais:
     **sem produto, agrupa todos os produtos com movimentação no período**; com seleção,
     inclui o produto sem movimento; cada grupo tem saldo inicial, movimentações e subtotal
     (saldo final/entradas/saídas); CSV próprio acompanha os filtros (período obrigatório);
   - observação do movimento impressa; helper puro `relatorio-movimentacao.ts`.
9. **Seed de movimentações** (`prisma/seed-movimentacoes.ts` + `npm run db:seed:mov`, run
   `RUN-20261102-07`): 3 entradas + 3 saídas por produto ativo pelo fluxo
   pedido → remessa → expedição → entrega → baixa; dev-only (`nexus`), marcador
   `[seed-mov]` e retomada por etapa. Executado: 12 produtos, 3 notas de entrada,
   9 pedidos/remessas/expedições, 36+36 movimentos.
10. **Auditoria legível** (runs `RUN-20261102-08/09`): cada evento mostra o antes/depois a
    partir de `dados_anteriores`/`dados_novos`, agrupado por dia; coleções (`itens`, `saldos`,
    `movimentacoes`, `notas_expedicao`) viram blocos por item, sem JSON, com **uma linha
    por atributo alterado**; entidades e referências exibem rótulo + descrição
    (`Nota de saída #10 · Escola…`, produto, usuário);
    status/datas formatados; sensíveis redigidos (`[oculto]`); CSV com Entidade, Descrição e
    Alterações legíveis. Módulo de auditoria com pesquisa/filtros avançados fica para depois.
11. **Padronizações:** `ImprimirButton` movido para `components/relatorios/`; helpers
    `formatarQuantidade` e `contagem`; `ROTULOS_TIPO_CODIGO`; helper `montarCsv`.
12. **Vencimento, Pedidos, Expedições e Entregas** (run `RUN-20261102-11`): todos em A4
    retrato com `RelatorioCadastro`; Vencimento em faixas de urgência; Pedidos por escola →
    pedido (status em badge) → itens; Expedições por dia + cartão por expedição; Entregas por
    instituição + cartão por nota. `BadgeStatus`/`CartaoRegistro` compartilhados;
    `id_destinatario` nas linhas de pedidos/entregas; CSV preservado.
13. **Sem schema novo**; quantidades seguem sem unidade (AGENTS §8).
14. **Documentação e release** (runs `RUN-20261102-12/13`): `IMPLEMENTACAO.md` (RF023/RF024)
    e `docs/relatorios/README.md` alinhados ao código; `A4 paisagem`/`RelatorioAmpliado`
    removidos do código, docs e AGENTS (o sistema só gera A4 retrato); release
    `1.02.11.2026` no `CHANGELOG.md` e `package.json`; tag `v1.02.11.2026`.

## Verificação — 1.07

- `npm run lint` → exit 0; `npm run build:standalone` → exit 0; `npm run package:standalone`
  → `app.zip` 35,3 MB, com `server.js`, `.next/static`, `public` e client Prisma; sem `.env`.
- Standalone em `PORT=3010`: `/api/health` → **200** `{"status":"ok","db":true,"versao":
  "1.07.11.2026"}`.
- SQL em banco temporário: `schema.sql` + `seed.sql` aplicados; **81 permissões, 2 perfis, 3
  conversões** (`UNIDADE:1`, `PCT10:10`, `CX50:50`); seed reaplicado sem duplicar; migração 001
  renomeou preservando IDs. `npm test`/Vitest → **542 testes**.
- Parser do Windows PowerShell 5.1 → OK nos **13** `.ps1` de `deploy/windows`.
- Payload: Node 37.304.352, MySQL 281.154.912, Caddy 18.384.117, VC++ 25.635.768, NSSM 331.264,
  app 37.029.389, SQL; total 399.888.932 bytes.
- Setup Inno Setup 7: `NexusSetup-1.07.11.2026.exe`, **412.970.582 bytes (393,8 MB)**, SHA-256
  `0CB656A92B37169B51AC27CCE1A6EBD3D793C6BA77A0ED8D0F55BAFA28FE55CC`.
- Upgrade real 10.02 → 1.07 na máquina (que já tinha Node/Git/MySQL 8.0): MySQL migrado para
  `C:\ProgramData\Nexus\mysql`; `NexusMySQL84`/`NexusApp`/`NexusCaddy` Running; health 1.07
  `db=true`; HTTPS 200; tray em execução; smoke OK; unidades `UNIDADE/PCT10/CX50`.

## Verificação — wizard (pós-1.07, `[Unreleased]`)

- `ISCC` 7.1.0 → exit 0; `NexusSetup-1.07.11.2026.exe`, **412.959.775 bytes**, SHA-256
  `1AE58EAADEB65BB02E2DC6CF691D0BB5F4D6FA3501FDDD9D39AABB2447CF5034`.
- Parser PowerShell 5.1 → OK nos **12** `.ps1` de `deploy/windows` (o `instalar-gui.ps1` foi
  removido).
- Setup descartável em `%TEMP%` validou em runtime `CreateCustomForm`, `TNewProgressBar`,
  `SetTimer`/`CreateCallback`, `ShowModal`, `Close`/`Release` e `OnCloseQuery` (marcador
  `ok ticks=6`); `icacls` com `*S-1-5-32-544`/`*S-1-5-18` → exit 0, ACL somente
  Administrators/SYSTEM.
- Teste do executor com `bootstrap.ps1 -NoPrompt`: sem senhas → exit 1 com mensagem clara;
  com root+app → leitura do arquivo de credenciais OK.
- **Upgrade real (13:37):** o wizard abriu, pediu as senhas e iniciou o bootstrap; a fase 1
  falhou ao sobrescrever `nssm.exe` em uso pelos serviços (`bootstrap-20261107-133741.log`).
  `NexusMySQL84`/`NexusApp`/`NexusCaddy` continuaram Running e o health 1.07 `db=true`.
  Corrigido em `87928ec`: hash do NSSM igual ao payload → não copia; divergente → para e
  reinicia App/Caddy; Caddy ganhou a mesma checagem de versão.
- O `bootstrap.ps1 -Resume` para concluir a validação **não rodou**: o UAC foi cancelado.
- **ACL (14:07):** aplicada na máquina; raiz com `Enzo:(OI)(CI)(M)` + SYSTEM/Administrators
  Full; 33 diretórios e 3 arquivos protegidos; `logs`/`uploads`/`backups`/`config`/`mysql`/
  `caddy` listáveis sem elevação; serviços e health OK. O código correspondente está em
  `ac9a8e7`/`cb5ee0b`; um novo setup aplica a regra em instalações futuras.
- **Pendente:** rodar o setup corrigido (`C:\Users\Enzo\Desktop\NexusSetup-1.07.11.2026-wizard.exe`,
  SHA `1AE58E…`, ou `out\NexusSetup-1.07.11.2026.exe`) e concluir o upgrade; depois testar
  instalação nova em VM limpa. O wizard antigo (SHA `E703…`) foi substituído na Área de
  Trabalho; os processos antigos já não estão em execução.

## Verificação — histórico até 11.02

- `npm run lint` → exit 0; `npm run build` → exit 0 (health/uploads).
- Testes de health/uploads → **13/13** com config temporária sem `globalSetup`.
- Parser do Windows PowerShell 5.1 → OK nos **12** `.ps1` de `deploy/windows`.
- Instalador compilado com Inno Setup 7 (`NexusSetup-11.02.11.2026.exe`, 46,2 MB); tag
  `v11.02.11.2026` contém `/api/health`; SHA-256
  `1F963EEFD9E2BEE61D0D4FA6773F1FA1B9310BD162404162B10B5C6442EDFA9E`.
  O ISCC comprimiu `tools\nssm\nssm.exe`; o mirror
  `raw.githubusercontent.com/.../v11.02.11.2026/deploy/windows/tools/nssm/nssm.exe`
  respondeu 331.264 bytes com SHA-256
  `F689EE9AF94B00E9E3F0BB072B34CAAF207F32DCB4F5782FC9CA351DF9A06C97`.
- Instalação real validada na máquina (10.02): MySQL 8.4.13 na 3214,
  `NexusApp`/`NexusCaddy` Running, health `10.02.11.2026` com `db=true`, HTTPS 200, smoke OK,
  bandeja `NexusTray.exe` em execução (sessão 1) e tarefa `NexusTray` Running.
- MySQL 8.4.13 dedicado na 3214 (`NexusMySQL84`), sem tocar na 3306; regras de firewall
  criadas/validadas pelo `smoke.ps1`.
- Revisão independente `RUN-20261102-22`: bloqueante B1 (ACLs herdadas) e altos A1–A6
  corrigidos nos runs `23..25`; pendências reais no §15 do runbook.

- `npm run lint` → exit 0.
- `npm run build` → exit 0.
- `tests/lib/relatorio-movimentacao.test.ts` + `tests/services/relatorio.test.ts` +
  `tests/dao/relatorio.test.ts` → 84/84; com auditoria e vencimento → **118/118** em 6
  arquivos. (`npm test` padrão continua bloqueado pelo `prisma db push` do `globalSetup` sob
  agente; suíte completa rodou 497/497 com o push desligado.)
- Commits `KAN-157`: `4bc480d` (relatórios em fichas/faixas + auditoria), `a191f62`
  (seed de movimentações), `dbf4198` (estado), `45d3b22` (implementação), `0be8d21`
  (remoção do A4 paisagem), `759964e` (docs) e `ceccd10` (release). `main` e a tag
  `v1.02.11.2026` publicados em `origin`.
- Seed de movimentações executado no `nexus`; conferência independente: 12 produtos,
  3 notas de entrada, 9 pedidos/remessas/expedições e **3 entradas + 3 saídas por produto**
  (36+36 movimentos), sem divergências; reexecução idempotente.
- Inspeção visual em desktop 1440×900 com o CSS real: fichas, 8 códigos, faixa de contatos
  (3 e-mails + 3 telefones, caso de uma coluna), funcionário sem duplicação, movimentação
  por documento, Extrato por produto e auditoria com antes/depois. A inspeção achou e corrigiu
  a linha de observação do Extrato (classe `mov-obs` com `display:block` quebrava o `colSpan`),
  o “1 itens” e o alinhamento/redação do diff de auditoria.
- Auditoria conferida na tela real (`/relatorios/auditoria`, dev server): nota com escola,
  “Usuário da tentativa” resolvido, coleções com descrição dos produtos, login sem diff e
  sem linhas vazias; sem JSON na folha. Após o ajuste de layout, cada item tem cabeçalho e
  uma linha por atributo (`Qtd. entregue 0 → 40`, `Saldo 250 → 210`).
- Quatro relatórios restantes conferidos em 1440×900 no dev server: Pedidos (escola →
  pedido com badge APROVADO → itens), Entregas (instituição + cartões BAIXA TOTAL),
  Vencimento (faixa “61 a 90 dias” com badge “em 74 dias”) e Expedições (dia + cartões com
  status/veículo/condutor).

## Pendências

1. **Testar o wizard pós-1.07 em máquina limpa/colega:** usar o setup novo em
   `C:\Users\Enzo\Desktop\NexusSetup-1.07.11.2026-wizard.exe` (SHA `1AE58E…`) ou
   `deploy/windows/out/NexusSetup-1.07.11.2026.exe`; o `NexusSetup-1.07.11.2026.exe`
   (SHA `0CB6…`) é a release 1.07 anterior, sem o wizard. Validar a página de senhas, a
   janela de progresso, a extração do payload, a migração do MySQL, o SQL, os serviços, o
   HTTPS e a bandeja. Testar o upgrade com os quatro campos vazios e com senhas preenchidas.
   A ACL do usuário já está aplicada na máquina; o setup novo apenas a persiste para
   instalações futuras.
2. **Acesso de outros usuários:** a ACL concede `Modify` somente ao SID de quem instalou;
   outras contas locais ainda precisam de elevação. `C:\Program Files\Nexus` e `app\.env`
   continuam protegidos; se o usuário quiser `app\.env` ou as cópias `.env-*` de backup sem
   UAC, decidir em um próximo run.
3. **Testar `atualizar.ps1 -Package`:** a máquina atual foi atualizada pelo bootstrap; o
   caminho de pacote + SQL do atualizador ainda não foi exercitado.
4. **Docs:** o runbook `docs/processo/PRODUCAO.md` foi atualizado para o wizard e para a ACL;
   revisar `IMPLEMENTACAO.md` se necessário.
5. **Release:** definir a próxima versão DateVer (`2.07.11.2026`) e publicar o wizard/ACL; o
   `CHANGELOG` está em `[Unreleased]` e o setup em `out` é build local, sem tag.
6. **Ferramentas:** `tools/figma-export/fixtures.ts` ainda usa `PACOTE`/`CAIXA`; alinhar a
   `PCT10`/`CX50`.
7. **Bandeja e usuário padrão:** a tarefa roda no logon de quem instalou, com
   `RunLevel Highest`; conta padrão exige um tray `asInvoker` + tarefa elevada de restart.
8. **Produção:** executar o `NexusSetup` no galpão, concluir o primeiro acesso (Super Admin),
   criar o usuário do representante e validar impressão/backup.
9. **Limitações conhecidas:** backup sem `caddy\data`; retenção de `backups\uploads`;
   CA permanece no trust store; hashes de Node/VC++/Caddy/MySQL a preencher; DNS dos clientes.
10. **RFs restantes:** RF011, RF012, RF019, RF021, RF023, RF024/XLSX; RF018/RF026/RNF009
    fora do escopo.
