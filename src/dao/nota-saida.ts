import type { StatusRemessa } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "./_audit";
import { buildPagination, type PaginationParams } from "@/types";
import { estoqueDAO } from "./estoque";

export type NotaSaidaItemCriacao = {
  id_produto: number;
  quantidade_solicitada: number;
};

export type NotaSaidaRemessaCriacao = {
  id_destinatario: number;
  id_funcionario_condutor: number | null;
  id_veiculo: number | null;
  urgente: boolean;
  observacao: string | null;
  itens: NotaSaidaItemCriacao[];
};

export type NotaSaidaCriacao = {
  observacao: string | null;
  remessas: NotaSaidaRemessaCriacao[];
};

export type RemessaItemAtualizacao = {
  /** `null`/ausente = item novo (acrescentado na edição). */
  id_item_remessa: number | null;
  id_produto: number;
  quantidade_solicitada: number;
};

export type RemessaAtualizacao = {
  id_destinatario: number;
  id_funcionario_condutor: number | null;
  id_veiculo: number | null;
  urgente: boolean;
  observacao: string | null;
  itens: RemessaItemAtualizacao[];
};

export type NotaSaidaAtualizacao = {
  observacao: string | null;
};

const AUDIT_ENTIDADE = "NotaSaida";

const ROTULOS_STATUS_REMESSA: Record<string, string> = {
  EM_PREPARACAO: "em preparação",
  PRONTO_PARA_ENTREGA: "pronta para entrega",
  EM_PERCURSO: "em percurso",
  PENDENTE: "pendente",
  FINALIZADO_TOTAL: "finalizada",
  FINALIZADO_PARCIAL: "finalizada parcialmente",
  CANCELADA: "cancelada",
};

/** Status em que a remessa ainda pode ser editada; os demais são histórico (RN004). */
export const STATUS_REMESSA_EDITAVEL: StatusRemessa[] = [
  "EM_PREPARACAO",
  "PRONTO_PARA_ENTREGA",
];

export type ResultadoCancelamentoRemessa =
  | { success: true; id_remessa: number; status: "CANCELADA" }
  | { error: string };

/** Snapshot da remessa usado na auditoria (antes e depois da edição). */
function snapshotRemessa(
  remessa: {
    id_remessa: number;
    id_destinatario: number;
    id_funcionario_condutor: number | null;
    id_veiculo: number | null;
    urgente: boolean;
    observacao: string | null;
    status: string;
  },
  itens: {
    id_item_remessa?: number | null;
    id_estoque: number;
    id_produto: number;
    quantidade_solicitada: number;
  }[],
) {
  return {
    id_remessa: remessa.id_remessa,
    id_destinatario: remessa.id_destinatario,
    id_funcionario_condutor: remessa.id_funcionario_condutor,
    id_veiculo: remessa.id_veiculo,
    urgente: remessa.urgente,
    observacao: remessa.observacao,
    status: remessa.status,
    itens: itens.map((item) => ({
      id_item_remessa: item.id_item_remessa,
      id_estoque: item.id_estoque,
      id_produto: item.id_produto,
      quantidade_solicitada: item.quantidade_solicitada,
    })),
  };
}

export class NotaSaidaDAO {
  /** Notas de saída (tipo SAIDA), da mais recente para a mais antiga. */
  async list(params: PaginationParams = {}) {
    const { skip, take } = buildPagination(params);
    const where = { ativo: true, tipo: "SAIDA" as const };

    const [data, total] = await Promise.all([
      prisma.notaSaida.findMany({
        skip,
        take,
        where,
        include: {
          remessas: {
            include: {
              destinatario: {
                select: { pessoaJuridica: { select: { razao_social: true } } },
              },
              // Só o id dos itens: a tela mostra a quantidade de produtos
              // (linhas de item) de cada remessa.
              itens: { select: { id_item_remessa: true } },
            },
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
   * Cria a nota de saída com as remessas, os itens de cada remessa e as
   * reservas de estoque em uma única transação. A nota de saída não possui
   * itens (`item_nota_saida`): os itens e o destinatário estão na remessa.
   * Qualquer falha desfaz tudo.
   */
  async create(data: NotaSaidaCriacao, id_usuario: number) {
    return prisma.$transaction(async (tx) => {
      const nota = await tx.notaSaida.create({
        data: {
          data_criacao: new Date(),
          tipo: "SAIDA",
          status: "ABERTA",
          observacao: data.observacao,
        },
      });

      const remessasGravadas: {
        id_remessa: number;
        id_destinatario: number;
        id_funcionario_condutor: number | null;
        id_veiculo: number | null;
        urgente: boolean;
        observacao: string | null;
        itens: {
          id_item_remessa: number;
          id_estoque: number;
          id_produto: number;
          quantidade_solicitada: number;
        }[];
        reservas: {
          id_reserva_estoque: number;
          id_estoque: number;
          quantidade: number;
          saldo_anterior: number;
          saldo_posterior: number;
        }[];
      }[] = [];

      for (const remessa of data.remessas) {
        const remessaCriada = await tx.remessa.create({
          data: {
            id_nota_saida: nota.id_nota_saida,
            id_destinatario: remessa.id_destinatario,
            data_criacao: new Date(),
            status: "EM_PREPARACAO",
            id_funcionario_condutor: remessa.id_funcionario_condutor,
            id_veiculo: remessa.id_veiculo,
            urgente: remessa.urgente,
            observacao: remessa.observacao,
          },
        });

        const itensGravados: {
          id_item_remessa: number;
          id_estoque: number;
          id_produto: number;
          quantidade_solicitada: number;
        }[] = [];
        const reservasGravadas: {
          id_reserva_estoque: number;
          id_estoque: number;
          quantidade: number;
          saldo_anterior: number;
          saldo_posterior: number;
        }[] = [];

        for (const item of remessa.itens) {
          const reserva = await estoqueDAO.reservar(
            {
              id_produto: item.id_produto,
              id_remessa: remessaCriada.id_remessa,
              id_usuario,
              quantidade: item.quantidade_solicitada,
            },
            tx,
          );

          const itemCriado = await tx.itemRemessa.create({
            data: {
              id_remessa: remessaCriada.id_remessa,
              id_estoque: reserva.estoque.id_estoque,
              quantidade_solicitada: item.quantidade_solicitada,
            },
          });

          itensGravados.push({
            id_item_remessa: itemCriado.id_item_remessa,
            id_estoque: reserva.estoque.id_estoque,
            id_produto: item.id_produto,
            quantidade_solicitada: item.quantidade_solicitada,
          });
          reservasGravadas.push({
            id_reserva_estoque: reserva.reserva.id_reserva_estoque,
            id_estoque: reserva.estoque.id_estoque,
            quantidade: item.quantidade_solicitada,
            saldo_anterior: reserva.saldo_anterior,
            saldo_posterior: reserva.saldo_posterior,
          });
        }

        remessasGravadas.push({
          id_remessa: remessaCriada.id_remessa,
          id_destinatario: remessa.id_destinatario,
          id_funcionario_condutor: remessa.id_funcionario_condutor,
          id_veiculo: remessa.id_veiculo,
          urgente: remessa.urgente,
          observacao: remessa.observacao,
          itens: itensGravados,
          reservas: reservasGravadas,
        });
      }

      await registrarAuditoria(
        id_usuario,
        "CRIAR",
        AUDIT_ENTIDADE,
        nota.id_nota_saida,
        null,
        {
          tipo: "SAIDA",
          status: "ABERTA",
          observacao: data.observacao,
          remessas: remessasGravadas,
        },
        tx,
      );

      return { nota, remessas: remessasGravadas };
    });
  }

  /** Remessa com destinatário, condutor, veículo e itens (com o produto). */
  async getRemessa(id: number) {
    return prisma.remessa.findUnique({
      where: { id_remessa: id },
      include: {
        destinatario: {
          select: {
            id_destinatario: true,
            pessoaJuridica: { select: { razao_social: true } },
          },
        },
        condutor: {
          select: { id_funcionario: true, pessoaFisica: { select: { nome: true } } },
        },
        veiculo: { select: { id_veiculo: true, placa: true, modelo: true } },
        itens: {
          include: {
            estoque: {
              include: { produto: { select: { id_produto: true, descricao: true } } },
            },
          },
          orderBy: { id_item_remessa: "asc" },
        },
      },
    });
  }

  /**
   * Edita a remessa em uma única transação: cabeçalho, `quantidade_solicitada`
   * dos itens e acréscimo de item. Para cada item alterado a reserva é corrigida
   * **pelo delta** (`nova − antiga`), positiva ou negativa, com uma
   * `reserva_estoque` e os saldos anterior/posterior; o item novo reserva o valor
   * cheio. Remover item é recusado (não há estado de item excluído — RN004) e
   * remessa finalizada/cancelada é histórico: a edição é recusada. Qualquer
   * falha desfaz tudo.
   */
  async updateRemessa(id: number, data: RemessaAtualizacao, id_usuario: number) {
    return prisma.$transaction(async (tx) => {
      const atual = await tx.remessa.findUnique({
        where: { id_remessa: id },
        include: {
          itens: {
            include: {
              estoque: {
                select: { id_estoque: true, id_produto: true, saldo_reservado: true },
              },
            },
            orderBy: { id_item_remessa: "asc" },
          },
        },
      });
      if (!atual) throw new Error("Remessa não encontrada.");

      if (!STATUS_REMESSA_EDITAVEL.includes(atual.status)) {
        const rotulo = ROTULOS_STATUS_REMESSA[atual.status] ?? atual.status;
        throw new Error(
          `Remessa ${rotulo} não pode ser editada. Só remessas em preparação ou prontas para entrega podem ser editadas; finalizadas e canceladas são histórico.`,
        );
      }

      const itensAtuais = new Map(
        atual.itens.map((item) => [item.id_item_remessa, item]),
      );
      const idsInformados = new Set<number>();

      for (const item of data.itens) {
        if (item.id_item_remessa === null) continue;
        if (!itensAtuais.has(item.id_item_remessa)) {
          throw new Error("Item não pertence a esta remessa.");
        }
        idsInformados.add(item.id_item_remessa);
      }
      for (const idAtual of itensAtuais.keys()) {
        if (!idsInformados.has(idAtual)) {
          throw new Error("Não é possível remover itens de uma remessa.");
        }
      }

      // Garante a transição uma única vez mesmo com edições concorrentes.
      const atualizacao = await tx.remessa.updateMany({
        where: { id_remessa: id, status: { in: STATUS_REMESSA_EDITAVEL } },
        data: {
          id_destinatario: data.id_destinatario,
          id_funcionario_condutor: data.id_funcionario_condutor,
          id_veiculo: data.id_veiculo,
          urgente: data.urgente,
          observacao: data.observacao,
        },
      });
      if (atualizacao.count !== 1) {
        throw new Error("A remessa não pode mais ser editada.");
      }

      const itensGravados: {
        id_item_remessa: number;
        id_estoque: number;
        id_produto: number;
        quantidade_solicitada: number;
      }[] = [];
      const ajustesReserva: {
        id_item_remessa: number | null;
        id_estoque: number;
        delta: number;
        saldo_anterior: number;
        saldo_posterior: number;
      }[] = [];

      for (const item of data.itens) {
        const anterior =
          item.id_item_remessa === null
            ? null
            : itensAtuais.get(item.id_item_remessa)!;

        if (anterior) {
          const delta = item.quantidade_solicitada - Number(anterior.quantidade_solicitada);
          if (delta !== 0) {
            const ajuste = await estoqueDAO.ajustarReserva(
              {
                id_estoque: anterior.id_estoque,
                id_remessa: id,
                id_usuario,
                quantidade: delta,
                observacao: "Correção da quantidade solicitada",
              },
              tx,
            );
            ajustesReserva.push({
              id_item_remessa: anterior.id_item_remessa,
              id_estoque: anterior.id_estoque,
              delta,
              saldo_anterior: ajuste.saldo_anterior,
              saldo_posterior: ajuste.saldo_posterior,
            });
          }

          await tx.itemRemessa.update({
            where: { id_item_remessa: anterior.id_item_remessa },
            data: { quantidade_solicitada: item.quantidade_solicitada },
          });

          itensGravados.push({
            id_item_remessa: anterior.id_item_remessa,
            id_estoque: anterior.id_estoque,
            id_produto: anterior.estoque.id_produto,
            quantidade_solicitada: item.quantidade_solicitada,
          });
        } else {
          const reserva = await estoqueDAO.reservar(
            {
              id_produto: item.id_produto,
              id_remessa: id,
              id_usuario,
              quantidade: item.quantidade_solicitada,
            },
            tx,
          );

          const criado = await tx.itemRemessa.create({
            data: {
              id_remessa: id,
              id_estoque: reserva.estoque.id_estoque,
              quantidade_solicitada: item.quantidade_solicitada,
            },
          });

          itensGravados.push({
            id_item_remessa: criado.id_item_remessa,
            id_estoque: reserva.estoque.id_estoque,
            id_produto: item.id_produto,
            quantidade_solicitada: item.quantidade_solicitada,
          });
          ajustesReserva.push({
            id_item_remessa: criado.id_item_remessa,
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
        "Remessa",
        id,
        snapshotRemessa(
          atual,
          atual.itens.map((item) => ({
            id_item_remessa: item.id_item_remessa,
            id_estoque: item.id_estoque,
            id_produto: item.estoque.id_produto,
            quantidade_solicitada: Number(item.quantidade_solicitada),
          })),
        ),
        {
          ...snapshotRemessa({ ...atual, ...data }, itensGravados),
          ajustes_reserva: ajustesReserva,
        },
        tx,
      );

      return { id_remessa: id };
    });
  }

  /** Nota de saída com as remessas, o destinatário e os itens de cada remessa. */
  async getNotaSaida(id: number) {
    return prisma.notaSaida.findFirst({
      where: { id_nota_saida: id, tipo: "SAIDA", ativo: true },
      include: {
        remessas: {
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
                  include: { produto: { select: { id_produto: true, descricao: true } } },
                },
              },
              orderBy: { id_item_remessa: "asc" },
            },
          },
          orderBy: { id_remessa: "asc" },
        },
      },
    });
  }

  /**
   * Edita apenas a observação da nota de saída. As remessas são editadas
   * individualmente, cada uma com a sua própria reserva. Grava auditoria
   * (`NotaSaida`/`ALTERAR`) com antes/depois.
   */
  async updateNotaSaida(id: number, data: NotaSaidaAtualizacao, id_usuario: number) {
    return prisma.$transaction(async (tx) => {
      const atual = await tx.notaSaida.findFirst({
        where: { id_nota_saida: id, tipo: "SAIDA", ativo: true },
      });
      if (!atual) throw new Error("Nota de saída não encontrada.");

      const nota = await tx.notaSaida.update({
        where: { id_nota_saida: id },
        data: { observacao: data.observacao },
      });

      await registrarAuditoria(
        id_usuario,
        "ALTERAR",
        AUDIT_ENTIDADE,
        id,
        { observacao: atual.observacao, status: atual.status },
        { observacao: nota.observacao, status: nota.status },
        tx,
      );

      return { id_nota_saida: id };
    });
  }

  /**
   * Cancela uma remessa ainda não iniciada (`EM_PREPARACAO` ou
   * `PRONTO_PARA_ENTREGA`) em uma única transação: devolve
   * `saldo_reservado -= quantidade_solicitada` na linha de estoque de cada
   * item, registra a `reserva_estoque` negativa, muda o status para
   * `CANCELADA` e grava a auditoria. Nada é excluído (RN004). O status
   * `CANCELADA` faz a segunda tentativa ser recusada sem debitar de novo.
   */
  async cancelarRemessa(
    id_remessa: number,
    id_usuario: number,
  ): Promise<ResultadoCancelamentoRemessa> {
    return prisma.$transaction(async (tx) => {
      const remessa = await tx.remessa.findUnique({
        where: { id_remessa },
        include: { itens: { orderBy: { id_item_remessa: "asc" } } },
      });

      if (!remessa) return { error: "Remessa não encontrada." };

      if (remessa.status === "CANCELADA") {
        return { error: "Remessa já está cancelada." };
      }

      if (
        remessa.status !== "EM_PREPARACAO" &&
        remessa.status !== "PRONTO_PARA_ENTREGA"
      ) {
        const rotulo = ROTULOS_STATUS_REMESSA[remessa.status] ?? remessa.status;
        return {
          error: `Remessa ${rotulo} não pode ser cancelada. Só remessas em preparação ou prontas para entrega podem ser canceladas.`,
        };
      }

      // Garante a transição uma única vez mesmo com cancelamentos concorrentes:
      // a segunda atualização não encontra mais o status de origem.
      const atualizacao = await tx.remessa.updateMany({
        where: {
          id_remessa,
          status: { in: ["EM_PREPARACAO", "PRONTO_PARA_ENTREGA"] },
        },
        data: { status: "CANCELADA" },
      });
      if (atualizacao.count !== 1) {
        return { error: "Remessa já está cancelada." };
      }

      const reservasLiberadas: {
        id_reserva_estoque: number;
        id_item_remessa: number;
        id_estoque: number;
        quantidade: number;
        saldo_anterior: number;
        saldo_posterior: number;
      }[] = [];

      for (const item of remessa.itens) {
        const liberacao = await estoqueDAO.liberarReserva(
          {
            id_estoque: item.id_estoque,
            id_remessa,
            id_usuario,
            quantidade: Number(item.quantidade_solicitada),
            observacao: "Cancelamento da remessa",
          },
          tx,
        );

        reservasLiberadas.push({
          id_reserva_estoque: liberacao.reserva.id_reserva_estoque,
          id_item_remessa: item.id_item_remessa,
          id_estoque: item.id_estoque,
          quantidade: Number(liberacao.reserva.quantidade),
          saldo_anterior: liberacao.saldo_anterior,
          saldo_posterior: liberacao.saldo_posterior,
        });
      }

      await registrarAuditoria(
        id_usuario,
        "ALTERAR",
        "Remessa",
        id_remessa,
        {
          id_remessa,
          status: remessa.status,
          itens: remessa.itens.map((item) => ({
            id_item_remessa: item.id_item_remessa,
            id_estoque: item.id_estoque,
            quantidade_solicitada: Number(item.quantidade_solicitada),
          })),
        },
        {
          id_remessa,
          status: "CANCELADA",
          reservas_liberadas: reservasLiberadas,
        },
        tx,
      );

      return { success: true, id_remessa, status: "CANCELADA" };
    });
  }
}

export const notaSaidaDAO = new NotaSaidaDAO();
