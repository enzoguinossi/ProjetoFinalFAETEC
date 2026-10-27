# PROJECT_STATE — Nexus

> Estado corrente do trabalho orquestrado. **Escritor único: Orquestrador.**
> Última consolidação: 2026-10-27 (inventário/contagem implementado sobre o estoque achatado).

## Objetivo atual

**Concluir a entrega final do Nexus para a FAETEC 2026.** A `main` local está à frente de
`origin/main` (`fff7076`) com mural/validades/gráficos (`dc24eca`), ajustes de unidades
(`30ba95a`), notas só com totais (`3b1a767`), revamp de permissões (`be58c0c`), estoque
achatado em `produto` (`6993a93`) e, nesta rodada, o inventário (RF015). A produção está
**parada** (3001); falta a release, o backfill de produção e o escopo restante.

## Entregue nesta rodada (working tree; commit pendente)

1. **Inventário por produto** (sem lote): snapshot `quantidade_sistema = produto.saldo`;
   `ItemInventario`/`AjusteInventario` por `ID_produto`; unique inventário/produto.
2. **Fluxo** `ABERTO → EM_CONTAGEM → AGUARDANDO_APROVACAO → FINALIZADO` + `CANCELADO`;
   abertura/edição travam produtos (`SELECT ... FOR UPDATE`); decisão/finalização/
   cancelamento transacionais e sem ajuste em CANCELADO/FINALIZADO.
3. **Contagem:** uma por funcionário/item (unique); item sem contagem bloqueia; contagem
   cega funcional por `estoque.ver_saldo` + `Inventario.contagem_cega`; sem
   `inventario.ver_contagem_cega`; sistema/saldos/quantidade final/“sem ajuste” mascarados
   na tela/lista/CSV sem `estoque.ver_saldo`.
4. **Decisão por item** (`quantidade_final`, `origem` MEDIA/CONTAGEM,
   `id_contagem_inventario`, `decidido_em`, `id_usuario_decisao`); média ou qualquer
   contagem individual, inclusive sem diferença. `AjusteInventario` só com diferença,
   único, com `quantidade_contada`/origem/contagem; movimento com `id_ajuste_inventario`;
   rejeição/cancelamento sem saldo.
5. **Bloqueio por produto** em todas as operações de saldo implementadas (entrada, saída,
   reserva, liberação, ajuste, baixa, baixa direta), exceto o ajuste do inventário.
6. **Editável/excluível** só antes da primeira contagem; depois só cancelar; `data_fim` no
   cancelamento; auditoria com produto/quantidade/saldo; hard delete de produto protegido;
   consulta após fechado; `FINALIZADO` não volta.
7. **UI** `/inventario` em Mov. Estoque: lista, detalhe/contagem, aprovação comparativa,
   lista de contagem impressa (campos em branco; sistema opcional; emitente/data; sem
   assinatura), relatório CSV/PDF; `data-figma`, harvest 53/53 e `figma:check`.
8. **Docs:** ENTENDIMENTO/REGRAS/REQUISITOS/IMPLEMENTACAO/AGENTS/diagramas/CHANGELOG.
9. **Testes/validação:** 448/448; lint, build e `figma:check` verdes; reviewer/QA
   aprovaram após as correções de concorrência e cega.

## Estado verificado

- **Git:** `main` em `6993a93` + working tree do inventário; `origin/main` em `fff7076`;
  nada empurrado.
- **Banco dev:** estoque achatado (saldo −18/reservado 514, dado pré-existente); inventário 1
  finalizado/backfillado no dev; `nexus_test` sem resíduos.
- **Produção:** worktree em `c1d2f8c`, servidor 3001 parado; `nexus_prod` no schema antigo.

## Pendências reais

1. **Commit e release** — commitar o inventário e publicar a próxima release no dia 27/10,
   `1.27.10.2026` (tag `v1.27.10.2026`); exige aprovação do usuário.
2. **Produção** — script/backfill versionado do achatamento (somas ativas, remapeamento
   `ID_estoque`→`ID_produto`, backup, detecção de linhas inativas), `db push`, build/start/
   smoke. Servidor 3001 parado.
3. **Escopo restante para 100%** — RF020 (fotos), RF024/XLSX e partes de RF019/RF021.
4. **Jira/manual** — KAN-140/156/157/144, worklogs e KAN-149/150/151/152.
5. **Pendências técnicas conhecidas** — coleta/desmontagem sem código (bloqueio cobre o que
   existe); `figma:harvest` das telas novas já OK; a permissão obsoleta pode exigir limpeza
   em bancos antigos.

## Próximas ações

1. Commitar o inventário.
2. Aprovar a release `1.27.10.2026` + push.
3. Preparar a produção com backfill/backup e os gates.
4. Fechar o escopo restante/manual/Jira.

## Histórico recente

- **2026-10-27** — inventário implementado e revisado; 448 testes; concorrência e cega
  corrigidas; docs.
- **2026-10-26** — estoque achatado em `produto` (`6993a93`); revamp de permissões
  (`be58c0c`).
- **2026-10-25** — notas só com totais (`3b1a767`); unidades/unidade de saída (`30ba95a`);
  mural/validades/gráficos (`dc24eca`).
- Runs: `.ai-workflow/runs/` (01–84).
