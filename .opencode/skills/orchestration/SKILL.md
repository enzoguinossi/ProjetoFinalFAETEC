---
name: Orquestração multiagente (Nexus)
description: Como o Orquestrador do Nexus decompõe um objetivo, delega a subagentes com contrato, acompanha runs e recupera o estado persistido em .ai-workflow. Use ao coordenar tarefas, delegar a outro agente, abrir/acompanhar um run ou retomar o trabalho após compactação/reinício.
---

# Orquestração multiagente — Nexus

Roteiro de coordenação. O detalhe de estado e propriedade de escrita está em
`.ai-workflow/README.md`; o template de delegação em
`.ai-workflow/contracts/TASK_CONTRACT_TEMPLATE.md`.

## Papéis

| Papel | Agente (`subagent`) | Só pode |
|---|---|---|
| Orquestrador | `orchestrator` (primary) | delegar, validar, escrever estado |
| Developer | `developer` | implementar escopo e commitar |
| Reviewer | `reviewer` | revisar (não edita) |
| QA | `qa` | testar (edita só `tests/**`) |
| Docs Keeper | `docs-keeper` | `docs/**`, `CHANGELOG.md`, `README.md`, `AGENTS.md` |
| Release Manager | `release-manager` | changelog/estado, propor tag |

## Ciclo de um run

1. **Estado** — ler `.ai-workflow/PROJECT_STATE.md` + `runs/` ativos; validar
   `git status`/`git worktree list`; Git vence a conversa.
2. **Contrato** — gerar `RUN-AAAAMMDD-NN`, issue Jira, escopo, critérios, testes, branch.
3. **Delegar** — ferramenta `subagent` (contexto próprio). Profundidade máx. **2**.
   Run que o usuário acompanha → `session.create`/`session.send` (OpenChamber).
4. **Acompanhar** — ler o resultado; **validar** os artefatos (diff, commit, issue, testes).
5. **Encadear** — reviewer → qa → docs-keeper → release-manager quando aplicável.
6. **Consolidar** — atualizar `PROJECT_STATE.md` e registrar o resultado no run.

## Regras anti-abuso

- Uma tarefa = um run = um arquivo em `runs/` (evita escrita concorrente).
- Nada de delegação recursiva sem limite, sessões sem teto ou trabalho duplicado.
- Contrato sem issue Jira não gera commit (regra do projeto).
- Falha/erro de agente → status `bloqueado`/`falhou`, nunca "concluído".
- Mensagens curtas com referência a artefato persistido; não transmitir a conversa toda.
