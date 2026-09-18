import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "./_audit";
import { buildPagination, type PaginationParams } from "@/types";

const AUDIT_ENTIDADE = "PessoaFisica";

export class PessoaFisicaDAO {
  async list(params: PaginationParams = {}) {
    const { skip, take } = buildPagination(params);
    const [data, total] = await Promise.all([
      prisma.pessoaFisica.findMany({
        skip, take,
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

  async create(data: { nome: string; cpf?: string }, id_usuario: number) {
    const created = await prisma.pessoaFisica.create({ data });
    await registrarAuditoria(id_usuario, "CRIAR", AUDIT_ENTIDADE, created.id_pessoa_fisica, null, { nome: data.nome, cpf: data.cpf ?? null });
    return created;
  }

  async update(id: number, data: { nome?: string; cpf?: string }, id_usuario: number) {
    const antes = await prisma.pessoaFisica.findUniqueOrThrow({ where: { id_pessoa_fisica: id } });
    const depois = await prisma.pessoaFisica.update({ where: { id_pessoa_fisica: id }, data });
    await registrarAuditoria(id_usuario, "ALTERAR", AUDIT_ENTIDADE, id,
      { nome: antes.nome, cpf: antes.cpf },
      { nome: depois.nome, cpf: depois.cpf },
    );
    return depois;
  }

  async softDelete(id: number, id_usuario: number) {
    const antes = await prisma.pessoaFisica.findUniqueOrThrow({ where: { id_pessoa_fisica: id } });
    const depois = await prisma.pessoaFisica.update({ where: { id_pessoa_fisica: id }, data: { ativo: false } });
    await registrarAuditoria(id_usuario, "DESATIVAR", AUDIT_ENTIDADE, id,
      { ativo: antes.ativo },
      { ativo: depois.ativo },
    );
    return depois;
  }
}

export const pessoaFisicaDAO = new PessoaFisicaDAO();