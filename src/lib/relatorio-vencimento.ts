import type { ProdutoVencimentoRelatorioRow } from "@/dao/relatorio";

export type FaixaVencimentoId =
  | "vencidos"
  | "hoje"
  | "ate30"
  | "d31a60"
  | "d61a90"
  | "mais90";

export const FAIXAS_VENCIMENTO: { id: FaixaVencimentoId; titulo: string }[] = [
  { id: "vencidos", titulo: "Vencidos" },
  { id: "hoje", titulo: "Vence hoje" },
  { id: "ate30", titulo: "Vence em até 30 dias" },
  { id: "d31a60", titulo: "31 a 60 dias" },
  { id: "d61a90", titulo: "61 a 90 dias" },
  { id: "mais90", titulo: "Mais de 90 dias" },
];

/** Faixa de urgência de um produto pela diferença em dias para a validade. */
export function classificarVencimento(dias: number): FaixaVencimentoId {
  if (dias < 0) return "vencidos";
  if (dias === 0) return "hoje";
  if (dias <= 30) return "ate30";
  if (dias <= 60) return "d31a60";
  if (dias <= 90) return "d61a90";
  return "mais90";
}

/** Agrupa os produtos nas seis faixas, na ordem de urgência. */
export function agruparVencimento(
  data: ProdutoVencimentoRelatorioRow[],
): { id: FaixaVencimentoId; titulo: string; itens: ProdutoVencimentoRelatorioRow[] }[] {
  return FAIXAS_VENCIMENTO.map((faixa) => ({
    ...faixa,
    itens: data.filter(
      (linha) => classificarVencimento(linha.dias_restantes) === faixa.id,
    ),
  }));
}
