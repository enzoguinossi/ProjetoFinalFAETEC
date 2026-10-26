# Regras de Negócio — Projeto Nexus

**Semântica das quantidades (transversal às RNs):** a conversão de unidade é **apenas auxílio
de lançamento** — multiplica a quantidade digitada para calcular o total na hora, sem ser
copiada para a nota. O estoque, a reserva, a baixa e a movimentação ficam em **base**
(`UNIDADE`, fator 1), e dashboard, relatórios e CSV exibem a quantidade base sem unidade.
`item_nota_entrada.quantidade` é o total que entra no estoque; `item_nota_saida` guarda só
`qtd_esperada` (total solicitado) e `qtd_entregue` (total entregue). A **Unidade Padrão de
Saída** do produto só auxilia o lançamento de notas de Remessa (`SAIDA`) — ver
[`ENTENDIMENTO.md`](./ENTENDIMENTO.md) §3.6.1, §3.11.1 e §3.12.

## RN001 — Alerta de Saldo Insuficiente
**Prioridade:** Essencial

Ao tentar criar ou alterar uma nota de saída (ou uma expedição) com estoque insuficiente, o sistema deve **avisar** o usuário sobre a falta de saldo, mas **permitir que o fluxo continue**. Um bloqueio poderia atrasar a rotina operacional caso o estoque esteja desatualizado.

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
permanece reservado (`saldo_reservado`) até ser entregue ou cortado. Ver
[`ENTENDIMENTO.md`](./ENTENDIMENTO.md) §3.11.2.

## RN004 — Imutabilidade de Histórico
**Prioridade:** Essencial

Entradas confirmadas e baixas finalizadas não podem ser excluídas — apenas estornadas via ajuste com justificativa.

## RN005 — Aprovação de Ajuste de Inventário
**Prioridade:** Essencial

Diferenças detectadas em inventário não geram ajuste automático — toda alteração no saldo precisa de aprovação manual de usuário com permissão `inventario.aprovar_ajuste`.