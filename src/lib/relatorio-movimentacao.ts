import type {
  MovimentacaoRelatorioRow,
  ProdutoFiltroRelatorio,
  TipoMovimentacaoExibicao,
} from "@/dao/relatorio";

/** Movimentações de um mesmo documento, em linhas consecutivas. */
export type GrupoDocumento = {
  chave: string;
  tipo: TipoMovimentacaoExibicao;
  documento: string;
  data_hora: Date;
  destinatario_fornecedor: string;
  /** Usuários distintos, na ordem em que aparecem. */
  usuarios: string[];
  itens: MovimentacaoRelatorioRow[];
};

/** Extrato de um produto selecionado: saldo inicial, itens e saldo final. */
export type GrupoProduto = {
  id_produto: number;
  codigo: string;
  produto: string;
  saldo_inicial: number | null;
  saldo_final: number | null;
  entradas: number;
  saidas: number;
  itens: MovimentacaoRelatorioRow[];
};

/** Evita resíduo de ponto flutuante nas somas/saldos calculados. */
function arredondar(valor: number): number {
  return Number(valor.toFixed(3));
}

/** Produtos distintos que aparecem nas movimentações (para o extrato sem filtro). */
export function produtosComMovimento(
  data: MovimentacaoRelatorioRow[],
): ProdutoFiltroRelatorio[] {
  const porId = new Map<number, ProdutoFiltroRelatorio>();
  for (const item of data) {
    if (!porId.has(item.id_produto)) {
      porId.set(item.id_produto, {
        id_produto: item.id_produto,
        codigo: item.codigo,
        descricao: item.produto,
      });
    }
  }
  return [...porId.values()];
}

/**
 * Agrupa as movimentações por documento **em linhas consecutivas**: ao mudar a
 * chave, começa outro grupo. Se a mesma nota reaparecer depois de outra, ela
 * vira um novo grupo (a leitura é o extrato na ordem cronológica).
 *
 * Ajustes (sem nota) usam a própria movimentação como chave, então cada um é
 * um grupo isolado.
 */
export function agruparPorDocumento(
  data: MovimentacaoRelatorioRow[],
): GrupoDocumento[] {
  const grupos: GrupoDocumento[] = [];
  let atual: GrupoDocumento | null = null;

  for (const item of data) {
    const chave =
      item.documento === "—" ? `ajuste-${item.id_movimentacao}` : item.documento;

    if (!atual || atual.chave !== chave) {
      atual = {
        chave,
        tipo: item.tipo,
        documento: item.documento,
        data_hora: item.data_hora,
        destinatario_fornecedor: item.destinatario_fornecedor,
        usuarios: [],
        itens: [],
      };
      grupos.push(atual);
    }

    atual.itens.push(item);
    if (!atual.usuarios.includes(item.usuario)) atual.usuarios.push(item.usuario);
  }

  return grupos;
}

/**
 * Monta o extrato de cada produto selecionado, ordenado por código (inclusive
 * os sem movimento). Linhas de produtos fora da seleção são ignoradas.
 */
export function agruparExtratoPorProduto(
  data: MovimentacaoRelatorioRow[],
  produtos: ProdutoFiltroRelatorio[],
): GrupoProduto[] {
  const selecionados = new Set(produtos.map((produto) => produto.id_produto));
  const porProduto = new Map<number, MovimentacaoRelatorioRow[]>();

  for (const item of data) {
    if (!selecionados.has(item.id_produto)) continue;
    const lista = porProduto.get(item.id_produto);
    if (lista) lista.push(item);
    else porProduto.set(item.id_produto, [item]);
  }

  return [...produtos]
    .sort((a, b) => a.codigo.localeCompare(b.codigo))
    .map((produto) => {
      const itens = porProduto.get(produto.id_produto) ?? [];
      const primeiro = itens[0];
      const ultimo = itens[itens.length - 1];

      let saldoInicial: number | null = null;
      if (primeiro) {
        if (primeiro.saldo_anterior !== null) {
          saldoInicial = arredondar(primeiro.saldo_anterior);
        } else if (primeiro.saldo_posterior !== null) {
          saldoInicial = arredondar(primeiro.saldo_posterior - primeiro.quantidade);
        }
      }

      let saldoFinal: number | null = null;
      if (ultimo) {
        if (ultimo.saldo_posterior !== null) {
          saldoFinal = arredondar(ultimo.saldo_posterior);
        } else if (ultimo.saldo_anterior !== null) {
          saldoFinal = arredondar(ultimo.saldo_anterior + ultimo.quantidade);
        }
      }

      let entradas = 0;
      let saidas = 0;
      for (const item of itens) {
        if (item.quantidade > 0) entradas += item.quantidade;
        else if (item.quantidade < 0) saidas += Math.abs(item.quantidade);
      }

      return {
        id_produto: produto.id_produto,
        codigo: produto.codigo,
        produto: produto.descricao,
        saldo_inicial: saldoInicial,
        saldo_final: saldoFinal,
        entradas: arredondar(entradas),
        saidas: arredondar(saidas),
        itens,
      };
    });
}
