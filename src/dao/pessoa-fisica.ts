import { prisma } from "@/lib/prisma";
import type {
  PaginationParams,
  PaginatedResult,
  buildPagination,
} from "@/types";

export class PessoaFisicaDAO {
  async list(params: PaginationParams = {}): Promise<PaginatedResult<any>> {
    const { skip, take } = buildPagination(params);
    const [data, total] = await Promise.all([
      prisma.pessoaFisica.findMany({
        skip,
        take,
        where: { ativo: true },
        orderBy: { nome: "asc" },
      }),
      prisma.pessoaFisica.count({ where: { ativo: true } }),
    ]);
    return { data, total, page: params.page ?? 1, limit: take, totalPages: Math.ceil(total / take) };
  }

  async getById(id: number) {
    return prisma.pessoaFisica.findUnique({
      where: { id_pessoa_fisica: id },
      include: { funcionario: true },
    });
  }

  async create(data: { nome: string; cpf?: string }) {
    return prisma.pessoaFisica.create({ data });
  }

  async update(id: number, data: { nome?: string; cpf?: string }) {
    return prisma.pessoaFisica.update({ where: { id_pessoa_fisica: id }, data });
  }

  async softDelete(id: number) {
    return prisma.pessoaFisica.update({
      where: { id_pessoa_fisica: id },
      data: { ativo: false },
    });
  }
}

export const pessoaFisicaDAO = new PessoaFisicaDAO();