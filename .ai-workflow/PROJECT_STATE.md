# PROJECT_STATE — Nexus

> Estado corrente do trabalho orquestrado. **Escritor único: Orquestrador.**
> Última consolidação: 2026-10-17 (release 1.17.10.2026).

## Objetivo atual

**Primeira versão entregue** — release `1.17.10.2026` (tag `v1.17.10.2026`) com o sistema
de acesso/cadastros, a infraestrutura de orquestração multiagente e a ferramenta de
exportação para o Figma.

**Próxima fase (sessão nova):** revisar documentação e fluxos e iniciar a **movimentação de
estoque** (KAN-140 — a branch antiga foi descartada; refazer do zero).

## Convenções ativas

- Branch de integração: **`main`** — e **não se cria branch por versão**: o release é uma
  **tag na `main`** (`vN.DD.MM.YYYY`). Ver `docs/VERSIONAMENTO.md`.
- Agentes versionados no repositório: `.opencode/agents/*.md`.
- Estado/contratos versionados neste diretório (`.ai-workflow/`).
- Versionamento: **DateVer `N.DD.MM.YYYY`** (fuso `America/Sao_Paulo`) → tag `vN.DD.MM.YYYY`.
- Changelog: **Keep a Changelog 1.1.0 (pt-BR)** em `CHANGELOG.md`.
- Antes de criar/alterar task no Jira: **mostrar o texto exato ao usuário**
  (`docs/agents/JIRA.MD`).

## Runs

| Run | Objetivo | Agente | Status | Branch/worktree | Issue |
|---|---|---|---|---|---|
| RUN-20261017-01 | Infraestrutura de orquestração multiagente | orchestrator | concluído | `main` | KAN-165 |
| RUN-20261017-02 | Ferramenta de exportação para o Figma (fechamento) | orchestrator | concluído | `figma-export` → `main` | KAN-166 |
| RUN-20261017-03 | Primeiro release (`1.17.10.2026`) | release-manager | concluído | `main` | KAN-165, KAN-166 |

## Bloqueios e dependências

- Nenhum bloqueio. **Publicação autorizada pelo usuário em 2026-10-17** e executada na
  sequência (`git push origin main` + `git push origin v1.17.10.2026`).

## Trabalho existente a preservar

- Branch/worktree **`figma-export`**: **integrada na `main` e removida** em 2026-10-17
  (branch e worktree apagados a pedido do usuário). Os artefatos gerados no Figma foram
  preservados em `out/figma-export/` (ignorado pelo git).
- Worktree **`gravacao`**: `prisma/seed-demo.ts` não rastreado. Preservar.
- Worktree **`modulo-estoque`** (KAN-140): **descartada** (refazer do zero).
  **Não deletar** branch nem worktree sem autorização.

## Git (verificado no checkpoint)

- `main` = `ed324fd`; **tag `v1.17.10.2026`** apontando para ela (local).
- `origin/main` ainda em `3a3c352` — dezenas de commits locais à frente (infra + Figma +
  release).
- Nenhuma tag de versão anterior (esta é a primeira).

## Último checkpoint válido

- 2026-10-17 — release `1.17.10.2026` preparado, tag local criada e integrado na `main`.
- KAN-165 e KAN-166 **concluídas** no Jira (KAN-166 renomeada para refletir a ferramenta).
- Decisões registradas: state no repo; integração na `main` sem branch de versão; agentes no
  repo; DateVer com N=1 e fuso `America/Sao_Paulo`; `modulo-estoque` descartada (não
  deletada); texto exato no Jira antes de criar/alterar task.

## Testes executados

- `node scripts/ai-workflow-check.mjs` → 13/13 automáticos, 2 manuais, 0 falhas.
- `npm test` → 165/165 (18 arquivos) · `npx tsc --noEmit` · `npx eslint .` · `npm run build`.
- `npm run figma:check` → verde (21/21 marcas, 53 mestres, fidelidade e resiliência em 0).
- `npm run figma:harvest` → 47/47 cenários; `figma:compare` → média 2,421% (limite de 0,5%
  dispensado pelo usuário — resíduo de rasterização; evidência é o mapa de `diff/`).

## Próximas ações

1. Definir o destino de `gravacao` (worktree com `prisma/seed-demo.ts` não rastreado).
2. **Sessão nova:** revisar documentação e fluxos; iniciar a **movimentação de estoque**
   (KAN-140), com a task criada pelo formato novo do `docs/agents/JIRA.MD` (texto exato
   mostrado ao usuário antes de criar).
3. Registrar o **worklog** de KAN-165 e KAN-166 (horas efetivamente trabalhadas — pendente
   de confirmação do usuário).
