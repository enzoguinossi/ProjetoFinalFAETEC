# RUN-20261017-02 — Ferramenta de exportação para o Figma (fechamento)

## Identificação

- **Run ID:** `RUN-20261017-02`
- **Criado em:** 2026-10-17
- **Agente executor:** `orchestrator` → delega a `developer` / `reviewer` / `qa`
- **Solicitante:** usuário (sessão principal)
- **Profundidade de delegação:** `0/2`

## Objetivo e tarefa

- **Objetivo:** fechar a ferramenta de exportação do Nexus para o Figma (`tools/figma-export/`).
- **Tarefa:**
  1. Garantir **reuso sob mudança visual**: alterar elementos visuais em `src/components`
     deve continuar refletindo corretamente no Figma — as marcas `data-figma*` não podem
     se perder num refactor.
  2. Concluir a **leitura de componentes (a volta — Figma → app)**.
  3. **Versionamento**: primeiro release DateVer + changelog.
- **Fora de escopo:** alterar a lógica funcional do produto (as marcas são aditivas).

## Rastreabilidade

- **Issues Jira:** KAN-166.
- **Referências:** `tools/figma-export/MAPA.md` (arquitetura, contrato, invariantes,
  armadilhas e histórico de bugs), `tools/figma-export/README.md`,
  `.opencode/skills/figma-export/SKILL.md`, `AGENTS.md` §Exportação para o Figma.
- **Dependências:** nenhuma.

## Escopo e restrições

- **Escopo de arquivos:** `tools/figma-export/**`, `.opencode/skills/figma-export/**`,
  `src/components/**` (só marcas `data-figma*`), `AGENTS.md` (seção da ferramenta),
  `package.json` (scripts `figma:*`), `.gitignore`, `CHANGELOG.md`.
- **Não tocar:** demais arquivos de produto; banco de desenvolvimento (a colheita usa o
  banco isolado `nexus_figma_export`).
- **Critérios de aceite:** ver KAN-166.
  1. `npm run figma:check` limpo, com uma **invariante nova** que trave a perda de marcas
     `data-figma*` (guarda de reuso).
  2. A volta exercitada no Figma real + `npm run figma:diff` conferido.
  3. `npm run figma:compare` executado dentro do limite de 0,5%.
  4. Primeiro release versionado (DateVer) com changelog.

## Ambiente

- **Branch:** `figma-export`
- **Worktree:** `C:/Users/Enzo/.local/share/opencode/worktree/853499850a6d48c07df1738ae584e360336ce596/figma-export`
- **Commit-base:** `f17a671`

## Resultado (preenchido pelo executor)

- **Status:** em andamento (1 de 3 concluída)
- **Commit de preservação do WIP:** `0dfd6e5` (KAN-166) — 42 arquivos, o ferramental
  completo (`tools/figma-export/**` + skill + marcas `data-figma*`).
- **Integração:** `614205a` (merge da `main` — traz agentes e `.ai-workflow` para a branch).
- **Evidência de base:** `npm run figma:check` limpo — 53/53 componentes com tamanho
  medido e âncora, 47/47 telas em 1366×768, 0 duplicações, volta lendo 1.469 instâncias
  (45 com âncora) e 19 variáveis.

### Subtarefas

| Subtarefa | Run | Status | Evidência |
|---|---|---|---|
| Guarda de reuso (invariante #13 das marcas) | `RUN-20261017-02a` | **concluída** | `120a4a1` + `c49c647`; `figma:check` verde com `21/21 promovidos com a marca`; falha demonstrada com a marca removida |
| Leitura de componentes (volta) no Figma real | — | **aguarda o usuário** | pendente a leitura de uma página (aba *Ler do Figma*) + `figma:diff` |
| `figma:compare` (conferência 1:1) | — | **aguarda o usuário** | pendente importação com *conferir 1:1* |
| Versionamento (DateVer + changelog) | — | preparado | `CHANGELOG.md` com `Unreleased`; versão planejada `1.17.10.2026` |

- **Pendências reais:** `figma:compare` nunca rodou de verdade; a leitura real de uma
  página não foi exercitada no Figma — ambas dependem do Figma do usuário (MAPA §9).
