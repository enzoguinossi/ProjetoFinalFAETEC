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

  /**
   * Reserva `quantidade` da linha de estoque do produto para uma nota de
   * saída: usa a linha ativa (ou reativa a inativa; sem linha, cria com
   * `quantidade_atual = 0`), soma `saldo_reservado` e registra a
   * `reserva_estoque` com os saldos anterior/posterior. A reserva pode deixar
   * o disponível negativo (RN001). Roda no cliente de transação informado.
   */
  async reservar(
    dados: {
      id_produto: number;
      id_nota_saida: number;
      id_usuario: number;
      quantidade: number;
      observacao?: string | null;
    },
    client: Prisma.TransactionClient = prisma,
  ) {
    const ativa = await client.estoque.findFirst({
      where: { id_produto: dados.id_produto, ativo: true },
      orderBy: { id_estoque: "asc" },
    });

    const existente =
      ativa ??
      (await client.estoque.findFirst({
        where: { id_produto: dados.id_produto, ativo: false },
        orderBy: { id_estoque: "asc" },
      }));

    let saldo_anterior: number;
    let estoque;

    if (existente) {
      saldo_anterior = Number(existente.saldo_reservado);
      estoque = await client.estoque.update({
        where: { id_estoque: existente.id_estoque },
        data: { saldo_reservado: { increment: dados.quantidade }, ativo: true },
      });
    } else {
      saldo_anterior = 0;
      estoque = await client.estoque.create({
        data: {
          id_produto: dados.id_produto,
          quantidade_atual: 0,
          saldo_reservado: dados.quantidade,
          data_entrada: new Date(),
        },
      });
    }

    const saldo_posterior = Number(estoque.saldo_reservado);

    const reserva = await client.reservaEstoque.create({
      data: {
        id_estoque: estoque.id_estoque,
        id_nota_saida: dados.id_nota_saida,
        id_usuario: dados.id_usuario,
        quantidade: dados.quantidade,
        saldo_anterior,
        saldo_posterior,
        data_hora: new Date(),
        observacao: dados.observacao ?? null,
      },
    });

    return { estoque, reserva, saldo_anterior, saldo_posterior };
  }

  /**
   * Libera uma reserva já feita na linha de estoque da nota de saída: subtrai
   * `quantidade` de `saldo_reservado` e registra a `reserva_estoque` com
   * quantidade **negativa**, preservando o histórico (RN004). Roda no cliente
   * de transação informado.
   */
  async liberarReserva(
    dados: {
      id_estoque: number;
      id_nota_saida: number;
      id_usuario: number;
      quantidade: number;
      observacao?: string | null;
    },
    client: Prisma.TransactionClient = prisma,
  ) {
    const existente = await client.estoque.findUniqueOrThrow({
      where: { id_estoque: dados.id_estoque },
    });

    const saldo_anterior = Number(existente.saldo_reservado);
    const estoque = await client.estoque.update({
      where: { id_estoque: dados.id_estoque },
      data: { saldo_reservado: { decrement: dados.quantidade } },
    });
    const saldo_posterior = Number(estoque.saldo_reservado);

    const reserva = await client.reservaEstoque.create({
      data: {
        id_estoque: estoque.id_estoque,
        id_nota_saida: dados.id_nota_saida,
        id_usuario: dados.id_usuario,
        quantidade: -dados.quantidade,
        saldo_anterior,
        saldo_posterior,
        data_hora: new Date(),
        observacao: dados.observacao ?? null,
      },
    });

    return { estoque, reserva, saldo_anterior, saldo_posterior };
  }

  /**
   * Corrige a reserva de uma nota de saída pelo **delta** informado: soma
   * `saldo_reservado += delta` (delta pode ser negativo) e registra a
   * `reserva_estoque` com `quantidade = delta` e os saldos anterior/posterior.
   * Delta zero não gera registro. Roda no cliente de transação informado.
   */
  async ajustarReserva(
    dados: {
      id_estoque: number;
      id_nota_saida: number;
      id_usuario: number;
      quantidade: number;
      observacao?: string | null;
    },
    client: Prisma.TransactionClient = prisma,
  ) {
    const existente = await client.estoque.findUniqueOrThrow({
      where: { id_estoque: dados.id_estoque },
    });

    const saldo_anterior = Number(existente.saldo_reservado);
    const estoque = await client.estoque.update({
      where: { id_estoque: dados.id_estoque },
      data: { saldo_reservado: { increment: dados.quantidade } },
    });
    const saldo_posterior = Number(estoque.saldo_reservado);

    const reserva = await client.reservaEstoque.create({
      data: {
        id_estoque: estoque.id_estoque,
        id_nota_saida: dados.id_nota_saida,
        id_usuario: dados.id_usuario,
        quantidade: dados.quantidade,
        saldo_anterior,
        saldo_posterior,
        data_hora: new Date(),
        observacao: dados.observacao ?? null,
      },
    });

    return { estoque, reserva, saldo_anterior, saldo_posterior };
  }

  /**
   * Dá baixa da entrega de uma nota de saída: subtrai `quantidade` de
   * `quantidade_atual` **e** de `saldo_reservado` e registra a
   * `movimentacao_estoque` com quantidade **negativa** e `ID_nota_saida`
   * (a saída é o sinal — não existe campo `tipo`). Não valida
   * `quantidade_atual`: a divergência de inventário não pode bloquear uma
   * entrega que aconteceu (RN001). Aborta se `saldo_reservado` ficar
   * negativo. Roda no cliente de transação informado.
   */
  async baixar(
    dados: {
      id_estoque: number;
      id_nota_saida: number;
      id_usuario: number;
      quantidade: number;
      observacao?: string | null;
    },
    client: Prisma.TransactionClient = prisma,
  ) {
    const existente = await client.estoque.findUniqueOrThrow({
      where: { id_estoque: dados.id_estoque },
    });

    const saldo_reservado_anterior = Number(existente.saldo_reservado);
    if (saldo_reservado_anterior < dados.quantidade) {
      throw new Error(
        "Saldo reservado insuficiente para registrar a baixa da entrega.",
      );
    }

    const saldo_anterior = Number(existente.quantidade_atual);
    const estoque = await client.estoque.update({
      where: { id_estoque: dados.id_estoque },
      data: {
        quantidade_atual: { decrement: dados.quantidade },
        saldo_reservado: { decrement: dados.quantidade },
      },
    });

    const movimentacao = await client.movimentacaoEstoque.create({
      data: {
        id_estoque: estoque.id_estoque,
        id_usuario: dados.id_usuario,
        id_nota_saida: dados.id_nota_saida,
        quantidade: -dados.quantidade,
        saldo_anterior,
        saldo_posterior: Number(estoque.quantidade_atual),
        data_hora: new Date(),
        observacao: dados.observacao ?? null,
      },
    });

    return {
      estoque,
      movimentacao,
      saldo_anterior,
      saldo_posterior: Number(estoque.quantidade_atual),
      saldo_reservado_anterior,
      saldo_reservado_posterior: Number(estoque.saldo_reservado),
    };
  }

  /**
   * Baixa direta de uma saída sem reserva (avaria/consumo interno): localiza a
   * linha **ativa** do produto (erro claro se não houver), subtrai `quantidade`
   * de `quantidade_atual` e registra a `movimentacao_estoque` com quantidade
   * **negativa** e `ID_nota_saida`. Não mexe em `saldo_reservado` e **não**
   * valida saldo: RN001 manda avisar e gravar mesmo assim. Roda no cliente de
   * transação informado.
   */
  async baixarDireto(
    dados: {
      id_produto: number;
      id_nota_saida: number;
      id_usuario: number;
      quantidade: number;
      observacao?: string | null;
    },
    client: Prisma.TransactionClient = prisma,
  ) {
    const existente = await client.estoque.findFirst({
      where: { id_produto: dados.id_produto, ativo: true },
      orderBy: { id_estoque: "asc" },
      include: { produto: { select: { descricao: true } } },
    });
    if (!existente) {
      throw new Error(
        `O produto ${dados.id_produto} não possui estoque ativo para dar baixa.`,
      );
    }

    const saldo_anterior = Number(existente.quantidade_atual);
    const estoque = await client.estoque.update({
      where: { id_estoque: existente.id_estoque },
      data: { quantidade_atual: { decrement: dados.quantidade } },
    });
    const saldo_posterior = Number(estoque.quantidade_atual);

    const movimentacao = await client.movimentacaoEstoque.create({
      data: {
        id_estoque: estoque.id_estoque,
        id_usuario: dados.id_usuario,
        id_nota_saida: dados.id_nota_saida,
        quantidade: -dados.quantidade,
        saldo_anterior,
        saldo_posterior,
        data_hora: new Date(),
        observacao: dados.observacao ?? null,
      },
    });

    return {
      estoque,
      movimentacao,
      descricao: existente.produto.descricao,
      saldo_anterior,
      saldo_posterior,
    };
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