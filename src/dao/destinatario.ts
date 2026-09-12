import { prisma } from "@/lib/prisma";
import { buildPagination, type PaginationParams, type PaginatedResult } from "@/types";

export class DestinatarioDAO {
  async list(params: PaginationParams = {}) {
    const { skip, take } = buildPagination(params);
    const [data, total] = await Promise.all([
      prisma.destinatario.findMany({
        skip, take,
        where: { ativo: true },
        include: {
          pessoaJuridica: true,
          endereco: true,
        },
        orderBy: { id_destinatario: "desc" },
      }),
      prisma.destinatario.count({ where: { ativo: true } }),
    ]);
    return { data, total, page: params.page ?? 1, limit: take, totalPages: Math.ceil(total / take) };
  }

  async getById(id: number) {
    return prisma.destinatario.findUnique({
      where: { id_destinatario: id },
      include: {
        pessoaJuridica: true,
        endereco: true,
        telefones: true,
        emails: true,
        destinatarioCodigos: { include: { tipoCodigo: true } },
      },
    });
  }

  async softDelete(id: number) {
    return prisma.destinatario.update({ where: { id_destinatario: id }, data: { ativo: false } });
  }
}

export const destinatarioDAO = new DestinatarioDAO();