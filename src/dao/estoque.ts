import { prisma } from "@/lib/prisma";
import { buildPagination, type PaginationParams, type PaginatedResult } from "@/types";

export class EstoqueDAO {
  async list(params: PaginationParams & { id_produto?: number } = {}) {
    const { skip, take } = buildPagination(params);
    const where: any = { ativo: true };
    if (params.id_produto) where.id_produto = params.id_produto;

    const [data, total] = await Promise.all([
      prisma.estoque.findMany({
        skip, take,
        where,
        include: { produto: { select: { descricao: true } } },
        orderBy: { data_entrada: "desc" },
      }),
      prisma.estoque.count({ where }),
    ]);
    return { data, total, page: params.page ?? 1, limit: take, totalPages: Math.ceil(total / take) };
  }

  async getSaldoDisponivel(id_produto: number) {
    const estoques = await prisma.estoque.findMany({
      where: { id_produto, ativo: true },
    });
    const total = estoques.reduce((acc, e) => acc + Number(e.quantidade_atual), 0);
    const reservado = estoques.reduce((acc, e) => acc + Number(e.saldo_reservado), 0);
    return { quantidade_atual: total, saldo_reservado: reservado, saldo_disponivel: total - reservado };
  }

  async movimentar(
    id_estoque: number,
    id_usuario: number,
    quantidade: number,
    observacao?: string,
  ) {
    const estoque = await prisma.estoque.findUniqueOrThrow({ where: { id_estoque: id_estoque } });
    const saldo_anterior = Number(estoque.quantidade_atual);
    const saldo_posterior = saldo_anterior + quantidade;

    await prisma.$transaction([
      prisma.estoque.update({
        where: { id_estoque: id_estoque },
        data: { quantidade_atual: saldo_posterior },
      }),
      prisma.movimentacaoEstoque.create({
        data: {
          id_estoque,
          id_usuario,
          quantidade,
          saldo_anterior,
          saldo_posterior,
          observacao,
        },
      }),
    ]);
  }
}

export const estoqueDAO = new EstoqueDAO();