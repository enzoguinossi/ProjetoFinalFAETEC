import type { NotaSaidaItemDetalhe } from "./tipos";

/** Item da nota com o total solicitado e o total entregue. */
export function itemSaidaDetalhe(item: {
  id_item_nota_saida: number;
  qtd_esperada: number;
  qtd_entregue: number;
  produto: { id_produto: number; descricao: string };
}): NotaSaidaItemDetalhe {
  return {
    id_item_nota_saida: item.id_item_nota_saida,
    id_produto: item.produto.id_produto,
    descricao: item.produto.descricao,
    quantidade_solicitada: Number(item.qtd_esperada),
    quantidade_entregue: Number(item.qtd_entregue),
  };
}
