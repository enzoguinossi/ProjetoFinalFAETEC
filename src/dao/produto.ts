import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { EntidadeComVinculosError } from "./_errors";
import { buildPagination, type PaginationParams } from "@/types";

type Db = Prisma.TransactionClient;

export class ProdutoDAO {
  async list(params: PaginationParams & { search?: string } = {}) {
    const { skip, take } = buildPagination(params);
    const where: any = { ativo: true };
    if (params.search) where.descricao = { contains: params.search };
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

  async searchPriorizado(
    query: string,
    take = 20,
  ): Promise<{ id_produto: number; descricao: string }[]> {
    const [exactCode, prefixCode, containCode, containDesc] = await Promise.all([
      prisma.produto.findMany({
        where: { ativo: true, produtoCodigos: { some: { codigo: { equals: query } } } },
        select: { id_produto: true, descricao: true },
        take,
        orderBy: { descricao: "asc" },
      }),
      prisma.produto.findMany({
        where: {
          ativo: true,
          produtoCodigos: { some: { codigo: { startsWith: query } } },
          NOT: { produtoCodigos: { some: { codigo: { equals: query } } } },
        },
        select: { id_produto: true, descricao: true },
        take,
        orderBy: { descricao: "asc" },
      }),
      prisma.produto.findMany({
        where: {
          ativo: true,
          produtoCodigos: { some: { codigo: { contains: query } } },
          NOT: {
            OR: [
              { produtoCodigos: { some: { codigo: { equals: query } } } },
              { produtoCodigos: { some: { codigo: { startsWith: query } } } },
            ],
          },
        },
        select: { id_produto: true, descricao: true },
        take,
        orderBy: { descricao: "asc" },
      }),
      prisma.produto.findMany({
        where: {
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
        select: { id_produto: true, descricao: true },
        take,
        orderBy: { descricao: "asc" },
      }),
    ]);

    const seen = new Set<number>();
    const results: { id_produto: number; descricao: string }[] = [];
    for (const batch of [exactCode, prefixCode, containCode, containDesc]) {
      for (const p of batch) {
        if (!seen.has(p.id_produto)) {
          seen.add(p.id_produto);
          results.push(p);
          if (results.length >= take) break;
        }
      }
      if (results.length >= take) break;
    }
    return results.slice(0, take);
  }

  async searchPriorizadoComEstoque(
    query: string,
    take = 50,
  ): Promise<
    {
      id_produto: number;
      descricao: string;
      estoques: { quantidade_atual: number; saldo_reservado: number }[];
    }[]
  > {
    const select = {
      id_produto: true,
      descricao: true,
      estoques: {
        where: { ativo: true },
        select: { quantidade_atual: true, saldo_reservado: true },
      },
    } as const;

    const [exactCode, prefixCode, containCode, containDesc] = await Promise.all([
      prisma.produto.findMany({
        where: { ativo: true, produtoCodigos: { some: { codigo: { equals: query } } } },
        select,
        take,
        orderBy: { descricao: "asc" },
      }),
      prisma.produto.findMany({
        where: {
          ativo: true,
          produtoCodigos: { some: { codigo: { startsWith: query } } },
          NOT: { produtoCodigos: { some: { codigo: { equals: query } } } },
        },
        select,
        take,
        orderBy: { descricao: "asc" },
      }),
      prisma.produto.findMany({
        where: {
          ativo: true,
          produtoCodigos: { some: { codigo: { contains: query } } },
          NOT: {
            OR: [
              { produtoCodigos: { some: { codigo: { equals: query } } } },
              { produtoCodigos: { some: { codigo: { startsWith: query } } } },
            ],
          },
        },
        select,
        take,
        orderBy: { descricao: "asc" },
      }),
      prisma.produto.findMany({
        where: {
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
        select,
        take,
        orderBy: { descricao: "asc" },
      }),
    ]);

    const seen = new Set<number>();
    const results: (typeof exactCode)[number][] = [];
    for (const batch of [exactCode, prefixCode, containCode, containDesc]) {
      for (const p of batch) {
        if (!seen.has(p.id_produto)) {
          seen.add(p.id_produto);
          results.push(p);
          if (results.length >= take) break;
        }
      }
      if (results.length >= take) break;
    }
    return results.slice(0, take);
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

  async create(
    data: {
      descricao: string; foto_url?: string; perecivel?: boolean; composto?: boolean;
      data_validade?: string; id_conversao_padrao?: number;
    },
    id_usuario: number,
  ) {
    return prisma.$transaction(async (tx) => {
      const p = await tx.produto.create({
        data: { ...data, data_validade: data.data_validade ? new Date(data.data_validade) : undefined },
      });
      await tx.registroAuditoria.create({
        data: { id_usuario, acao: "CRIAR", data_hora: new Date(), entidade: "Produto", id_entidade_afetada: p.id_produto, dados_novos: { descricao: data.descricao } },
      });
      return p;
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

      await tx.registroAuditoria.create({
        data: { id_usuario, acao: "CRIAR", data_hora: new Date(), entidade: "Produto", id_entidade_afetada: p.id_produto, dados_novos: { descricao: data.descricao } },
      });

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

  async update(
    id: number,
    data: { descricao?: string; foto_url?: string; perecivel?: boolean; data_validade?: string },
    id_usuario: number,
  ) {
    return prisma.$transaction(async (tx) => {
      const antes = await tx.produto.findUniqueOrThrow({ where: { id_produto: id } });
      const depois = await tx.produto.update({
        where: { id_produto: id },
        data: { ...data, data_validade: data.data_validade ? new Date(data.data_validade) : undefined },
      });
      await tx.registroAuditoria.create({
        data: { id_usuario, acao: "ALTERAR", data_hora: new Date(), entidade: "Produto", id_entidade_afetada: id, dados_anteriores: { descricao: antes.descricao, perecivel: antes.perecivel }, dados_novos: { descricao: depois.descricao, perecivel: depois.perecivel } },
      });
      return depois;
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
      const antes = await tx.produto.findUniqueOrThrow({ where: { id_produto: id } });

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

      await tx.registroAuditoria.create({
        data: {
          id_usuario, acao: "ALTERAR", data_hora: new Date(), entidade: "Produto",
          id_entidade_afetada: id,
          dados_anteriores: { descricao: antes.descricao, perecivel: antes.perecivel, composto: antes.composto, ativo: antes.ativo },
          dados_novos: { descricao: depois.descricao, perecivel: depois.perecivel, composto: depois.composto, ativo: depois.ativo },
        },
      });

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
    const [estoque, itensNotaSaida, itensNotaEntrada, itensRemessa, itensPedido, itensColeta, movimentacoes, insumosFilho] = await Promise.all([
      client.estoque.count({ where: { id_produto: id } }),
      client.itemNotaSaida.count({ where: { estoque: { id_produto: id } } }),
      client.itemNotaEntrada.count({ where: { id_produto: id } }),
      client.itemRemessa.count({ where: { estoque: { id_produto: id } } }),
      client.itemPedidoEscola.count({ where: { id_produto: id } }),
      client.itemColeta.count({ where: { estoque: { id_produto: id } } }),
      client.movimentacaoEstoque.count({ where: { estoque: { id_produto: id } } }),
      client.produtoInsumo.count({ where: { id_produto_filho: id } }),
    ]);

    const vinculos: string[] = [];
    if (estoque > 0) vinculos.push(`${estoque} registro(s) de estoque`);
    if (itensNotaSaida > 0) vinculos.push(`${itensNotaSaida} item(ns) de nota de saída`);
    if (itensNotaEntrada > 0) vinculos.push(`${itensNotaEntrada} item(ns) de nota de entrada`);
    if (itensRemessa > 0) vinculos.push(`${itensRemessa} item(ns) de remessa`);
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

      await tx.registroAuditoria.create({
        data: {
          id_usuario, acao: "EXCLUIR", data_hora: new Date(), entidade: "Produto",
          id_entidade_afetada: id,
          dados_anteriores: { descricao: antes.descricao, perecivel: antes.perecivel, composto: antes.composto },
        },
      });
    });
  }

  async softDelete(id: number, id_usuario: number) {
    return prisma.$transaction(async (tx) => {
      const antes = await tx.produto.findUniqueOrThrow({ where: { id_produto: id } });
      const depois = await tx.produto.update({ where: { id_produto: id }, data: { ativo: false } });
      await tx.registroAuditoria.create({
        data: { id_usuario, acao: "DESATIVAR", data_hora: new Date(), entidade: "Produto", id_entidade_afetada: id, dados_anteriores: { ativo: antes.ativo }, dados_novos: { ativo: depois.ativo } },
      });
      return depois;
    });
  }
}

export const produtoDAO = new ProdutoDAO();