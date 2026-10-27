import { formatarCodigo } from "@/lib/formatar";
import type { Column } from "@/components/DataTable";

/** Linha da listagem de produtos — reaproveitada pelo seletor de produto. */
export type ProdutoListRow = {
  id_produto: number;
  codigo: string;
  descricao: string;
  qtd: string;
  livre: string;
};

/** Colunas da listagem/seletor de produto (Código → Descrição → Quantidade → Qtd. Livre). */
export const COLUNAS_PRODUTO: Column<ProdutoListRow>[] = [
  { key: "codigo", label: "Código", width: "1fr", align: "center" },
  { key: "descricao", label: "Descrição", width: "2fr", align: "left" },
  { key: "qtd", label: "Quantidade", width: "1fr", align: "right" },
  { key: "livre", label: "Qtd. Livre", width: "1fr", align: "right" },
];

type ProdutoComSaldo = {
  id_produto: number;
  descricao: string;
  saldo: number;
  saldo_reservado: number;
};

/**
 * Único lugar que calcula o saldo livre (`saldo − reservado`).
 * Usado pela listagem de produtos e pelo seletor de produto da movimentação.
 * O saldo é sempre em base (UNIDADE), sem rótulo de unidade nas telas.
 */
export function produtoParaLinha(p: ProdutoComSaldo): ProdutoListRow {
  const saldo = Number(p.saldo);
  const reservado = Number(p.saldo_reservado);
  return {
    id_produto: p.id_produto,
    codigo: formatarCodigo(p.id_produto),
    descricao: p.descricao,
    qtd: String(saldo),
    livre: String(saldo - reservado),
  };
}
