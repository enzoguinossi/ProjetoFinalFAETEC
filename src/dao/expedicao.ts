import {
  Prisma,
  type StatusExpedicao,
  type StatusNotaSaida,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "./_audit";
import { estoqueDAO } from "./estoque";
import { buildPagination, type ListParams } from "@/types";

type Db = Prisma.TransactionClient;

export type EntregaItem = {
  id_item_nota_saida: number;
  qtd_entregue: number;
};

export type ResultadoEntrega = {
  id_nota_saida: number;
  id_expedicao: number;
  status: StatusNotaSaida;
  itens: { id_item_nota_saida: number; qtd_entregue: number }[];
};

const AUDIT_ENTIDADE = "Expedicao";

/** Status em que a nota ainda pode entrar numa expedição. */
const STATUS_NOTA_ELEGIVEL: StatusNotaSaida[] = [
  "ABERTA",
  "PENDENTE",
  "BAIXA_PARCIAL",
];

/** Status de expedição que "ocupa" a nota: uma nota não entra em duas. */
const STATUS_EXPEDICAO_ATIVA: StatusExpedicao[] = [
  "PLANEJADA",
  "EM_PERCURSO",
];

export type ExpedicaoDados = {
  data_prevista: Date;
  observacao: string | null;
  id_veiculo: number;
  id_funcionario_condutor: number;
  /** Consumido na criação; não é gravado na expedição. */
  id_percurso: number | null;
};

export type ExpedicaoAtualizacao = Omit<ExpedicaoDados, "id_percurso">;

const includeNotas = {
  notas: {
    orderBy: { ordem_visita: "asc" as const },
    include: {
      notaSaida: {
        include: {
          destinatario: { include: { pessoaJuridica: true } },
          itens: {
            orderBy: { id_item_nota_saida: "asc" as const },
            include: {
              estoque: {
                select: { produto: { select: { descricao: true } } },
              },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.ExpedicaoInclude;

const includeDetalhe = {
  veiculo: true,
  condutor: { include: { pessoaFisica: true } },
  ...includeNotas,
} satisfies Prisma.ExpedicaoInclude;

const includeResumo = {
  veiculo: true,
  notas: {
    orderBy: { ordem_visita: "asc" as const },
    include: {
      notaSaida: {
        include: {
          destinatario: { include: { pessoaJuridica: true } },
        },
      },
    },
  },
} satisfies Prisma.ExpedicaoInclude;

type ExpedicaoComNotas = Prisma.ExpedicaoGetPayload<{
  include: typeof includeNotas;
}>;

/** Soma pendente dos itens: `Σ(qtd_esperada − qtd_entregue)`. */
export function saldoPendente(
  itens: { qtd_esperada: number; qtd_entregue: number }[],
): number {
  return itens.reduce(
    (total, item) =>
      total + (Number(item.qtd_esperada) - Number(item.qtd_entregue)),
    0,
  );
}

/** Snapshot serializável para a auditoria (datas em ISO, notas na ordem). */
function snapshot(expedicao: ExpedicaoComNotas) {
  return {
    id_expedicao: expedicao.id_expedicao,
    id_veiculo: expedicao.id_veiculo,
    id_funcionario_condutor: expedicao.id_funcionario_condutor,
    data_criacao: expedicao.data_criacao.toISOString(),
    data_prevista: expedicao.data_prevista.toISOString().slice(0, 10),
    observacao: expedicao.observacao,
    status: expedicao.status,
    ativo: expedicao.ativo,
    notas: expedicao.notas.map((nota) => ({
      id_nota_saida: nota.id_nota_saida,
      ordem_visita: nota.ordem_visita,
      status: nota.notaSaida.status,
    })),
  };
}

/** Confere se o veículo e o condutor informados existem e estão ativos. */
async function validarVinculos(client: Db, data: ExpedicaoAtualizacao) {
  const veiculo = await client.veiculo.findFirst({
    where: { id_veiculo: data.id_veiculo, ativo: true },
    select: { id_veiculo: true },
  });
  if (!veiculo) throw new Error("Veículo não encontrado ou inativo.");

  const condutor = await client.funcionario.findFirst({
    where: {
      id_funcionario: data.id_funcionario_condutor,
      ativo: true,
      condutor: true,
    },
    select: { id_funcionario: true },
  });
  if (!condutor) {
    throw new Error("Condutor não encontrado, inativo ou não habilitado.");
  }
}

/**
 * Nota elegível para entrar numa expedição: tipo `SAIDA`, ativa, com status
 * `ABERTA`/`PENDENTE`/`BAIXA_PARCIAL`, saldo pendente > 0 e sem vínculo com
 * outra expedição `PLANEJADA`/`EM_PERCURSO`.
 */
async function buscarNotaElegivel(client: Db, id_nota_saida: number) {
  const nota = await client.notaSaida.findFirst({
    where: {
      id_nota_saida,
      ativo: true,
      tipo: "SAIDA",
      status: { in: STATUS_NOTA_ELEGIVEL },
    },
    include: {
      itens: true,
      expedicoes: {
        include: {
          expedicao: {
            select: { id_expedicao: true, ativo: true, status: true },
          },
        },
      },
    },
  });

  if (!nota) return null;
  if (saldoPendente(nota.itens) <= 0) return null;

  const ocupada = nota.expedicoes.some(
    (vinculo) =>
      vinculo.expedicao.ativo &&
      STATUS_EXPEDICAO_ATIVA.includes(vinculo.expedicao.status),
  );
  if (ocupada) return null;

  return nota;
}

/**
 * Registra a entrega de uma nota em `EM_PERCURSO` na expedição `EM_PERCURSO`.
 * `itens` traz a quantidade entregue **total** por item; o delta é calculado
 * sobre `qtd_entregue`. Tudo na transação recebida: baixa de estoque +
 * reserva + item + status + auditoria. A transição condicional do status
 * garante que a segunda chamada não debite de novo.
 */
async function finalizarNota(
  tx: Db,
  id_expedicao: number,
  id_nota_saida: number,
  itens: EntregaItem[],
  cortar_restante: boolean,
  id_usuario: number,
): Promise<ResultadoEntrega> {
  const expedicao = await tx.expedicao.findFirst({
    where: { id_expedicao, ativo: true },
    select: { id_expedicao: true, status: true },
  });
  if (!expedicao) throw new Error("Expedição não encontrada.");
  if (expedicao.status !== "EM_PERCURSO") {
    throw new Error("Só expedições em percurso registram entrega.");
  }

  const nota = await tx.notaSaida.findFirst({
    where: { id_nota_saida, tipo: "SAIDA", ativo: true },
    include: {
      itens: { orderBy: { id_item_nota_saida: "asc" } },
      expedicoes: { select: { id_expedicao: true } },
    },
  });
  if (!nota) throw new Error("Nota de saída não encontrada.");
  if (!nota.expedicoes.some((vinculo) => vinculo.id_expedicao === id_expedicao)) {
    throw new Error("Esta nota não pertence à expedição.");
  }
  if (nota.status !== "EM_PERCURSO") {
    throw new Error(
      "Esta nota não está em percurso: a entrega já foi registrada ou a nota não saiu.",
    );
  }
  if (itens.length !== nota.itens.length) {
    throw new Error("Informe a quantidade entregue de todos os itens da nota.");
  }

  const informado = new Map<number, number>();
  for (const item of itens) {
    if (informado.has(item.id_item_nota_saida)) {
      throw new Error("Cada item da nota deve ser informado uma única vez.");
    }
    informado.set(item.id_item_nota_saida, item.qtd_entregue);
  }

  const plano = nota.itens.map((item) => {
    const nova = informado.get(item.id_item_nota_saida);
    if (nova === undefined) {
      throw new Error("Informe a quantidade entregue de todos os itens da nota.");
    }

    const esperada = Number(item.qtd_esperada);
    const atual = Number(item.qtd_entregue);

    if (!Number.isFinite(nova) || nova < 0 || nova > esperada) {
      throw new Error(
        "Quantidade entregue inválida: precisa estar entre zero e a quantidade esperada do item.",
      );
    }
    if (nova < atual) {
      throw new Error(
        "A quantidade entregue não pode ser menor que a já registrada no item.",
      );
    }

    return {
      item,
      esperada,
      atual,
      nova,
      delta: nova - atual,
      restante: cortar_restante ? esperada - nova : 0,
    };
  });

  const totalEsperada = plano.reduce((total, item) => total + item.esperada, 0);
  const totalEntregue = plano.reduce((total, item) => total + item.nova, 0);
  const totalDelta = plano.reduce((total, item) => total + item.delta, 0);

  const status: StatusNotaSaida =
    totalDelta === 0 && !cortar_restante
      ? "PENDENTE"
      : totalEntregue >= totalEsperada
        ? "BAIXA_TOTAL"
        : cortar_restante
          ? "BAIXA_COM_CORTE"
          : "BAIXA_PARCIAL";

  // Aborta antes de mexer em qualquer saldo se a reserva não cobre o que será
  // entregue/cortado — `saldo_reservado` nunca pode ficar negativo.
  const saldosAnteriores: {
    id_estoque: number;
    quantidade_atual: number;
    saldo_reservado: number;
  }[] = [];

  for (const item of plano) {
    const estoque = await tx.estoque.findUnique({
      where: { id_estoque: item.item.id_estoque },
    });
    if (!estoque) throw new Error("Estoque do item não encontrado.");

    const saldoReservado = Number(estoque.saldo_reservado);
    if (saldoReservado < item.delta + item.restante) {
      throw new Error(
        "Saldo reservado insuficiente para registrar a entrega.",
      );
    }

    saldosAnteriores.push({
      id_estoque: item.item.id_estoque,
      quantidade_atual: Number(estoque.quantidade_atual),
      saldo_reservado: saldoReservado,
    });
  }

  // Transição condicional: a segunda chamada (mesmo concorrente) não encontra
  // mais o status de origem e é recusada sem debitar.
  const transicao = await tx.notaSaida.updateMany({
    where: { id_nota_saida, status: "EM_PERCURSO" },
    data: { status },
  });
  if (transicao.count !== 1) {
    throw new Error("A entrega desta nota já foi registrada.");
  }

  const movimentacoes: {
    id_movimentacao: number;
    id_estoque: number;
    quantidade: number;
    saldo_anterior: number;
    saldo_posterior: number;
  }[] = [];
  const reservasLiberadas: {
    id_reserva_estoque: number;
    id_estoque: number;
    quantidade: number;
    saldo_anterior: number;
    saldo_posterior: number;
  }[] = [];

  for (const item of plano) {
    if (item.delta > 0) {
      const baixa = await estoqueDAO.baixar(
        {
          id_estoque: item.item.id_estoque,
          id_nota_saida,
          id_usuario,
          quantidade: item.delta,
          observacao: "Baixa da entrega da nota de saída",
        },
        tx,
      );
      movimentacoes.push({
        id_movimentacao: baixa.movimentacao.id_movimentacao,
        id_estoque: item.item.id_estoque,
        quantidade: Number(baixa.movimentacao.quantidade),
        saldo_anterior: baixa.saldo_anterior,
        saldo_posterior: baixa.saldo_posterior,
      });
    }

    if (item.restante > 0) {
      const liberacao = await estoqueDAO.liberarReserva(
        {
          id_estoque: item.item.id_estoque,
          id_nota_saida,
          id_usuario,
          quantidade: item.restante,
          observacao: "Corte do restante da entrega",
        },
        tx,
      );
      reservasLiberadas.push({
        id_reserva_estoque: liberacao.reserva.id_reserva_estoque,
        id_estoque: item.item.id_estoque,
        quantidade: Number(liberacao.reserva.quantidade),
        saldo_anterior: liberacao.saldo_anterior,
        saldo_posterior: liberacao.saldo_posterior,
      });
    }

    if (item.nova !== item.atual) {
      await tx.itemNotaSaida.update({
        where: { id_item_nota_saida: item.item.id_item_nota_saida },
        data: { qtd_entregue: item.nova },
      });
    }
  }

  const saldosPosteriores: {
    id_estoque: number;
    quantidade_atual: number;
    saldo_reservado: number;
  }[] = [];
  for (const item of plano) {
    const estoque = await tx.estoque.findUniqueOrThrow({
      where: { id_estoque: item.item.id_estoque },
    });
    saldosPosteriores.push({
      id_estoque: item.item.id_estoque,
      quantidade_atual: Number(estoque.quantidade_atual),
      saldo_reservado: Number(estoque.saldo_reservado),
    });
  }

  await registrarAuditoria(
    id_usuario,
    "ALTERAR",
    "NotaSaida",
    id_nota_saida,
    {
      id_nota_saida,
      id_expedicao,
      status: nota.status,
      cortar_restante,
      itens: plano.map((item) => ({
        id_item_nota_saida: item.item.id_item_nota_saida,
        id_estoque: item.item.id_estoque,
        qtd_esperada: item.esperada,
        qtd_entregue: item.atual,
      })),
      saldos: saldosAnteriores,
    },
    {
      id_nota_saida,
      id_expedicao,
      status,
      cortar_restante,
      itens: plano.map((item) => ({
        id_item_nota_saida: item.item.id_item_nota_saida,
        id_estoque: item.item.id_estoque,
        qtd_esperada: item.esperada,
        qtd_entregue: item.nova,
      })),
      saldos: saldosPosteriores,
      movimentacoes,
      reservas_liberadas: reservasLiberadas,
    },
    tx,
  );

  return {
    id_nota_saida,
    id_expedicao,
    status,
    itens: plano.map((item) => ({
      id_item_nota_saida: item.item.id_item_nota_saida,
      qtd_entregue: item.nova,
    })),
  };
}

export class ExpedicaoDAO {
  /** Lista paginada das expedições ativas, com notas, destinatários e veículo. */
  async list(params: ListParams = {}) {
    const { skip, take } = buildPagination(params);
    const where: Prisma.ExpedicaoWhereInput = { ativo: true };

    if (params.search) {
      const termo = params.search.trim();
      where.OR = [
        { observacao: { contains: termo } },
        { veiculo: { placa: { contains: termo } } },
        {
          notas: {
            some: {
              notaSaida: {
                destinatario: {
                  pessoaJuridica: { razao_social: { contains: termo } },
                },
              },
            },
          },
        },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.expedicao.findMany({
        skip,
        take,
        where,
        include: includeResumo,
        orderBy: [{ data_prevista: "desc" }, { id_expedicao: "desc" }],
      }),
      prisma.expedicao.count({ where }),
    ]);

    return {
      data,
      total,
      page: params.page ?? 1,
      limit: take,
      totalPages: Math.ceil(total / take),
    };
  }

  /** Detalhe (manifesto) da expedição ativa. */
  async getById(id: number) {
    return prisma.expedicao.findFirst({
      where: { id_expedicao: id, ativo: true },
      include: includeDetalhe,
    });
  }

  /** Veículos ativos para o seletor do formulário. */
  async listVeiculos(params: ListParams = {}) {
    const { skip, take } = buildPagination(params);
    const where: Prisma.VeiculoWhereInput = { ativo: true };
    if (params.search) {
      where.OR = [
        { placa: { contains: params.search } },
        { modelo: { contains: params.search } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.veiculo.findMany({
        skip,
        take,
        where,
        orderBy: { placa: "asc" },
      }),
      prisma.veiculo.count({ where }),
    ]);

    return {
      data,
      total,
      page: params.page ?? 1,
      limit: take,
      totalPages: Math.ceil(total / take),
    };
  }

  /** Funcionários ativos marcados como condutores. */
  async listCondutores(params: ListParams = {}) {
    const { skip, take } = buildPagination(params);
    const where: Prisma.FuncionarioWhereInput = { ativo: true, condutor: true };
    if (params.search) {
      where.pessoaFisica = { nome: { contains: params.search } };
    }

    const [data, total] = await Promise.all([
      prisma.funcionario.findMany({
        skip,
        take,
        where,
        include: { pessoaFisica: true },
        orderBy: { pessoaFisica: { nome: "asc" } },
      }),
      prisma.funcionario.count({ where }),
    ]);

    return {
      data,
      total,
      page: params.page ?? 1,
      limit: take,
      totalPages: Math.ceil(total / take),
    };
  }

  /** Percursos disponíveis para montar a expedição (template de ordem). */
  async listPercursos(params: ListParams = {}) {
    const { skip, take } = buildPagination(params);
    const where: Prisma.PercursoWhereInput = {};
    if (params.search) where.nome = { contains: params.search };

    const [data, total] = await Promise.all([
      prisma.percurso.findMany({
        skip,
        take,
        where,
        include: { _count: { select: { destinatarios: true } } },
        orderBy: { nome: "asc" },
      }),
      prisma.percurso.count({ where }),
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
   * Notas elegíveis para o seletor de adição. O saldo pendente é calculado
   * sobre os itens, por isso a lista é filtrada antes de paginar.
   */
  async listNotasElegiveis(
    params: ListParams & { excludeIds?: number[] } = {},
  ) {
    const { skip, take } = buildPagination(params);
    const where: Prisma.NotaSaidaWhereInput = {
      ativo: true,
      tipo: "SAIDA",
      status: { in: STATUS_NOTA_ELEGIVEL },
      expedicoes: {
        none: {
          expedicao: {
            ativo: true,
            status: { in: [...STATUS_EXPEDICAO_ATIVA] },
          },
        },
      },
    };

    if (params.excludeIds && params.excludeIds.length > 0) {
      where.id_nota_saida = { notIn: params.excludeIds };
    }

    if (params.search) {
      const termo = params.search.trim();
      const filtros: Prisma.NotaSaidaWhereInput[] = [
        {
          destinatario: {
            pessoaJuridica: { razao_social: { contains: termo } },
          },
        },
      ];
      if (/^\d+$/.test(termo)) {
        filtros.push({ id_nota_saida: Number(termo) });
      }
      where.OR = filtros;
    }

    const candidatas = await prisma.notaSaida.findMany({
      where,
      include: {
        destinatario: { include: { pessoaJuridica: true } },
        itens: true,
      },
      orderBy: { id_nota_saida: "asc" },
    });

    const elegiveis = candidatas.filter(
      (nota) => saldoPendente(nota.itens) > 0,
    );
    const data = elegiveis.slice(skip, skip + take);

    return {
      data,
      total: elegiveis.length,
      page: params.page ?? 1,
      limit: take,
      totalPages: Math.ceil(elegiveis.length / take),
    };
  }

  /**
   * Cria a expedição `PLANEJADA` e, quando um percurso é informado, acrescenta
   * automaticamente as notas elegíveis cujos destinatários estão nele, já na
   * ordem do percurso. O percurso não é gravado.
   */
  async create(data: ExpedicaoDados, id_usuario: number) {
    return prisma.$transaction(async (tx) => {
      await validarVinculos(tx, data);

      const expedicao = await tx.expedicao.create({
        data: {
          id_veiculo: data.id_veiculo,
          id_funcionario_condutor: data.id_funcionario_condutor,
          data_criacao: new Date(),
          data_prevista: data.data_prevista,
          observacao: data.observacao,
          status: "PLANEJADA",
        },
      });

      if (data.id_percurso !== null) {
        const percurso = await tx.percurso.findUnique({
          where: { id_percurso: data.id_percurso },
          include: {
            destinatarios: { orderBy: { ordem_visita: "asc" } },
          },
        });
        if (!percurso) throw new Error("Percurso não encontrado.");

        const idsDestinatarios = percurso.destinatarios.map(
          (item) => item.id_destinatario,
        );
        const ordemDestinatario = new Map(
          idsDestinatarios.map((id, indice) => [id, indice]),
        );

        if (idsDestinatarios.length > 0) {
          const candidatas = await tx.notaSaida.findMany({
            where: {
              ativo: true,
              tipo: "SAIDA",
              status: { in: STATUS_NOTA_ELEGIVEL },
              id_destinatario: { in: idsDestinatarios },
              expedicoes: {
                none: {
                  expedicao: {
                    ativo: true,
                    status: { in: [...STATUS_EXPEDICAO_ATIVA] },
                  },
                },
              },
            },
            include: { itens: true },
            orderBy: { id_nota_saida: "asc" },
          });

          const elegiveis = candidatas
            .filter(
              (nota) =>
                nota.id_destinatario !== null &&
                saldoPendente(nota.itens) > 0,
            )
            .sort((a, b) => {
              const ordemA =
                ordemDestinatario.get(a.id_destinatario ?? -1) ?? 0;
              const ordemB =
                ordemDestinatario.get(b.id_destinatario ?? -1) ?? 0;
              return ordemA - ordemB || a.id_nota_saida - b.id_nota_saida;
            });

          if (elegiveis.length > 0) {
            await tx.expedicaoNota.createMany({
              data: elegiveis.map((nota, indice) => ({
                id_expedicao: expedicao.id_expedicao,
                id_nota_saida: nota.id_nota_saida,
                ordem_visita: indice + 1,
                data_adicao: new Date(),
              })),
            });
          }
        }
      }

      const depois = await tx.expedicao.findUniqueOrThrow({
        where: { id_expedicao: expedicao.id_expedicao },
        include: includeNotas,
      });

      await registrarAuditoria(
        id_usuario,
        "CRIAR",
        AUDIT_ENTIDADE,
        expedicao.id_expedicao,
        null,
        snapshot(depois),
        tx,
      );

      return depois;
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  }

  /** Altera data/observação/veículo/condutor; só em expedição `PLANEJADA`. */
  async update(id: number, data: ExpedicaoAtualizacao, id_usuario: number) {
    return prisma.$transaction(async (tx) => {
      const antes = await tx.expedicao.findUniqueOrThrow({
        where: { id_expedicao: id },
        include: includeNotas,
      });

      if (!antes.ativo) throw new Error("Expedição desativada.");
      if (antes.status !== "PLANEJADA") {
        throw new Error("Só expedições planejadas podem ser alteradas.");
      }

      await validarVinculos(tx, data);

      await tx.expedicao.update({
        where: { id_expedicao: id },
        data: {
          data_prevista: data.data_prevista,
          observacao: data.observacao,
          id_veiculo: data.id_veiculo,
          id_funcionario_condutor: data.id_funcionario_condutor,
        },
      });

      const depois = await tx.expedicao.findUniqueOrThrow({
        where: { id_expedicao: id },
        include: includeNotas,
      });

      await registrarAuditoria(
        id_usuario,
        "ALTERAR",
        AUDIT_ENTIDADE,
        id,
        snapshot(antes),
        snapshot(depois),
        tx,
      );

      return depois;
    });
  }

  /** Acrescenta uma nota elegível ao fim da ordem da expedição. */
  async adicionarNota(
    id: number,
    id_nota_saida: number,
    id_usuario: number,
  ) {
    return prisma.$transaction(async (tx) => {
      const antes = await tx.expedicao.findUniqueOrThrow({
        where: { id_expedicao: id },
        include: includeNotas,
      });

      if (!antes.ativo) throw new Error("Expedição desativada.");
      if (antes.status !== "PLANEJADA") {
        throw new Error("Só expedições planejadas podem receber notas.");
      }

      const nota = await buscarNotaElegivel(tx, id_nota_saida);
      if (!nota) {
        throw new Error(
          "Nota de saída não elegível: precisa estar em aberto/pendente com saldo pendente e não pode estar em outra expedição ativa.",
        );
      }

      const agregado = await tx.expedicaoNota.aggregate({
        where: { id_expedicao: id },
        _max: { ordem_visita: true },
      });

      await tx.expedicaoNota.create({
        data: {
          id_expedicao: id,
          id_nota_saida,
          ordem_visita: (agregado._max.ordem_visita ?? 0) + 1,
          data_adicao: new Date(),
        },
      });

      const depois = await tx.expedicao.findUniqueOrThrow({
        where: { id_expedicao: id },
        include: includeNotas,
      });

      await registrarAuditoria(
        id_usuario,
        "ALTERAR",
        AUDIT_ENTIDADE,
        id,
        snapshot(antes),
        snapshot(depois),
        tx,
      );

      return depois;
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  }

  /** Remove o vínculo da nota (sem tocar na nota) e renumera 1..N. */
  async removerNota(id: number, id_nota_saida: number, id_usuario: number) {
    return prisma.$transaction(async (tx) => {
      const antes = await tx.expedicao.findUniqueOrThrow({
        where: { id_expedicao: id },
        include: includeNotas,
      });

      if (!antes.ativo) throw new Error("Expedição desativada.");
      if (antes.status !== "PLANEJADA") {
        throw new Error("Só expedições planejadas podem ter notas removidas.");
      }

      const vinculo = await tx.expedicaoNota.findFirst({
        where: { id_expedicao: id, id_nota_saida },
      });
      if (!vinculo) {
        throw new Error("Esta nota não pertence à expedição.");
      }

      await tx.expedicaoNota.delete({
        where: { id_expedicao_nota: vinculo.id_expedicao_nota },
      });

      const restantes = await tx.expedicaoNota.findMany({
        where: { id_expedicao: id },
        orderBy: { ordem_visita: "asc" },
      });
      for (const [indice, restante] of restantes.entries()) {
        await tx.expedicaoNota.update({
          where: { id_expedicao_nota: restante.id_expedicao_nota },
          data: { ordem_visita: indice + 1 },
        });
      }

      const depois = await tx.expedicao.findUniqueOrThrow({
        where: { id_expedicao: id },
        include: includeNotas,
      });

      await registrarAuditoria(
        id_usuario,
        "ALTERAR",
        AUDIT_ENTIDADE,
        id,
        snapshot(antes),
        snapshot(depois),
        tx,
      );

      return depois;
    });
  }

  /**
   * Grava a ordem 1..N de uma vez. `ordem` é a lista de `id_nota_saida` na
   * sequência desejada e precisa conter exatamente as notas da expedição.
   */
  async moverOrdem(id: number, ordem: number[], id_usuario: number) {
    return prisma.$transaction(async (tx) => {
      const antes = await tx.expedicao.findUniqueOrThrow({
        where: { id_expedicao: id },
        include: includeNotas,
      });

      if (!antes.ativo) throw new Error("Expedição desativada.");
      if (antes.status !== "PLANEJADA") {
        throw new Error("Só expedições planejadas podem ser reordenadas.");
      }

      const vinculos = await tx.expedicaoNota.findMany({
        where: { id_expedicao: id },
      });
      const idsAtuais = new Set(
        vinculos.map((vinculo) => vinculo.id_nota_saida),
      );

      const idsInformados = new Set(ordem);
      const mesmaLista =
        ordem.length === vinculos.length &&
        idsInformados.size === ordem.length &&
        ordem.every((idNota) => idsAtuais.has(idNota));
      if (!mesmaLista) {
        throw new Error(
          "A nova ordem precisa conter exatamente as notas da expedição.",
        );
      }

      const porNota = new Map(
        vinculos.map((vinculo) => [vinculo.id_nota_saida, vinculo]),
      );
      for (const [indice, idNota] of ordem.entries()) {
        const vinculo = porNota.get(idNota);
        if (!vinculo) continue;
        await tx.expedicaoNota.update({
          where: { id_expedicao_nota: vinculo.id_expedicao_nota },
          data: { ordem_visita: indice + 1 },
        });
      }

      const depois = await tx.expedicao.findUniqueOrThrow({
        where: { id_expedicao: id },
        include: includeNotas,
      });

      await registrarAuditoria(
        id_usuario,
        "ALTERAR",
        AUDIT_ENTIDADE,
        id,
        snapshot(antes),
        snapshot(depois),
        tx,
      );

      return depois;
    });
  }

  /**
   * Despacha a expedição: `PLANEJADA` → `EM_PERCURSO`, todas as notas →
   * `EM_PERCURSO` e o veículo → `EM_EXPEDICAO`. Exige ao menos uma nota e um
   * veículo. Não altera estoque nem reserva.
   */
  async despachar(id: number, id_usuario: number) {
    return prisma.$transaction(async (tx) => {
      const antes = await tx.expedicao.findUniqueOrThrow({
        where: { id_expedicao: id },
        include: includeNotas,
      });

      if (!antes.ativo) throw new Error("Expedição desativada.");
      if (antes.status !== "PLANEJADA") {
        throw new Error("Só expedições planejadas podem ser despachadas.");
      }
      if (antes.notas.length === 0) {
        throw new Error("Adicione ao menos uma nota antes de despachar.");
      }

      const veiculo = await tx.veiculo.findFirst({
        where: { id_veiculo: antes.id_veiculo, ativo: true },
        select: { id_veiculo: true, status: true },
      });
      if (!veiculo) throw new Error("Veículo não encontrado.");
      if (veiculo.status === "INDISPONIVEL") {
        throw new Error("Veículo indisponível para expedição.");
      }

      const veiculoEmOutraExpedicao = await tx.expedicao.findFirst({
        where: {
          id_expedicao: { not: id },
          id_veiculo: antes.id_veiculo,
          ativo: true,
          status: "EM_PERCURSO",
        },
        select: { id_expedicao: true },
      });
      if (veiculoEmOutraExpedicao) {
        throw new Error("Veículo já está em outra expedição em percurso.");
      }

      await tx.expedicao.update({
        where: { id_expedicao: id },
        data: { status: "EM_PERCURSO" },
      });

      await tx.notaSaida.updateMany({
        where: {
          id_nota_saida: {
            in: antes.notas.map((nota) => nota.id_nota_saida),
          },
        },
        data: { status: "EM_PERCURSO" },
      });

      await tx.veiculo.update({
        where: { id_veiculo: antes.id_veiculo },
        data: { status: "EM_EXPEDICAO" },
      });

      const depois = await tx.expedicao.findUniqueOrThrow({
        where: { id_expedicao: id },
        include: includeNotas,
      });

      await registrarAuditoria(
        id_usuario,
        "ALTERAR",
        AUDIT_ENTIDADE,
        id,
        snapshot(antes),
        snapshot(depois),
        tx,
      );

      return depois;
    });
  }

  /**
   * Registra a entrega de uma nota em `EM_PERCURSO`: dá baixa do entregue
   * (`quantidade_atual` e `saldo_reservado` pelo delta), libera a reserva do
   * restante no corte, atualiza `qtd_entregue` e o status da nota, com
   * auditoria `NotaSaida`/`ALTERAR`. Tudo em transação única.
   */
  async registrarEntrega(
    id: number,
    id_nota_saida: number,
    itens: EntregaItem[],
    cortar_restante: boolean,
    id_usuario: number,
  ): Promise<ResultadoEntrega> {
    return prisma.$transaction(
      (tx) =>
        finalizarNota(
          tx,
          id,
          id_nota_saida,
          itens,
          cortar_restante,
          id_usuario,
        ),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  /**
   * Atalho "não entregue": registra zero entregue (mantendo o já entregue
   * anteriormente) e sem corte → `PENDENTE`, sem alterar estoque nem reserva.
   */
  async marcarNaoEntregue(
    id: number,
    id_nota_saida: number,
    id_usuario: number,
  ): Promise<ResultadoEntrega> {
    return prisma.$transaction(
      async (tx) => {
        const nota = await tx.notaSaida.findFirst({
          where: { id_nota_saida, tipo: "SAIDA", ativo: true },
          include: { itens: { orderBy: { id_item_nota_saida: "asc" } } },
        });
        if (!nota) throw new Error("Nota de saída não encontrada.");

        return finalizarNota(
          tx,
          id,
          id_nota_saida,
          nota.itens.map((item) => ({
            id_item_nota_saida: item.id_item_nota_saida,
            qtd_entregue: Number(item.qtd_entregue),
          })),
          false,
          id_usuario,
        );
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  /**
   * Conclui a expedição `EM_PERCURSO`: notas ainda em percurso passam a
   * `PENDENTE`, a expedição vai para `CONCLUIDA` e o veículo volta para
   * `DISPONIVEL` quando não estiver em outra expedição em percurso. Auditoria
   * `Expedicao`/`ALTERAR` registra quantas notas ficaram pendentes.
   */
  async concluir(id: number, id_usuario: number) {
    return prisma.$transaction(
      async (tx) => {
        const antes = await tx.expedicao.findUniqueOrThrow({
          where: { id_expedicao: id },
          include: includeNotas,
        });

        if (!antes.ativo) throw new Error("Expedição desativada.");
        if (antes.status !== "EM_PERCURSO") {
          throw new Error("Só expedições em percurso podem ser concluídas.");
        }

        const transicao = await tx.expedicao.updateMany({
          where: { id_expedicao: id, status: "EM_PERCURSO" },
          data: { status: "CONCLUIDA" },
        });
        if (transicao.count !== 1) {
          throw new Error("A expedição já foi concluída.");
        }

        const pendentes = await tx.notaSaida.updateMany({
          where: {
            id_nota_saida: {
              in: antes.notas.map((nota) => nota.id_nota_saida),
            },
            status: "EM_PERCURSO",
          },
          data: { status: "PENDENTE" },
        });

        const veiculoEmOutraExpedicao = await tx.expedicao.findFirst({
          where: {
            id_expedicao: { not: id },
            id_veiculo: antes.id_veiculo,
            ativo: true,
            status: "EM_PERCURSO",
          },
          select: { id_expedicao: true },
        });

        if (!veiculoEmOutraExpedicao) {
          await tx.veiculo.update({
            where: { id_veiculo: antes.id_veiculo },
            data: { status: "DISPONIVEL" },
          });
        }

        const depois = await tx.expedicao.findUniqueOrThrow({
          where: { id_expedicao: id },
          include: includeNotas,
        });

        await registrarAuditoria(
          id_usuario,
          "ALTERAR",
          AUDIT_ENTIDADE,
          id,
          snapshot(antes),
          {
            ...snapshot(depois),
            notas_marcadas_pendentes: pendentes.count,
          },
          tx,
        );

        return depois;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  /** Desativa (`ativo = false`) uma expedição `PLANEJADA`, com auditoria. */
  async desativar(id: number, id_usuario: number) {
    return prisma.$transaction(async (tx) => {
      const antes = await tx.expedicao.findUniqueOrThrow({
        where: { id_expedicao: id },
        include: includeNotas,
      });

      if (!antes.ativo) throw new Error("Expedição já está desativada.");
      if (antes.status !== "PLANEJADA") {
        throw new Error("Só expedições planejadas podem ser desativadas.");
      }

      await tx.expedicao.update({
        where: { id_expedicao: id },
        data: { ativo: false },
      });

      const depois = await tx.expedicao.findUniqueOrThrow({
        where: { id_expedicao: id },
        include: includeNotas,
      });

      await registrarAuditoria(
        id_usuario,
        "DESATIVAR",
        AUDIT_ENTIDADE,
        id,
        snapshot(antes),
        snapshot(depois),
        tx,
      );

      return depois;
    });
  }
}

export const expedicaoDAO = new ExpedicaoDAO();
