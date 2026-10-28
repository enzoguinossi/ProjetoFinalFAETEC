# PROJECT_STATE — Nexus

> Estado corrente do trabalho orquestrado. **Escritor único: Orquestrador.**
> Última consolidação: 2026-10-28 (módulo de Pedidos/RF025 implementado).

## Objetivo atual

**Concluir a entrega final do Nexus para a FAETEC 2026.** A `main` local está à frente de
`origin/main` (`fff7076`) com mural (`dc24eca`), unidades (`30ba95a`), notas só com totais
(`3b1a767`), permissões (`be58c0c`), estoque achatado (`6993a93`), inventário (`77e022c`,
`e4af680`, `68c03a8`) e, nesta rodada, **Pedidos (RF025)**. A produção está **parada**
(3001); falta a release, o dedupe/backfill de produção e o escopo restante.

## Entregue nesta rodada (working tree; commit pendente)

1. **Pedidos (RF025):** `/pedidos` com criar/editar (PENDENTE), aprovar/recusar
   (`pedido.aprovar`), detalhe, observação e observação por item; sem `ativo`/número;
   `data_criacao` automática; pedidos não são desativados nem excluídos.
2. **Importação na Saída:** pedido `CONFIRMADO` sem nota aparece para importar; a Saída usa
   `pedidoService.importar` com conferência somente leitura, valida destinatário/itens/
   quantidades, cria **uma nota nova por pedido**, soma duplicados, aplica RN001/bloqueio
   por inventário, grava `ID_nota_saida` e tira o pedido da importação. Nota divergente é
   recusada.
3. **Unicidade de produto por nota:** `@@unique` em `item_nota_saida`/`item_nota_entrada`
   + validação de serviço; conversão padrão de saída só auxílio, sem vínculo no pedido.
4. **Filtros e relatório:** lista e `/relatorios/pedidos` com escola, status, período,
   produto e nota (com/sem/todas); layout de relatório ampliado/reutilizável em A4
   paisagem + CSV (demais relatórios depois); sem Figma.
5. **Permissões:** `pedido.listar/criar/alterar/consultar/aprovar`; `/pedidos` acessível
   por qualquer uma do módulo, ações conforme permissão; `nota_saida.criar` na importação.
6. **Auditoria** de criar/editar/aprovar/recusar/importar; transições condicionais.
7. **Release de produção:** `scripts/dedupe-itens-nota.ts` +
   `npm run db:dedupe-notas` (URL explícita, dry-run padrão, `--apply` só `nexus_prod`/test,
   backup/auditoria) para deduplicar notas antigas antes do `db push` das uniques.
8. **Docs:** RF025 + renumeração NF-e RF026, ENTENDIMENTO, REGRAS, IMPLEMENTACAO, AGENTS,
   diagramas, CHANGELOG, README, ESCOPO_FORA.
9. **Testes/validação:** 472/472; lint e build verdes; fluxo visual completo e dedupe
   testado no `nexus_test`; dev resetado (decisão do usuário).

## Estado verificado

- **Git:** `main` em `68c03a8` + working tree dos Pedidos; `origin/main` em `fff7076`;
  nada empurrado.
- **Banco dev:** resetado com seed (82 permissões? conferir seed) e fixtures do developer;
  inventário #1 aberto demonstrando bloqueio; `nexus_test` limpo.
- **Produção:** worktree em `c1d2f8c`, servidor 3001 parado; `nexus_prod` no schema antigo.

## Pendências reais

1. **Commit e release** — commitar os Pedidos e publicar a próxima release no dia 28/10,
   `1.28.10.2026` (tag `v1.28.10.2026`); exige aprovação do usuário.
2. **Produção** — backfill do achatamento + dedupe das notas + gates, `db push`,
   build/start/smoke. Servidor 3001 parado.
3. **Escopo restante para 100%** — RF020 (fotos), RF024/XLSX e partes de RF019/RF021.
4. **Jira/manual** — issues/worklogs e KAN-149/150/151/152.
5. **Pendências técnicas** — coleta/desmontagem sem código; filtros/busca nas demais
   DataTables; layout ampliado para os outros relatórios; sem Figma no módulo de Pedidos.

## Próximas ações

1. Commitar os Pedidos.
2. Aprovar a release `1.28.10.2026` + push.
3. Preparar a produção com backfill/dedupe e gates.
4. Fechar o escopo restante/manual/Jira.

## Histórico recente

- **2026-10-28** — Pedidos/RF025 implementado; importação na Saída, filtros/relatório
  ampliado, dedupe script; 472 testes.
- **2026-10-27/28** — inventário implementado (RF015) e lista de contagem A4.
- **2026-10-26** — estoque achatado em `produto` (`6993a93`); revamp de permissões
  (`be58c0c`).
- **2026-10-25** — notas só com totais (`3b1a767`); unidades (`30ba95a`); mural
  (`dc24eca`).
- Runs: `.ai-workflow/runs/` (01–88).
