import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

/**
 * Operações de saldo do produto.
 *
 * A tabela `estoque` foi achatada em `produto`: `saldo` é a quantidade total e
 * `saldo_reservado` a parcela comprometida. Não existe mais linha de estoque;
 * todas as operações atualizam o produto e registram o histórico com
 * `id_produto` (saldo anterior/posterior).
 */
export class SaldoDAO {
  async getSaldoDisponivel(id_produto: number) {
    const produto = await prisma.produto.findUniqueOrThrow({
      where: { id_produto },
      select: { saldo: true, saldo_reservado: true },
    });
    const saldo = Number(produto.saldo);
    const reservado = Number(produto.saldo_reservado);
    return {
      saldo,
      saldo_reservado: reservado,
      saldo_disponivel: saldo - reservado,
    };
  }

  /** Entrada: soma no saldo do produto e registra a movimentação. */
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
    const existente = await client.produto.findUniqueOrThrow({
      where: { id_produto: dados.id_produto },
      select: { saldo: true },
    });
    const saldo_anterior = Number(existente.saldo);
    const produto = await client.produto.update({
      where: { id_produto: dados.id_produto },
      data: { saldo: { increment: dados.quantidade } },
    });
    const saldo_posterior = Number(produto.saldo);

    const movimentacao = await client.movimentacaoEstoque.create({
      data: {
        id_produto: dados.id_produto,
        id_usuario: dados.id_usuario,
        id_nota_entrada: dados.id_nota_entrada,
        quantidade: dados.quantidade,
        saldo_anterior,
        saldo_posterior,
        data_hora: new Date(),
        observacao: dados.observacao ?? null,
      },
    });

    return { produto, movimentacao, saldo_anterior, saldo_posterior };
  }

  /** Reserva: soma no reservado do produto e registra a reserva. */
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
    const existente = await client.produto.findUniqueOrThrow({
      where: { id_produto: dados.id_produto },
      select: { saldo_reservado: true },
    });
    const saldo_anterior = Number(existente.saldo_reservado);
    const produto = await client.produto.update({
      where: { id_produto: dados.id_produto },
      data: { saldo_reservado: { increment: dados.quantidade } },
    });
    const saldo_posterior = Number(produto.saldo_reservado);

    const reserva = await client.reservaEstoque.create({
      data: {
        id_produto: dados.id_produto,
        id_nota_saida: dados.id_nota_saida,
        id_usuario: dados.id_usuario,
        quantidade: dados.quantidade,
        saldo_anterior,
        saldo_posterior,
        data_hora: new Date(),
        observacao: dados.observacao ?? null,
      },
    });

    return { produto, reserva, saldo_anterior, saldo_posterior };
  }

  /** Libera reserva: subtrai do reservado e registra quantidade negativa. */
  async liberarReserva(
    dados: {
      id_produto: number;
      id_nota_saida: number;
      id_usuario: number;
      quantidade: number;
      observacao?: string | null;
    },
    client: Prisma.TransactionClient = prisma,
  ) {
    const existente = await client.produto.findUniqueOrThrow({
      where: { id_produto: dados.id_produto },
      select: { saldo_reservado: true },
    });
    const saldo_anterior = Number(existente.saldo_reservado);
    const produto = await client.produto.update({
      where: { id_produto: dados.id_produto },
      data: { saldo_reservado: { decrement: dados.quantidade } },
    });
    const saldo_posterior = Number(produto.saldo_reservado);

    const reserva = await client.reservaEstoque.create({
      data: {
        id_produto: dados.id_produto,
        id_nota_saida: dados.id_nota_saida,
        id_usuario: dados.id_usuario,
        quantidade: -dados.quantidade,
        saldo_anterior,
        saldo_posterior,
        data_hora: new Date(),
        observacao: dados.observacao ?? null,
      },
    });

    return { produto, reserva, saldo_anterior, saldo_posterior };
  }

  /** Corrige a reserva pelo delta (positivo ou negativo). */
  async ajustarReserva(
    dados: {
      id_produto: number;
      id_nota_saida: number;
      id_usuario: number;
      quantidade: number;
      observacao?: string | null;
    },
    client: Prisma.TransactionClient = prisma,
  ) {
    const existente = await client.produto.findUniqueOrThrow({
      where: { id_produto: dados.id_produto },
      select: { saldo_reservado: true },
    });
    const saldo_anterior = Number(existente.saldo_reservado);
    const produto = await client.produto.update({
      where: { id_produto: dados.id_produto },
      data: { saldo_reservado: { increment: dados.quantidade } },
    });
    const saldo_posterior = Number(produto.saldo_reservado);

    const reserva = await client.reservaEstoque.create({
      data: {
        id_produto: dados.id_produto,
        id_nota_saida: dados.id_nota_saida,
        id_usuario: dados.id_usuario,
        quantidade: dados.quantidade,
        saldo_anterior,
        saldo_posterior,
        data_hora: new Date(),
        observacao: dados.observacao ?? null,
      },
    });

    return { produto, reserva, saldo_anterior, saldo_posterior };
  }

  /**
   * Baixa da entrega: subtrai do saldo e do reservado, registrando a
   * movimentação negativa. RN001 não bloqueia saldo total; a reserva é a
   * garantia (aborta se ficar negativa).
   */
  async baixar(
    dados: {
      id_produto: number;
      id_nota_saida: number;
      id_usuario: number;
      quantidade: number;
      observacao?: string | null;
    },
    client: Prisma.TransactionClient = prisma,
  ) {
    const existente = await client.produto.findUniqueOrThrow({
      where: { id_produto: dados.id_produto },
      select: { saldo: true, saldo_reservado: true },
    });

    const saldo_reservado_anterior = Number(existente.saldo_reservado);
    if (saldo_reservado_anterior < dados.quantidade) {
      throw new Error(
        "Saldo reservado insuficiente para registrar a baixa da entrega.",
      );
    }

    const saldo_anterior = Number(existente.saldo);
    const produto = await client.produto.update({
      where: { id_produto: dados.id_produto },
      data: {
        saldo: { decrement: dados.quantidade },
        saldo_reservado: { decrement: dados.quantidade },
      },
    });

    const movimentacao = await client.movimentacaoEstoque.create({
      data: {
        id_produto: dados.id_produto,
        id_usuario: dados.id_usuario,
        id_nota_saida: dados.id_nota_saida,
        quantidade: -dados.quantidade,
        saldo_anterior,
        saldo_posterior: Number(produto.saldo),
        data_hora: new Date(),
        observacao: dados.observacao ?? null,
      },
    });

    return {
      produto,
      movimentacao,
      saldo_anterior,
      saldo_posterior: Number(produto.saldo),
      saldo_reservado_anterior,
      saldo_reservado_posterior: Number(produto.saldo_reservado),
    };
  }

  /**
   * Baixa direta (Avaria/Consumo Interno): subtrai do saldo sem mexer na
   * reserva e sem validar o total (RN001).
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
    const existente = await client.produto.findFirst({
      where: { id_produto: dados.id_produto, ativo: true },
      select: { saldo: true, descricao: true },
    });
    if (!existente) {
      throw new Error(
        `O produto ${dados.id_produto} não está ativo para dar baixa.`,
      );
    }

    const saldo_anterior = Number(existente.saldo);
    const produto = await client.produto.update({
      where: { id_produto: dados.id_produto },
      data: { saldo: { decrement: dados.quantidade } },
    });
    const saldo_posterior = Number(produto.saldo);

    const movimentacao = await client.movimentacaoEstoque.create({
      data: {
        id_produto: dados.id_produto,
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
      produto,
      movimentacao,
      descricao: existente.descricao,
      saldo_anterior,
      saldo_posterior,
    };
  }

  async movimentar(
    id_produto: number,
    id_usuario: number,
    quantidade: number,
    observacao?: string,
  ) {
    return prisma.$transaction(async (tx) => {
      const existente = await tx.produto.findUniqueOrThrow({
        where: { id_produto },
        select: { saldo: true },
      });
      const saldo_anterior = Number(existente.saldo);
      const produto = await tx.produto.update({
        where: { id_produto },
        data: { saldo: { increment: quantidade } },
      });
      const saldo_posterior = Number(produto.saldo);
      const movimentacao = await tx.movimentacaoEstoque.create({
        data: {
          id_produto,
          id_usuario,
          quantidade,
          saldo_anterior,
          saldo_posterior,
          data_hora: new Date(),
          observacao,
        },
      });
      return { produto, movimentacao, saldo_anterior, saldo_posterior };
    });
  }
}

export const saldoDAO = new SaldoDAO();
