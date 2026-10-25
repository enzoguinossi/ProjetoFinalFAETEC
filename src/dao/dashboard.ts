import { prisma } from "@/lib/prisma";
import { formatarCodigo } from "@/lib/formatar";
import {
  chaveMesSaoPaulo,
  diaUtcSaoPaulo,
  ultimosMeses,
} from "@/lib/datas";
import { STATUS_NOTA_SAIDA } from "@/types";

/** Evita resíduo de ponto flutuante (Float no banco). */
function arredondar(valor: number): number {
  return Math.round(valor * 1000) / 1000;
}

export const ROTULOS_STATUS_NOTA: Record<string, string> = {
  ABERTA: "Aberta",
  EM_PERCURSO: "Em percurso",
  PENDENTE: "Pendente",
  BAIXA_TOTAL: "Baixa total",
  BAIXA_PARCIAL: "Baixa parcial",
  BAIXA_COM_CORTE: "Baixa com corte",
  CANCELADA: "Cancelada",
};

export type DashboardEstoque = {
  itens: number;
  produtosComSaldo: number;
};

export type DashboardMovimentacoes = {
  labels: string[];
  entradas: number[];
  saidas: number[];
};

export type DashboardTopProduto = {
  id_produto: number;
  descricao: string;
  quantidade: number;
};

export type DashboardStatusNota = {
  status: string;
  label: string;
  total: number;
};

export type DashboardPendencia = {
  id_nota_saida: number;
  codigo: string;
  destinatario: string;
  status: string;
  label: string;
};

export type DashboardPermissoes = {
  estoque: boolean;
  notas: boolean;
  expedicoes: boolean;
};

export type DashboardResumo = {
  estoque: DashboardEstoque;
  saidasPendentes: number;
  expedicoesAtivas: number;
  vencendoEm30Dias: number;
  movimentacoes: DashboardMovimentacoes;
  topProdutos: DashboardTopProduto[];
  statusNotas: DashboardStatusNota[];
  pendencias: DashboardPendencia[];
};

const VAZIO: DashboardResumo = {
  estoque: { itens: 0, produtosComSaldo: 0 },
  saidasPendentes: 0,
  expedicoesAtivas: 0,
  vencendoEm30Dias: 0,
  movimentacoes: { labels: [], entradas: [], saidas: [] },
  topProdutos: [],
  statusNotas: [],
  pendencias: [],
};

export class DashboardDAO {
  /** Soma de `quantidade_atual` dos estoques ativos. */
  async resumoEstoque(): Promise<DashboardEstoque> {
    const [soma, porProduto] = await Promise.all([
      prisma.estoque.aggregate({
        where: { ativo: true },
        _sum: { quantidade_atual: true },
      }),
      prisma.estoque.groupBy({
        by: ["id_produto"],
        where: { ativo: true },
        _sum: { quantidade_atual: true },
      }),
    ]);

    return {
      itens: arredondar(soma._sum.quantidade_atual ?? 0),
      produtosComSaldo: porProduto.filter(
        (linha) => (linha._sum.quantidade_atual ?? 0) > 0,
      ).length,
    };
  }

  /** Notas em PENDENTE ou BAIXA_PARCIAL (as que exigem acompanhamento). */
  async contarSaidasPendentes(): Promise<number> {
    return prisma.notaSaida.count({
      where: { ativo: true, status: { in: ["PENDENTE", "BAIXA_PARCIAL"] } },
    });
  }

  async contarExpedicoesAtivas(): Promise<number> {
    return prisma.expedicao.count({
      where: { ativo: true, status: "EM_PERCURSO" },
    });
  }

  /** Perecíveis ativos que vencem entre hoje e os próximos 30 dias. */
  async contarVencendoEm30Dias(agora: Date = new Date()): Promise<number> {
    const hoje = diaUtcSaoPaulo(agora);
    const limite = new Date(hoje.getTime() + 30 * 86_400_000);
    return prisma.produto.count({
      where: {
        perecivel: true,
        ativo: true,
        data_validade: { gte: hoje, lte: limite },
      },
    });
  }

  /**
   * Entradas × saídas dos últimos 6 meses, derivadas de `movimentacao_estoque`
   * pelo vínculo com nota de entrada ou nota de saída. Ajustes ficam fora.
   */
  async movimentacoesPorMes(agora: Date = new Date()): Promise<DashboardMovimentacoes> {
    const meses = ultimosMeses(6, agora);
    const movimentacoes = await prisma.movimentacaoEstoque.findMany({
      where: { data_hora: { gte: meses[0].primeiroDia } },
      select: {
        quantidade: true,
        data_hora: true,
        id_nota_entrada: true,
        id_nota_saida: true,
      },
    });

    const indice = new Map(meses.map((mes, i) => [mes.chave, i]));
    const entradas = meses.map(() => 0);
    const saidas = meses.map(() => 0);

    for (const movimentacao of movimentacoes) {
      const posicao = indice.get(chaveMesSaoPaulo(movimentacao.data_hora));
      if (posicao === undefined) continue;
      const quantidade = Number(movimentacao.quantidade);
      if (movimentacao.id_nota_entrada !== null) {
        entradas[posicao] += quantidade;
      } else if (movimentacao.id_nota_saida !== null) {
        saidas[posicao] += Math.abs(quantidade);
      }
    }

    return {
      labels: meses.map((mes) => mes.label),
      entradas: entradas.map(arredondar),
      saidas: saidas.map(arredondar),
    };
  }

  /** Top 5 produtos por quantidade atual. */
  async topProdutos(): Promise<DashboardTopProduto[]> {
    const grupos = await prisma.estoque.groupBy({
      by: ["id_produto"],
      where: { ativo: true },
      _sum: { quantidade_atual: true },
      orderBy: { _sum: { quantidade_atual: "desc" } },
      take: 5,
    });

    const comSaldo = grupos.filter(
      (grupo) => (grupo._sum.quantidade_atual ?? 0) > 0,
    );
    if (comSaldo.length === 0) return [];

    const produtos = await prisma.produto.findMany({
      where: { id_produto: { in: comSaldo.map((grupo) => grupo.id_produto) } },
      select: {
        id_produto: true,
        descricao: true,
      },
    });
    const porId = new Map(produtos.map((produto) => [produto.id_produto, produto]));

    return comSaldo.flatMap((grupo) => {
      const produto = porId.get(grupo.id_produto);
      if (!produto) return [];
      return [
        {
          id_produto: produto.id_produto,
          descricao: produto.descricao,
          quantidade: arredondar(grupo._sum.quantidade_atual ?? 0),
        },
      ];
    });
  }

  /** Notas de saída por status, com os rótulos legíveis e a ordem do domínio. */
  async notasPorStatus(): Promise<DashboardStatusNota[]> {
    const grupos = await prisma.notaSaida.groupBy({
      by: ["status"],
      where: { ativo: true },
      _count: { _all: true },
    });

    return grupos
      .map((grupo) => ({
        status: grupo.status,
        label: ROTULOS_STATUS_NOTA[grupo.status] ?? grupo.status,
        total: grupo._count._all,
      }))
      .sort(
        (a, b) =>
          STATUS_NOTA_SAIDA.indexOf(a.status) - STATUS_NOTA_SAIDA.indexOf(b.status),
      );
  }

  /** Notas que ainda exigem acompanhamento (sem inventar pendências). */
  async pendencias(): Promise<DashboardPendencia[]> {
    const notas = await prisma.notaSaida.findMany({
      where: { ativo: true, status: { in: ["PENDENTE", "BAIXA_PARCIAL"] } },
      include: {
        destinatario: {
          select: {
            pessoaJuridica: {
              select: { razao_social: true, nome_fantasia: true },
            },
          },
        },
      },
      orderBy: { data_criacao: "desc" },
      take: 8,
    });

    return notas.map((nota) => ({
      id_nota_saida: nota.id_nota_saida,
      codigo: formatarCodigo(nota.id_nota_saida),
      destinatario:
        nota.destinatario?.pessoaJuridica?.nome_fantasia ??
        nota.destinatario?.pessoaJuridica?.razao_social ??
        "Sem destinatário",
      status: nota.status,
      label: ROTULOS_STATUS_NOTA[nota.status] ?? nota.status,
    }));
  }

  /**
   * Resumo do dashboard respeitando as permissões: seções sem permissão voltam
   * zeradas/vazias, e a página explica o motivo em vez de esconder o card.
   */
  async obterResumo(
    permissoes: DashboardPermissoes,
    agora: Date = new Date(),
  ): Promise<DashboardResumo> {
    const [
      estoque,
      saidasPendentes,
      expedicoesAtivas,
      vencendoEm30Dias,
      movimentacoes,
      topProdutos,
      statusNotas,
      pendencias,
    ] = await Promise.all([
      permissoes.estoque ? this.resumoEstoque() : Promise.resolve(VAZIO.estoque),
      permissoes.notas ? this.contarSaidasPendentes() : Promise.resolve(0),
      permissoes.expedicoes ? this.contarExpedicoesAtivas() : Promise.resolve(0),
      permissoes.estoque
        ? this.contarVencendoEm30Dias(agora)
        : Promise.resolve(0),
      permissoes.notas
        ? this.movimentacoesPorMes(agora)
        : Promise.resolve(VAZIO.movimentacoes),
      permissoes.estoque ? this.topProdutos() : Promise.resolve([]),
      permissoes.notas ? this.notasPorStatus() : Promise.resolve([]),
      permissoes.notas ? this.pendencias() : Promise.resolve([]),
    ]);

    return {
      estoque,
      saidasPendentes,
      expedicoesAtivas,
      vencendoEm30Dias,
      movimentacoes,
      topProdutos,
      statusNotas,
      pendencias,
    };
  }
}

export const dashboardDAO = new DashboardDAO();
