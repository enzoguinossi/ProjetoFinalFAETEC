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

- `main` = `9cc6845` (infra da orquestração) sobre `f17a671`; `origin/main` ainda em `3a3c352`.
- Worktrees: principal, `KAN-140-modulo-estoque`, `figma-export`, `gravacao`.
- Sem tags ainda. `CHANGELOG.md` criado nesta tarefa (seção `Unreleased`).

## Último checkpoint válido

- 2026-10-17 — Fase 1 (auditoria) concluída e aprovada pelo usuário.
- 2026-10-17 — E1–E8 implementadas e commitadas em `9cc6845` (KAN-165).
- Decisões: (1) state versionado/commitado; (2) integração na `main`; (3) agentes no repo;
  (4) `figma-export` revisar depois; (5) DateVer com N=1; (6) não deletar `modulo-estoque`.

## Testes executados

- `node scripts/ai-workflow-check.mjs` → 13/13 automáticos ok, 2 manuais, 0 falhas.
- `npx eslint scripts/ai-workflow-check.mjs` → 0 problemas.
- `opencode debug agents` → 6 agentes do projeto descobertos.

## Próximas ações

1. Verificação manual de runtime: abrir uma sessão-filha real e retomar em sessão nova.
2. Revisar/commitar o WIP do worktree `figma-export` (branch dele), conforme decisão (B).
3. Próximas entregas: usar o fluxo orquestrado (contrato → developer → reviewer → qa →
   docs-keeper → release-manager), com `.ai-workflow/runs/` por tarefa.
