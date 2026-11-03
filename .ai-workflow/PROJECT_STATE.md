# PROJECT_STATE — Nexus

> Estado corrente do trabalho orquestrado. **Escritor único: Orquestrador.**
> Última consolidação: 2026-11-02 (release `11.02.11.2026`, tag `v11.02.11.2026`; NSSM
> embutido no instalador).

## Objetivo atual

Preparar a instalação e a operação do Nexus em produção no Windows (KAN-170): health check,
uploads fora da aplicação, bootstrap do zero (Node 24, MySQL 8.4 LTS, NSSM, Caddy), bandeja
.NET 8, instalador Inno Setup e runbook. A entrega anterior (relatórios padronizados) está na
release `1.02.11.2026`.

## Produção Windows (KAN-170, runs `RUN-20261102-14..26`)

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

## Verificação

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

1. **Testar o instalador 11.02** na máquina do usuário e na do colega (VM/máquina limpa):
   MySQL 8.4.13 na **3214** (`NexusMySQL84`), hostname/DNS, CA do Caddy nos clientes, login e
   smoke. Testar com `nssm.cc` bloqueado para confirmar o NSSM embutido.
2. **Bandeja e usuário padrão:** a tarefa `NexusTray` roda no logon do usuário que instalou,
   com `RunLevel Highest`; o `.exe` tem `requireAdministrator`. Se o representante usar uma
   conta **padrão**, a bandeja não inicia elevada. Para esse cenário, será necessário um tray
   `asInvoker` e uma tarefa elevada separada para o restart.
3. **Limitações conhecidas do runbook (§15):** retenção de `backups\uploads`/`my.ini-*.bak`;
   backup sem `caddy\data`; bandeja só no logon de quem instalou; `.env` não mesclado;
   hashes incompletos no manifesto; DNS fora do escopo; `db push` sem migrations; CA permanece
   no trust store; conflito de caminho se já existir um MySQL 8.4 usando o diretório padrão.
4. **Produção:** executar o `NexusSetup` na máquina do galpão, concluir o primeiro acesso
   (Super Admin), criar o usuário do representante e validar impressão/backup.
4. **Módulo avançado de auditoria** (pesquisa, filtros e visualização própria) — adiado pelo
   usuário; o resolvedor de descrições já é reutilizável.
5. **Refatoração adiada pelo usuário:** separar responsabilidades do `BarraFiltros`
   (helpers de data/filtros) e trocar os SVGs inline por `lucide-react`.
6. **RFs restantes:** RF011, RF012, RF019, RF021, RF023, RF024/XLSX; RF018/RF026/RNF009
   fora do escopo.
