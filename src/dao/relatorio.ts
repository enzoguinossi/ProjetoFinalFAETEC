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

/** Tipos de movimentação que podem ser filtrados na Movimentação (lista vazia = todos). */
export const TIPOS_MOVIMENTACAO_RELATORIO = ["entrada", "saida"] as const;
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
  /** Produtos selecionados; vazio não filtra. */
  id_produtos?: number[];
  /** Restringe às movimentações das notas de saída destes destinatários. */
  id_destinatarios?: number[];
  /** Restringe às movimentações das notas de entrada destes fornecedores. */
  id_fornecedores?: number[];
  /** `entrada` = tem nota de entrada, `saida` = tem nota de saída; vazio = tudo. */
  tipos?: TipoMovimentacaoRelatorio[];
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

export const STATUS_EXPEDICAO_RELATORIO = [
  "PLANEJADA",
  "EM_PERCURSO",
  "CONCLUIDA",
] as const;
export type StatusExpedicaoRelatorio = (typeof STATUS_EXPEDICAO_RELATORIO)[number];

export const STATUS_NOTA_RELATORIO = [
  "PENDENTE",
  "BAIXA_TOTAL",
  "BAIXA_PARCIAL",
  "BAIXA_COM_CORTE",
  "EM_PERCURSO",
  "ABERTA",
  "CANCELADA",
] as const;
export type StatusNotaRelatorio = (typeof STATUS_NOTA_RELATORIO)[number];

/** Rótulos de status usados na tela e no CSV (mesmos da listagem de expedições). */
export const ROTULOS_STATUS_EXPEDICAO = {
  PLANEJADA: "Planejada",
  EM_PERCURSO: "Em percurso",
  CONCLUIDA: "Concluída",
} as const;

/** Rótulos de status da nota de saída (mesmos da listagem de expedições). */
export const ROTULOS_STATUS_NOTA = {
  ABERTA: "Aberta",
  EM_PERCURSO: "Em percurso",
  PENDENTE: "Pendente",
  BAIXA_TOTAL: "Baixa total",
  BAIXA_PARCIAL: "Baixa parcial",
  BAIXA_COM_CORTE: "Baixa com corte",
  CANCELADA: "Cancelada",
} as const;

export type ExpedicaoRelatorioRow = {
  id_expedicao: number;
  /** `YYYY-MM-DD`: `data_prevista` é DATE, sem hora. */
  data_prevista: string;
  status: (typeof ROTULOS_STATUS_EXPEDICAO)[keyof typeof ROTULOS_STATUS_EXPEDICAO];
  veiculo: string;
  condutor: string;
  /** Quantidade de notas vinculadas à expedição. */
  notas: number;
  /** Razões sociais distintas das notas, separadas por vírgula; `—` sem notas. */
  destinatarios: string;
  itens_esperados: number;
  itens_entregues: number;
};

export type ExpedicoesRelatorioResult = {
  data: ExpedicaoRelatorioRow[];
  totais: { notas: number; esperados: number; entregues: number };
};

export type ExpedicoesRelatorioFiltros = {
  /** Limite inferior do dia de `data_prevista` (meia-noite UTC). */
  de?: Date | null;
  /** Limite superior do dia de `data_prevista` (meia-noite UTC), inclusivo. */
  ate?: Date | null;
  /** Expedições selecionadas; vazio não filtra. */
  id_expedicoes?: number[];
  /** Restringe às expedições com alguma nota dos destinatários. */
  id_destinatarios?: number[];
  /** Condutores selecionados; vazio não filtra. */
  id_condutores?: number[];
  /** Status selecionados; vazio não filtra. */
  status?: StatusExpedicaoRelatorio[];
};

export type EntregaRelatorioRow = {
  id_nota_saida: number;
  /** Código exibido no relatório (`formatarCodigo(ID_nota_saida)`). */
  codigo: string;
  data: Date;
  destinatario: string;
  status: (typeof ROTULOS_STATUS_NOTA)[keyof typeof ROTULOS_STATUS_NOTA];
  /** Quantidade de itens da nota. */
  itens: number;
  esperado: number;
  entregue: number;
  /** `Σ(qtd_esperada − qtd_entregue)`. */
  pendente: number;
  /** `EXP #id` do vínculo mais recente, ou `—`. */
  expedicao: string;
};

export type EntregasRelatorioResult = {
  data: EntregaRelatorioRow[];
  totais: { esperado: number; entregue: number; pendente: number };
};

export type EntregasRelatorioFiltros = {
  /** Limite inferior (inclusivo) já convertido para o instante UTC. */
  de?: Date | null;
  /** Limite superior (inclusivo). */
  ate?: Date | null;
  /** Destinatários selecionados; vazio não filtra. */
  id_destinatarios?: number[];
  /** Status da nota selecionados; vazio não filtra. */
  status?: StatusNotaRelatorio[];
};

export type ExpedicaoFiltroRelatorio = {
  id_expedicao: number;
  codigo: string;
  /** `YYYY-MM-DD`. */
  data_prevista: string;
  veiculo: string;
};

export type CondutorFiltroRelatorio = {
  id_funcionario: number;
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
    if (filtros.id_produtos?.length) {
      where.estoque = { id_produto: { in: filtros.id_produtos } };
    }
    if (filtros.id_destinatarios?.length) {
      where.notaSaida = { id_destinatario: { in: filtros.id_destinatarios } };
    }
    if (filtros.id_fornecedores?.length) {
      where.notaEntrada = { id_fornecedor: { in: filtros.id_fornecedores } };
    }

    const tipos = filtros.tipos ?? [];
    if (tipos.length === 1) {
      where[tipos[0] === "entrada" ? "id_nota_entrada" : "id_nota_saida"] = { not: null };
    } else if (tipos.length > 1) {
      // Entrada e saída selecionadas: união das duas — o ajuste (sem nota) fica fora.
      where.OR = [{ id_nota_entrada: { not: null } }, { id_nota_saida: { not: null } }];
    }

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

  /** Produtos ativos para o filtro, mantendo os selecionados mesmo inativos. */
  async listarProdutosAtivos(incluirIds: number[] = []): Promise<ProdutoFiltroRelatorio[]> {
    const produtos = await prisma.produto.findMany({
      where: incluirIds.length
        ? { OR: [{ ativo: true }, { id_produto: { in: incluirIds } }] }
        : { ativo: true },
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
   * Destinatários ativos para o filtro, por razão social. Os selecionados
   * entram mesmo inativos, para o filtro não perder a seleção.
   */
  async listarDestinatariosParaFiltro(
    incluirIds: number[] = [],
  ): Promise<DestinatarioFiltroRelatorio[]> {
    const destinatarios = await prisma.destinatario.findMany({
      where: incluirIds.length
        ? { OR: [{ ativo: true }, { id_destinatario: { in: incluirIds } }] }
        : { ativo: true },
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

  /** Fornecedores ativos para o filtro, por razão social (mesma regra do destinatário). */
  async listarFornecedoresParaFiltro(
    incluirIds: number[] = [],
  ): Promise<FornecedorFiltroRelatorio[]> {
    const fornecedores = await prisma.fornecedor.findMany({
      where: incluirIds.length
        ? { OR: [{ ativo: true }, { id_fornecedor: { in: incluirIds } }] }
        : { ativo: true },
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

  /**
   * Expedições por período (RF023): data prevista no intervalo, com veículo,
   * condutor e as notas (destinatário e quantidades). A linha soma os itens de
   * todas as notas; a data prevista desce (mais recente primeiro).
   */
  async listarExpedicoesRelatorio(
    filtros: ExpedicoesRelatorioFiltros = {},
  ): Promise<ExpedicoesRelatorioResult> {
    const where: Prisma.ExpedicaoWhereInput = { ativo: true };

    if (filtros.de || filtros.ate) {
      where.data_prevista = {};
      if (filtros.de) where.data_prevista.gte = filtros.de;
      if (filtros.ate) where.data_prevista.lte = filtros.ate;
    }
    if (filtros.id_expedicoes?.length) {
      where.id_expedicao = { in: filtros.id_expedicoes };
    }
    if (filtros.id_condutores?.length) {
      where.id_funcionario_condutor = { in: filtros.id_condutores };
    }
    if (filtros.id_destinatarios?.length) {
      where.notas = {
        some: { notaSaida: { id_destinatario: { in: filtros.id_destinatarios } } },
      };
    }
    if (filtros.status?.length) where.status = { in: filtros.status };

    const expedicoes = await prisma.expedicao.findMany({
      where,
      select: {
        id_expedicao: true,
        data_prevista: true,
        status: true,
        veiculo: { select: { placa: true } },
        condutor: { select: { pessoaFisica: { select: { nome: true } } } },
        notas: {
          select: {
            notaSaida: {
              select: {
                destinatario: {
                  select: { pessoaJuridica: { select: { razao_social: true } } },
                },
                itens: { select: { qtd_esperada: true, qtd_entregue: true } },
              },
            },
          },
        },
      },
      orderBy: [{ data_prevista: "desc" }, { id_expedicao: "desc" }],
    });

    const data: ExpedicaoRelatorioRow[] = expedicoes.map((expedicao) => {
      const itens = expedicao.notas.flatMap((nota) => nota.notaSaida.itens);
      const destinatarios = [
        ...new Set(
          expedicao.notas
            .map((nota) => nota.notaSaida.destinatario?.pessoaJuridica.razao_social)
            .filter((nome): nome is string => Boolean(nome)),
        ),
      ].join(", ");

      return {
        id_expedicao: expedicao.id_expedicao,
        data_prevista: expedicao.data_prevista.toISOString().slice(0, 10),
        status: ROTULOS_STATUS_EXPEDICAO[expedicao.status],
        veiculo: expedicao.veiculo.placa,
        condutor: expedicao.condutor.pessoaFisica.nome,
        notas: expedicao.notas.length,
        destinatarios: destinatarios || "—",
        itens_esperados: arredondar(
          itens.reduce((soma, item) => soma + Number(item.qtd_esperada), 0),
        ),
        itens_entregues: arredondar(
          itens.reduce((soma, item) => soma + Number(item.qtd_entregue), 0),
        ),
      };
    });

    const totais = data.reduce(
      (acc, row) => ({
        notas: acc.notas + row.notas,
        esperados: acc.esperados + row.itens_esperados,
        entregues: acc.entregues + row.itens_entregues,
      }),
      { notas: 0, esperados: 0, entregues: 0 },
    );

    return {
      data,
      totais: {
        notas: totais.notas,
        esperados: arredondar(totais.esperados),
        entregues: arredondar(totais.entregues),
      },
    };
  }

  /**
   * Entregas por instituição (RF023): notas de saída criadas no período, com
   * destinatário, itens, quantidades e a expedição mais recente. A pendência é
   * a diferença entre o esperado e o entregue, item a item. Data decrescente.
   */
  async listarEntregasRelatorio(
    filtros: EntregasRelatorioFiltros = {},
  ): Promise<EntregasRelatorioResult> {
    const where: Prisma.NotaSaidaWhereInput = { ativo: true };

    if (filtros.de || filtros.ate) {
      where.data_criacao = {};
      if (filtros.de) where.data_criacao.gte = filtros.de;
      if (filtros.ate) where.data_criacao.lte = filtros.ate;
    }
    if (filtros.id_destinatarios?.length) {
      where.id_destinatario = { in: filtros.id_destinatarios };
    }
    if (filtros.status?.length) where.status = { in: filtros.status };

    const notas = await prisma.notaSaida.findMany({
      where,
      select: {
        id_nota_saida: true,
        data_criacao: true,
        status: true,
        destinatario: {
          select: { pessoaJuridica: { select: { razao_social: true } } },
        },
        itens: { select: { qtd_esperada: true, qtd_entregue: true } },
        expedicoes: {
          select: { id_expedicao: true },
          orderBy: { data_adicao: "desc" },
          take: 1,
        },
      },
      orderBy: [{ data_criacao: "desc" }, { id_nota_saida: "desc" }],
    });

    const data: EntregaRelatorioRow[] = notas.map((nota) => {
      const ultimaExpedicao = nota.expedicoes[0];
      const esperado = arredondar(
        nota.itens.reduce((soma, item) => soma + Number(item.qtd_esperada), 0),
      );
      const entregue = arredondar(
        nota.itens.reduce((soma, item) => soma + Number(item.qtd_entregue), 0),
      );

      return {
        id_nota_saida: nota.id_nota_saida,
        codigo: formatarCodigo(nota.id_nota_saida),
        data: nota.data_criacao,
        destinatario: nota.destinatario?.pessoaJuridica.razao_social ?? "—",
        status: ROTULOS_STATUS_NOTA[nota.status],
        itens: nota.itens.length,
        esperado,
        entregue,
        pendente: arredondar(esperado - entregue),
        expedicao: ultimaExpedicao ? `EXP #${ultimaExpedicao.id_expedicao}` : "—",
      };
    });

    const totais = data.reduce(
      (acc, row) => ({
        esperado: acc.esperado + row.esperado,
        entregue: acc.entregue + row.entregue,
        pendente: acc.pendente + row.pendente,
      }),
      { esperado: 0, entregue: 0, pendente: 0 },
    );

    return {
      data,
      totais: {
        esperado: arredondar(totais.esperado),
        entregue: arredondar(totais.entregue),
        pendente: arredondar(totais.pendente),
      },
    };
  }

  /**
   * Expedições do período para o filtro, por data prevista decrescente. Sem
   * período, todas as ativas. As expedições selecionadas entram mesmo fora do
   * período ou inativas, para o filtro não perder a seleção.
   */
  async listarExpedicoesParaFiltro(opts: {
    de?: Date | null;
    ate?: Date | null;
    incluirIds?: number[];
  } = {}): Promise<ExpedicaoFiltroRelatorio[]> {
    const periodo: Prisma.ExpedicaoWhereInput = { ativo: true };
    if (opts.de || opts.ate) {
      periodo.data_prevista = {};
      if (opts.de) periodo.data_prevista.gte = opts.de;
      if (opts.ate) periodo.data_prevista.lte = opts.ate;
    }

    const expedicoes = await prisma.expedicao.findMany({
      where: opts.incluirIds?.length
        ? { OR: [periodo, { id_expedicao: { in: opts.incluirIds } }] }
        : periodo,
      select: {
        id_expedicao: true,
        data_prevista: true,
        veiculo: { select: { placa: true } },
      },
      orderBy: [{ data_prevista: "desc" }, { id_expedicao: "desc" }],
    });

    return expedicoes.map((expedicao) => ({
      id_expedicao: expedicao.id_expedicao,
      codigo: formatarCodigo(expedicao.id_expedicao),
      data_prevista: expedicao.data_prevista.toISOString().slice(0, 10),
      veiculo: expedicao.veiculo.placa,
    }));
  }

  /** Condutores ativos (funcionário com `condutor = true`), por nome. */
  async listarCondutoresParaFiltro(
    incluirIds: number[] = [],
  ): Promise<CondutorFiltroRelatorio[]> {
    const condutores = await prisma.funcionario.findMany({
      where: incluirIds.length
        ? { OR: [{ ativo: true, condutor: true }, { id_funcionario: { in: incluirIds } }] }
        : { ativo: true, condutor: true },
      select: {
        id_funcionario: true,
        pessoaFisica: { select: { nome: true } },
      },
      orderBy: { pessoaFisica: { nome: "asc" } },
    });

    return condutores.map((condutor) => ({
      id_funcionario: condutor.id_funcionario,
      nome: condutor.pessoaFisica.nome,
    }));
  }
}

export const relatorioDAO = new RelatorioDAO();
