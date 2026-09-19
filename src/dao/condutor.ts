import { prisma } from "@/lib/prisma";
import { buildPagination, type PaginationParams } from "@/types";

export class CondutorDAO {
  async list(params: PaginationParams = {}) {
    const { skip, take } = buildPagination(params);
    const [data, total] = await Promise.all([
      prisma.condutor.findMany({
        skip, take,
        where: { ativo: true },
        include: { funcionario: { include: { pessoaFisica: true } } },
        orderBy: { id_condutor: "desc" },
      }),
      prisma.condutor.count({ where: { ativo: true } }),
    ]);
    return { data, total, page: params.page ?? 1, limit: take, totalPages: Math.ceil(total / take) };
  }

  async getById(id: number) {
    return prisma.condutor.findUnique({
      where: { id_condutor: id },
      include: { funcionario: { include: { pessoaFisica: true } }, condutorCodigos: { include: { tipoCodigo: true } } },
    });
  }

  async create(
    data: { id_funcionario: number; numero_cnh?: string; categoria_cnh?: string; validade_cnh?: string },
    id_usuario: number,
  ) {
    return prisma.$transaction(async (tx) => {
      const c = await tx.condutor.create({ data: { ...data, validade_cnh: data.validade_cnh ? new Date(data.validade_cnh) : undefined } });
      await tx.registroAuditoria.create({
        data: { id_usuario, acao: "CRIAR", data_hora: new Date(), entidade: "Condutor", id_entidade_afetada: c.id_condutor, dados_novos: { id_funcionario: data.id_funcionario } },
      });
      return c;
    });
  }

  async softDelete(id: number, id_usuario: number) {
    return prisma.$transaction(async (tx) => {
      const antes = await tx.condutor.findUniqueOrThrow({ where: { id_condutor: id } });
      const depois = await tx.condutor.update({ where: { id_condutor: id }, data: { ativo: false } });
      await tx.registroAuditoria.create({
        data: { id_usuario, acao: "DESATIVAR", data_hora: new Date(), entidade: "Condutor", id_entidade_afetada: id, dados_anteriores: { ativo: antes.ativo }, dados_novos: { ativo: depois.ativo } },
      });
      return depois;
    });
  }
}

export const condutorDAO = new CondutorDAO();