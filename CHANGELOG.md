# Changelog

Todas as mudanças relevantes deste projeto são documentadas neste arquivo.

O formato segue [Keep a Changelog 1.1.0 (pt-BR)](https://keepachangelog.com/pt-BR/1.1.0/),
e o versionamento adota **DateVer** `N.DD.MM.YYYY` (tag `vN.DD.MM.YYYY`), em que `N` é a
sequência da release no mesmo dia.

## [Unreleased]

### Added

- Infraestrutura de orquestração multiagente: agentes versionados em `.opencode/agents/`
  (orchestrator, developer, reviewer, qa, docs-keeper, release-manager).
- Skills de processo `.opencode/skills/{orchestration,jira-smart-commits,release}/SKILL.md`.
- Estado persistente `.ai-workflow/` (`PROJECT_STATE.md`, `contracts/`, `runs/`,
  `decisions/`) e ADR 0001.
- Convenção de versionamento DateVer e este changelog.

<!--
Categorias: Added, Changed, Deprecated, Removed, Fixed, Security.
Não crie uma versão nova sem cumprir o checklist de release.
-->
