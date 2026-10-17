# Contrato de Tarefa — `<RUN-ID>`

> Preenchido pelo **Orquestrador** ao delegar e completado pelo **agente executor**.
> Um arquivo de run = um contrato + um resultado. Não reescreva o contrato depois;
> anexe o resultado abaixo.

## Identificação

- **Run ID:** `RUN-AAAAMMDD-NN` (único)
- **Criado em:** `AAAA-MM-DD HH:MM`
- **Agente executor:** `orchestrator | developer | reviewer | qa | docs-keeper | release-manager`
- **Solicitante:** Orquestrador (sessão `<sessionID>`)
- **Profundidade de delegação:** `n/2` (limite: 2)

## Objetivo e tarefa

- **Objetivo:** (1 frase, resultado esperado)
- **Tarefa:** (escopo delimitado; o que está DENTRO e FORA)

## Rastreabilidade

- **Issues Jira:** `KAN-xxx` (obrigatório para trabalho que gera commit)
- **Referências documentais:** `docs/...`, `AGENTS.md`, `docs/processo/JIRA.md`, RN/RF/RNF
- **Dependências:** outros `RUN-ID` dos quais depende
- **Bloqueia:** outros `RUN-ID`

## Escopo e restrições

- **Escopo de arquivos:** (globs permitidos; ex.: `src/app/produtos/**`, `tests/**`)
- **Não tocar:** (globs proibidos)
- **Critérios de aceite:** (verificáveis)
- **Testes esperados:** (`npm run lint`, `npm run build`, `npm test`, comandos específicos)

## Ambiente

- **Branch:** `KAN-<n>-<slug>` | `main`
- **Worktree:** caminho absoluto
- **Commit-base:** SHA no início da execução

## Resultado (preenchido pelo executor)

- **Status:** `concluído | parcial | bloqueado | falhou`
- **Arquivos alterados:** (lista)
- **Testes realizados e resultado:** (comando → resultado)
- **Commit SHA:** (quando aplicável)
- **Riscos e pendências:** (reais; nunca omitir)
- **Bloqueios e escalonamento:** (o que impede e o que precisa do Orquestrador/usuário)

## Verificação do Orquestrador (não confiar só no relatório)

- [ ] `git status` / `git diff` conferem com "arquivos alterados"
- [ ] commit SHA existe no repositório
- [ ] issue Jira existe e corresponde
- [ ] testes citados realmente passaram
