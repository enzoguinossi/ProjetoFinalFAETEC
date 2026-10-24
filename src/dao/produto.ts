import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { registrarAuditoria } from "./_audit";
import { EntidadeComVinculosError } from "./_errors";
import { buildPagination, type ListParams } from "@/types";

type Db = Prisma.TransactionClient;

export class ProdutoDAO {
  async list(params: ListParams = {}, exceptoIds: number[] = []) {
    const { skip, take } = buildPagination(params);
    const where: Prisma.ProdutoWhereInput = { ativo: true };
    if (params.search) where.descricao = { contains: params.search };
    if (exceptoIds.length > 0) where.id_produto = { notIn: exceptoIds };
    const [data, total] = await Promise.all([
      prisma.produto.findMany({
        skip, take, where,
        include: {
          conversaoPadrao: true,
          estoques: {
            where: { ativo: true },
            select: { quantidade_atual: true, saldo_reservado: true },
          },
        },
        orderBy: { descricao: "asc" },
      }),
      prisma.produto.count({ where }),
    ]);
    return { data, total, page: params.page ?? 1, limit: take, totalPages: Math.ceil(total / take) };
  }

  /**
   * Busca priorizada: código exato → prefixo → contém código → descrição.
   * Mantém a ordem de prioridade e remove duplicados entre os lotes.
   */
  private async buscarPriorizado<T extends { id_produto: number }>(
    query: string,
    take: number,
    find: (where: Prisma.ProdutoWhereInput) => Promise<T[]>,
  ): Promise<T[]> {
    const condicoes: Prisma.ProdutoWhereInput[] = [
      { ativo: true, produtoCodigos: { some: { codigo: { equals: query } } } },
      {
        ativo: true,
        produtoCodigos: { some: { codigo: { startsWith: query } } },
        NOT: { produtoCodigos: { some: { codigo: { equals: query } } } },
      },
      {
        ativo: true,
        produtoCodigos: { some: { codigo: { contains: query } } },
        NOT: {
          OR: [
            { produtoCodigos: { some: { codigo: { equals: query } } } },
            { produtoCodigos: { some: { codigo: { startsWith: query } } } },
          ],
        },
      },
      {
        ativo: true,
        descricao: { contains: query },
        NOT: {
          OR: [
            { produtoCodigos: { some: { codigo: { equals: query } } } },
            { produtoCodigos: { some: { codigo: { startsWith: query } } } },
            { produtoCodigos: { some: { codigo: { contains: query } } } },
          ],
        },
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

  async searchPriorizado(query: string, take = 20) {
    return this.buscarPriorizado(query, take, (where) =>
      prisma.produto.findMany({
        where,
        select: { id_produto: true, descricao: true },
        take,
        orderBy: { descricao: "asc" },
      }),
    );
  }

  async searchPriorizadoComEstoque(query: string, take = 50) {
    return this.buscarPriorizado(query, take, (where) =>
      prisma.produto.findMany({
        where,
        select: {
          id_produto: true,
          descricao: true,
          estoques: {
            where: { ativo: true },
            select: { quantidade_atual: true, saldo_reservado: true },
          },
        },
        take,
        orderBy: { descricao: "asc" },
      }),
    );
  }

  async getById(id: number) {
    return prisma.produto.findUnique({
      where: { id_produto: id },
      include: {
        conversaoPadrao: true,
        produtoCodigos: { include: { tipoCodigo: true } },
        estoques: { where: { ativo: true } },
        insumosPai: { include: { produtoFilho: true } },
      },
    });
  }

  async createCompleto(
    data: {
      descricao: string; foto_url?: string; perecivel?: boolean; composto?: boolean;
      data_validade?: string; id_conversao_padrao?: number;
      codigos?: { id_tipo_codigo: number; codigo: string }[];
      insumos?: { id_produto_filho: number; quantidade: number }[];
    },
    id_usuario: number,
  ) {
    return prisma.$transaction(async (tx) => {
      const p = await tx.produto.create({
        data: {
          descricao: data.descricao,
          foto_url: data.foto_url,
          perecivel: data.perecivel ?? false,
          composto: data.composto ?? false,
          data_validade: data.data_validade ? new Date(data.data_validade) : undefined,
          id_conversao_padrao: data.id_conversao_padrao,
        },
      });

      await registrarAuditoria(
        id_usuario, "CRIAR", "Produto", p.id_produto,
        null,
        { descricao: data.descricao, codigos: (data.codigos ?? []).map((c) => ({ id_tipo_codigo: c.id_tipo_codigo, codigo: c.codigo })) },
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

      return tx.produto.findUniqueOrThrow({
        where: { id_produto: p.id_produto },
        include: { conversaoPadrao: true, produtoCodigos: { include: { tipoCodigo: true } }, insumosPai: { include: { produtoFilho: true } } },
      });
    });
  }

  async updateCompleto(
    id: number,
    data: {
      descricao?: string; foto_url?: string; perecivel?: boolean; composto?: boolean;
      data_validade?: string; id_conversao_padrao?: number; ativo?: boolean;
      codigos?: { id_tipo_codigo: number; codigo: string }[];
      insumos?: { id_produto_filho: number; quantidade: number }[];
    },
    id_usuario: number,
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
          foto_url: data.foto_url,
          perecivel: data.perecivel ?? false,
          composto: data.composto ?? false,
          data_validade: data.data_validade ? new Date(data.data_validade) : undefined,
          id_conversao_padrao: data.id_conversao_padrao,
          ativo: data.ativo ?? true,
        },
      });

      await registrarAuditoria(
        id_usuario,
        data.ativo === false && antes.ativo ? "DESATIVAR" : "ALTERAR",
        "Produto", id,
        { descricao: antes.descricao, perecivel: antes.perecivel, composto: antes.composto, ativo: antes.ativo, codigos: antes.produtoCodigos.map((c) => ({ id_tipo_codigo: c.id_tipo_codigo, codigo: c.codigo })) },
        { descricao: depois.descricao, perecivel: depois.perecivel, composto: depois.composto, ativo: depois.ativo, codigos: (data.codigos ?? []).map((c) => ({ id_tipo_codigo: c.id_tipo_codigo, codigo: c.codigo })) },
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

      return tx.produto.findUniqueOrThrow({
        where: { id_produto: id },
        include: { conversaoPadrao: true, produtoCodigos: { include: { tipoCodigo: true } }, insumosPai: { include: { produtoFilho: true } } },
      });
    });
  }

  async verificarRelacionamentos(id: number, client: Db = prisma) {
    const [estoque, itensNotaSaida, itensNotaEntrada, itensPedido, itensColeta, movimentacoes, insumosFilho] = await Promise.all([
      client.estoque.count({ where: { id_produto: id } }),
      client.itemNotaSaida.count({ where: { estoque: { id_produto: id } } }),
      client.itemNotaEntrada.count({ where: { id_produto: id } }),
      client.itemPedidoEscola.count({ where: { id_produto: id } }),
      client.itemColeta.count({ where: { estoque: { id_produto: id } } }),
      client.movimentacaoEstoque.count({ where: { estoque: { id_produto: id } } }),
      client.produtoInsumo.count({ where: { id_produto_filho: id } }),
    ]);

    const vinculos: string[] = [];
    if (estoque > 0) vinculos.push(`${estoque} registro(s) de estoque`);
    if (itensNotaSaida > 0) vinculos.push(`${itensNotaSaida} item(ns) de nota de saída`);
    if (itensNotaEntrada > 0) vinculos.push(`${itensNotaEntrada} item(ns) de nota de entrada`);
    if (itensPedido > 0) vinculos.push(`${itensPedido} pedido(s) de escola`);
    if (itensColeta > 0) vinculos.push(`${itensColeta} item(ns) de coleta`);
    if (movimentacoes > 0) vinculos.push(`${movimentacoes} movimentação(ões) de estoque`);
    if (insumosFilho > 0) vinculos.push(`${insumosFilho} produto(s) composto(s) que o utilizam como insumo`);

    return { podeExcluir: vinculos.length === 0, vinculos };
  }

  async hardDelete(id: number, id_usuario: number) {
    await prisma.$transaction(async (tx) => {
      const { podeExcluir, vinculos } = await this.verificarRelacionamentos(id, tx);
      if (!podeExcluir) throw new EntidadeComVinculosError("este produto", vinculos);

      const antes = await tx.produto.findUniqueOrThrow({ where: { id_produto: id } });

      await tx.produtoCodigo.deleteMany({ where: { id_produto: id } });
      await tx.produtoInsumo.deleteMany({ where: { id_produto_pai: id } });
      await tx.produto.delete({ where: { id_produto: id } });

      await registrarAuditoria(
        id_usuario, "EXCLUIR", "Produto", id,
        { descricao: antes.descricao, perecivel: antes.perecivel, composto: antes.composto },
        null,
        tx,
      );
    });
  }

  async setFotoUrl(id: number, foto_url: string | null, id_usuario: number) {
    return prisma.$transaction(async (tx) => {
      const antes = await tx.produto.findUniqueOrThrow({ where: { id_produto: id } });
      const depois = await tx.produto.update({ where: { id_produto: id }, data: { foto_url } });
      await registrarAuditoria(
        id_usuario, "ALTERAR", "Produto", id,
        { foto_url: antes.foto_url },
        { foto_url: depois.foto_url },
        tx,
      );
      return depois;
    });
  }

  /** Remove o produto recém-criado em caso de falha no processamento da imagem (rollback). */
  async rollbackCreate(id: number, id_usuario: number) {
    await prisma.$transaction(async (tx) => {
      const antes = await tx.produto.findUniqueOrThrow({ where: { id_produto: id } });
      await tx.produtoCodigo.deleteMany({ where: { id_produto: id } });
      await tx.produtoInsumo.deleteMany({ where: { id_produto_pai: id } });
      await tx.produto.delete({ where: { id_produto: id } });
      await registrarAuditoria(
        id_usuario, "EXCLUIR", "Produto", id,
        { descricao: antes.descricao, foto_url: antes.foto_url, perecivel: antes.perecivel, composto: antes.composto },
        null,
        tx,
      );
    });
  }
}

export const produtoDAO = new ProdutoDAO();