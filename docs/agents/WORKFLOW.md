# Workflow multiagente — Nexus

Este documento explica **como** o trabalho é orquestrado por agentes no Nexus. Ele não
substitui `AGENTS.md` (convenções) nem `docs/agents/JIRA.MD` (regras de Jira): complementa.

## Visão geral

```
                 ┌───────────────────────────┐
   objetivo  ──► │  Orquestrador (primary)   │ ──► PROJECT_STATE.md
                 └─────────────┬─────────────┘
                               │ subagent (sessão-filha, contexto próprio)
     ┌────────────┬────────────┼────────────┬──────────────┐
     ▼            ▼            ▼            ▼              ▼
 Developer     Reviewer      QA        Docs Keeper   Release Manager
 (implementa)  (revisa)    (valida)    (documenta)   (versiona)
```

- Agentes versionados no repositório: `.opencode/agents/*.md`.
- Skills de processo: `.opencode/skills/{orchestration,jira-smart-commits,release}/`.
- Estado persistente: `.ai-workflow/` (ver `.ai-workflow/README.md`).
- Contrato de tarefa: `.ai-workflow/contracts/TASK_CONTRACT_TEMPLATE.md`.

## Como iniciar e usar

1. Abra a sessão com o agente **`orchestrator`** (é o agente primário do fluxo).
2. Descreva o objetivo em linguagem natural.
3. O Orquestrador lê `.ai-workflow/PROJECT_STATE.md`, valida o Git e decompõe a tarefa.
4. Ele delega a subagentes e devolve o resultado **verificado** (não só o relatório).

## Delegação e acompanhamento

- Trabalho interno: ferramenta nativa **`subagent`** (filho com contexto próprio;
  profundidade máxima **2**).
- Run que **você** quer acompanhar: `session.create`/`session.send` (OpenChamber) e
  `session.status`/`session.messages` para acompanhar.
- Mensagens entre agentes são **curtas e referenciam artefatos** (arquivo, commit, issue)
  em vez de transmitir a conversa inteira.

## Recuperar depois de compactação/reinício

Siga `.ai-workflow/README.md`: ler `PROJECT_STATE.md` → `git status`/`git worktree list`
→ runs ativos → conferir Git real (o Git vence) → retomar do "Próximo passo".

## Relação Jira · Git · worktrees · DateVer · changelog

| Elo | Regra |
|---|---|
| **Jira ↔ commit** | chave no início da mensagem (`KAN-123: ...`); smart commits pelo app GitHub for Atlassian. Fonte: `docs/agents/JIRA.MD`. |
| **Git ↔ entrega** | branch de integração `main`; branches de trabalho `KAN-<n>-<slug>`; cada run registra o commit-base. |
| **Worktrees** | trabalho paralelo em worktree próprio por tarefa. Criar worktree **não** carrega alterações não commitadas — commite antes de mover. |
| **DateVer** | versão `N.DD.MM.YYYY`, tag `vN.DD.MM.YYYY` (N começa em 1). |
| **Changelog** | `CHANGELOG.md`, Keep a Changelog 1.1.0 (pt-BR), com `Unreleased`. |

Checklist de release: `.opencode/skills/release/SKILL.md`.

## Relatório de entrega (para os orientadores)

Modelo conciso, ao final de uma entrega/release:

```markdown
# Entrega — <título> (<versão N.DD.MM.YYYY>)

- **Objetivo:** ...
- **Issues atendidas:** KAN-xxx, KAN-yyy
- **Funcionalidades implementadas:** ...
- **Testes e evidências:** comando → resultado
- **Documentação atualizada:** arquivos
- **Versão / tag:** N.DD.MM.YYYY / vN.DD.MM.YYYY (commit <sha>)
- **Limitações conhecidas:** ...
- **Próximos passos:** ...
```

Nada de resultado fictício: só o que foi efetivamente executado e verificado.
