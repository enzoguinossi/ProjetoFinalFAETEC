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
     `data-figma*` (guarda de reuso). ✅
  2. A volta exercitada no Figma real + `npm run figma:diff` conferido. ✅
  3. `npm run figma:compare` executado dentro do limite de 0,5%. ⚠️ **dispensado pelo
     usuário em 2026-10-17**: o limite **não é atingível** entre renderizadores (o resíduo
     de ~2,4% é rasterização de texto — Chromium vs Figma; ver MAPA §9). O valor numérico
     passa a ser um portão de sanidade, e a evidência de fidelidade é o **mapa de diff**
     (`out/figma-export/diff/<tela>.png`) revisado por uma pessoa — foi assim que os
     quatro defeitos de reconstrução foram encontrados.
  4. Primeiro release versionado (DateVer) com changelog. ✅

## Ambiente

- **Branch:** `figma-export`
- **Worktree:** `C:/Users/Enzo/.local/share/opencode/worktree/853499850a6d48c07df1738ae584e360336ce596/figma-export`
- **Commit-base:** `f17a671`

## Resultado (preenchido pelo executor)

- **Status:** **concluído** — correções, revisão independente e QA executados; endurecimento aplicado.
- **WIP preservado:** `0dfd6e5` · **integração da infra na branch:** `614205a`

### Subtarefas

| Subtarefa | Run | Status | Evidência |
|---|---|---|---|
| Guarda de reuso (invariante #13 das marcas) | `RUN-20261017-02a` | **concluída** | `120a4a1` + `c49c647`; `21/21 promovidos com a marca`; falha demonstrada |
| Fontes → Inter (causa do desvio no 1:1) | `RUN-20261017-02b` | **concluída** | `5b1250c` + `655c8f0`; `tsc`/`eslint`/`build` verdes; `Inter` em 36/36 textos |
| Leitura de componentes (volta) no Figma real | — | **concluída** | `figma:diff` sobre a `Page 1`: componentes e telas sem diferença |
| `figma:compare` (conferência 1:1) | — | **dispensado** | 3 medições: 2,707% → 2,502% → **2,421%**; limite de 0,5% inatingível (MAPA §9) |
| Tokens com fonte única + upsert no plugin | `RUN-20261017-02c` | **concluída** | `2619971` + `83cc912`; 14 cores + 5 métricas do `globals.css` |
| 4 defeitos de reconstrução | `RUN-20261017-02d` | **concluída** | `2f8d99d` + `12cde68`; invariantes 15–18 |
| Endurecimento pós-revisão | `RUN-20261017-02e` | **concluída** | `67e1024` + `f7c50e5`; 6 achados corrigidos |
| Versionamento (DateVer + changelog) | — | **concluído** | `docs/VERSIONAMENTO.md`; fuso `America/Sao_Paulo` (`25fa7b2`) |

### Revisão e QA

- **Reviewer:** 1 bloqueante (critério #3 não cumprido → **dispensado pelo usuário**) e 8 não
  bloqueantes; os acionáveis viraram o `RUN-20261017-02e`.
- **QA:** 6/6 critérios verificáveis passaram; sem regressões (`npm test` 165/165, `tsc`,
  `eslint`, `build`, `figma:check`, `figma:harvest` 47/47).
- **Limitações aceitas:** (a) limite do `compare` (acima); (b) resíduo de padding do
  `ConfirmDialog` — os designers ajustam manualmente; (c) 2 telas usam `monospace`
  (`LoginForm.tsx`) e o plugin mapeia para Inter.

- **Pendências:** nenhuma bloqueante para o release.
