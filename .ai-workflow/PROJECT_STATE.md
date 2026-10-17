# PROJECT_STATE — Nexus

> Estado corrente do trabalho orquestrado. **Escritor único: Orquestrador.**
> Última consolidação: 2026-10-17 (RUN-20261017-01).

## Objetivo atual

Implantar a **arquitetura de orquestração multiagente** (infraestrutura de trabalho
com agentes, estado persistente, contratos, Jira, Git/worktrees, DateVer e changelog).
**Não alterar lógica funcional do produto** nesta tarefa.

## Convenções ativas

- Branch de integração: **`main`**.
- Branches de trabalho: `KAN-<n>-<slug>`.
- Agentes versionados no repositório: `.opencode/agents/*.md`.
- Estado/contratos versionados neste diretório (`.ai-workflow/`).
- Versionamento: **DateVer `N.DD.MM.YYYY`** → tag **`vN.DD.MM.YYYY`** (N começa em 1).
- Changelog: **Keep a Changelog 1.1.0 (pt-BR)** em `CHANGELOG.md`.

## Runs

| Run | Objetivo | Agente | Status | Branch/worktree | Issue |
|---|---|---|---|---|---|
| RUN-20261017-01 | Infraestrutura de orquestração multiagente | orchestrator | em andamento | `main` (checkout principal) | KAN-165 |

## Bloqueios e dependências

- Nenhum bloqueio. Issue desta entrega: **KAN-165** (criada em 2026-10-17).

## Trabalho existente a preservar

- Worktree **`figma-export`** (suja): skill V2 `.opencode/skills/figma-export/SKILL.md`
  + `tools/figma-export/**` (Playwright + plugin Figma). Decisão do usuário: **revisar/
  commitar na branch dele depois** (opção B). Não tocar nesta tarefa.
- Worktree **`gravacao`**: `prisma/seed-demo.ts` não rastreado. Preservar.
- Worktree **`modulo-estoque`** (KAN-140): **desconsiderar** (refazer do zero).
  **Não deletar** branch nem worktree sem autorização.

## Git (verificado no checkpoint)

- `main` = `f17a671`, **3 commits à frente** de `origin/main` (`2125cbd`, `fe95544`, `f17a671`).
- Worktrees: principal, `KAN-140-modulo-estoque`, `figma-export`, `gravacao`.
- Sem tags. Sem `CHANGELOG.md` (antes desta tarefa).

## Último checkpoint válido

- Fase 1 (auditoria) concluída e aprovada pelo usuário em 2026-10-17.
- Decisões: (1) state versionado/commitado; (2) integração na `main`; (3) agentes no repo;
  (4) `figma-export` revisar depois; (5) DateVer com N=1; (6) não deletar `modulo-estoque`.

## Testes executados

- Estrutura da arquitetura: `node scripts/ai-workflow-check.mjs` (ver
  `.ai-workflow/ARCHITECTURE_TESTS.md`).

## Próximas ações

1. Definir a chave Jira desta entrega.
2. Commitar E1–E3 (estado + agentes + skills).
3. Commitar E4–E6 (Jira doc + changelog + política em `AGENTS.md`).
4. Commitar E7–E8 (testes da arquitetura + docs/apresentação).
5. Executar `scripts/ai-workflow-check.mjs` e registrar evidências.
