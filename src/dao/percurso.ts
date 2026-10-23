import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { registrarAuditoria } from "./_audit";
import { buildPagination, type ListParams } from "@/types";

type Db = Prisma.TransactionClient;

export type PercursoDestinatarioDados = {
  id_destinatario: number;
  ordem_visita: number;
};

export type PercursoDados = {
  nome: string;
  descricao?: string | null;
  destinatarios: PercursoDestinatarioDados[];
};

const includeDestinatarios = {
  destinatarios: {
    orderBy: { ordem_visita: "asc" as const },
    include: { destinatario: { include: { pessoaJuridica: true } } },
  },
} satisfies Prisma.PercursoInclude;

function snapshot(percurso: {
  nome: string;
  descricao: string | null;
  destinatarios: { id_destinatario: number; ordem_visita: number }[];
}) {
  return {
    nome: percurso.nome,
    descricao: percurso.descricao,
    destinatarios: percurso.destinatarios.map((d) => ({
      id_destinatario: d.id_destinatario,
      ordem_visita: d.ordem_visita,
    })),
  };
}

async function garantirNomeUnico(
  client: Db,
  nome: string,
  ignorarId?: number,
): Promise<void> {
  const existente = await client.percurso.findFirst({
    where: {
      nome,
      ativo: true,
      ...(ignorarId ? { NOT: { id_percurso: ignorarId } } : {}),
    },
    select: { id_percurso: true },
  });
  if (existente) throw new Error("Já existe um percurso ativo com este nome.");
}

export class PercursoDAO {
  /**
   * Lista paginada de percursos com a contagem de destinatários.
   * Sem `ativo` informado, devolve ativos e desativados (a tela de cadastro
   * mostra a situação); os seletores de rota pedem `ativo: true`.
   */
  async list(params: ListParams & { ativo?: boolean } = {}) {
    const { skip, take } = buildPagination(params);
    const where: Prisma.PercursoWhereInput = {};
    if (params.ativo !== undefined) where.ativo = params.ativo;
    if (params.search) where.nome = { contains: params.search };

    const [data, total] = await Promise.all([
      prisma.percurso.findMany({
        skip,
        take,
        where,
        orderBy: { nome: "asc" },
        include: { _count: { select: { destinatarios: true } } },
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

  async getById(id: number) {
    return prisma.percurso.findUnique({
      where: { id_percurso: id },
      include: includeDestinatarios,
    });
  }

  /** Nome já usado por um percurso ativo (fora do próprio, ao alterar). */
  async nomeAtivoEmUso(nome: string, ignorarId?: number): Promise<boolean> {
    const existente = await prisma.percurso.findFirst({
      where: {
        nome,
        ativo: true,
        ...(ignorarId ? { NOT: { id_percurso: ignorarId } } : {}),
      },
      select: { id_percurso: true },
    });
    return existente !== null;
  }

  async create(data: PercursoDados, id_usuario: number) {
    return prisma.$transaction(async (tx) => {
      await garantirNomeUnico(tx, data.nome);

      const percurso = await tx.percurso.create({
        data: { nome: data.nome, descricao: data.descricao ?? null },
      });

      await tx.percursoDestinatario.createMany({
        data: data.destinatarios.map((d) => ({
          id_percurso: percurso.id_percurso,
          id_destinatario: d.id_destinatario,
          ordem_visita: d.ordem_visita,
        })),
      });

      const depois = await tx.percurso.findUniqueOrThrow({
        where: { id_percurso: percurso.id_percurso },
        include: includeDestinatarios,
      });

      await registrarAuditoria(
        id_usuario,
        "CRIAR",
        "Percurso",
        percurso.id_percurso,
        null,
        snapshot(depois),
        tx,
      );

      return depois;
    });
  }

  async update(id: number, data: PercursoDados, id_usuario: number) {
    return prisma.$transaction(async (tx) => {
      const antes = await tx.percurso.findUniqueOrThrow({
        where: { id_percurso: id },
        include: includeDestinatarios,
      });
      await garantirNomeUnico(tx, data.nome, id);

      await tx.percurso.update({
        where: { id_percurso: id },
        data: { nome: data.nome, descricao: data.descricao ?? null },
      });

      await tx.percursoDestinatario.deleteMany({ where: { id_percurso: id } });
      await tx.percursoDestinatario.createMany({
        data: data.destinatarios.map((d) => ({
          id_percurso: id,
          id_destinatario: d.id_destinatario,
          ordem_visita: d.ordem_visita,
        })),
      });

      const depois = await tx.percurso.findUniqueOrThrow({
        where: { id_percurso: id },
        include: includeDestinatarios,
      });

      await registrarAuditoria(
        id_usuario,
        "ALTERAR",
        "Percurso",
        id,
        snapshot(antes),
        snapshot(depois),
        tx,
      );

      return depois;
    });
  }

  /** Desativação (soft delete): o registro e a ordem das visitas permanecem. */
  async desativar(id: number, id_usuario: number) {
    return prisma.$transaction(async (tx) => {
      const antes = await tx.percurso.findUniqueOrThrow({
        where: { id_percurso: id },
        include: includeDestinatarios,
      });

      if (!antes.ativo) return antes;

      await tx.percurso.update({
        where: { id_percurso: id },
        data: { ativo: false },
      });

      await registrarAuditoria(
        id_usuario,
        "DESATIVAR",
        "Percurso",
        id,
        snapshot(antes),
        { ...snapshot(antes), ativo: false },
        tx,
      );

      return tx.percurso.findUniqueOrThrow({
        where: { id_percurso: id },
        include: includeDestinatarios,
      });
    });
  }

  /**
   * Destinatários ativos disponíveis para o seletor do formulário de percurso.
   * Listagem própria (não reutiliza a da saída, que exige `estoque.saida`).
   */
  async listDestinatarios(
    params: ListParams & { excludeIds?: number[] } = {},
  ) {
    const { skip, take } = buildPagination(params);
    const where: Prisma.DestinatarioWhereInput = { ativo: true };
    if (params.excludeIds && params.excludeIds.length > 0) {
      where.id_destinatario = { notIn: params.excludeIds };
    }
    if (params.search) {
      where.pessoaJuridica = { razao_social: { contains: params.search } };
    }

    const [data, total] = await Promise.all([
      prisma.destinatario.findMany({
        skip,
        take,
        where,
        include: { pessoaJuridica: true },
        orderBy: { pessoaJuridica: { razao_social: "asc" } },
      }),
      prisma.destinatario.count({ where }),
    ]);

    return {
      data,
      total,
      page: params.page ?? 1,
      limit: take,
      totalPages: Math.ceil(total / take),
    };
  }
}

export const percursoDAO = new PercursoDAO();
