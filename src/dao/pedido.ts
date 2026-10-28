import type { Prisma, StatusPedido } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildPagination } from "@/types";
import { registrarAuditoria } from "./_audit";

/** Item da solicitação: só produto e quantidade total (sem unidade/fator). */
export type PedidoItemCriacao = {
  id_produto: number;
  quantidade: number;
  observacao?: string | null;
};

export type PedidoCriacao = {
  id_destinatario: number;
  observacao: string | null;
  itens: PedidoItemCriacao[];
};

/** Filtros da lista e do relatório de pedidos. */
export type PedidoFiltros = {
  page?: number;
  limit?: number;
  /** Busca por escola, produto ou observação. */
  search?: string;
  destinatarios?: number[];
  status?: StatusPedido[];
  /** Período de `data_criacao` (ISO `YYYY-MM-DD`, inclusivo). */
  de?: string;
  ate?: string;
  produtos?: number[];
  /** `true` = com nota vinculada; `false` = sem nota; `null` = qualquer. */
  com_nota?: boolean | null;
};

const AUDIT_ENTIDADE = "PedidoEscola";

/** Limites do dia em São Paulo, convertidos para o instante do servidor. */
function intervaloPeriodo(de?: string, ate?: string) {
  const OFFSET = "-03:00";
  const inicio = de ? new Date(`${de}T00:00:00.000${OFFSET}`) : null;
  const fim = ate ? new Date(`${ate}T23:59:59.999${OFFSET}`) : null;
  return { inicio, fim };
}

function whereDe(filtros: PedidoFiltros): Prisma.PedidoEscolaWhereInput {
  const { inicio, fim } = intervaloPeriodo(filtros.de, filtros.ate);
  const busca = filtros.search?.trim();

  return {
    ...(filtros.destinatarios?.length
      ? { id_destinatario: { in: filtros.destinatarios } }
      : {}),
    ...(filtros.status?.length ? { status: { in: filtros.status } } : {}),
    ...(filtros.produtos?.length
      ? { itens: { some: { id_produto: { in: filtros.produtos } } } }
      : {}),
    ...(filtros.com_nota === true
      ? { id_nota_saida: { not: null } }
      : filtros.com_nota === false
        ? { id_nota_saida: null }
        : {}),
    ...(inicio || fim
      ? {
          data_criacao: {
            ...(inicio ? { gte: inicio } : {}),
            ...(fim ? { lte: fim } : {}),
          },
        }
      : {}),
    ...(busca
      ? {
          OR: [
            {
              destinatario: {
                pessoaJuridica: { razao_social: { contains: busca } },
              },
            },
            { itens: { some: { produto: { descricao: { contains: busca } } } } },
            { observacao: { contains: busca } },
          ],
        }
      : {}),
  };
}

const includePedido = {
  destinatario: {
    select: {
      id_destinatario: true,
      tipo_destinatario: true,
      pessoaJuridica: { select: { razao_social: true } },
    },
  },
  itens: {
    include: {
      produto: { select: { id_produto: true, descricao: true } },
    },
    orderBy: { id_item_pedido_escola: "asc" as const },
  },
  notaSaida: {
    select: { id_nota_saida: true, status: true, tipo: true },
  },
};

/** Snapshot do pedido usado na auditoria. */
function snapshot(pedido: {
  id_pedido_escola: number;
  id_destinatario: number;
  id_nota_saida: number | null;
  status: string;
  observacao: string | null;
  itens?: { id_produto: number; quantidade: number | string }[];
}) {
  return {
    id_pedido_escola: pedido.id_pedido_escola,
    id_destinatario: pedido.id_destinatario,
    id_nota_saida: pedido.id_nota_saida,
    status: pedido.status,
    observacao: pedido.observacao,
    itens: (pedido.itens ?? []).map((item) => ({
      id_produto: item.id_produto,
      quantidade: Number(item.quantidade),
    })),
  };
}

export class PedidoDAO {
  /** Lista paginada com busca e todos os filtros do módulo (server-side). */
  async list(filtros: PedidoFiltros = {}) {
    const { skip, take } = buildPagination(filtros);
    const where = whereDe(filtros);

    const [data, total] = await Promise.all([
      prisma.pedidoEscola.findMany({
        skip,
        take,
        where,
        include: includePedido,
        orderBy: { data_criacao: "desc" },
      }),
      prisma.pedidoEscola.count({ where }),
    ]);

    return {
      data,
      total,
      page: filtros.page ?? 1,
      limit: take,
      totalPages: Math.ceil(total / take),
    };
  }

  /** Todos os pedidos que casam com os filtros, sem paginação (relatório/CSV). */
  async listarTodos(filtros: PedidoFiltros = {}) {
    return prisma.pedidoEscola.findMany({
      where: whereDe(filtros),
      include: includePedido,
      orderBy: [{ data_criacao: "desc" }, { id_pedido_escola: "desc" }],
    });
  }

  async getById(id: number) {
    return prisma.pedidoEscola.findUnique({
      where: { id_pedido_escola: id },
      include: includePedido,
    });
  }

  /** Pedidos aprovados e ainda sem nota — a lista de importação da Saída. */
  async listarAprovadosSemNota() {
    return prisma.pedidoEscola.findMany({
      where: { status: "CONFIRMADO", id_nota_saida: null },
      include: includePedido,
      orderBy: { data_criacao: "asc" },
    });
  }

  /** Cria o pedido e os itens em uma transação, com auditoria. */
  async create(data: PedidoCriacao, id_usuario: number) {
    return prisma.$transaction(async (tx) => {
      const pedido = await tx.pedidoEscola.create({
        data: {
          id_destinatario: data.id_destinatario,
          // `data_criacao` é sempre automática: o cliente não a informa.
          data_criacao: new Date(),
          status: "PENDENTE",
          observacao: data.observacao,
          itens: {
            create: data.itens.map((item) => ({
              id_produto: item.id_produto,
              quantidade: item.quantidade,
              observacao: item.observacao ?? null,
            })),
          },
        },
        include: includePedido,
      });

      await registrarAuditoria(
        id_usuario,
        "CRIAR",
        AUDIT_ENTIDADE,
        pedido.id_pedido_escola,
        null,
        snapshot(pedido),
        tx,
      );

      return pedido;
    });
  }

  /**
   * Edita um pedido `PENDENTE`: destinatário, observação e itens (os itens são
   * substituídos pelo conjunto normalizado e somado). Aprovado/recusado é
   * histórico e não pode ser editado.
   */
  async update(id: number, data: PedidoCriacao, id_usuario: number) {
    return prisma.$transaction(async (tx) => {
      const atual = await tx.pedidoEscola.findUnique({
        where: { id_pedido_escola: id },
        include: includePedido,
      });
      if (!atual) return { error: "Pedido não encontrado." };

      // Transição condicional: se outro usuário aprovar/recusar (ou editar) no
      // meio do caminho, o `count` é 0 e nada é alterado.
      const alteracao = await tx.pedidoEscola.updateMany({
        where: { id_pedido_escola: id, status: "PENDENTE" },
        data: {
          id_destinatario: data.id_destinatario,
          observacao: data.observacao,
        },
      });
      if (alteracao.count !== 1) {
        return { error: "Só pedidos pendentes podem ser editados." };
      }

      await tx.itemPedidoEscola.deleteMany({ where: { id_pedido_escola: id } });
      const depois = await tx.pedidoEscola.update({
        where: { id_pedido_escola: id },
        data: {
          itens: {
            create: data.itens.map((item) => ({
              id_produto: item.id_produto,
              quantidade: item.quantidade,
              observacao: item.observacao ?? null,
            })),
          },
        },
        include: includePedido,
      });

      await registrarAuditoria(
        id_usuario,
        "ALTERAR",
        AUDIT_ENTIDADE,
        id,
        snapshot(atual),
        snapshot(depois),
        tx,
      );

      return { pedido: depois };
    });
  }

  /**
   * Aprova (`PENDENTE → CONFIRMADO`) ou recusa (`PENDENTE → RECUSADO`).
   * A transição só acontece uma vez, mesmo com cliques concorrentes.
   */
  async alterarStatus(id: number, status: StatusPedido, id_usuario: number) {
    return prisma.$transaction(async (tx) => {
      const atual = await tx.pedidoEscola.findUnique({
        where: { id_pedido_escola: id },
        include: includePedido,
      });
      if (!atual) return { error: "Pedido não encontrado." };
      if (atual.status !== "PENDENTE") {
        return { error: "Só pedidos pendentes podem ser aprovados ou recusados." };
      }

      const alteracao = await tx.pedidoEscola.updateMany({
        where: { id_pedido_escola: id, status: "PENDENTE" },
        data: { status },
      });
      if (alteracao.count !== 1) {
        return { error: "O pedido já foi analisado." };
      }

      const depois = await tx.pedidoEscola.findUniqueOrThrow({
        where: { id_pedido_escola: id },
        include: includePedido,
      });

      await registrarAuditoria(
        id_usuario,
        "ALTERAR",
        AUDIT_ENTIDADE,
        id,
        snapshot(atual),
        snapshot(depois),
        tx,
      );

      return { pedido: depois };
    });
  }

  /**
   * Vincula a nota recém-criada ao pedido **dentro da transação da nota**:
   * exige que o pedido esteja aprovado e sem nota e que a nota corresponda ao
   * pedido (destinatário e itens com os mesmos produtos e totais). Uma nota
   * divergente é recusada e a transação inteira desfaz.
   */
  async vincularNota(
    tx: Prisma.TransactionClient,
    id_pedido_escola: number,
    id_nota_saida: number,
    id_usuario: number,
    nota: {
      id_destinatario: number | null;
      itens: { id_produto: number; quantidade: number }[];
    },
  ) {
    const pedido = await tx.pedidoEscola.findUnique({
      where: { id_pedido_escola },
      include: includePedido,
    });
    if (!pedido) throw new Error("Pedido não encontrado.");
    if (pedido.status !== "CONFIRMADO") {
      throw new Error("Só pedidos aprovados podem ser importados na saída.");
    }
    if (pedido.id_nota_saida !== null) {
      throw new Error("Este pedido já possui nota de saída.");
    }
    if (nota.id_destinatario !== pedido.id_destinatario) {
      throw new Error(
        "A nota não corresponde ao pedido: o destinatário é diferente.",
      );
    }

    // Compara os itens somando repetidos dos dois lados (o pedido guarda um
    // item por produto; a nota também, pela unique).
    const somar = (itens: { id_produto: number; quantidade: number }[]) => {
      const mapa = new Map<number, number>();
      for (const item of itens) {
        mapa.set(item.id_produto, (mapa.get(item.id_produto) ?? 0) + item.quantidade);
      }
      return mapa;
    };
    const produtosPedido = somar(
      pedido.itens.map((item) => ({
        id_produto: item.id_produto,
        quantidade: Number(item.quantidade),
      })),
    );
    const produtosNota = somar(nota.itens);
    const EPS = 0.000001;
    const corresponde =
      produtosPedido.size === produtosNota.size &&
      [...produtosPedido.entries()].every(([idProduto, quantidade]) => {
        const naNota = produtosNota.get(idProduto);
        return naNota !== undefined && Math.abs(naNota - quantidade) <= EPS;
      });
    if (!corresponde) {
      throw new Error(
        "A nota não corresponde ao pedido: os itens/quantidades são diferentes.",
      );
    }

    const alteracao = await tx.pedidoEscola.updateMany({
      where: {
        id_pedido_escola,
        status: "CONFIRMADO",
        id_nota_saida: null,
      },
      data: { id_nota_saida },
    });
    if (alteracao.count !== 1) {
      throw new Error("Este pedido já possui nota de saída.");
    }

    await registrarAuditoria(
      id_usuario,
      "ALTERAR",
      AUDIT_ENTIDADE,
      id_pedido_escola,
      snapshot(pedido),
      { ...snapshot(pedido), id_nota_saida },
      tx,
    );

    return { id_pedido_escola, id_nota_saida };
  }
}

export const pedidoDAO = new PedidoDAO();
