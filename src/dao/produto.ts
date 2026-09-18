import { prisma } from "@/lib/prisma";
import { buildPagination, type PaginationParams } from "@/types";

export class ProdutoDAO {
  async list(params: PaginationParams & { search?: string } = {}) {
    const { skip, take } = buildPagination(params);
    const where: any = { ativo: true };
    if (params.search) where.descricao = { contains: params.search };
    const [data, total] = await Promise.all([
      prisma.produto.findMany({
        skip, take, where,
        include: { conversaoPadrao: true },
        orderBy: { descricao: "asc" },
      }),
      prisma.produto.count({ where }),
    ]);
    return { data, total, page: params.page ?? 1, limit: take, totalPages: Math.ceil(total / take) };
  }

  async getById(id: number) {
    return prisma.produto.findUnique({
      where: { id_produto: id },
      include: {
        conversaoPadrao: true,
        produtoCodigos: { include: { tipoCodigo: true } },
        estoques: { where: { ativo: true } },
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
        data: { id_usuario, acao: "CRIAR", entidade: "Produto", id_entidade_afetada: p.id_produto, dados_novos: { descricao: data.descricao } },
      });
      return p;
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
        data: { id_usuario, acao: "ALTERAR", entidade: "Produto", id_entidade_afetada: id, dados_anteriores: { descricao: antes.descricao, perecivel: antes.perecivel }, dados_novos: { descricao: depois.descricao, perecivel: depois.perecivel } },
      });
      return depois;
    });
  }

  async softDelete(id: number, id_usuario: number) {
    return prisma.$transaction(async (tx) => {
      const antes = await tx.produto.findUniqueOrThrow({ where: { id_produto: id } });
      const depois = await tx.produto.update({ where: { id_produto: id }, data: { ativo: false } });
      await tx.registroAuditoria.create({
        data: { id_usuario, acao: "DESATIVAR", entidade: "Produto", id_entidade_afetada: id, dados_anteriores: { ativo: antes.ativo }, dados_novos: { ativo: depois.ativo } },
      });
      return depois;
    });
  }
}

export const produtoDAO = new ProdutoDAO();