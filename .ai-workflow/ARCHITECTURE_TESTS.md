# Testes da arquitetura multiagente

A própria infraestrutura de agentes precisa ser testável. Este documento prova os
cenários exigidos e diz **o que é automatizado** e **o que exige runtime** (manual).

## Verificação automática

```bash
node scripts/ai-workflow-check.mjs
```

Somente leitura; não toca rede/Jira nem faz operações destrutivas. Sai com código `1`
se qualquer verificação automática falhar.

## Cenários

| # | Cenário | Como é verificado | Tipo |
|---|---|---|---|
| 1 | Orquestrador abre e acompanha sessão-filho | `orchestrator` é `primary` + permissão `subagent`; runtime: abrir um subagente e ver a sessão-filho | Auto + MANUAL |
| 2 | Agentes recebem instruções e contexto delimitado | cada `agent` declara fontes de contexto, limites e formato | Auto |
| 3 | Entregas com contrato verificável | template com run, issue, escopo, critérios, testes, commit SHA | Auto |
| 4 | Estado persiste após a sessão terminar | `PROJECT_STATE.md` + `runs/` + `decisions/` versionados | Auto |
| 5 | Sessão nova reconstrói o estado | README de recuperação; runtime: sessão limpa | Auto + MANUAL |
| 6 | Tarefa bloqueada é tratada | status `bloqueado`/`falhou` no contrato + seção de bloqueios | Auto |
| 7 | Falha de agente ≠ sucesso | orquestrador exige validação independente (não confia no relatório) | Auto |
| 8 | Paralelismo não sobrescreve | escritor único do estado; um arquivo de run por execução | Auto |
| 9 | QA roda antes da conclusão | checklist de release e ciclo citam QA | Auto |
| 10 | Docs/changelog só com mudança real | changelog Keep a Changelog com `Unreleased`; regras do docs-keeper | Auto |
| 11 | Associações Jira verificáveis | skill aponta para `docs/agents/JIRA.MD` (fonte única) | Auto |
| 12 | Release não conclui sem critérios | checklist obrigatório + condições de bloqueio | Auto |

## Simulações (operações destrutivas/externas)

Sem ambiente isolado, estas operações **não** são executadas de verdade; são simuladas por
inspeção de configuração:

- **Criação de tag / push** — verificado que `release-manager` marca `ask` e que o
  checklist exige aprovação; nenhuma tag é criada por este teste.
- **Operações Jira de escrita** — verificado que a skill exige fonte única e proíbe
  comentar sem aprovação; nenhuma escrita no Jira é feita por este teste.
- **`db:reset` / limpeza de worktree** — proibidos sem autorização; não exercitados.

## Evidência de execução

Registre a saída de `node scripts/ai-workflow-check.mjs` no run correspondente em
`.ai-workflow/runs/`.
