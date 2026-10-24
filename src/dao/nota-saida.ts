import type { StatusNotaSaida } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "./_audit";
import { buildPagination, type PaginationParams } from "@/types";
import { estoqueDAO } from "./estoque";

export type NotaSaidaItemCriacao = {
  id_produto: number;
  quantidade_solicitada: number;
};

/**
 * Tipo aceito na criação da saída. `DESMONTAGEM` é fluxo próprio e não passa
 * pelo formulário de saída.
 */
export type NotaSaidaTipo = "SAIDA" | "AVARIA" | "CONSUMO_INTERNO";

/** Dados da nota de saída: a nota é a entrega (destinatário, itens e reserva). */
export type NotaSaidaCriacao = {
  tipo: NotaSaidaTipo;
  /** Obrigatório só em `SAIDA`; avaria/consumo interno não têm destinatário. */
  id_destinatario: number | null;
  urgente: boolean;
  observacao: string | null;
  itens: NotaSaidaItemCriacao[];
};

/** Item da edição: com `id_item_nota_saida` = existente; sem = novo. */
export type NotaSaidaItemAtualizacao = {
  id_item_nota_saida: number | null;
  id_produto: number;
  quantidade_solicitada: number;
};

export type NotaSaidaAtualizacao = {
  id_destinatario: number;
  urgente: boolean;
  observacao: string | null;
  itens: NotaSaidaItemAtualizacao[];
};

const AUDIT_ENTIDADE = "NotaSaida";

const ROTULOS_STATUS_NOTA_SAIDA: Record<string, string> = {
  ABERTA: "aberta",
  EM_PERCURSO: "em percurso",
  PENDENTE: "pendente",
  BAIXA_TOTAL: "com baixa total",
  BAIXA_PARCIAL: "com baixa parcial",
  BAIXA_COM_CORTE: "com baixa e corte",
  CANCELADA: "cancelada",
};

/** Status em que a nota ainda pode ser editada; os demais são histórico (RN004). */
export const STATUS_NOTA_SAIDA_EDITAVEL: StatusNotaSaida[] = ["ABERTA"];

export type ResultadoCancelamentoNotaSaida =
  | { success: true; id_nota_saida: number; status: "CANCELADA" }
  | { error: string };

/** Snapshot da nota usado na auditoria (antes e depois da edição). */
function snapshotNotaSaida(
  nota: {
    id_nota_saida: number;
    tipo: string;
    id_destinatario: number | null;
    urgente: boolean;
    observacao: string | null;
    status: string;
  },
  itens: {
    id_item_nota_saida?: number | null;
    id_estoque: number;
    id_produto: number;
    quantidade_solicitada: number;
    quantidade_entregue?: number;
  }[],
) {
  return {
    id_nota_saida: nota.id_nota_saida,
    tipo: nota.tipo,
    id_destinatario: nota.id_destinatario,
    urgente: nota.urgente,
    observacao: nota.observacao,
    status: nota.status,
    itens: itens.map((item) => ({
      id_item_nota_saida: item.id_item_nota_saida,
      id_estoque: item.id_estoque,
      id_produto: item.id_produto,
      quantidade_solicitada: item.quantidade_solicitada,
      quantidade_entregue: item.quantidade_entregue ?? null,
    })),
  };
}

/** Saldo disponível da linha ativa do produto; sem linha, zero. */
async function saldoDisponivelNoCliente(
  client: Prisma.TransactionClient,
  id_produto: number,
) {
  const linha = await client.estoque.findFirst({
    where: { id_produto, ativo: true },
    orderBy: { id_estoque: "asc" },
    include: { produto: { select: { descricao: true } } },
  });
  if (!linha) return { disponivel: 0, descricao: null as string | null };
  return {
    disponivel: Number(linha.quantidade_atual) - Number(linha.saldo_reservado),
    descricao: linha.produto.descricao,
  };
}

export class NotaSaidaDAO {
  /** Todas as notas de saída ativas (Remessa, Avaria e Consumo Interno). */
  async list(params: PaginationParams = {}) {
    const { skip, take } = buildPagination(params);
    const where = { ativo: true };

    const [data, total] = await Promise.all([
      prisma.notaSaida.findMany({
        skip,
        take,
        where,
        include: {
          destinatario: {
            select: {
              id_destinatario: true,
              pessoaJuridica: { select: { razao_social: true } },
            },
          },
          itens: {
            include: {
              estoque: {
                include: {
                  produto: {
                    select: {
                      id_produto: true,
                      descricao: true,
                      conversaoPadrao: { select: { nome: true } },
                    },
                  },
                },
              },
            },
            orderBy: { id_item_nota_saida: "asc" },
          },
        },
        orderBy: { data_criacao: "desc" },
      }),
      prisma.notaSaida.count({ where }),
    ]);

    return {
      data,
      total,
      page: params.page ?? 1,
      limit: take,
      totalPages: Math.ceil(total / take),
    };
  }

  /**
   * Cria a nota de saída em uma única transação, conforme o tipo:
   *
   * - `SAIDA` (Remessa): destinatário, reserva (`saldo_reservado += qtd`) e
   *   status `ABERTA` — a baixa acontece na execução da entrega.
   * - `AVARIA`/`CONSUMO_INTERNO`: sem destinatário e sem reserva; cada item
   *   baixa `quantidade_atual` na hora (`baixarDireto` + movimentação negativa)
   *   e a nota nasce `BAIXA_TOTAL`, com `qtd_entregue = qtd_esperada`.
   *
   * Saldo insuficiente apenas avisa (RN001), nunca bloqueia; o aviso volta para
   * a tela. Qualquer falha desfaz tudo.
   */
  async create(data: NotaSaidaCriacao, id_usuario: number) {
    return prisma.$transaction(async (tx) => {
      const ehRemessa = data.tipo === "SAIDA";
      if (ehRemessa && !data.id_destinatario) {
        throw new Error("Selecione o destinatário da nota de saída.");
      }

      const nota = await tx.notaSaida.create({
        data: {
          id_destinatario: ehRemessa ? data.id_destinatario : null,
          data_criacao: new Date(),
          tipo: data.tipo,
          status: ehRemessa ? "ABERTA" : "BAIXA_TOTAL",
          urgente: ehRemessa ? data.urgente : false,
          observacao: data.observacao,
        },
      });

      const itensGravados: {
        id_item_nota_saida: number;
        id_estoque: number;
        id_produto: number;
        quantidade_solicitada: number;
        quantidade_entregue: number;
      }[] = [];
      const reservasGravadas: {
        id_reserva_estoque: number;
        id_estoque: number;
        quantidade: number;
        saldo_anterior: number;
        saldo_posterior: number;
      }[] = [];
      const movimentacoesGravadas: {
        id_movimentacao: number;
        id_estoque: number;
        quantidade: number;
        saldo_anterior: number;
        saldo_posterior: number;
      }[] = [];
      const avisos: string[] = [];

      for (const item of data.itens) {
        if (ehRemessa) {
          const saldo = await saldoDisponivelNoCliente(tx, item.id_produto);
          if (item.quantidade_solicitada > saldo.disponivel) {
            const rotulo = saldo.descricao ?? `produto ${item.id_produto}`;
            avisos.push(
              `Saldo insuficiente de ${rotulo} (disponível ${saldo.disponivel}, solicitado ${item.quantidade_solicitada})`,
            );
          }

          const reserva = await estoqueDAO.reservar(
            {
              id_produto: item.id_produto,
              id_nota_saida: nota.id_nota_saida,
              id_usuario,
              quantidade: item.quantidade_solicitada,
              observacao: "Reserva da nota de saída",
            },
            tx,
          );

          const itemCriado = await tx.itemNotaSaida.create({
            data: {
              id_nota_saida: nota.id_nota_saida,
              id_estoque: reserva.estoque.id_estoque,
              qtd_esperada: item.quantidade_solicitada,
            },
          });

          itensGravados.push({
            id_item_nota_saida: itemCriado.id_item_nota_saida,
            id_estoque: reserva.estoque.id_estoque,
            id_produto: item.id_produto,
            quantidade_solicitada: item.quantidade_solicitada,
            quantidade_entregue: Number(itemCriado.qtd_entregue),
          });
          reservasGravadas.push({
            id_reserva_estoque: reserva.reserva.id_reserva_estoque,
            id_estoque: reserva.estoque.id_estoque,
            quantidade: item.quantidade_solicitada,
            saldo_anterior: reserva.saldo_anterior,
            saldo_posterior: reserva.saldo_posterior,
          });
        } else {
          const baixa = await estoqueDAO.baixarDireto(
            {
              id_produto: item.id_produto,
              id_nota_saida: nota.id_nota_saida,
              id_usuario,
              quantidade: item.quantidade_solicitada,
              observacao: `Baixa imediata da nota de ${
                data.tipo === "AVARIA" ? "avaria" : "consumo interno"
              }`,
            },
            tx,
          );

          if (item.quantidade_solicitada > baixa.saldo_anterior) {
            avisos.push(
              `Saldo insuficiente de ${baixa.descricao} (disponível ${baixa.saldo_anterior}, solicitado ${item.quantidade_solicitada})`,
            );
          }

          const itemCriado = await tx.itemNotaSaida.create({
            data: {
              id_nota_saida: nota.id_nota_saida,
              id_estoque: baixa.estoque.id_estoque,
              qtd_esperada: item.quantidade_solicitada,
              qtd_entregue: item.quantidade_solicitada,
            },
          });

          itensGravados.push({
            id_item_nota_saida: itemCriado.id_item_nota_saida,
            id_estoque: baixa.estoque.id_estoque,
            id_produto: item.id_produto,
            quantidade_solicitada: item.quantidade_solicitada,
            quantidade_entregue: item.quantidade_solicitada,
          });
          movimentacoesGravadas.push({
            id_movimentacao: baixa.movimentacao.id_movimentacao,
            id_estoque: baixa.estoque.id_estoque,
            quantidade: Number(baixa.movimentacao.quantidade),
            saldo_anterior: baixa.saldo_anterior,
            saldo_posterior: baixa.saldo_posterior,
          });
        }
      }

      await registrarAuditoria(
        id_usuario,
        "CRIAR",
        AUDIT_ENTIDADE,
        nota.id_nota_saida,
        null,
        {
          ...snapshotNotaSaida(nota, itensGravados),
          reservas: reservasGravadas,
          movimentacoes: movimentacoesGravadas,
        },
        tx,
      );

      return {
        nota,
        itens: itensGravados,
        reservas: reservasGravadas,
        movimentacoes: movimentacoesGravadas,
        aviso:
          avisos.length > 0
            ? `${avisos.join("; ")}. A saída foi gravada mesmo assim (RN001).`
            : null,
      };
    });
  }

  /** Nota de saída (qualquer tipo) com destinatário, itens e reservas. */
  async getNotaSaida(id: number) {
    return prisma.notaSaida.findFirst({
      where: { id_nota_saida: id, ativo: true },
      include: {
        destinatario: {
          select: {
            id_destinatario: true,
            pessoaJuridica: { select: { razao_social: true } },
          },
        },
        itens: {
          include: {
            estoque: {
              include: {
                produto: {
                  select: {
                    id_produto: true,
                    descricao: true,
                    conversaoPadrao: { select: { nome: true } },
                  },
                },
              },
            },
          },
          orderBy: { id_item_nota_saida: "asc" },
        },
        reservas: { orderBy: { id_reserva_estoque: "asc" } },
      },
    });
  }

  /**
   * Edita a nota aberta em uma única transação: destinatário, urgência,
   * observação e `qtd_esperada` dos itens. Para cada item alterado a reserva é
   * corrigida **pelo delta** (`nova − antiga`), positiva ou negativa, com uma
   * `reserva_estoque` e os saldos anterior/posterior; o item novo reserva o
   * valor cheio. Remover item é recusado (não há estado de item excluído —
   * RN004) e nota fora de `ABERTA` é histórico: a edição é recusada. Qualquer
   * falha desfaz tudo.
   */
  async updateNotaSaida(id: number, data: NotaSaidaAtualizacao, id_usuario: number) {
    return prisma.$transaction(async (tx) => {
      const atual = await tx.notaSaida.findFirst({
        where: { id_nota_saida: id, tipo: "SAIDA", ativo: true },
        include: {
          itens: {
            include: {
              estoque: {
                select: { id_estoque: true, id_produto: true, saldo_reservado: true },
              },
            },
            orderBy: { id_item_nota_saida: "asc" },
          },
        },
      });
      if (!atual) throw new Error("Nota de saída não encontrada.");

      if (!STATUS_NOTA_SAIDA_EDITAVEL.includes(atual.status)) {
        const rotulo = ROTULOS_STATUS_NOTA_SAIDA[atual.status] ?? atual.status;
        throw new Error(
          `Nota de saída ${rotulo} não pode ser editada. Só notas abertas podem ser editadas; finalizadas e canceladas são histórico.`,
        );
      }

      const itensAtuais = new Map(
        atual.itens.map((item) => [item.id_item_nota_saida, item]),
      );
      const idsInformados = new Set<number>();

      for (const item of data.itens) {
        if (item.id_item_nota_saida === null) continue;
        if (!itensAtuais.has(item.id_item_nota_saida)) {
          throw new Error("Item não pertence a esta nota de saída.");
        }
        idsInformados.add(item.id_item_nota_saida);
      }
      for (const idAtual of itensAtuais.keys()) {
        if (!idsInformados.has(idAtual)) {
          throw new Error("Não é possível remover itens de uma nota de saída.");
        }
      }

      // Garante a transição uma única vez mesmo com edições concorrentes.
      const atualizacao = await tx.notaSaida.updateMany({
        where: { id_nota_saida: id, status: { in: STATUS_NOTA_SAIDA_EDITAVEL } },
        data: {
          id_destinatario: data.id_destinatario,
          urgente: data.urgente,
          observacao: data.observacao,
        },
      });
      if (atualizacao.count !== 1) {
        throw new Error("A nota de saída não pode mais ser editada.");
      }

      const itensGravados: {
        id_item_nota_saida: number;
        id_estoque: number;
        id_produto: number;
        quantidade_solicitada: number;
      }[] = [];
      const ajustesReserva: {
        id_item_nota_saida: number | null;
        id_estoque: number;
        delta: number;
        saldo_anterior: number;
        saldo_posterior: number;
      }[] = [];

      for (const item of data.itens) {
        const anterior =
          item.id_item_nota_saida === null
            ? null
            : itensAtuais.get(item.id_item_nota_saida)!;

        if (anterior) {
          const delta = item.quantidade_solicitada - Number(anterior.qtd_esperada);
          if (delta !== 0) {
            const ajuste = await estoqueDAO.ajustarReserva(
              {
                id_estoque: anterior.id_estoque,
                id_nota_saida: id,
                id_usuario,
                quantidade: delta,
                observacao: "Correção da quantidade da nota de saída",
              },
              tx,
            );
            ajustesReserva.push({
              id_item_nota_saida: anterior.id_item_nota_saida,
              id_estoque: anterior.id_estoque,
              delta,
              saldo_anterior: ajuste.saldo_anterior,
              saldo_posterior: ajuste.saldo_posterior,
            });
          }

          await tx.itemNotaSaida.update({
            where: { id_item_nota_saida: anterior.id_item_nota_saida },
            data: { qtd_esperada: item.quantidade_solicitada },
          });

          itensGravados.push({
            id_item_nota_saida: anterior.id_item_nota_saida,
            id_estoque: anterior.id_estoque,
            id_produto: anterior.estoque.id_produto,
            quantidade_solicitada: item.quantidade_solicitada,
          });
        } else {
          const reserva = await estoqueDAO.reservar(
            {
              id_produto: item.id_produto,
              id_nota_saida: id,
              id_usuario,
              quantidade: item.quantidade_solicitada,
              observacao: "Item acrescentado na nota de saída",
            },
            tx,
          );

          const criado = await tx.itemNotaSaida.create({
            data: {
              id_nota_saida: id,
              id_estoque: reserva.estoque.id_estoque,
              qtd_esperada: item.quantidade_solicitada,
            },
          });

          itensGravados.push({
            id_item_nota_saida: criado.id_item_nota_saida,
            id_estoque: reserva.estoque.id_estoque,
            id_produto: item.id_produto,
            quantidade_solicitada: item.quantidade_solicitada,
          });
          ajustesReserva.push({
            id_item_nota_saida: criado.id_item_nota_saida,
            id_estoque: reserva.estoque.id_estoque,
            delta: item.quantidade_solicitada,
            saldo_anterior: reserva.saldo_anterior,
            saldo_posterior: reserva.saldo_posterior,
          });
        }
      }

      await registrarAuditoria(
        id_usuario,
        "ALTERAR",
        AUDIT_ENTIDADE,
        id,
        snapshotNotaSaida(
          atual,
          atual.itens.map((item) => ({
            id_item_nota_saida: item.id_item_nota_saida,
            id_estoque: item.id_estoque,
            id_produto: item.estoque.id_produto,
            quantidade_solicitada: Number(item.qtd_esperada),
          })),
        ),
        {
          ...snapshotNotaSaida({ ...atual, ...data }, itensGravados),
          ajustes_reserva: ajustesReserva,
        },
        tx,
      );

      return { id_nota_saida: id };
    });
  }

  /**
   * Cancela uma nota ainda `ABERTA` em uma única transação: devolve
   * `saldo_reservado -= qtd_esperada` na linha de estoque de cada item,
   * registra a `reserva_estoque` negativa, muda o status para `CANCELADA` e
   * grava a auditoria. Nada é excluído (RN004). O status `CANCELADA` faz a
   * segunda tentativa ser recusada sem debitar de novo.
   */
  async cancelarNotaSaida(
    id_nota_saida: number,
    id_usuario: number,
  ): Promise<ResultadoCancelamentoNotaSaida> {
    return prisma.$transaction(async (tx) => {
      const nota = await tx.notaSaida.findFirst({
        where: { id_nota_saida, ativo: true },
        include: { itens: { orderBy: { id_item_nota_saida: "asc" } } },
      });

      if (!nota) return { error: "Nota de saída não encontrada." };

      if (nota.tipo !== "SAIDA") {
        return {
          error:
            "Notas de avaria e consumo interno dão baixa na criação e são histórico — não podem ser canceladas (RN004).",
        };
      }

      if (nota.status === "CANCELADA") {
        return { error: "Nota de saída já está cancelada." };
      }

      if (nota.status !== "ABERTA") {
        const rotulo = ROTULOS_STATUS_NOTA_SAIDA[nota.status] ?? nota.status;
        return {
          error: `Nota de saída ${rotulo} não pode ser cancelada. Só notas abertas podem ser canceladas.`,
        };
      }

      // Garante a transição uma única vez mesmo com cancelamentos concorrentes:
      // a segunda atualização não encontra mais o status de origem.
      const atualizacao = await tx.notaSaida.updateMany({
        where: { id_nota_saida, status: "ABERTA" },
        data: { status: "CANCELADA" },
      });
      if (atualizacao.count !== 1) {
        return { error: "Nota de saída já está cancelada." };
      }

      const reservasLiberadas: {
        id_reserva_estoque: number;
        id_item_nota_saida: number;
        id_estoque: number;
        quantidade: number;
        saldo_anterior: number;
        saldo_posterior: number;
      }[] = [];

      for (const item of nota.itens) {
        const liberacao = await estoqueDAO.liberarReserva(
          {
            id_estoque: item.id_estoque,
            id_nota_saida,
            id_usuario,
            quantidade: Number(item.qtd_esperada),
            observacao: "Cancelamento da nota de saída",
          },
          tx,
        );

        reservasLiberadas.push({
          id_reserva_estoque: liberacao.reserva.id_reserva_estoque,
          id_item_nota_saida: item.id_item_nota_saida,
          id_estoque: item.id_estoque,
          quantidade: Number(liberacao.reserva.quantidade),
          saldo_anterior: liberacao.saldo_anterior,
          saldo_posterior: liberacao.saldo_posterior,
        });
      }

      await registrarAuditoria(
        id_usuario,
        "ALTERAR",
        AUDIT_ENTIDADE,
        id_nota_saida,
        {
          id_nota_saida,
          status: nota.status,
          itens: nota.itens.map((item) => ({
            id_item_nota_saida: item.id_item_nota_saida,
            id_estoque: item.id_estoque,
            qtd_esperada: Number(item.qtd_esperada),
          })),
        },
        {
          id_nota_saida,
          status: "CANCELADA",
          reservas_liberadas: reservasLiberadas,
        },
        tx,
      );

      return { success: true, id_nota_saida, status: "CANCELADA" };
    });
  }
}

export const notaSaidaDAO = new NotaSaidaDAO();
