# PROJECT_STATE — Nexus

> Estado corrente do trabalho orquestrado. **Escritor único: Orquestrador.**
> Última consolidação: 2026-11-02 (relatórios em fichas/faixas + auditoria legível,
> commit `KAN-157`).

## Objetivo atual

Padronizar todos os relatórios: cadastro em “ficha”, movimentação/extrato por documento/
produto, auditoria legível com antes/depois e os quatro relatórios restantes em faixas/cartões.
Base anterior: repaginação dos cadastros + seed demo no commit `KAN-139` (worktree principal,
`main`). Esta rodada foi commitada em `KAN-157` (`4bc480d` + `a191f62`, sem push).

## Entregue (runs `RUN-20261102-01..11`)

1. **Componentes:** `FichaRelatorio` e `RelatorioCadastro` em `src/components/relatorios/`
   + `src/types/relatorio.ts` e `src/lib/fichas-relatorio.ts` (adaptadores por entidade).
2. **Produtos:** Quantidade/Reservado/Qtd. livre e Un. de entrada/Un. de saída; foto
   opcional (1 anexo ativo) com quadro “Sem foto”; todos os códigos em grade de 4 colunas;
   totalizador Total/Livre.
3. **Funcionários:** CPF/Cargo/Condutor e E-mail/Telefone; foto opcional.
4. **Destinatários:** CNPJ/Tipo/Telefone e Endereço/E-mail; sem foto.
5. **Fornecedores:** CNPJ/Telefone e Endereço/E-mail; sem foto.
6. **Filtro “Listar códigos”** nos quatro relatórios, refletindo na tela e no CSV
   (coluna opcional “Códigos” com `TIPO: valor`).
7. **Filtro “Listar contatos”** em funcionários, destinatários e fornecedores
   (runs `RUN-20261102-02/03`): faixa “Contatos” entre o corpo e os códigos, com todos os
   e-mails e telefones ativos, principal primeiro e marcado, tipo do telefone e formatação.
   Com o filtro ligado, o corpo perde “E-mail”/“Telefone” (sem duplicação); o CSV
   **substitui** `E-mail`/`Telefone` por `E-mails`/`Telefones` na mesma posição.
8. **Movimentação e Extrato são relatórios separados** (runs `RUN-20261102-04/05`):
   - `/relatorios/movimentacao` é sempre a movimentação agrupada por documento (o filtro de
     produto apenas filtra; não vira extrato);
   - `/relatorios/extrato` é um relatório próprio, com período + produto(s) opcionais:
     **sem produto, agrupa todos os produtos com movimentação no período**; com seleção,
     inclui o produto sem movimento; cada grupo tem saldo inicial, movimentações e subtotal
     (saldo final/entradas/saídas); CSV próprio acompanha os filtros (período obrigatório);
   - observação do movimento impressa; helper puro `relatorio-movimentacao.ts`.
9. **Seed de movimentações** (`prisma/seed-movimentacoes.ts` + `npm run db:seed:mov`, run
   `RUN-20261102-07`): 3 entradas + 3 saídas por produto ativo pelo fluxo
   pedido → remessa → expedição → entrega → baixa; dev-only (`nexus`), marcador
   `[seed-mov]` e retomada por etapa. Executado: 12 produtos, 3 notas de entrada,
   9 pedidos/remessas/expedições, 36+36 movimentos.
10. **Auditoria legível** (runs `RUN-20261102-08/09`): cada evento mostra o antes/depois a
    partir de `dados_anteriores`/`dados_novos`, agrupado por dia; coleções (`itens`, `saldos`,
    `movimentacoes`, `notas_expedicao`) viram blocos por item, sem JSON, com **uma linha
    por atributo alterado**; entidades e referências exibem rótulo + descrição
    (`Nota de saída #10 · Escola…`, produto, usuário);
    status/datas formatados; sensíveis redigidos (`[oculto]`); CSV com Entidade, Descrição e
    Alterações legíveis. Módulo de auditoria com pesquisa/filtros avançados fica para depois.
11. **Padronizações:** `ImprimirButton` movido para `components/relatorios/`; helpers
    `formatarQuantidade` e `contagem`; `ROTULOS_TIPO_CODIGO`; helper `montarCsv`.
12. **Vencimento, Pedidos, Expedições e Entregas** (run `RUN-20261102-11`): todos em A4
    retrato com `RelatorioCadastro`; Vencimento em faixas de urgência; Pedidos por escola →
    pedido (status em badge) → itens; Expedições por dia + cartão por expedição; Entregas por
    instituição + cartão por nota. `BadgeStatus`/`CartaoRegistro` compartilhados;
    `id_destinatario` nas linhas de pedidos/entregas; CSV preservado.
13. **Sem schema novo**; quantidades seguem sem unidade (AGENTS §8).

## Verificação

- `npm run lint` → exit 0.
- `npm run build` → exit 0.
- `tests/lib/relatorio-movimentacao.test.ts` + `tests/services/relatorio.test.ts` +
  `tests/dao/relatorio.test.ts` → 84/84; com auditoria e vencimento → **118/118** em 6
  arquivos. (`npm test` padrão continua bloqueado pelo `prisma db push` do `globalSetup` sob
  agente; suíte completa rodou 497/497 com o push desligado.)
- Commits `KAN-157`: `4bc480d` (relatórios em fichas/faixas + auditoria) e `a191f62`
  (seed de movimentações). Sem push.
- Seed de movimentações executado no `nexus`; conferência independente: 12 produtos,
  3 notas de entrada, 9 pedidos/remessas/expedições e **3 entradas + 3 saídas por produto**
  (36+36 movimentos), sem divergências; reexecução idempotente.
- Inspeção visual em desktop 1440×900 com o CSS real: fichas, 8 códigos, faixa de contatos
  (3 e-mails + 3 telefones, caso de uma coluna), funcionário sem duplicação, movimentação
  por documento, Extrato por produto e auditoria com antes/depois. A inspeção achou e corrigiu
  a linha de observação do Extrato (classe `mov-obs` com `display:block` quebrava o `colSpan`),
  o “1 itens” e o alinhamento/redação do diff de auditoria.
- Auditoria conferida na tela real (`/relatorios/auditoria`, dev server): nota com escola,
  “Usuário da tentativa” resolvido, coleções com descrição dos produtos, login sem diff e
  sem linhas vazias; sem JSON na folha. Após o ajuste de layout, cada item tem cabeçalho e
  uma linha por atributo (`Qtd. entregue 0 → 40`, `Saldo 250 → 210`).
- Quatro relatórios restantes conferidos em 1440×900 no dev server: Pedidos (escola →
  pedido com badge APROVADO → itens), Entregas (instituição + cartões BAIXA TOTAL),
  Vencimento (faixa “61 a 90 dias” com badge “em 74 dias”) e Expedições (dia + cartões com
  status/veículo/condutor).

## Pendências

1. **Docs:** atualizar `docs/dominio/IMPLEMENTACAO.md` com o modelo de ficha, as rotas de
   movimentação/extrato, a auditoria com diff/descrições, os quatro relatórios em faixas e o
   seed de movimentações.
2. **Módulo avançado de auditoria** (pesquisa, filtros e visualização própria) — adiado pelo
   usuário; o resolvedor de descrições já é reutilizável.
3. **Refatoração adiada pelo usuário:** separar responsabilidades do `BarraFiltros`
   (helpers de data/filtros) e trocar os SVGs inline por `lucide-react`.
4. **Release** `1.xx.xx.2026` + push (aprovação).
5. **Produção:** backfill `foto_url` → `anexo`, achatamento do estoque, dedupe das notas,
   gates, `db push`, build/start/smoke.
6. **RFs restantes:** RF011, RF012, RF019, RF021, RF023, RF024/XLSX; RF018/RF026/RNF009
   fora do escopo.
