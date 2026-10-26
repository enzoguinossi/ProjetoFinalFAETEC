# PROJECT_STATE — Nexus

> Estado corrente do trabalho orquestrado. **Escritor único: Orquestrador.**
> Última consolidação: 2026-10-25 (as notas guardam apenas os totais; conversão é auxílio
> de lançamento).

## Objetivo atual

**Concluir a entrega final do Nexus para a FAETEC 2026.** A `main` local está à frente de
`origin/main` (`fff7076`) com o mural/validades/gráficos (`dc24eca`), os ajustes de
unidades (`30ba95a`) e, nesta rodada, a remoção da conversão das notas. A produção está
**parada** (3001) e o `nexus_prod` ainda precisa da release, do backfill e do `db push`.

## Entregue nesta rodada (working tree; commit pendente)

1. **Nota de entrada sem conversão:** `item_nota_entrada` não tem mais
   `fator_conversao`/`quantidade_convertida`; `quantidade` é o **total** que entra no
   estoque. A criação usa a conversão padrão/fator só como auxílio para calcular o total;
   a edição usa o total guardado. Backfill `quantidade = quantidade_convertida` feito no
   dev antes do drop.
2. **Nota de saída sem conversão:** `item_nota_saida` não tem mais `unidade_saida`,
   `fator_conversao` nem `quantidade_solicitada`; guarda só `qtd_esperada` (solicitado) e
   `qtd_entregue` (entregue). A criação da Remessa usa a unidade de saída/fator do produto
   só para calcular o total; a edição usa o total.
3. **Visualizações limpas:** entrada, saída e expedição mostram apenas quantidades/totais;
   sem unidade, fator, “base” ou “convertida”. `src/lib/expedicao-unidade.ts` removido.
4. **Produto/tabela de conversão:** `id_conversao_padrao`/`id_conversao_saida` e
   `conversao_unidade` continuam como padrões auxiliares de lançamento; nada é copiado
   para a nota.
5. **Docs:** `ENTENDIMENTO`, `REQUISITOS_FUNCIONAIS`, `IMPLEMENTACAO`, `REGRAS_NEGOCIO`,
   `AGENTS.md`, diagramas e `CHANGELOG` (`[Unreleased]`) atualizados para “nota só totais;
   conversão é auxílio”; o backfill está registrado no CHANGELOG.
6. **Testes:** **422/422**; lint, build e `figma:check` verdes (developer); revisão
   independente confirmou criação/edição/estoque/reserva/baixa e apontou o gate de
   migração de produção.

## Estado verificado

- **Git:** `main` em `3e02b50` + working tree desta rodada; `origin/main` em `fff7076`;
  tags `v3.24.10.2026` e `v4.24.10.2026`; nada empurrado.
- **Banco dev (`nexus`):** `db push` aplicado após backfill das 2 linhas de entrada; a
  `UNIDADE` padrão está em `id_conversao = 1`. `nexus_test` sincronizado; 422 testes.
- **Produção:** worktree em `c1d2f8c` (3.24.10.2026), servidor 3001 parado; `nexus_prod`
  sem as colunas novas e sem backfill.

## Gates de produção (antes do deploy)

1. **Backfill da entrada:** antes do `db push` que remove
   `fator_conversao`/`quantidade_convertida`, rodar
   `UPDATE item_nota_entrada SET quantidade = quantidade_convertida WHERE quantidade <> quantidade_convertida;`
   e conferir a contagem. Sem isso, notas antigas passam a exibir/editar a quantidade
   digitada como total e o delta corrompe o estoque.
2. **UNIDADE padrão:** conferir que `conversao_unidade` tem a UNIDADE (`padrao = true`) e
   que os defaults `1` de `id_conversao_padrao`/`id_conversao_saida` apontam para ela;
   se necessário, fazer o backfill para o id correto (no dev era 4 e foi renumerado para 1).
3. O `db push` de produção é destrutivo; exige backup e consentimento explícito.

## Pendências reais

1. **Commit e release** — a próxima release no dia 25/10 seria `1.25.10.2026`
   (tag `v1.25.10.2026`); exige aprovação do usuário.
2. **Produção** — backup, os dois gates acima, `db push`, atualizar a worktree, build/start
   e smoke. Servidor 3001 parado.
3. **Escopo restante para 100%** — RF015 (inventário), RF020 (fotos), RF024/XLSX e partes
   de RF019/RF021; sem decisão do usuário.
4. **Jira** — KAN-140/KAN-156/KAN-157/KAN-144 e worklogs, com texto aprovado.
5. **Manual/apresentação** — KAN-149/150/151/152.

## Próximas ações

1. Commitar o diff desta rodada (KAN-140).
2. Aprovar a release `1.25.10.2026` + push.
3. Preparar a produção com os dois gates e o `db push`.
4. Decidir o escopo restante e atualizar manual/apresentação/Jira.

## Histórico recente

- **2026-10-25** — notas guardam apenas os totais; conversão é auxílio de lançamento;
  422 testes; docs; gate de backfill de produção.
- **2026-10-25** — ajustes de unidades, unidade de saída na Remessa e dashboard sem
  unidade (`30ba95a`); 422 testes.
- **2026-10-25** — mural, validades, sino e gráficos (`dc24eca`); 416 testes.
- **2026-10-24** — releases `3.24.10.2026` e `4.24.10.2026`.
- Runs: `.ai-workflow/runs/` (01–78).
