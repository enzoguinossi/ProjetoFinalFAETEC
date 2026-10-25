# PROJECT_STATE — Nexus

> Estado corrente do trabalho orquestrado. **Escritor único: Orquestrador.**
> Última consolidação: 2026-10-25 (correção das unidades, unidade de saída na Remessa e
> ajustes do dashboard/relatórios).

## Objetivo atual

**Concluir a entrega final do Nexus para a FAETEC 2026.** A `main` local está à frente de
`origin/main` (`fff7076`) com o mural/validades/gráficos (`dc24eca`) e, nesta rodada, a
correção de unidades e a unidade padrão de saída na Remessa. O servidor de produção está
**parado** (3001) e o `nexus_prod` ainda precisa do `db push` e da release.

## Entregue nesta rodada (commit 30ba95a)

1. **Semântica de unidades corrigida (KAN-140):** a conversão é **fator de entrada**
   (`quantidade_convertida = quantidade × fator`); estoque, reserva, baixa e movimentação
   ficam em **base (UNIDADE, fator 1)**. O nome da conversão não é mais usado como unidade
   do saldo.
2. **Dashboard sem unidade:** removidos “soma das quantidades, sem converter unidades”,
   o nome de conversão no top 5 e qualquer rótulo de unidade.
3. **Relatórios/CSV/seletores/listagens sem coluna “Unidade”:** quantidades em base, sem
   o nome da conversão padrão.
4. **Produto com dois campos:** **Conversão Padrão de Entrada** (`id_conversao_padrao`) e
   **Unidade Padrão de Saída** (`id_conversao_saida`), ambos **NOT NULL**, default
   `UNIDADE`/1, lado a lado no formulário/visualização, cada um com o botão “+” que abre o
   mesmo `UnidadesModal`.
5. **Remessa com unidade de saída:** a quantidade é informada na unidade padrão de saída
   do produto; o item guarda `unidade_saida` (nome snapshot), `fator_conversao` e
   `quantidade_solicitada`; `qtd_esperada`/`qtd_entregue` ficam em base. Avaria/Consumo
   não usam unidade de saída; notas antigas usam fallback e não exibem unidade.
6. **Expedição:** mostra a unidade de saída e a base; o input/baixa/parcial/corte são
   explicitamente **base** (2 CAIXA = 100 base), sem ambiguidade.
7. **Exclusão de unidade:** revincula à padrão **os dois vínculos** do produto, com
   auditoria; o nome/fator da nota ficam no snapshot.
8. **Docs:** `ENTENDIMENTO`, `REQUISITOS_FUNCIONAIS`, `IMPLEMENTACAO`, `REGRAS_NEGOCIO`,
   `AGENTS.md`, diagramas e `CHANGELOG` (`[Unreleased]`) atualizados.
9. **Testes:** **422/422**; lint, build e `figma:check` verdes; QA e reviewer aprovaram o
   bloqueante da expedição; rótulos restantes de base ajustados.

## Estado verificado

- **Git:** `main` em `6cd7b2f` + working tree desta rodada; `origin/main` em `fff7076`;
  tags `v3.24.10.2026` e `v4.24.10.2026`; nada empurrado.
- **Banco dev (`nexus`):** `db push` aplicado; a `UNIDADE` padrão foi **renumerada para
  `id_conversao = 1`** (antes era 4) preservando os 8 produtos. `nexus_test` sincronizado.
- **Produção:** worktree `projetofinalfaetec-prod` em `c1d2f8c` (3.24.10.2026), servidor
  3001 parado; `nexus_prod` sem as colunas novas e sem a padronização de id.

## Risco de produção (gate de deploy)

O schema usa `id_conversao_padrao`/`id_conversao_saida` **NOT NULL DEFAULT 1**. Antes do
`db push` no `nexus_prod`, conferir a `conversao_unidade`:
- se não existir `id_conversao = 1`, o FK falha;
- se `id = 1` não for `UNIDADE`/`padrao = true`, os produtos existentes passam a sair na
  unidade errada (fator 50 reservaria 50×).
Fazer o alinhamento/backfill para o id da unidade `padrao = true` **antes** do push (como
foi feito no dev) e validar o smoke da Remessa.

## Pendências reais

1. **Commit e release** — a próxima release no dia 25/10 seria `1.25.10.2026`
   (tag `v1.25.10.2026`); exige aprovação do usuário.
2. **Produção** — backup, conferência/backfill do id 1, `db push` com consentimento,
   atualizar a worktree, build/start/smoke. Servidor 3001 parado.
3. **Escopo restante para 100%** — RF015 (inventário), RF020 (fotos da nota), RF024/XLSX
   e partes de RF019/RF021; sem decisão do usuário.
4. **Jira** — fechamento/ajustes de KAN-140/KAN-156/KAN-157/KAN-144 e worklogs, com texto
   aprovado.
5. **Manual/apresentação** — KAN-149/150/151/152.

## Próximas ações

1. Revisar o diff final e commitar (KAN-140).
2. Aprovar a release `1.25.10.2026` + push.
3. Preparar a produção com o gate do id da UNIDADE padrão e o `db push`.
4. Decidir o escopo restante e atualizar manual/apresentação/Jira.

## Histórico recente

- **2026-10-25** — correção de unidades, unidade de saída na Remessa, dashboard/relatórios
  sem unidade, layout e botão do produto, expedição em base rotulada; 422 testes; docs.
- **2026-10-25** — mural, validades, sino e gráficos (`dc24eca`); 416 testes.
- **2026-10-24** — releases `3.24.10.2026` e `4.24.10.2026`.
- Runs: `.ai-workflow/runs/` (01–77).
