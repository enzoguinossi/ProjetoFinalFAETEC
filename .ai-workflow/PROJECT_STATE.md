# PROJECT_STATE — Nexus

> Estado corrente do trabalho orquestrado. **Escritor único: Orquestrador.**
> Última consolidação: 2026-10-31 (fotos unificadas + tentativa de entrega).

## Objetivo atual

**Concluir a entrega final do Nexus para a FAETEC 2026.** A `main` local está em
`69ce759` (módulo de Pedidos) com a feature de **fotos unificadas e tentativa de
entrega** no working tree, ainda **sem commit**. A produção está **parada** (3001);
faltam a release, a migração/backfill de produção e o escopo restante.

## Entregue nesta rodada (working tree; commit pendente)

### RUN-20261031-89 — fotos unificadas

1. **`anexo` único** com dono exclusivo (`id_produto`, `id_funcionario` ou
   `id_expedicao_nota`), `id_usuario`, `ativo`, cascade; `produto.foto_url` **removido**.
2. **Produto e funcionário** com 1 foto ativa (troca desativa a anterior e remove o
   arquivo só após o commit; rollback em falha); `foto_url` do DTO derivado do anexo.
3. **Funcionário** ganhou foto no cadastro/visualização.
4. **`FotosField`/`FotosGaleria`** reutilizáveis (upload/URL no cadastro, múltiplo na
   tentativa, remoção via `remover_anexos`, limite e preview).
5. **Relatórios:** checkbox “Listar fotos” em Produtos e Funcionários (tela, impressão e
   CSV com URL).
6. **`experimental.serverActions.bodySizeLimit = "30mb"`** (o padrão de 1 MB não comporta
   nem a foto de produto de 5 MB).
7. Fixtures do Figma atualizadas (anexo em vez de `foto_url`).

### RUN-20261031-90 — tentativa de entrega

1. **Fotos na tentativa** (`expedicao_nota`): 0..5, WEBP 1024px/5 MB, `data_tentativa`,
   `id_usuario_tentativa`, justificativa; imutáveis depois de registrada.
2. **“Não entregue”** exige justificativa (1..1000) e aceita fotos; nota volta a
   `PENDENTE`, mantém a reserva e pode ir para outra expedição.
3. **Entrega parcial:** o formulário lista **só itens com pendência**, mostra os completos
   em leitura e usa **“entregar agora”** (delta, default = pendência); o servidor recusa
   item sem pendência, redução do já entregue e delta zero em todos sem corte/justificativa.
4. **Corte com item omitido** libera a reserva do restante (correção do reviewer).
5. **Tela da expedição e detalhe da nota** exibem tentativas, justificativa e galeria.
6. **Relatórios de Entregas e Expedições** com checkbox “Listar fotos”, miniaturas,
   justificativa e CSV com URLs; `RelatorioAmpliado` A4 paisagem.
7. **Docs:** AGENTS (§13/§14/§17), ENTENDIMENTO, REGRAS, RFs, IMPLEMENTACAO, diagramas,
   CHANGELOG e README.

## Estado verificado

- **Git:** `main` em `69ce759`; working tree com 35+ arquivos dos RUN-89/90 (não
  commitado). `origin/main` em `fff7076`; nada empurrado. `next-env.d.ts` restaurado.
- **Testes/gates:** 44 arquivos, **490/490 testes**; `lint`, `build` e `tsc --noEmit`
  verdes. Reviewer: **sem bloqueante** (achados relevantes corrigidos). QA: **APROVADO**
  (limitação: sem clique real no navegador/impressão física).
- **Banco dev:** dataset manual de validação (1 produto, 3 notas, 4 expedições, fotos);
  `nexus_test` limpo após a suíte; `nexus_prod` intocado.
- **Uploads:** `public/uploads/` é ignorado pelo Git; há 3 arquivos órfãos de validação
  (produtos/2782 e versões antigas), sem impacto.
- **Produção:** worktree `C:\Users\Enzo\Documents\Code\projetofinalfaetec-prod` em
  `c1d2f8c`, servidor 3001 parado, `nexus_prod` no schema antigo.

## Pendências reais

1. **Commit** — a feature está sem commit; falta definir a **chave Jira** correta
   (o trabalho cruza KAN-140/KAN-142/KAN-153; não associar a issue errada). Sugestão:
   uma issue nova “Fotos unificadas e tentativa de entrega” ou duas KANs (cadastro vs
   entrega).
2. **Release** — próxima release no dia 31/10: `1.31.10.2026` / tag `v1.31.10.2026`,
   com aprovação do usuário.
3. **Produção — backfill obrigatório antes do `db push`:**
   - capturar `produto.foto_url` antes de remover a coluna e recriar os `anexo` depois;
   - achatamento do estoque (`produto.saldo`) e dedupe das notas (`npm run db:dedupe-notas`);
   - limpar `anexo` legado (sem dono / `ID_nota_saida`) e arquivos órfãos.
   Nenhum script de migração de `foto_url` foi criado ainda.
4. **Escopo restante para 100%** — RF011 (leitor dedicado), RF012 (transferência, se
   entrar), RF019 (assistente ou encerrar com o aviso RN001), RF021 (quadro de
   pendências/urgências), RF023 (consolidado semestral/filtros motorista/veículo) e
   RF024/XLSX. RF018, RF026 e RNF009 estão fora.
5. **Jira/manual** — issues/worklogs; KAN-149/150/151/152.

## Próximas ações

1. Definir a chave Jira e commitar os RUN-89/90 (sem push).
2. Aprovar a release `1.31.10.2026` + push.
3. Preparar a produção: backfill de fotos/estoque, dedupe, gates, `db push`,
   build/start/smoke.
4. Fechar RF011/RF012/RF019/RF021/RF023/RF024 e a documentação final.

## Histórico recente

- **2026-10-31** — fotos unificadas em `anexo`, foto de funcionário, tentativa de entrega
  com fotos/justificativa, parcial e relatórios com checkbox; 490 testes.
- **2026-10-28** — Pedidos/RF025 (`69ce759`).
- **2026-10-27/28** — inventário (RF015).
- **2026-10-26** — estoque achatado (`6993a93`); permissões (`be58c0c`).
- **2026-10-25** — notas só com totais (`3b1a767`); unidades (`30ba95a`); mural (`dc24eca`).
- Runs: `.ai-workflow/runs/` (01–90).
