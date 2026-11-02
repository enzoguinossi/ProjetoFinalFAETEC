# Relatórios impressos (A4)

Modelo visual dos relatórios do Nexus. A implementação real são as rotas em
`src/app/relatorios/**`, renderizadas no servidor e impressas pelo navegador; os
arquivos `*.html` + `Relatorio.css` desta pasta são os protótipos estáticos que
serviram de base para o layout e continuam como referência visual.

---

## Padrão

- Folha **A4 retrato** (`@page { size: A4 portrait }`, 210 × 297 mm).
- Cores em preto, cinza e branco; tipografia Arial/Helvetica.
- CSS único em `src/app/relatorios/relatorios.css` (importado pelo layout do módulo).
- Moldura dos cadastros (Produtos, Funcionários, Destinatários e Fornecedores),
  Vencimento, Pedidos, Expedições, Entregas e Extrato: `RelatorioCadastro` (ações,
  filtros, folha, totais e rodapé); Movimentação e Auditoria montam a folha diretamente.
- Componentes de folha: `FichaRelatorio` (cadastros), `CartaoRegistro`
  (expedições/entregas), `BadgeStatus`, `BarraFiltros` e `ImprimirButton`.
- O sistema é desktop (mínimo 1360×768); não há layout mobile.

---

## Relatórios implementados

| Relatório | Rota | Folha | CSV |
| :--- | :--- | :--- | :--- |
| Lista de Produtos | `/relatorios/produtos` | fichas | `/relatorios/produtos/export` |
| Movimentação de Estoque | `/relatorios/movimentacao` | faixas por documento | `/relatorios/movimentacao/export` |
| Extrato de Produto | `/relatorios/extrato` | grupos por produto | `/relatorios/extrato/export` |
| Expedições por Período | `/relatorios/expedicoes` | faixa por dia + cartões | `/relatorios/expedicoes/export` |
| Entregas por Instituição | `/relatorios/entregas` | faixa por instituição + cartões | `/relatorios/entregas/export` |
| Pedidos por Escola | `/relatorios/pedidos` | faixa por escola → pedido → itens | `/relatorios/pedidos/export` |
| Funcionários | `/relatorios/funcionarios` | fichas | `/relatorios/funcionarios/export` |
| Destinatários | `/relatorios/destinatarios` | fichas | `/relatorios/destinatarios/export` |
| Fornecedores | `/relatorios/fornecedores` | fichas | `/relatorios/fornecedores/export` |
| Produtos Próximos ao Vencimento | `/relatorios/vencimento` | faixas de urgência | `/relatorios/vencimento/export` |
| Auditoria | `/relatorios/auditoria` | eventos + diff legível | `/relatorios/auditoria/export` |
| Inventário (fechado/cancelado) | `/inventario/[id]/relatorio` | tabela | `/inventario/[id]/relatorio/export` |

> O **Extrato de Produto** é um relatório próprio em `/relatorios/extrato`, com filtro de
> período e de produtos (opcional). Sem produto selecionado, ele mostra todos os produtos
> que tiveram movimentação no período, agrupados por produto; com produtos selecionados,
> inclui também os que não tiveram movimento no período. Ele mostra saldo inicial,
> movimentações e saldo final por produto; a **Movimentação de Estoque**
> (`/relatorios/movimentacao`) permanece agrupada por documento, mesmo quando filtrada por
> produto.

- **Pedidos** usa A4 retrato: faixa por escola, sub-faixa por pedido (código,
  data, status e nota) e itens em linhas.
- **Expedições e Entregas** aceitam `?fotos=1`: até 4 miniaturas (+N) na folha e
  a URL no CSV; em Entregas, a justificativa também entra no CSV.
- **Auditoria** mostra o diff em `antes → depois`, com coleções por item e
  `[oculto]` para campos sensíveis; sem JSON bruto e sem diff em eventos de login.

---

## Protótipos estáticos

`Produtos.html`, `Extrato_produto.html`, `Funcionarios.html`,
`Destinatarios.html`, `Fornecedores.html`, `Projeto.html` e `Relatorio.css` são a
referência visual original (A4 retrato, tabelas). Não são servidos pelo sistema e
não representam o estado atual: os cadastros usam fichas, os relatórios
operacionais usam faixas/cartões e a Auditoria usa eventos com diff legível,
conforme a tabela acima.

---

## Como exportar

1. Abra o relatório em `/relatorios` e aplique os filtros.
2. **CSV**: use o botão **Exportar CSV** da tela (mesmos filtros da URL).
3. **PDF**: use **Imprimir** e escolha "Salvar como PDF" nas configurações de
   impressão, mantendo o papel A4 retrato e os gráficos de segundo plano.
