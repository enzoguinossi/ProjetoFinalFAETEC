import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { registrarAuditoria } from "./_audit";
import { EntidadeComVinculosError } from "./_errors";
import { conversaoUnidadeDAO } from "./conversao-unidade";
import { buildPagination, type ListParams } from "@/types";

type Db = Prisma.TransactionClient;

/** Filtros da listagem de produtos (não se aplicam aos seletores operacionais). */
export type ProdutoListFiltros = {
  /** true = só ativos (default) | false = só inativos | null = todos */
  ativo?: boolean | null;
  perecivel?: boolean;
  composto?: boolean;
  id_tipo_codigo?: number[];
};

export class ProdutoDAO {
  /** `where` base dos filtros de listagem/busca (ativo é tri-state). */
  private filtrosWhere(filtros: ProdutoListFiltros = {}): Prisma.ProdutoWhereInput {
    const where: Prisma.ProdutoWhereInput = {};
    if (filtros.ativo !== null) where.ativo = filtros.ativo ?? true;
    if (filtros.perecivel !== undefined) where.perecivel = filtros.perecivel;
    if (filtros.composto !== undefined) where.composto = filtros.composto;
    if (filtros.id_tipo_codigo && filtros.id_tipo_codigo.length > 0) {
      where.produtoCodigos = { some: { id_tipo_codigo: { in: filtros.id_tipo_codigo } } };
    }
    return where;
  }

  async list(params: ListParams & ProdutoListFiltros = {}, exceptoIds: number[] = []) {
    const { skip, take } = buildPagination(params);
    const where = this.filtrosWhere(params);
    if (params.search) where.descricao = { contains: params.search };
    if (exceptoIds.length > 0) where.id_produto = { notIn: exceptoIds };
    const [data, total] = await Promise.all([
      prisma.produto.findMany({
        skip, take, where,
        orderBy: { descricao: "asc" },
      }),
      prisma.produto.count({ where }),
    ]);
    return { data, total, page: params.page ?? 1, limit: take, totalPages: Math.ceil(total / take) };
  }

  /**
   * Busca priorizada: código exato → prefixo → contém código → descrição.
   * Mantém a ordem de prioridade e remove duplicados entre os lotes.
   * Os filtros da listagem entram em `AND` em todas as condições.
   */
  private async buscarPriorizado<T extends { id_produto: number }>(
    query: string,
    take: number,
    find: (where: Prisma.ProdutoWhereInput) => Promise<T[]>,
    filtros: ProdutoListFiltros = {},
  ): Promise<T[]> {
    const base = this.filtrosWhere(filtros);
    const condicoes: Prisma.ProdutoWhereInput[] = [
      { AND: [base, { produtoCodigos: { some: { codigo: { equals: query } } } }] },
      {
        AND: [
          base,
          {
            produtoCodigos: { some: { codigo: { startsWith: query } } },
            NOT: { produtoCodigos: { some: { codigo: { equals: query } } } },
          },
        ],
      },
      {
        AND: [
          base,
          {
            produtoCodigos: { some: { codigo: { contains: query } } },
            NOT: {
              OR: [
                { produtoCodigos: { some: { codigo: { equals: query } } } },
                { produtoCodigos: { some: { codigo: { startsWith: query } } } },
              ],
            },
          },
        ],
      },
      {
        AND: [
          base,
          {
            descricao: { contains: query },
            NOT: {
              OR: [
                { produtoCodigos: { some: { codigo: { equals: query } } } },
                { produtoCodigos: { some: { codigo: { startsWith: query } } } },
                { produtoCodigos: { some: { codigo: { contains: query } } } },
              ],
            },
          },
        ],
      },
    ];

    const lotes = await Promise.all(condicoes.map((where) => find(where)));

    const vistos = new Set<number>();
    const resultados: T[] = [];
    for (const lote of lotes) {
      for (const p of lote) {
        if (!vistos.has(p.id_produto)) {
          vistos.add(p.id_produto);
          resultados.push(p);
          if (resultados.length >= take) break;
        }
      }
      if (resultados.length >= take) break;
    }
    return resultados.slice(0, take);
  }

  async searchPriorizado(query: string, take = 20, filtros: ProdutoListFiltros = {}) {
    return this.buscarPriorizado(
      query,
      take,
      (where) =>
        prisma.produto.findMany({
          where,
          select: { id_produto: true, descricao: true },
          take,
          orderBy: { descricao: "asc" },
        }),
      filtros,
    );
  }

  async searchPriorizadoComSaldo(
    query: string,
    take = 50,
    filtros: ProdutoListFiltros = {},
  ) {
    return this.buscarPriorizado(
      query,
      take,
      (where) =>
        prisma.produto.findMany({
          where,
          select: {
            id_produto: true,
            descricao: true,
            saldo: true,
            saldo_reservado: true,
            ativo: true,
          },
          take,
          orderBy: { descricao: "asc" },
        }),
      filtros,
    );
  }

  async getById(id: number) {
    return prisma.produto.findUnique({
      where: { id_produto: id },
      include: {
        conversaoPadrao: true,
        conversaoSaida: true,
        produtoCodigos: { include: { tipoCodigo: true } },
        insumosPai: { include: { produtoFilho: true } },
        anexos: {
          where: { ativo: true },
          orderBy: [{ data_upload: "desc" }, { id_anexo: "desc" }],
        },
      },
    });
  }

  async createCompleto(
    data: {
      descricao: string; perecivel?: boolean; composto?: boolean;
      data_validade?: string; id_conversao_padrao?: number; id_conversao_saida?: number;
      codigos?: { id_tipo_codigo: number; codigo: string }[];
      insumos?: { id_produto_filho: number; quantidade: number }[];
    },
    id_usuario: number,
    /** Executado na mesma transação, após o produto existir (foto/anexo). */
    depoisDeCriar?: (tx: Prisma.TransactionClient, id_produto: number) => Promise<void>,
  ) {
    // As duas conversões são obrigatórias. Quando o formulário não informa,
    // vale a unidade padrão do sistema (UNIDADE/1) — a de saída só é usada em
    // Remessa; a de entrada é o fator aplicado na entrada do estoque.
    const unidadePadrao = await conversaoUnidadeDAO.getPadrao();
    const idConversaoPadrao = data.id_conversao_padrao ?? unidadePadrao?.id_conversao;
    if (!idConversaoPadrao) {
      throw new Error("Nenhuma unidade padrão configurada. Execute o seed do sistema.");
    }
    const idConversaoSaida =
      data.id_conversao_saida ?? unidadePadrao?.id_conversao ?? idConversaoPadrao;

    return prisma.$transaction(async (tx) => {
      const p = await tx.produto.create({
        data: {
          descricao: data.descricao,
          perecivel: data.perecivel ?? false,
          composto: data.composto ?? false,
          data_validade: data.data_validade ? new Date(data.data_validade) : undefined,
          id_conversao_padrao: idConversaoPadrao,
          id_conversao_saida: idConversaoSaida,
        },
      });

      await registrarAuditoria(
        id_usuario, "CRIAR", "Produto", p.id_produto,
        null,
        {
          descricao: data.descricao,
          id_conversao_padrao: idConversaoPadrao,
          id_conversao_saida: idConversaoSaida,
          codigos: (data.codigos ?? []).map((c) => ({ id_tipo_codigo: c.id_tipo_codigo, codigo: c.codigo })),
        },
        tx,
      );

      // Códigos personalizados
      for (const c of data.codigos ?? []) {
        await tx.produtoCodigo.create({
          data: { id_produto: p.id_produto, id_tipo_codigo: c.id_tipo_codigo, codigo: c.codigo },
        });
      }

      // Insumos (BOM)
      for (const ins of data.insumos ?? []) {
        await tx.produtoInsumo.create({
          data: { id_produto_pai: p.id_produto, id_produto_filho: ins.id_produto_filho, quantidade: ins.quantidade },
        });
      }

      if (depoisDeCriar) {
        await depoisDeCriar(tx, p.id_produto);
      }

      return tx.produto.findUniqueOrThrow({
        where: { id_produto: p.id_produto },
        include: {
          conversaoPadrao: true,
          conversaoSaida: true,
          produtoCodigos: { include: { tipoCodigo: true } },
          insumosPai: { include: { produtoFilho: true } },
          anexos: {
            where: { ativo: true },
            orderBy: [{ data_upload: "desc" }, { id_anexo: "desc" }],
          },
        },
      });
    });
  }

  async updateCompleto(
    id: number,
    data: {
      descricao?: string; perecivel?: boolean; composto?: boolean;
      data_validade?: string; id_conversao_padrao?: number; id_conversao_saida?: number;
      ativo?: boolean;
      codigos?: { id_tipo_codigo: number; codigo: string }[];
      insumos?: { id_produto_filho: number; quantidade: number }[];
    },
    id_usuario: number,
    /** Executado na mesma transação, após atualizar o produto (foto/anexo). */
    depoisDeAtualizar?: (tx: Prisma.TransactionClient) => Promise<void>,
  ) {
    return prisma.$transaction(async (tx) => {
      const antes = await tx.produto.findUniqueOrThrow({
        where: { id_produto: id },
        include: { produtoCodigos: true },
      });

      const depois = await tx.produto.update({
        where: { id_produto: id },
        data: {
          descricao: data.descricao,
          perecivel: data.perecivel ?? false,
          composto: data.composto ?? false,
          data_validade: data.data_validade ? new Date(data.data_validade) : undefined,
          id_conversao_padrao: data.id_conversao_padrao,
          id_conversao_saida: data.id_conversao_saida,
          ativo: data.ativo ?? true,
        },
      });

      await registrarAuditoria(
        id_usuario,
        data.ativo === false && antes.ativo ? "DESATIVAR" : "ALTERAR",
        "Produto", id,
        {
          descricao: antes.descricao,
          perecivel: antes.perecivel,
          composto: antes.composto,
          ativo: antes.ativo,
          id_conversao_padrao: antes.id_conversao_padrao,
          id_conversao_saida: antes.id_conversao_saida,
          codigos: antes.produtoCodigos.map((c) => ({ id_tipo_codigo: c.id_tipo_codigo, codigo: c.codigo })),
        },
        {
          descricao: depois.descricao,
          perecivel: depois.perecivel,
          composto: depois.composto,
          ativo: depois.ativo,
          id_conversao_padrao: depois.id_conversao_padrao,
          id_conversao_saida: depois.id_conversao_saida,
          codigos: (data.codigos ?? []).map((c) => ({ id_tipo_codigo: c.id_tipo_codigo, codigo: c.codigo })),
        },
        tx,
      );

      // Substitui códigos personalizados
      await tx.produtoCodigo.deleteMany({ where: { id_produto: id } });
      for (const c of data.codigos ?? []) {
        await tx.produtoCodigo.create({
          data: { id_produto: id, id_tipo_codigo: c.id_tipo_codigo, codigo: c.codigo },
        });
      }

      // Substitui insumos
      await tx.produtoInsumo.deleteMany({ where: { id_produto_pai: id } });
      for (const ins of data.insumos ?? []) {
        await tx.produtoInsumo.create({
          data: { id_produto_pai: id, id_produto_filho: ins.id_produto_filho, quantidade: ins.quantidade },
        });
      }

      if (depoisDeAtualizar) {
        await depoisDeAtualizar(tx);
      }

      return tx.produto.findUniqueOrThrow({
        where: { id_produto: id },
        include: {
          conversaoPadrao: true,
          conversaoSaida: true,
          produtoCodigos: { include: { tipoCodigo: true } },
          insumosPai: { include: { produtoFilho: true } },
          anexos: {
            where: { ativo: true },
            orderBy: [{ data_upload: "desc" }, { id_anexo: "desc" }],
          },
        },
      });
    });
  }

  async verificarRelacionamentos(id: number, client: Db = prisma) {
    const [produto, itensNotaSaida, itensNotaEntrada, itensPedido, itensColeta, movimentacoes, insumosFilho, itensInventario, ajustesInventario] = await Promise.all([
      client.produto.findUnique({
        where: { id_produto: id },
        select: { saldo: true, saldo_reservado: true },
      }),
      client.itemNotaSaida.count({ where: { id_produto: id } }),
      client.itemNotaEntrada.count({ where: { id_produto: id } }),
      client.itemPedidoEscola.count({ where: { id_produto: id } }),
      client.itemColeta.count({ where: { id_produto: id } }),
      client.movimentacaoEstoque.count({ where: { id_produto: id } }),
      client.produtoInsumo.count({ where: { id_produto_filho: id } }),
      client.itemInventario.count({ where: { id_produto: id } }),
      client.ajusteInventario.count({ where: { id_produto: id } }),
    ]);

    const vinculos: string[] = [];
    if (Number(produto?.saldo ?? 0) !== 0 || Number(produto?.saldo_reservado ?? 0) !== 0) {
      vinculos.push("saldo de estoque");
    }
    if (itensNotaSaida > 0) vinculos.push(`${itensNotaSaida} item(ns) de nota de saída`);
    if (itensNotaEntrada > 0) vinculos.push(`${itensNotaEntrada} item(ns) de nota de entrada`);
    if (itensPedido > 0) vinculos.push(`${itensPedido} pedido(s) de escola`);
    if (itensColeta > 0) vinculos.push(`${itensColeta} item(ns) de coleta`);
    if (movimentacoes > 0) vinculos.push(`${movimentacoes} movimentação(ões) de estoque`);
    if (insumosFilho > 0) vinculos.push(`${insumosFilho} produto(s) composto(s) que o utilizam como insumo`);
    if (itensInventario > 0) vinculos.push(`${itensInventario} item(ns) de inventário`);
    if (ajustesInventario > 0) vinculos.push(`${ajustesInventario} ajuste(s) de inventário`);

    return { podeExcluir: vinculos.length === 0, vinculos };
  }

  async hardDelete(id: number, id_usuario: number): Promise<string[]> {
    return prisma.$transaction(async (tx) => {
      const { podeExcluir, vinculos } = await this.verificarRelacionamentos(id, tx);
      if (!podeExcluir) throw new EntidadeComVinculosError("este produto", vinculos);

      const antes = await tx.produto.findUniqueOrThrow({ where: { id_produto: id } });
      const anexos = await tx.anexo.findMany({
        where: { id_produto: id, ativo: true },
        select: { url: true },
      });

      await tx.produtoCodigo.deleteMany({ where: { id_produto: id } });
      await tx.produtoInsumo.deleteMany({ where: { id_produto_pai: id } });
      await tx.produto.delete({ where: { id_produto: id } });

      await registrarAuditoria(
        id_usuario, "EXCLUIR", "Produto", id,
        { descricao: antes.descricao, perecivel: antes.perecivel, composto: antes.composto },
        null,
        tx,
      );

      return anexos.map((anexo) => anexo.url);
    });
  }
}

export const produtoDAO = new ProdutoDAO();