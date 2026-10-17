# ADR 0001 — Arquitetura de orquestração multiagente

- **Data:** 2026-10-17
- **Status:** aceita

## Contexto

O desenvolvimento era assistido por uma única sessão de IA, sem estado persistente,
sem contratos de delegação e sem papéis especializados. Havia risco de perda de
contexto (compactação), trabalho duplicado e ausência de rastreabilidade entre
código, issue e release.

## Decisão

Adotar uma arquitetura **hierárquica de agentes** usando os recursos nativos
verificados do OpenCode V2:

- **Orquestrador** (`mode: primary`) é a interface; decompõe, delega e consolida.
- **Subagentes** (`mode: subagent`): `developer`, `reviewer`, `qa`, `docs-keeper`,
  `release-manager`. Delegação pela ferramenta nativa **`subagent`** (sessões-filhas,
  contexto próprio). `openchamber session.*` fica reservado para runs que o **usuário**
  acompanha.
- **Estado persistente** em `.ai-workflow/` (versionado), com escritor único para o
  estado consolidado e um arquivo por run.
- **Contrato de tarefa** padronizado; relatório de agente **não** é prova — o
  Orquestrador valida Git/Jira.
- **Versionamento DateVer** `N.DD.MM.YYYY` (tag `vN.DD.MM.YYYY`) + **Keep a Changelog** pt-BR.
- **Fonte única de regras de Jira** permanece `docs/agents/JIRA.MD` (estendida, não duplicada).

## Alternativas consideradas

- *Reutilizar OpenChamber Notes/Plans como estado* — rejeitado: é armazenamento do app,
  não do repositório; não garante recuperação a partir de registros versionados.
- *Um único "agente faz-tudo"* — rejeitado: contraria a separação de papéis e a revisão
  independente.
- *`session.create` para toda delegação* — rejeitado: mais pesado que o `subagent` nativo
  para trabalho interno; reservado a runs visíveis ao usuário.

## Consequências

- Requer disciplina de escrita nos arquivos de estado (evita concorrência).
- Custo: duas etapas extras (contrato e validação) por tarefa.
- Ganho: retomada após compactação, rastreabilidade issue↔commit↔release, revisão
  independente e menos trabalho duplicado.
