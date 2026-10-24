# Sistema de Relatorios Impressos (A4)

Modelo padronizado em HTML5 e CSS3 para geracao de relatorios operacionais em formato A4, prontos para impressao ou exportacao em PDF.

---

## Padrao Visual

- Formato: Folha A4 portrait (210mm x 297mm).
- Cores: Preto, cinza e branco.
- Tipografia: Arial / Helvetica.
- Ajuste de impressao: Suporte a regra @media print e margens A4.

---

## Estrutura de Modulos

| ID | Nome do Relatorio | Ficheiro | Status |
| :--- | :--- | :--- | :--- |
| KAN-158 | 0/5 Base Compartilhada | Relatorio.css | Concluido |
| KAN-159 | 1/5 Lista de Produtos | Produtos.html | Concluido |
| KAN-161 | 2/5 Extrato de Produto | Extrato_produto.html | Concluido |
| KAN-163 | 3/5 Funcionarios | Funcionarios.html | A fazer |
| KAN-162 | 4/5 Destinatarios | Destinatarios.html | A fazer |
| KAN-160 | 5/5 Fornecedores | Fornecedores.html | A fazer |
| - | Documentacao do modelo | Projeto.html | Referencia |

> O **Extrato de Produto** usa a mesma tela da **Movimentação de Estoque**
> (`/relatorios/movimentacao`): basta escolher o produto no filtro (equivalente a
> `?produto=<id>`). O título e o cabeçalho passam a identificar o produto.

---

## Dicionario de Placeholders

Substitua os placeholders abaixo pelos dados dinamicos do sistema:

### Cabecalho
- {{NOME_RELATORIO}}: Titulo principal do relatorio.
- {{DATA_EMISSAO}}: Data de geracao (DD/MM/AAAA).
- {{HORA_EMISSAO}}: Hora de geracao (HH:MM).
- {{PAGINA_ATUAL}}: Numero da pagina.
- {{TOTAL_PAGINAS}}: Total de paginas.

### Tabela de Dados
- {{COD_PRODUTO}}: Codigo identificador do item.
- {{DESC_PRODUTO}}: Nome ou descricao do produto.
- {{QTD_ESTOQUE}}: Quantidade em estoque.
- {{QTD_LIVRE}}: Quantidade disponivel.

### Totalizadores
- {{TOTAL_ESTOQUE}}: Soma total em estoque.
- {{TOTAL_LIVRE}}: Soma total livre.
- {{USUARIO_EMISSOR}}: Usuario responsavel pela emissao.

---

## Como Exportar em PDF

1. Abra o arquivo HTML no navegador.
2. Pressione Ctrl + P (Windows) ou Cmd + P (Mac).
3. Selecione a opcao "Salvar como PDF".
4. Marque a opcao "Graficos de segundo plano" nas configuracoes.