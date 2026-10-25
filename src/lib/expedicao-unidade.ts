const numero = (valor: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 6 }).format(valor);

/**
 * Item da expedição com a quantidade de saída e a base.
 * A nota de Remessa guarda o snapshot; Avaria/Consumo e notas antigas só têm
 * a base (sem unidade de saída).
 */
export type ItemQuantidadeExpedicao = {
  qtd_esperada: number;
  qtd_entregue: number;
  unidade_saida: string | null;
  fator_conversao: number;
  quantidade_solicitada: number | null;
};

/** Quantidade na unidade de saída, ou `null` quando o item não tem unidade. */
export function quantidadeNaSaida(item: ItemQuantidadeExpedicao): number | null {
  if (!item.unidade_saida) return null;
  const fator = Number(item.fator_conversao);
  const base = Number(item.qtd_esperada);
  if (!Number.isFinite(fator) || fator <= 0 || !Number.isFinite(base)) {
    return null;
  }
  const quantidade = Number(item.quantidade_solicitada ?? base / fator);
  return Number.isFinite(quantidade) ? quantidade : null;
}

/** Ex.: `2 CAIXA (100 base)` na Remessa; `4 (base)` em Avaria/Consumo. */
export function rotuloEsperadaExpedicao(item: ItemQuantidadeExpedicao): string {
  const base = `${numero(Number(item.qtd_esperada))} base`;
  const saida = quantidadeNaSaida(item);
  if (saida === null || !item.unidade_saida) return base;
  return `${numero(saida)} ${item.unidade_saida} (${base})`;
}

/** Entregue sempre em base, com o rótulo explícito. */
export function rotuloEntregueExpedicao(item: ItemQuantidadeExpedicao): string {
  return `${numero(Number(item.qtd_entregue))} base`;
}
