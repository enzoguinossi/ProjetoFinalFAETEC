# Changelog

Todas as mudanças relevantes deste projeto são documentadas neste arquivo.

O formato segue [Keep a Changelog 1.1.0 (pt-BR)](https://keepachangelog.com/pt-BR/1.1.0/),
e o versionamento adota **DateVer** `N.DD.MM.YYYY` (tag `vN.DD.MM.YYYY`), em que `N` é a
sequência da release no mesmo dia.

A convenção completa — como numerar releases do mesmo dia, como escrever uma entrada e a
rastreabilidade versão ↔ issues ↔ commit — está em
[`docs/VERSIONAMENTO.md`](docs/VERSIONAMENTO.md). O checklist de release está em
`.opencode/skills/release/SKILL.md`.

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
- `docs/VERSIONAMENTO.md`: fonte detalhada da convenção de versionamento e changelog
  (DateVer + Keep a Changelog 1.1.0 pt-BR), com exemplos de releases no mesmo dia,
  escrita de entradas, rastreabilidade versão ↔ issues ↔ commit e o que nunca fazer.
  Referenciado no cabeçalho do `CHANGELOG.md`, no `README.md` e no `AGENTS.md`. (KAN-166)

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

### Fixed

- Exportação para o Figma — quatro defeitos de **reconstrução** encontrados na revisão das
  telas contra a captura de referência (a cena estava correta; a montagem no Figma não):
  - **Lupa do CEP coberta:** `flex-grow` virava "Fill" nos dois filhos da linha CEP+UF e o
    auto-layout do Figma, que **não tem peso**, dividiu a linha em duas colunas iguais
    (210px): a coluna do CEP encolheu com o conteúdo transbordando e o select da UF passou
    a cobrir o botão da lupa. `grow` agora só é emitido quando há **um** filho que cresce e
    **sobra** para distribuir (o tamanho medido manda).
  - **Paginação em duas linhas** ("Página 1 de" / "0"): `{a} de {b}` no JSX são três nós de
    texto e as três caixas de `Range.getClientRects` eram contadas como três **linhas** — o
    texto saía como quebra automática (`HEIGHT`) e o Figma o re-quebrava. Agora são
    contadas **linhas visuais** e `white-space: nowrap` (herdado) proíbe a quebra.
  - **Vão no `ConfirmDialog`** (excluir de funcionários/destinatários): o mestre vem da
    ocorrência mais completa (mensagem de 3 linhas) e a instância herdava a altura do
    parágrafo, empurrando a barra de botões 23px para baixo. A instância agora adota o
    tamanho da **sua** ocorrência.
  - **Deriva vertical no modal de destinatário:** o campo `flex-1` de uma coluna esticada
    pela grade ficava com `grow` mesmo sem o navegador tê-lo crescido; no Figma o "Fill"
    absorvia os 233px de sobra e os campos seguintes saíam do recorte do modal.
- `figma:check`: quatro invariantes novas de **fidelidade da montagem** (15–18), uma por
  defeito, cada uma provada com o defeito reintroduzido. Nenhum arquivo de `src/**` mudou.

<!--
Categorias: Added, Changed, Deprecated, Removed, Fixed, Security.
Não crie uma versão nova sem cumprir o checklist de release.
Próximo release planejado: 1.17.10.2026 (tag v1.17.10.2026) — aguarda a verificação da
volta no Figma e o `figma:compare`.
-->
