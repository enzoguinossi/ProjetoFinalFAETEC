# Changelog

Todas as mudanças relevantes deste projeto são documentadas neste arquivo.

O formato segue [Keep a Changelog 1.1.0 (pt-BR)](https://keepachangelog.com/pt-BR/1.1.0/),
e o versionamento adota **DateVer** `N.DD.MM.YYYY` (tag `vN.DD.MM.YYYY`), em que `N` é a
sequência da release no mesmo dia.

## [Unreleased]

### Added

- Ferramenta de exportação do Nexus para o Figma (`tools/figma-export/`): plugin local +
  servidor local (sem o MCP oficial), colheita de 47 telas com Playwright e reconstrução
  das telas como componentes reutilizáveis com propriedades, com captura 1:1 de referência.
- **Volta (Figma → app):** aba *Ler do Figma* no plugin, leitura de página para
  `out/figma-export/figma/<página>.json` e `figma:diff` (tokens × `globals.css`,
  componentes casados por nome + âncora de código e telas).
- Scripts `figma:harvest`, `figma:serve`, `figma:check`, `figma:compare`, `figma:diff`,
  `figma:fixtures` e a skill `.opencode/skills/figma-export`.
- Verificação automática do plugin sem abrir o Figma (`figma:check`), com 14 invariantes —
  incluindo a **guarda de reuso** que falha se um componente promovido perder a marca
  `data-figma` no código e a que prova que as **variáveis do Figma convergem para os
  tokens do `globals.css`**.
- Infraestrutura de orquestração multiagente: agentes versionados em `.opencode/agents/`
  (orchestrator, developer, reviewer, qa, docs-keeper, release-manager).
- Skills de processo `.opencode/skills/{orchestration,jira-smart-commits,release}/SKILL.md`.
- Estado persistente `.ai-workflow/` (`PROJECT_STATE.md`, `contracts/`, `runs/`,
  `decisions/`) e ADR 0001.
- Convenção de versionamento DateVer `N.DD.MM.YYYY` (tag `vN.DD.MM.YYYY`) e este changelog.

### Changed

- Componentes compartilhados (`src/components/*`) receberam marcas `data-figma*`
  (atributos aditivos: não alteram comportamento nem visual) que ligam a UI aos
  componentes do design.
- Tokens de design passaram a ter **fonte única** no `src/app/globals.css`: a colheita os
  lê (`tools/figma-export/tokens.ts`) e os leva no manifesto, e o plugin **atualiza as
  variáveis existentes e cria as novas** nas coleções `Nexus / Cor` e `Nexus / Métrica`
  (upsert; nada é removido). A cópia à mão que existia em `plugin/code.js`
  (`TOKENS_COR`/`TOKENS_METRICA`) foi removida — era ela que ficava desatualizada quando
  o `globals.css` mudava. Foram acrescentados ao `@theme` apenas os tokens que só
  existiam nessa cópia (`--color-branco`, `--raio-lg`, `--raio-xl`, `--raio-pill`);
  **nenhum valor de token existente mudou**.

<!--
Categorias: Added, Changed, Deprecated, Removed, Fixed, Security.
Não crie uma versão nova sem cumprir o checklist de release.
Próximo release planejado: 1.17.10.2026 (tag v1.17.10.2026) — aguarda a verificação da
volta no Figma e o `figma:compare`.
-->
