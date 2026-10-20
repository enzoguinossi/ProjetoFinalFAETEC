import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { buildPagination, type PaginationParams } from "@/types";

export class EstoqueDAO {
  async list(params: PaginationParams & { id_produto?: number } = {}) {
    const { skip, take } = buildPagination(params);
    const where: Prisma.EstoqueWhereInput = { ativo: true };
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

  /**
   * Dá entrada de uma nota no estoque do produto: usa a linha existente
   * (uma por produto) ou cria a primeira; soma `quantidade_atual` e registra
   * a movimentação com os saldos. Roda no cliente de transação informado.
   */
  async registrarEntrada(
    dados: {
      id_produto: number;
      id_usuario: number;
      id_nota_entrada: number;
      quantidade: number;
      data_entrada: Date;
      observacao?: string | null;
    },
    client: Prisma.TransactionClient = prisma,
  ) {
    const ativa = await client.estoque.findFirst({
      where: { id_produto: dados.id_produto, ativo: true },
      orderBy: { id_estoque: "asc" },
    });

    // Sem linha ativa, uma linha inativa do mesmo produto é reativada — a
    // entrada significa que o produto voltou a ter estoque (uma linha/produto).
    const existente =
      ativa ??
      (await client.estoque.findFirst({
        where: { id_produto: dados.id_produto, ativo: false },
        orderBy: { id_estoque: "asc" },
      }));

    let saldo_anterior: number;

    if (existente) {
      saldo_anterior = Number(existente.quantidade_atual);
    } else {
      saldo_anterior = 0;
    }

    const estoque = existente
      ? await client.estoque.update({
          where: { id_estoque: existente.id_estoque },
          data: { quantidade_atual: { increment: dados.quantidade }, ativo: true },
        })
      : await client.estoque.create({
          data: {
            id_produto: dados.id_produto,
            quantidade_atual: dados.quantidade,
            saldo_reservado: 0,
            data_entrada: dados.data_entrada,
          },
        });

    const saldo_posterior = Number(estoque.quantidade_atual);

    const movimentacao = await client.movimentacaoEstoque.create({
      data: {
        id_estoque: estoque.id_estoque,
        id_usuario: dados.id_usuario,
        id_nota_entrada: dados.id_nota_entrada,
        quantidade: dados.quantidade,
        saldo_anterior,
        saldo_posterior,
        data_hora: new Date(),
        observacao: dados.observacao ?? null,
      },
    });

    return { estoque, movimentacao, saldo_anterior, saldo_posterior };
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
          data_hora: new Date(),
          observacao,
        },
      }),
    ]);
  }
}

export const estoqueDAO = new EstoqueDAO();