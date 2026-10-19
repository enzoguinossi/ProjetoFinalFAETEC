# PROJECT_STATE — Nexus

> Estado corrente do trabalho orquestrado. **Escritor único: Orquestrador.**
> Última consolidação: 2026-10-19 (revisão da documentação + decisões de modelagem).

## Objetivo atual

**Primeira versão entregue** — release `1.17.10.2026` (tag `v1.17.10.2026`) com o sistema
de acesso/cadastros, a infraestrutura de orquestração multiagente e a ferramenta de
exportação para o Figma.

**Documentação revisada e reorganizada** (`aaad949`): `docs/` passou a ter `dominio/`,
`processo/` e `diagramas/`; a documentação foi confrontada com o código e as divergências
corrigidas.

**Decisões de modelagem aplicadas** (`e407b96`): a nota de saída deixou de ter
destinatário e passou a consolidar pedidos; `mensagem_mural.ID_usuario` ficou opcional;
`anexo.ID_documento_fiscal` foi removida. O banco está em sincronia com o schema.

**Próxima fase:** iniciar a **movimentação de estoque** (KAN-140 — a branch antiga foi
descartada; refazer do zero), com a task criada pelo formato do `docs/processo/JIRA.md`.

## Convenções ativas

- Branch de integração: **`main`** — e **não se cria branch por versão**: o release é uma
  **tag na `main`** (`vN.DD.MM.YYYY`). Ver `docs/processo/VERSIONAMENTO.md`.
- Agentes versionados no repositório: `.opencode/agents/*.md`.
- Estado/contratos versionados neste diretório (`.ai-workflow/`).
- Versionamento: **DateVer `N.DD.MM.YYYY`** (fuso `America/Sao_Paulo`) → tag `vN.DD.MM.YYYY`.
- Changelog: **Keep a Changelog 1.1.0 (pt-BR)** em `CHANGELOG.md`.
- Antes de criar/alterar task no Jira: **mostrar o texto exato ao usuário**
  (`docs/processo/JIRA.md`).
- **Índice da documentação:** `docs/README.md`.
- **Fonte de verdade, na ordem:** código → `prisma/schema.prisma` →
  `docs/dominio/{REGRAS_NEGOCIO,REQUISITOS_FUNCIONAIS,REQUISITOS_NAO_FUNCIONAIS,ENTENDIMENTO}.md`
  → `AGENTS.md` → `docs/processo/JIRA.md` → histórico da conversa.
- **Schema:** o projeto **não versiona migrations** — aplica com `prisma db push`
  (`npm run db:push` / `npm run db:setup`).

## Runs

| Run | Objetivo | Agente | Status | Branch/worktree | Issue |
|---|---|---|---|---|---|
| RUN-20261017-01 | Infraestrutura de orquestração multiagente | orchestrator | concluído | `main` | KAN-165 |
| RUN-20261017-02 | Ferramenta de exportação para o Figma (fechamento) | orchestrator | concluído | `figma-export` → `main` | KAN-166 |
| RUN-20261017-03 | Primeiro release (`1.17.10.2026`) | release-manager | concluído | `main` | KAN-165, KAN-166 |
| RUN-20261017-04 | Verificação da documentação de domínio vs. schema/código | general | concluído | `main` | — |
| RUN-20261017-05 | Verificação do README, AGENTS e docs de processo | general | concluído | `main` | — |
| RUN-20261017-06 | Reorganização de `docs/` e correções de conteúdo | docs-keeper | concluído | `main` | — |
| RUN-20261017-07 | Referências à documentação fora de `docs/` | developer | concluído | `main` | — |
| RUN-20261017-08 | `mensagem_mural.ID_usuario` nullable; `anexo.ID_documento_fiscal` removida | developer | concluído | `main` | — |
| RUN-20261017-09 | RN003 e `tipo_codigo` registrados; pontos em aberto zerados | docs-keeper | concluído | `main` | — |
| RUN-20261017-10 | Nota de saída sem destinatário; datas; build reparado; `db push` | developer | concluído | `main` | — |
| RUN-20261017-11 | Nota consolida pedidos (FK em `pedido_escola`) | developer | concluído | `main` | — |

Os runs 04–11 não têm issue: **decisão explícita do usuário** de commitar sem chave. É uma
**exceção consciente** à regra 1 de smart commits do `AGENTS.md` — não é descuido e não
deve ser tomado como precedente.

## Bloqueios e dependências

- Nenhum bloqueio. Release `1.17.10.2026` publicado (autorizado em 2026-10-17).

## Trabalho existente a preservar

- Branch/worktree **`figma-export`**: **integrada na `main` e removida** em 2026-10-17.
  Os artefatos gerados no Figma foram preservados em `out/figma-export/` (ignorado pelo git).
- Worktree **`gravacao`**: `prisma/seed-demo.ts` não rastreado. Preservar.
- Worktree **`modulo-estoque`** (branch `KAN-140-modulo-estoque`): **descartada** (refazer
  do zero). **Não deletar** branch nem worktree sem autorização.

## Decisões de modelagem de 2026-10-19

| # | Decisão | Efeito no modelo |
|---|---|---|
| 1 | Mensagens automáticas do mural não têm autor | `mensagem_mural.ID_usuario` → opcional (`NULL` = sistema) |
| 2 | RN003: a pendência é a remessa `PENDENTE` do split | **sem** tabela nova |
| 3 | `anexo.ID_documento_fiscal` era coluna órfã | coluna **removida** |
| 4 | `tipo_codigo` sem permissões é intencional | dado de referência, sem CRUD |
| 5 | A nota de saída **não tem destinatário** | `nota_saida.ID_destinatario` removida; o destinatário fica em `remessa`/`coleta` |
| 6 | A nota **consolida pedidos** | FK migrada para `pedido_escola.ID_nota_saida` (1:N) |

Detalhe em `docs/dominio/IMPLEMENTACAO.md` §"Decisões que estavam em aberto".

## Git (verificado no checkpoint)

- `main` = `e407b96` — **3 commits à frente de `origin/main`** (`6922050`), ainda **não
  publicados**: `aaad949` (docs), `7424192` (estado), `e407b96` (modelo).
- **Tag `v1.17.10.2026`** existe (local); é a única tag de versão do projeto.
- Banco de desenvolvimento em sincronia com o schema
  (`prisma migrate diff` → *No difference detected*).
- Árvore de trabalho limpa.

## Último checkpoint válido

- 2026-10-19 — decisões de modelagem aplicadas e integradas na `main` (`e407b96`).
- Entregue: `docs/` em `dominio/` · `processo/` · `diagramas/` (16 arquivos movidos com
  `git mv`); `docs/README.md` e `docs/dominio/IMPLEMENTACAO.md` (novos); 25 divergências de
  domínio (`D01`–`D25`) e 13 de processo (`F01`–`F13`) corrigidas; `README.md` reduzido ao
  essencial; `AGENTS.md` alinhado ao repositório real; 6 decisões de modelagem aplicadas.
- **Entradas publicadas do `CHANGELOG` preservadas:** a correção de caminho dentro da versão
  `1.17.10.2026` foi **revertida** — reescrever a entrada falsificaria o histórico (viola o
  §5 do `docs/processo/VERSIONAMENTO.md`). Só o preâmbulo do arquivo foi atualizado.
- `next-env.d.ts` é gerado e alterna entre `.next/dev/types` e `.next/types` conforme o
  comando; **não** entra em commit.

## Testes executados

- `npm test` → **165/165 (18 arquivos)** · `npm run build` → *Compiled successfully* —
  reexecutados pelo Orquestrador no `e407b96`.
- `node scripts/ai-workflow-check.mjs` → **13/13 automáticos**, 2 manuais, **0 falhas**.
- `npx prisma validate` + `prisma generate` + `prisma db push` → OK; `prisma migrate diff`
  → *No difference detected*.
- `npx tsc --noEmit` · `npx eslint .` · `npm run figma:check` — da release anterior.
- Correções do `npm install` nesta rodada: `playwright-core` estava declarado no
  `package.json` e no `package-lock.json` mas **ausente de `node_modules`**, o que quebrava
  `npm run build` em `tools/figma-export/harvest.ts`. Reinstalado; `package.json` e
  `package-lock.json` não mudaram.

## Próximas ações

1. **Publicar** os commits pendentes (`git push origin main`) — **requer aprovação do usuário**.
2. Definir o destino de `gravacao` (worktree com `prisma/seed-demo.ts` não rastreado).
3. Iniciar a **movimentação de estoque** (KAN-140), com a task criada pelo formato novo do
   `docs/processo/JIRA.md` (texto exato mostrado ao usuário antes de criar).
4. **Ponto em aberto** antes do módulo de expedições (KAN-142 / RF017b): **como um pedido
   entra numa nota** — se cada confirmação cria uma nota nova ou se o pedido se junta a uma
   nota em aberto. Registrado em `docs/dominio/IMPLEMENTACAO.md` §"Pontos em aberto".
5. Considerar `npm install` obrigatório no setup: a ausência de `playwright-core` quebra o
   build e não é detectada até alguém rodar `npm run build`.
6. **Worklog registrado** em 2026-10-17 (via MCP): KAN-165 = `1h 30m` (início 13:30) ·
   KAN-166 = `4h` (início 14:20), no fuso `America/Sao_Paulo`.
