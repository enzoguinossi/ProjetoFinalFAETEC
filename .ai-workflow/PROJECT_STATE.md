# PROJECT_STATE — Nexus

> Estado corrente do trabalho orquestrado. **Escritor único: Orquestrador.**
> Última consolidação: 2026-10-26 (estoque achatado no produto; inventário na sequência).

## Objetivo atual

**Concluir a entrega final do Nexus para a FAETEC 2026.** A `main` local está à frente de
`origin/main` (`fff7076`) com mural/validades/gráficos (`dc24eca`), ajustes de unidades
(`30ba95a`), notas só com totais (`3b1a767`), revamp de permissões (`be58c0c`) e, nesta
rodada, o achatamento do estoque em `produto`. A produção está **parada** (3001); falta a
release, o backfill de produção e o inventário (RF015).

## Entregue nesta rodada (working tree; commit pendente)

1. **Estoque achatado em `produto`:** `Produto.saldo` e `Produto.saldo_reservado`
   (`FLOAT NOT NULL DEFAULT 0`); model/tabela `Estoque` eliminados.
2. **FKs por produto:** `item_nota_saida`, `reserva_estoque`, `movimentacao_estoque`,
   `item_coleta`, `item_inventario` e `ajuste_inventario` referenciam `ID_produto`; nenhum
   `ID_estoque`/`data_entrada`/`estoque.ativo` restante.
3. **Operações:** `SaldoDAO`/`saldoDAO` no produto; entrada, reserva, liberação, ajuste,
   baixa, baixa direta e movimentação com transação, `saldo_anterior`/`saldo_posterior` e
   RN001 preservada. Produto, dashboard, relatórios, saída, expedição e coleta leem o
   produto, sem unidade.
4. **Migração dev:** 7 linhas antigas (5 ativas) consolidadas; 9 produtos preservados,
   4 zerados; 12 movimentações, 11 reservas e 12 itens remapeados sem divergência. Backup
   em `%TEMP%/opencode/nexus-backup-run80.json`. Saldo do dev: −18 (já existente) e
   reservado 514.
5. **Docs:** `ENTENDIMENTO`, `REGRAS_NEGOCIO`, `REQUISITOS_FUNCIONAIS`, `IMPLEMENTACAO`,
   `AGENTS.md`, diagramas e `CHANGELOG` atualizados; `docs/README` com 48 entidades.
6. **Testes/validação:** 422/422; lint, build e `figma:check` verdes; QA aprovou com
   ressalvas não bloqueantes; reviewer sem bloqueante no código.

## Pendências reais

1. **Commit e release** — commitar o achatamento e publicar a próxima release no dia
   26/10, `1.26.10.2026` (tag `v1.26.10.2026`); exige aprovação do usuário.
2. **Script/backfill de produção** — versionar o backfill (somas das linhas ativas,
   remapeamento `ID_estoque`→`ID_produto`, detecção de produto ativo só com linha inativa
   e nota ativa em linha inativa, dump/backup) antes do `db push` no `nexus_prod`.
3. **Inventário (RF015)** — próximo run, com as decisões do usuário:
   - por produto, sem lote; `ItemInventario`/`AjusteInventario` por `ID_produto`;
   - `ABERTO → EM_CONTAGEM → AGUARDANDO_APROVACAO → FINALIZADO` + `CANCELADO`;
   - editável/excluível até a primeira contagem; depois só cancelar (sem hard delete);
   - uma contagem por funcionário/item; item não contado bloqueia a finalização;
   - contagem cega unificada com `estoque.ver_saldo`; `inventario.ver_contagem_cega` sai;
   - `AjusteInventario` sem `diferenca`, com `quantidade_contada`, `origem`
     (`MEDIA`/`CONTAGEM`) e `id_contagem_inventario`; ajuste só com diferença;
   - `MovimentacaoEstoque.id_ajuste_inventario`; bloqueio por produto;
   - lista de contagem impressa (campos em branco; quantidades do sistema opcionais;
     emissor/data; sem assinatura); nome = observação;
   - relatório CSV+PDF do inventário fechado; auditoria rica; consulta após fechado;
     sem exclusão após contagem.
4. **Escopo restante para 100%** — RF020 (fotos), RF024/XLSX e partes de RF019/RF021.
5. **Jira/manual** — KAN-140/156/157/144, worklogs e KAN-149/150/151/152.

## Próximas ações

1. Commitar o achatamento e o script de backfill de produção.
2. Implementar o inventário (`RUN-20261026-81`).
3. Aprovar a release `1.26.10.2026` + push e preparar a produção.
4. Fechar o escopo restante/manual/Jira.

## Histórico recente

- **2026-10-26** — estoque achatado em `produto` (`saldo`/`saldo_reservado`), FKs por
  produto, migração dev; 422 testes; docs.
- **2026-10-26** — revamp da tela de permissões (`be58c0c`).
- **2026-10-25** — notas guardam apenas os totais (`3b1a767`); unidades e unidade de saída
  (`30ba95a`); mural/validades/gráficos (`dc24eca`).
- Runs: `.ai-workflow/runs/` (01–80).
