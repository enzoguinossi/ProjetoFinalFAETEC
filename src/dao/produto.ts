import { prisma } from "@/lib/prisma";
import { buildPagination, type PaginationParams, type PaginatedResult } from "@/types";

export class ProdutoDAO {
  async list(params: PaginationParams & { search?: string } = {}) {
    const { skip, take } = buildPagination(params);
    const where: any = { ativo: true };
    if (params.search) {
      where.descricao = { contains: params.search };
    }
    const [data, total] = await Promise.all([
      prisma.produto.findMany({
        skip, take,
        where,
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

  async softDelete(id: number) {
    return prisma.produto.update({ where: { id_produto: id }, data: { ativo: false } });
  }
}

export const produtoDAO = new ProdutoDAO();