---
name: Jira e smart commits (Nexus)
description: Uso do Jira e das mensagens de commit do Nexus — chave da issue, smart commits, worklog via MCP, status e critérios de conclusão. Use ao associar uma alteração a uma issue, escrever uma mensagem de commit, registrar worklog ou atualizar o status de uma task.
---

# Jira e smart commits — Nexus

A **fonte única de regras** é `docs/processo/JIRA.md`. Leia-a antes de qualquer operação e
**não duplique** o conteúdo aqui — esta skill só resume o que importa para decidir rápido.

## Decisões rápidas

- **Toda** mensagem de commit relacionada a uma task começa pela chave: `KAN-123: ...`.
- **Não** associar commit a issue por similaridade superficial — confirme a issue certa.
- Comentário no issue **só com aprovação prévia** do usuário sobre o conteúdo exato.
- Horas só via **worklog do MCP** (`addOrEditJiraIssueWorklog`). **`#time` não existe**.
- `#resolve`/`#close` **somente** quando os critérios de aceite forem atendidos.
- Se não houver issue adequada, **não invente**: reporte e peça a chave (criar ou indicar).

## Fluxo

`Solicitação → consultar Jira → identificar issue → ler escopo → inspecionar código/docs →
implementar → validar → worklog → (comentar só com aprovação) → atualizar status quando aplicável`

Operações Jira disponíveis pelo MCP `atlassian` (site `projeto-final.atlassian.net`):
`searchJiraIssuesUsingJql`, `getJiraIssue`, `createJiraIssue`, `editJiraIssue`,
`transitionJiraIssue`, `addOrEditJiraIssueWorklog`, `addOrEditJiraIssueComment`,
`createJiraIssueLink`, `manageJiraProjectVersion`.

## Integração automática

O app **GitHub for Atlassian** já está conectado (organização `enzoguinossi/ProjetoFinalFAETEC`):
o push linka commits/branches/PRs às issues e processa smart commits.
