import type { StatusNotaSaida, TipoNotaSaida } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "./_audit";
import { pedidoDAO } from "./pedido";
import { buildPagination, type PaginationParams } from "@/types";
import { limitesDoDiaSaoPaulo } from "@/lib/datas";
import { saldoDAO } from "./estoque";

export type NotaSaidaItemCriacao = {
  id_produto: number;
  /**
   * Quantidade informada na unidade de saída (o fator multiplica) ou, quando
   * `total_base`, o total já em base — usado na importação do pedido, que não
   * reconverte.
   */
  quantidade_solicitada: number;
  total_base?: boolean;
  /** Observação do item (levada do pedido na importação). */
  observacao?: string | null;
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
  /** Pedido aprovado que originou a nota (importação); vinculado na transação. */
  id_pedido_escola?: number | null;
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

/**
 * Status em que a nota de Remessa ainda aceita retirada direta de itens
 * (baixa do pendente). `BAIXA_TOTAL`, `BAIXA_COM_CORTE` e `CANCELADA` são
 * histórico.
 */
export const STATUS_NOTA_SAIDA_RETIRAVEL: StatusNotaSaida[] = [
  "ABERTA",
  "EM_PERCURSO",
  "PENDENTE",
  "BAIXA_PARCIAL",
];

export type ResultadoCancelamentoNotaSaida =
  | { success: true; id_nota_saida: number; status: "CANCELADA" }
  | { error: string };

/** Item da retirada direta: quanto retirar agora do item da nota. */
export type RetiradaItem = {
  id_item_nota_saida: number;
  quantidade: number;
};

export type ResultadoRetiradaNotaSaida =
  | {
      success: true;
      id_nota_saida: number;
      status: "BAIXA_PARCIAL" | "BAIXA_TOTAL";
      itens: { id_item_nota_saida: number; qtd_entregue: number }[];
      movimentacoes: {
        id_movimentacao: number;
        id_produto: number;
        quantidade: number;
        saldo_anterior: number;
        saldo_posterior: number;
      }[];
    }
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
      id_produto: item.id_produto,
      quantidade_solicitada: item.quantidade_solicitada,
      quantidade_entregue: item.quantidade_entregue ?? null,
    })),
  };
}

/** Snapshot da retirada direta: status, itens, saldos e expedições vinculadas. */
function snapshotRetirada(
  nota: { id_nota_saida: number; status: string; urgente: boolean },
  itens: {
    id_item_nota_saida: number;
    id_produto: number;
    qtd_esperada: number;
    qtd_entregue: number;
  }[],
  saldos: { id_produto: number; saldo: number; saldo_reservado: number }[],
  expedicoes: { id_expedicao: number; status: string }[],
  movimentacoes?: {
    id_movimentacao: number;
    id_produto: number;
    quantidade: number;
    saldo_anterior: number;
    saldo_posterior: number;
  }[],
) {
  return {
    id_nota_saida: nota.id_nota_saida,
    status: nota.status,
    urgente: nota.urgente,
    itens,
    saldos,
    expedicoes,
    ...(movimentacoes ? { movimentacoes } : {}),
  };
}

/** Fator da unidade de saída, usado só para calcular o total no lançamento. */async function fatorSaidaDoProduto(
  client: Prisma.TransactionClient,
  id_produto: number,
) {
  const produto = await client.produto.findUnique({
    where: { id_produto },
    select: {
      descricao: true,
      conversaoSaida: { select: { fator: true } },
    },
  });
  if (!produto) {
    throw new Error("Produto inválido em uma nota de saída.");
  }
  const fator = Number(produto.conversaoSaida?.fator ?? 1);
  if (!Number.isFinite(fator) || fator <= 0) {
    throw new Error(
      `Fator da unidade de saída inválido para ${produto.descricao}.`,
    );
  }
  return fator;
}

/** Saldo disponível da linha ativa do produto; sem linha, zero. */
async function saldoDisponivelNoCliente(
  client: Prisma.TransactionClient,
  id_produto: number,
) {
  const produto = await client.produto.findUnique({
    where: { id_produto },
    select: { saldo: true, saldo_reservado: true, descricao: true },
  });
  if (!produto) return { disponivel: 0, descricao: null as string | null };
  return {
    disponivel: Number(produto.saldo) - Number(produto.saldo_reservado),
    descricao: produto.descricao,
  };
}

/** Filtros de domínio da listagem de notas de saída. */
export type NotaSaidaListFiltros = {
  /** Início do período de `data_criacao` (`YYYY-MM-DD`, dia local). */
  de?: string;
  /** Fim do período (`YYYY-MM-DD`, inclusivo). */
  ate?: string;
  tipos?: TipoNotaSaida[];
  status?: StatusNotaSaida[];
  id_destinatario?: number[];
  /** `true` = somente urgentes; ausente/false não filtra. */
  urgente?: boolean;
  /** Razão social do destinatário. */
  search?: string;
};

function whereDe(filtros: NotaSaidaListFiltros): Prisma.NotaSaidaWhereInput {
  const where: Prisma.NotaSaidaWhereInput = { ativo: true };
  const adicionais: Prisma.NotaSaidaWhereInput[] = [];

  if (filtros.tipos?.length) adicionais.push({ tipo: { in: filtros.tipos } });
  if (filtros.status?.length) adicionais.push({ status: { in: filtros.status } });
  if (filtros.id_destinatario?.length) {
    adicionais.push({ id_destinatario: { in: filtros.id_destinatario } });
  }
  if (filtros.urgente === true) adicionais.push({ urgente: true });

  const { inicio, fim } = limitesDoDiaSaoPaulo(filtros.de, filtros.ate);
  if (inicio || fim) {
    adicionais.push({
      data_criacao: {
        ...(inicio ? { gte: inicio } : {}),
        ...(fim ? { lte: fim } : {}),
      },
    });
  }

  const busca = filtros.search?.trim();
  if (busca) {
    // `AND` mantém a busca livre independente dos demais filtros.
    adicionais.push({
      destinatario: {
        pessoaJuridica: { razao_social: { contains: busca } },
      },
    });
  }

  if (adicionais.length > 0) where.AND = adicionais;
  return where;
}

export class NotaSaidaDAO {
  /** Todas as notas de saída ativas (Remessa, Avaria e Consumo Interno). */
  async list(params: PaginationParams & NotaSaidaListFiltros = {}) {
    const { skip, take } = buildPagination(params);
    const where = whereDe(params);

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
              produto: {
                select: {
                  id_produto: true,
                  descricao: true,
                },
              },
            },
            orderBy: { id_item_nota_saida: "asc" },
          },
          expedicoes: {
            orderBy: { data_adicao: "asc" },
            select: {
              id_expedicao: true,
              expedicao: { select: { id_expedicao: true, status: true } },
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
   * Cria a nota de saída em uma única transação, conforme o tipo:
   *
   * - `SAIDA` (Remessa): destinatário, reserva (`saldo_reservado += qtd`) e
   *   status `ABERTA` — a baixa acontece na execução da entrega.
   * - `AVARIA`/`CONSUMO_INTERNO`: sem destinatário e sem reserva; cada item
   *   baixa `produto.saldo` na hora (`baixarDireto` + movimentação negativa)
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
        id_produto: number;
        quantidade_solicitada: number;
        quantidade_entregue: number;
      }[] = [];
      const reservasGravadas: {
        id_reserva_estoque: number;
        id_produto: number;
        quantidade: number;
        saldo_anterior: number;
        saldo_posterior: number;
      }[] = [];
      const movimentacoesGravadas: {
        id_movimentacao: number;
        id_produto: number;
        quantidade: number;
        saldo_anterior: number;
        saldo_posterior: number;
      }[] = [];
      const avisos: string[] = [];

      for (const item of data.itens) {
        if (ehRemessa) {
          let fator = 1;
          let quantidadeBase: number;
          if (item.total_base) {
            quantidadeBase = item.quantidade_solicitada;
          } else {
            fator = await fatorSaidaDoProduto(tx, item.id_produto);
            quantidadeBase = item.quantidade_solicitada * fator;
          }

          const saldo = await saldoDisponivelNoCliente(tx, item.id_produto);
          if (quantidadeBase > saldo.disponivel) {
            const rotulo = saldo.descricao ?? `produto ${item.id_produto}`;
            const solicitado = item.total_base
              ? String(quantidadeBase)
              : `${item.quantidade_solicitada} × ${fator} = ${quantidadeBase}`;
            avisos.push(
              `Saldo insuficiente de ${rotulo} (disponível ${saldo.disponivel}, solicitado ${solicitado})`,
            );
          }

          const reserva = await saldoDAO.reservar(
            {
              id_produto: item.id_produto,
              id_nota_saida: nota.id_nota_saida,
              id_usuario,
              quantidade: quantidadeBase,
              observacao: "Reserva da nota de saída",
            },
            tx,
          );

          const itemCriado = await tx.itemNotaSaida.create({
            data: {
              id_nota_saida: nota.id_nota_saida,
              id_produto: item.id_produto,
              qtd_esperada: quantidadeBase,
              observacao: item.observacao ?? null,
            },
          });

          itensGravados.push({
            id_item_nota_saida: itemCriado.id_item_nota_saida,
            id_produto: item.id_produto,
            quantidade_solicitada: quantidadeBase,
            quantidade_entregue: Number(itemCriado.qtd_entregue),
          });
          reservasGravadas.push({
            id_reserva_estoque: reserva.reserva.id_reserva_estoque,
            id_produto: item.id_produto,
            quantidade: quantidadeBase,
            saldo_anterior: reserva.saldo_anterior,
            saldo_posterior: reserva.saldo_posterior,
          });
        } else {
          const baixa = await saldoDAO.baixarDireto(
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
              id_produto: item.id_produto,
              qtd_esperada: item.quantidade_solicitada,
              qtd_entregue: item.quantidade_solicitada,
            },
          });

          itensGravados.push({
            id_item_nota_saida: itemCriado.id_item_nota_saida,
            id_produto: item.id_produto,
            quantidade_solicitada: item.quantidade_solicitada,
            quantidade_entregue: item.quantidade_solicitada,
          });
          movimentacoesGravadas.push({
            id_movimentacao: baixa.movimentacao.id_movimentacao,
            id_produto: item.id_produto,
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
          id_pedido_escola: data.id_pedido_escola ?? null,
        },
        tx,
      );

      if (data.id_pedido_escola) {
        await pedidoDAO.vincularNota(
          tx,
          data.id_pedido_escola,
          nota.id_nota_saida,
          id_usuario,
          {
            id_destinatario: nota.id_destinatario,
            itens: itensGravados.map((item) => ({
              id_produto: item.id_produto,
              quantidade: item.quantidade_solicitada,
            })),
          },
        );
      }

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
            tipoDestinatario: { select: { nome: true } },
          },
        },
        itens: {
          include: {
            produto: {
              select: {
                id_produto: true,
                descricao: true,
              },
            },
          },
          orderBy: { id_item_nota_saida: "asc" },
        },
        reservas: { orderBy: { id_reserva_estoque: "asc" } },
        expedicoes: {
          orderBy: { data_adicao: "asc" },
          include: {
            expedicao: {
              select: {
                id_expedicao: true,
                data_prevista: true,
                status: true,
              },
            },
            usuarioTentativa: {
              select: {
                funcionario: {
                  select: { pessoaFisica: { select: { nome: true } } },
                },
              },
            },
            anexos: {
              where: { ativo: true },
              orderBy: { id_anexo: "asc" },
              select: { id_anexo: true, nome_arquivo: true, url: true },
            },
          },
        },
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
              produto: {
                select: { id_produto: true, saldo_reservado: true },
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
        id_produto: number;
        quantidade_solicitada: number;
      }[] = [];
      const ajustesReserva: {
        id_item_nota_saida: number | null;
        id_produto: number;
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
          // Item existente já guarda o total; a edição usa esse valor direto.
          const quantidadeBase = item.quantidade_solicitada;
          const delta = quantidadeBase - Number(anterior.qtd_esperada);
          if (delta !== 0) {
            const ajuste = await saldoDAO.ajustarReserva(
              {
                id_produto: anterior.produto.id_produto,
                id_nota_saida: id,
                id_usuario,
                quantidade: delta,
                observacao: "Correção da quantidade da nota de saída",
              },
              tx,
            );
            ajustesReserva.push({
              id_item_nota_saida: anterior.id_item_nota_saida,
              id_produto: anterior.produto.id_produto,
              delta,
              saldo_anterior: ajuste.saldo_anterior,
              saldo_posterior: ajuste.saldo_posterior,
            });
          }

          await tx.itemNotaSaida.update({
            where: { id_item_nota_saida: anterior.id_item_nota_saida },
            data: { qtd_esperada: quantidadeBase },
          });

          itensGravados.push({
            id_item_nota_saida: anterior.id_item_nota_saida,
            id_produto: anterior.produto.id_produto,
            quantidade_solicitada: quantidadeBase,
          });
        } else {
          const fator = await fatorSaidaDoProduto(tx, item.id_produto);
          const quantidadeBase = item.quantidade_solicitada * fator;

          const reserva = await saldoDAO.reservar(
            {
              id_produto: item.id_produto,
              id_nota_saida: id,
              id_usuario,
              quantidade: quantidadeBase,
              observacao: "Item acrescentado na nota de saída",
            },
            tx,
          );

          const criado = await tx.itemNotaSaida.create({
            data: {
              id_nota_saida: id,
              id_produto: item.id_produto,
              qtd_esperada: quantidadeBase,
            },
          });

          itensGravados.push({
            id_item_nota_saida: criado.id_item_nota_saida,
            id_produto: item.id_produto,
            quantidade_solicitada: quantidadeBase,
          });
          ajustesReserva.push({
            id_item_nota_saida: criado.id_item_nota_saida,
            id_produto: item.id_produto,
            delta: quantidadeBase,
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
            id_produto: item.produto.id_produto,
            quantidade_solicitada: Number(item.qtd_esperada),
            quantidade_entregue: Number(item.qtd_entregue),
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
            "Notas de desmontagem, avaria e consumo interno dão baixa na criação e são histórico — não podem ser canceladas (RN004).",
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
        id_produto: number;
        quantidade: number;
        saldo_anterior: number;
        saldo_posterior: number;
      }[] = [];

      for (const item of nota.itens) {
        const liberacao = await saldoDAO.liberarReserva(
          {
            id_produto: item.id_produto,
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
          id_produto: item.id_produto,
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
            id_produto: item.id_produto,
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

  /**
   * Retirada direta de itens de uma nota de Remessa: baixa o total retirado
   * (`saldo` e `saldo_reservado`) e soma em `qtd_entregue`. O retirado conta
   * como entregue; a nota vira `BAIXA_PARCIAL` ou `BAIXA_TOTAL`.
   *
   * A linha da nota é travada (`FOR UPDATE`) antes da leitura para que duas
   * retiradas concorrentes não somem além do pendente. Cobre nota aberta,
   * pendente, em percurso e com baixa parcial; finalizada/cancelada e os
   * demais tipos são histórico. Não grava tentativa (justificativa/fotos): a
   * retirada não é uma entrega da expedição.
   */
  async registrarRetirada(
    id_nota_saida: number,
    itens: RetiradaItem[],
    id_usuario: number,
  ): Promise<ResultadoRetiradaNotaSaida> {
    return prisma.$transaction(
      async (tx) => {
        // Trava a nota antes de ler os itens: serializa retiradas concorrentes.
        const travada = await tx.$queryRaw<{ id_nota_saida: number }[]>`
          SELECT ID_nota_saida FROM nota_saida
          WHERE ID_nota_saida = ${id_nota_saida}
          FOR UPDATE
        `;
        if (travada.length === 0) {
          return { error: "Nota de saída não encontrada." };
        }

        const nota = await tx.notaSaida.findFirst({
          where: { id_nota_saida, ativo: true },
          include: {
            itens: {
              orderBy: { id_item_nota_saida: "asc" },
              include: { produto: { select: { descricao: true } } },
            },
            expedicoes: {
              orderBy: { data_adicao: "asc" },
              select: {
                id_expedicao: true,
                expedicao: { select: { status: true } },
              },
            },
          },
        });
        if (!nota) return { error: "Nota de saída não encontrada." };

        if (nota.tipo !== "SAIDA") {
          return {
            error:
              "Só notas de remessa permitem retirada de itens; avaria e consumo interno já dão baixa na criação (RN004).",
          };
        }

        if (!STATUS_NOTA_SAIDA_RETIRAVEL.includes(nota.status)) {
          const rotulo = ROTULOS_STATUS_NOTA_SAIDA[nota.status] ?? nota.status;
          return {
            error: `Nota de saída ${rotulo} não permite retirada de itens.`,
          };
        }

        const EPS = 0.000001;
        const porId = new Map(
          nota.itens.map((item) => [item.id_item_nota_saida, item]),
        );
        const deltas = new Map<number, number>();

        for (const informado of itens) {
          const item = porId.get(informado.id_item_nota_saida);
          if (!item) {
            return {
              error: "Item informado não pertence a esta nota de saída.",
            };
          }
          if (
            !Number.isFinite(informado.quantidade) ||
            informado.quantidade < 0
          ) {
            return { error: "Quantidade de retirada inválida." };
          }
          if (informado.quantidade === 0) {
            deltas.set(item.id_item_nota_saida, 0);
            continue;
          }

          const pendente =
            Number(item.qtd_esperada) - Number(item.qtd_entregue);
          if (pendente <= EPS) {
            return {
              error: `O item ${item.produto.descricao} já está completo e não pode receber retirada.`,
            };
          }
          if (informado.quantidade > pendente + EPS) {
            return {
              error: `A quantidade retirada de ${item.produto.descricao} não pode ser maior que o pendente (${pendente}).`,
            };
          }
          deltas.set(item.id_item_nota_saida, informado.quantidade);
        }

        const plano = nota.itens.map((item) => {
          const delta = deltas.get(item.id_item_nota_saida) ?? 0;
          const atual = Number(item.qtd_entregue);
          return {
            item,
            delta,
            nova: atual + delta,
          };
        });

        if (!plano.some((item) => item.delta > 0)) {
          return { error: "Informe ao menos uma quantidade para retirar." };
        }

        const completo = plano.every(
          (item) =>
            item.nova >= Number(item.item.qtd_esperada) - EPS,
        );
        const status: "BAIXA_PARCIAL" | "BAIXA_TOTAL" = completo
          ? "BAIXA_TOTAL"
          : "BAIXA_PARCIAL";

        const idsProdutos = [
          ...new Set(nota.itens.map((item) => item.id_produto)),
        ];
        const lerSaldos = async () => {
          const produtos = await tx.produto.findMany({
            where: { id_produto: { in: idsProdutos } },
            select: {
              id_produto: true,
              saldo: true,
              saldo_reservado: true,
            },
            orderBy: { id_produto: "asc" },
          });
          return produtos.map((produto) => ({
            id_produto: produto.id_produto,
            saldo: Number(produto.saldo),
            saldo_reservado: Number(produto.saldo_reservado),
          }));
        };

        const expedicoes = nota.expedicoes.map((vinculo) => ({
          id_expedicao: vinculo.id_expedicao,
          status: vinculo.expedicao.status,
        }));

        const antes = snapshotRetirada(
          nota,
          nota.itens.map((item) => ({
            id_item_nota_saida: item.id_item_nota_saida,
            id_produto: item.id_produto,
            qtd_esperada: Number(item.qtd_esperada),
            qtd_entregue: Number(item.qtd_entregue),
          })),
          await lerSaldos(),
          expedicoes,
        );

        const movimentacoes: {
          id_movimentacao: number;
          id_produto: number;
          quantidade: number;
          saldo_anterior: number;
          saldo_posterior: number;
        }[] = [];

        for (const linha of plano) {
          if (linha.delta <= 0) continue;

          await tx.itemNotaSaida.update({
            where: { id_item_nota_saida: linha.item.id_item_nota_saida },
            data: { qtd_entregue: linha.nova },
          });

          const baixa = await saldoDAO.baixar(
            {
              id_produto: linha.item.id_produto,
              id_nota_saida,
              id_usuario,
              quantidade: linha.delta,
              observacao: "Retirada direta de itens da nota de saída",
            },
            tx,
          );
          movimentacoes.push({
            id_movimentacao: baixa.movimentacao.id_movimentacao,
            id_produto: linha.item.id_produto,
            quantidade: Number(baixa.movimentacao.quantidade),
            saldo_anterior: baixa.saldo_anterior,
            saldo_posterior: baixa.saldo_posterior,
          });
        }

        // Transição condicional: se a nota saiu do status de origem entre a
        // trava e a gravação (não deveria acontecer), nada é aplicado.
        const transicao = await tx.notaSaida.updateMany({
          where: {
            id_nota_saida,
            status: { in: STATUS_NOTA_SAIDA_RETIRAVEL },
          },
          data: { status },
        });
        if (transicao.count !== 1) {
          throw new Error("A nota de saída não permite mais retirada de itens.");
        }

        const depois = snapshotRetirada(
          { ...nota, status },
          plano.map((linha) => ({
            id_item_nota_saida: linha.item.id_item_nota_saida,
            id_produto: linha.item.id_produto,
            qtd_esperada: Number(linha.item.qtd_esperada),
            qtd_entregue: linha.nova,
          })),
          await lerSaldos(),
          expedicoes,
          movimentacoes,
        );

        await registrarAuditoria(
          id_usuario,
          "ALTERAR",
          AUDIT_ENTIDADE,
          id_nota_saida,
          antes,
          depois,
          tx,
        );

        return {
          success: true as const,
          id_nota_saida,
          status,
          itens: plano.map((linha) => ({
            id_item_nota_saida: linha.item.id_item_nota_saida,
            qtd_entregue: linha.nova,
          })),
          movimentacoes,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}

export const notaSaidaDAO = new NotaSaidaDAO();
