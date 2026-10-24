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

export const TIPOS_MOVIMENTACAO_RELATORIO = ["todos", "entrada", "saida"] as const;
export type TipoMovimentacaoRelatorio = (typeof TIPOS_MOVIMENTACAO_RELATORIO)[number];

/** Tipo como aparece no relatório: o ajuste é a movimentação sem nota vinculada. */
export type TipoMovimentacaoExibicao = "Entrada" | "Saída" | "Ajuste";

export type MovimentacaoRelatorioRow = {
  id_movimentacao: number;
  /** Data/hora do registro (o service formata no fuso de São Paulo). */
  data_hora: Date;
  id_produto: number;
  /** Código exibido no relatório (`formatarCodigo(ID_produto)`). */
  codigo: string;
  produto: string;
  tipo: TipoMovimentacaoExibicao;
  /** `NE #id`, `NS #id` ou `—` para ajuste. */
  documento: string;
  /** Destinatário da saída ou fornecedor da entrada; `—` quando não houver. */
  destinatario_fornecedor: string;
  quantidade: number;
  saldo_anterior: number | null;
  saldo_posterior: number | null;
  usuario: string;
  observacao: string | null;
};

export type MovimentacoesRelatorioResult = {
  data: MovimentacaoRelatorioRow[];
  /** Soma das quantidades positivas e das negativas em módulo. */
  totais: { entradas: number; saidas: number };
};

export type MovimentacoesRelatorioFiltros = {
  /** Limite inferior (inclusivo) já convertido para o instante UTC. */
  de?: Date;
  /** Limite superior (inclusivo). */
  ate?: Date;
  id_produto?: number | null;
  /** Restringe às movimentações da nota de saída do destinatário. */
  id_destinatario?: number | null;
  /** Restringe às movimentações da nota de entrada do fornecedor. */
  id_fornecedor?: number | null;
  /** `entrada` = tem nota de entrada, `saida` = tem nota de saída, `todos` = tudo. */
  tipo?: TipoMovimentacaoRelatorio;
};

export type ProdutoFiltroRelatorio = {
  id_produto: number;
  codigo: string;
  descricao: string;
};

export type DestinatarioFiltroRelatorio = {
  id_destinatario: number;
  nome: string;
};

export type FornecedorFiltroRelatorio = {
  id_fornecedor: number;
  nome: string;
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

  /**
   * Movimentações de estoque do período (inclusivo), opcionalmente de um
   * produto, de um destinatário/fornecedor e de um tipo. Ordem cronológica
   * crescente — é a leitura de um extrato: cada linha mostra o saldo antes e
   * depois.
   */
  async listarMovimentacoes(
    filtros: MovimentacoesRelatorioFiltros = {},
  ): Promise<MovimentacoesRelatorioResult> {
    const where: Prisma.MovimentacaoEstoqueWhereInput = {};

    if (filtros.de || filtros.ate) {
      where.data_hora = {};
      if (filtros.de) where.data_hora.gte = filtros.de;
      if (filtros.ate) where.data_hora.lte = filtros.ate;
    }
    if (filtros.id_produto) where.estoque = { id_produto: filtros.id_produto };
    if (filtros.id_destinatario) {
      where.notaSaida = { id_destinatario: filtros.id_destinatario };
    }
    if (filtros.id_fornecedor) {
      where.notaEntrada = { id_fornecedor: filtros.id_fornecedor };
    }

    if (filtros.tipo === "entrada") where.id_nota_entrada = { not: null };
    if (filtros.tipo === "saida") where.id_nota_saida = { not: null };

    const movimentacoes = await prisma.movimentacaoEstoque.findMany({
      where,
      select: {
        id_movimentacao: true,
        data_hora: true,
        quantidade: true,
        saldo_anterior: true,
        saldo_posterior: true,
        observacao: true,
        id_nota_entrada: true,
        id_nota_saida: true,
        estoque: { select: { id_produto: true, produto: { select: { descricao: true } } } },
        notaEntrada: {
          select: {
            fornecedor: {
              select: { pessoaJuridica: { select: { razao_social: true } } },
            },
          },
        },
        notaSaida: {
          select: {
            destinatario: {
              select: { pessoaJuridica: { select: { razao_social: true } } },
            },
          },
        },
        usuario: {
          select: {
            login: true,
            funcionario: { select: { pessoaFisica: { select: { nome: true } } } },
          },
        },
      },
      orderBy: [{ data_hora: "asc" }, { id_movimentacao: "asc" }],
    });

    const data: MovimentacaoRelatorioRow[] = movimentacoes.map((m) => {
      const id_produto = m.estoque.id_produto;
      const tipo: TipoMovimentacaoExibicao =
        m.id_nota_entrada !== null
          ? "Entrada"
          : m.id_nota_saida !== null
            ? "Saída"
            : "Ajuste";
      const documento =
        m.id_nota_entrada !== null
          ? `NE #${m.id_nota_entrada}`
          : m.id_nota_saida !== null
            ? `NS #${m.id_nota_saida}`
            : "—";

      return {
        id_movimentacao: m.id_movimentacao,
        data_hora: m.data_hora,
        id_produto,
        codigo: formatarCodigo(id_produto),
        produto: m.estoque.produto.descricao,
        tipo,
        documento,
        destinatario_fornecedor:
          m.notaSaida?.destinatario?.pessoaJuridica.razao_social ??
          m.notaEntrada?.fornecedor?.pessoaJuridica.razao_social ??
          "—",
        quantidade: arredondar(Number(m.quantidade)),
        saldo_anterior: m.saldo_anterior === null ? null : arredondar(Number(m.saldo_anterior)),
        saldo_posterior:
          m.saldo_posterior === null ? null : arredondar(Number(m.saldo_posterior)),
        usuario:
          m.usuario.funcionario.pessoaFisica.nome || m.usuario.login,
        observacao: m.observacao,
      };
    });

    const totais = data.reduce(
      (acc, row) => {
        if (row.quantidade >= 0) acc.entradas += row.quantidade;
        else acc.saidas += Math.abs(row.quantidade);
        return acc;
      },
      { entradas: 0, saidas: 0 },
    );

    return {
      data,
      totais: {
        entradas: arredondar(totais.entradas),
        saidas: arredondar(totais.saidas),
      },
    };
  }

  /** Produtos ativos para o select de filtro do relatório. */
  async listarProdutosAtivos(): Promise<ProdutoFiltroRelatorio[]> {
    const produtos = await prisma.produto.findMany({
      where: { ativo: true },
      select: { id_produto: true, descricao: true },
      orderBy: { descricao: "asc" },
    });

    return produtos.map((p) => ({
      id_produto: p.id_produto,
      codigo: formatarCodigo(p.id_produto),
      descricao: p.descricao,
    }));
  }

  /**
   * Destinatários ativos para o select de filtro, por razão social. O
   * destinatário do filtro corrente entra mesmo inativo, para o select não
   * perder a seleção.
   */
  async listarDestinatariosParaFiltro(
    incluirId?: number | null,
  ): Promise<DestinatarioFiltroRelatorio[]> {
    const destinatarios = await prisma.destinatario.findMany({
      where: incluirId ? { OR: [{ ativo: true }, { id_destinatario: incluirId }] } : { ativo: true },
      select: {
        id_destinatario: true,
        pessoaJuridica: { select: { razao_social: true } },
      },
      orderBy: { pessoaJuridica: { razao_social: "asc" } },
    });

    return destinatarios.map((d) => ({
      id_destinatario: d.id_destinatario,
      nome: d.pessoaJuridica.razao_social,
    }));
  }

  /** Fornecedores ativos para o select de filtro, por razão social (mesma regra do destinatário). */
  async listarFornecedoresParaFiltro(
    incluirId?: number | null,
  ): Promise<FornecedorFiltroRelatorio[]> {
    const fornecedores = await prisma.fornecedor.findMany({
      where: incluirId ? { OR: [{ ativo: true }, { id_fornecedor: incluirId }] } : { ativo: true },
      select: {
        id_fornecedor: true,
        pessoaJuridica: { select: { razao_social: true } },
      },
      orderBy: { pessoaJuridica: { razao_social: "asc" } },
    });

    return fornecedores.map((f) => ({
      id_fornecedor: f.id_fornecedor,
      nome: f.pessoaJuridica.razao_social,
    }));
  }

  /** Produto do filtro para o cabeçalho do Extrato (mesmo inativo, se for o caso). */
  async obterProdutoFiltro(id_produto: number): Promise<ProdutoFiltroRelatorio | null> {
    const produto = await prisma.produto.findUnique({
      where: { id_produto },
      select: { id_produto: true, descricao: true },
    });
    if (!produto) return null;

    return {
      id_produto: produto.id_produto,
      codigo: formatarCodigo(produto.id_produto),
      descricao: produto.descricao,
    };
  }
}

export const relatorioDAO = new RelatorioDAO();
