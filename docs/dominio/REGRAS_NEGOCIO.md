# Regras de Negócio — Projeto Nexus

**Semântica das quantidades (transversal às RNs):** a conversão de unidade é **apenas auxílio
de lançamento** — multiplica a quantidade digitada para calcular o total na hora, sem ser
copiada para a nota. O saldo do produto, a reserva, a baixa e a movimentação ficam em **base**
(`UNIDADE`, fator 1), e dashboard, relatórios e CSV exibem a quantidade base sem unidade.
`item_nota_entrada.quantidade` é o total que entra no saldo; `item_nota_saida` guarda só
`qtd_esperada` (total solicitado) e `qtd_entregue` (total entregue). A **Unidade Padrão de
Saída** do produto só auxilia o lançamento de notas de Remessa (`SAIDA`) — ver
[`ENTENDIMENTO.md`](./ENTENDIMENTO.md) §3.6.1, §3.11.1 e §3.12.

**Semântica do saldo (produto):** não existe tabela nem linha de estoque/lote. O saldo é do
**produto** — `produto.saldo` e `produto.saldo_reservado` (default `0` desde a criação), com
`saldo_disponivel = saldo − saldo_reservado`. Toda operação (entrada, reserva, liberação, baixa
e movimentação) atualiza essas duas colunas e registra o histórico com `ID_produto` em
`movimentacao_estoque`/`reserva_estoque` (`saldo_anterior`/`saldo_posterior`). `data_entrada` e
`ativo` de estoque não existem: a data fica no histórico e a atividade é `produto.ativo`. O
inventário não cria uma segunda linha/coluna de saldo: ele congela um snapshot de
`produto.saldo` e, na aprovação, ajusta o próprio produto. Ver
[`ENTENDIMENTO.md`](./ENTENDIMENTO.md) §3.7 e §3.9.

**Semântica do pedido:** o pedido (`pedido_escola`) é **somente a solicitação** — não reserva
estoque nem movimenta saldo, e **não possui `ativo`**: não é desativado nem excluído; o
histórico é o status (`PENDENTE`/`CONFIRMADO`/`RECUSADO`). Editar/aprovar/recusar usam
transição condicional (`PENDENTE`) e geram auditoria. Aprovar apenas torna o pedido elegível
para importação na Saída; a importação cria **uma nota nova por pedido** (1:1), valida
destinatário/produtos/quantidades contra o pedido (**nota divergente é recusada**), soma
produtos repetidos e grava `pedido.ID_nota_saida`. Os itens guardam só o total e a
**observação por item** (copiada para a nota); a conversão padrão de saída é apenas auxílio de
preenchimento, e **nenhuma nota** aceita produto duplicado. `/pedidos` é acessível por qualquer
permissão do módulo, com ações conforme a permissão. Ver
[`ENTENDIMENTO.md`](./ENTENDIMENTO.md) §3.11.0/§3.11.1.

## RN001 — Alerta de Saldo Insuficiente
**Prioridade:** Essencial

Ao tentar criar ou alterar uma nota de saída (ou uma expedição) com saldo insuficiente no
produto (`saldo_disponivel = saldo − saldo_reservado`), o sistema deve **avisar** o usuário
sobre a falta de saldo, mas **permitir que o fluxo continue**. Um bloqueio poderia atrasar a
rotina operacional caso o saldo esteja desatualizado.

## RN002 — Alerta de Validade
**Prioridade:** Essencial

O sistema deve notificar automaticamente no mural de mensagens quando produtos perecíveis estiverem a 90, 60, 45 e 30 dias do vencimento, com base na `data_validade` do cadastro do produto.

## RN003 — Pendência em Entrega Parcial
**Prioridade:** Essencial

Baixa parcial gera registro automático de pendência vinculado ao destinatário.

**Realização no modelo (decisão do usuário, 2026-10-23):** a "pendência" **é a própria nota de
saída** com status `BAIXA_PARCIAL`, ainda vinculada ao destinatário por
`nota_saida.ID_destinatario` — **sem *split*, sem nota nova e sem tabela nova**. O que falta
entregar continua derivado de `item_nota_saida.qtd_esperada − qtd_entregue`, e o restante
permanece reservado (`produto.saldo_reservado`) até ser entregue ou cortado. Ver
[`ENTENDIMENTO.md`](./ENTENDIMENTO.md) §3.11.2.

## RN004 — Imutabilidade de Histórico
**Prioridade:** Essencial

Entradas confirmadas e baixas finalizadas não podem ser excluídas — apenas estornadas via ajuste com justificativa.

O histórico não é o saldo: `produto.saldo`/`saldo_reservado` guardam o valor corrente e
`movimentacao_estoque`/`reserva_estoque` guardam cada alteração com `ID_produto`,
`saldo_anterior` e `saldo_posterior`. Apagar ou reescrever a movimentação (ou zerar o saldo)
para "corrigir" um lançamento é proibido; a correção gera o registro corretivo, e a auditoria
preserva antes/depois.

## RN005 — Aprovação de Ajuste de Inventário
**Prioridade:** Essencial

Diferenças detectadas em inventário não geram ajuste automático — toda alteração no saldo precisa de aprovação manual de usuário com permissão `inventario.aprovar_ajuste`.

A diferença é calculada contra o snapshot do `item_inventario` (`quantidade_sistema`, que é
`produto.saldo` na abertura). O aprovador pode escolher a **média** das contagens
(`origem = MEDIA`) ou **qualquer contagem individual** (`origem = CONTAGEM`, com
`id_contagem_inventario`), independentemente da média. A decisão fica no `ItemInventario`
(`quantidade_final`, `origem`, `id_contagem_inventario`, `decidido_em`,
`id_usuario_decisao`) mesmo quando não há diferença; o `AjusteInventario` (`quantidade_contada`,
sem coluna `diferenca`) só é criado quando `quantidade_final != quantidade_sistema` e é
**único por inventário/produto**. Um produto não pode estar em dois inventários ativos.

**Aprovado:** `produto.saldo` muda pelo delta e grava `movimentacao_estoque` com
`ID_ajuste_inventario`, `saldo_anterior` e `saldo_posterior`; `saldo_reservado` não é
alterado. **Rejeitado:** o saldo não muda e a justificativa fica registrada. **Sem
diferença:** não há ajuste nem movimento, mas o item fica decidido e o inventário pode
finalizar. **Cancelado:** não altera o saldo, preserva contagens/ajustes e grava `data_fim`.

A decisão, a finalização e o cancelamento são transacionais: travam a linha do inventário e
só avançam de status válido. Não há ajuste/movimento em inventário `CANCELADO` ou
`FINALIZADO`.

Enquanto o inventário está `ABERTO`, `EM_CONTAGEM` ou `AGUARDANDO_APROVACAO`, as movimentações
dos produtos inventariados ficam **bloqueadas** — entrada, saída (reserva, liberação, baixa e
baixa direta), desmontagem e coleta. A exceção é a movimentação de ajuste do próprio
inventário. Uma contagem por funcionário/item; item sem contagem impede o fechamento.