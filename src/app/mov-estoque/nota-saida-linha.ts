import type { NotaSaidaItemDetalhe } from "./tipos";

/**
 * Item da nota com a quantidade de saída e a base lado a lado.
 * Notas antigas não têm `quantidade_solicitada`/`unidade_saida`: o fallback é
 * a quantidade base e nenhuma unidade é exibida.
 */
export function itemSaidaDetalhe(item: {
  id_item_nota_saida: number;
  qtd_esperada: number;
  qtd_entregue: number;
  unidade_saida: string | null;
  fator_conversao: number;
  quantidade_solicitada: number | null;
  estoque: { produto: { id_produto: number; descricao: string } };
}): NotaSaidaItemDetalhe {
  return {
    id_item_nota_saida: item.id_item_nota_saida,
    id_produto: item.estoque.produto.id_produto,
    descricao: item.estoque.produto.descricao,
    unidade_saida: item.unidade_saida,
    fator_conversao: Number(item.fator_conversao),
    quantidade_solicitada: Number(item.quantidade_solicitada ?? item.qtd_esperada),
    quantidade_base: Number(item.qtd_esperada),
    quantidade_entregue: Number(item.qtd_entregue),
  };
}
