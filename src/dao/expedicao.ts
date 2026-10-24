import {
  Prisma,
  type StatusExpedicao,
  type StatusNotaSaida,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "./_audit";
import { buildPagination, type ListParams } from "@/types";

type Db = Prisma.TransactionClient;

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
  data_prevista: Date | null;
  observacao: string | null;
  id_veiculo: number | null;
  id_funcionario_condutor: number | null;
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
          itens: true,
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
    data_prevista: expedicao.data_prevista
      ? expedicao.data_prevista.toISOString().slice(0, 10)
      : null,
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

/** Confere se o veículo/condutor informado existe e está ativo. */
async function validarVinculos(client: Db, data: ExpedicaoAtualizacao) {
  if (data.id_veiculo !== null) {
    const veiculo = await client.veiculo.findFirst({
      where: { id_veiculo: data.id_veiculo, ativo: true },
      select: { id_veiculo: true },
    });
    if (!veiculo) throw new Error("Veículo não encontrado.");
  }

  if (data.id_funcionario_condutor !== null) {
    const condutor = await client.funcionario.findFirst({
      where: { id_funcionario: data.id_funcionario_condutor, ativo: true },
      select: { id_funcionario: true },
    });
    if (!condutor) throw new Error("Condutor não encontrado.");
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
      if (antes.id_veiculo === null) {
        throw new Error("Selecione um veículo antes de despachar.");
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
