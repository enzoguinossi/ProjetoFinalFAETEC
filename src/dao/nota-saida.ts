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

export type ResultadoCancelamentoRemessa =
  | { success: true; id_remessa: number; status: "CANCELADA" }
  | { error: string };

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
