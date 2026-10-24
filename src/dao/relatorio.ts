import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { formatarCodigo } from "@/lib/formatar";

export const SITUACOES_PRODUTO_RELATORIO = ["ativas", "inativas", "todas"] as const;
export type SituacaoProdutoRelatorio = (typeof SITUACOES_PRODUTO_RELATORIO)[number];

export type ProdutoRelatorioRow = {
  id_produto: number;
  /** Código exibido no relatório (`formatarCodigo(ID_produto)`). */
  codigo: string;
  descricao: string;
  /** Nome da unidade de conversão padrão do produto. */
  unidade: string;
  /** Soma de `quantidade_atual` dos estoques ativos. */
  quantidade: number;
  /** Soma de `quantidade_atual − saldo_reservado` dos estoques ativos. */
  livre: number;
  situacao: "Ativo" | "Inativo";
};

export type ProdutosRelatorioResult = {
  data: ProdutoRelatorioRow[];
  totais: { quantidade: number; livre: number };
};

export type ProdutosRelatorioFiltros = {
  /** `ativas` (padrão), `inativas` ou `todas`. */
  situacao?: SituacaoProdutoRelatorio;
};

/** Evita resíduo de ponto flutuante nas somas de quantidades (Float no banco). */
function arredondar(valor: number): number {
  return Math.round(valor * 1000) / 1000;
}

export class RelatorioDAO {
  /**
   * Listagem simples de produtos para o relatório impresso/CSV.
   * Não carrega composição (insumos) — apenas identificação, unidade e saldos.
   */
  async listarProdutosRelatorio(
    filtros: ProdutosRelatorioFiltros = {},
  ): Promise<ProdutosRelatorioResult> {
    const situacao = filtros.situacao ?? "ativas";
    const where: Prisma.ProdutoWhereInput = {};

    if (situacao !== "todas") where.ativo = situacao === "ativas";

    const produtos = await prisma.produto.findMany({
      where,
      select: {
        id_produto: true,
        descricao: true,
        ativo: true,
        conversaoPadrao: { select: { nome: true } },
        estoques: {
          where: { ativo: true },
          select: { quantidade_atual: true, saldo_reservado: true },
        },
      },
      orderBy: { descricao: "asc" },
    });

    const data: ProdutoRelatorioRow[] = produtos.map((p) => {
      const quantidade = p.estoques.reduce(
        (soma, e) => soma + Number(e.quantidade_atual),
        0,
      );
      const reservado = p.estoques.reduce(
        (soma, e) => soma + Number(e.saldo_reservado),
        0,
      );
      return {
        id_produto: p.id_produto,
        codigo: formatarCodigo(p.id_produto),
        descricao: p.descricao,
        unidade: p.conversaoPadrao?.nome ?? "—",
        quantidade: arredondar(quantidade),
        livre: arredondar(quantidade - reservado),
        situacao: p.ativo ? "Ativo" : "Inativo",
      };
    });

    const totais = data.reduce(
      (acc, row) => ({
        quantidade: acc.quantidade + row.quantidade,
        livre: acc.livre + row.livre,
      }),
      { quantidade: 0, livre: 0 },
    );

    return {
      data,
      totais: {
        quantidade: arredondar(totais.quantidade),
        livre: arredondar(totais.livre),
      },
    };
  }
}

export const relatorioDAO = new RelatorioDAO();
