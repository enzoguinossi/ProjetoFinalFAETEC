import { prisma } from "@/lib/prisma";
import { buildPagination, type PaginationParams, type PaginatedResult } from "@/types";

export class FuncionarioDAO {
  async list(params: PaginationParams = {}) {
    const { skip, take } = buildPagination(params);
    const [data, total] = await Promise.all([
      prisma.funcionario.findMany({
        skip, take,
        where: { ativo: true },
        include: {
          pessoaFisica: true,
          usuario: { select: { id_usuario: true, login: true, ativo: true } },
          condutor: { select: { id_condutor: true, numero_cnh: true } },
        },
        orderBy: { id_funcionario: "desc" },
      }),
      prisma.funcionario.count({ where: { ativo: true } }),
    ]);
    return { data, total, page: params.page ?? 1, limit: take, totalPages: Math.ceil(total / take) };
  }

  async getById(id: number) {
    return prisma.funcionario.findUnique({
      where: { id_funcionario: id },
      include: { pessoaFisica: true, usuario: true, condutor: true, telefones: true, emails: true },
    });
  }

  async create(data: { id_pessoa_fisica: number; cargo?: string }) {
    return prisma.funcionario.create({ data });
  }

  async softDelete(id: number) {
    return prisma.funcionario.update({ where: { id_funcionario: id }, data: { ativo: false } });
  }
}

export const funcionarioDAO = new FuncionarioDAO();