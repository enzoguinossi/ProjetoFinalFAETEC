# PROJECT_STATE — Nexus

> Estado corrente do trabalho orquestrado. **Escritor único: Orquestrador.**
> Última consolidação: 2026-10-17 (revisão e reorganização da documentação).

## Objetivo atual

**Primeira versão entregue** — release `1.17.10.2026` (tag `v1.17.10.2026`) com o sistema
de acesso/cadastros, a infraestrutura de orquestração multiagente e a ferramenta de
exportação para o Figma.

**Documentação revisada e reorganizada** em 2026-10-17 (commit `aaad949`): `docs/` passou
a ter `dominio/`, `processo/` e `diagramas/`; a documentação foi confrontada com o código
e as divergências corrigidas.

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

## Runs

| Run | Objetivo | Agente | Status | Branch/worktree | Issue |
|---|---|---|---|---|---|
| RUN-20261017-01 | Infraestrutura de orquestração multiagente | orchestrator | concluído | `main` | KAN-165 |
| RUN-20261017-02 | Ferramenta de exportação para o Figma (fechamento) | orchestrator | concluído | `figma-export` → `main` | KAN-166 |
| RUN-20261017-03 | Primeiro release (`1.17.10.2026`) | release-manager | concluído | `main` | KAN-165, KAN-166 |
| RUN-20261017-04 | Verificação da documentação de domínio vs. schema/código | general | concluído | `main` | — |
| RUN-20261017-05 | Verificação do README, AGENTS e docs de processo vs. repositório | general | concluído | `main` | — |
| RUN-20261017-06 | Reorganização de `docs/` e correções de conteúdo | docs-keeper | concluído | `main` | — |
| RUN-20261017-07 | Referências à documentação fora de `docs/` | developer | concluído | `main` | — |

Os runs 04–07 não têm issue: **decisão explícita do usuário em 2026-10-17** de commitar
sem chave. Isso é uma **exceção consciente** à regra 1 de smart commits do `AGENTS.md` —
não é descuido, e não deve ser tomado como precedente.

## Bloqueios e dependências

- Nenhum bloqueio. Release `1.17.10.2026` publicado (autorizado em 2026-10-17).

## Trabalho existente a preservar

- Branch/worktree **`figma-export`**: **integrada na `main` e removida** em 2026-10-17
  (branch e worktree apagados a pedido do usuário). Os artefatos gerados no Figma foram
  preservados em `out/figma-export/` (ignorado pelo git).
- Worktree **`gravacao`**: `prisma/seed-demo.ts` não rastreado. Preservar.
- Worktree **`modulo-estoque`** (branch `KAN-140-modulo-estoque`): **descartada** (refazer
  do zero). **Não deletar** branch nem worktree sem autorização.

## Git (verificado no checkpoint)

- `main` = `aaad949` — **1 commit à frente de `origin/main`** (`6922050`), ainda **não
  publicado**.
- **Tag `v1.17.10.2026`** existe (local); é a única tag de versão do projeto.
- Árvore de trabalho limpa no momento da consolidação.

## Último checkpoint válido

- 2026-10-17 — revisão e reorganização da documentação integrada na `main` (`aaad949`).
- Entregue: `docs/` em `dominio/` · `processo/` · `diagramas/` (16 arquivos movidos com
  `git mv`); `docs/README.md` e `docs/dominio/IMPLEMENTACAO.md` (novos); 25 divergências
  de domínio (`D01`–`D25`) e 13 de processo (`F01`–`F13`) corrigidas contra o código;
  `README.md` da raiz reduzido ao essencial; `AGENTS.md` alinhado ao repositório real.
- Decisões registradas: state no repo; integração na `main` sem branch de versão; agentes
  no repo; DateVer com N=1 e fuso `America/Sao_Paulo`; `modulo-estoque` descartada (não
  deletada); texto exato no Jira antes de criar/alterar task; **commits sem chave neste
  trabalho** (exceção aprovada pelo usuário).
- **Uma entrada publicada do `CHANGELOG` foi preservada:** a correção de caminho dentro da
  versão `1.17.10.2026` foi **revertida** — na data do release o arquivo estava mesmo em
  `docs/VERSIONAMENTO.md`, e reescrever a entrada falsificaria o histórico (viola o §5 do
  `docs/processo/VERSIONAMENTO.md`). Só o preâmbulo do arquivo foi atualizado.

## Testes executados

- `node scripts/ai-workflow-check.mjs` → **13/13 automáticos**, 2 manuais, **0 falhas**
  (o check 11, que exige `docs/processo/JIRA.md`, passou a valer com a reorganização).
- `npm test` → 165/165 (18 arquivos) · `npx tsc --noEmit` · `npx eslint .` · `npm run build`
  — da release anterior; **não reexecutados** nesta revisão (não houve mudança de código).
- `npm run figma:check` → verde (21/21 marcas, 53 mestres) — da release anterior.
- Nesta revisão: `git status`/`git diff --stat` conferidos, `grep` de caminhos antigos
  (nenhuma ocorrência fora do histórico de `runs/` e `decisions/`), contagens conferidas
  por contagem real (52 modelos, 10 enums, 52 classes no `classes.puml`, 52 entidades no
  `DER.puml`, 25 RFs, 5 RNs, 9 RNFs, 68 permissões no seed).

## Próximas ações

1. **Publicar** o commit `aaad949` (`git push origin main`) — **requer aprovação do usuário**.
2. Definir o destino de `gravacao` (worktree com `prisma/seed-demo.ts` não rastreado).
3. Iniciar a **movimentação de estoque** (KAN-140), com a task criada pelo formato novo do
   `docs/processo/JIRA.md` (texto exato mostrado ao usuário antes de criar).
4. Resolver os **4 pontos em aberto** de `docs/dominio/IMPLEMENTACAO.md` — em especial o
   autor das mensagens automáticas do mural (`mensagem_mural.ID_usuario` é `NOT NULL`),
   que precisa de decisão antes de implementar RF014.
5. **Worklog registrado** em 2026-10-17 (via MCP): KAN-165 = `1h 30m` (início 13:30) ·
   KAN-166 = `4h` (início 14:20), no fuso `America/Sao_Paulo`.
