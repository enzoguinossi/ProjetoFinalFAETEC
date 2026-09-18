import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "./_audit";
import { buildPagination, type PaginationParams } from "@/types";

const AUDIT_ENTIDADE = "Funcionario";

export class FuncionarioDAO {
  async list(params: PaginationParams = {}) {
    const { skip, take } = buildPagination(params);
    const [data, total] = await Promise.all([
      prisma.funcionario.findMany({
        skip, take,
        where: { ativo: true },
        include: {
          pessoaFisica: { select: { id_pessoa_fisica: true, nome: true, cpf: true } },
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
      include: {
        pessoaFisica: true,
        usuario: true,
        condutor: true,
        telefones: { where: { ativo: true } },
        emails: true,
        funcionarioCodigos: { include: { tipoCodigo: true } },
      },
    });
  }

  /**
   * Cria Funcionario + PessoaFisica em transação, com auditoria.
   */
  async create(
    data: { nome: string; cpf?: string; cargo?: string },
    id_usuario: number,
  ) {
    const result = await prisma.$transaction(async (tx) => {
      const pf = await tx.pessoaFisica.create({
        data: { nome: data.nome, cpf: data.cpf },
      });
      await tx.registroAuditoria.create({
        data: {
          id_usuario,
          acao: "CRIAR",
          entidade: "PessoaFisica",
          id_entidade_afetada: pf.id_pessoa_fisica,
          dados_novos: { nome: data.nome, cpf: data.cpf ?? null },
        },
      });

      const func = await tx.funcionario.create({
        data: { id_pessoa_fisica: pf.id_pessoa_fisica, cargo: data.cargo },
      });
      await tx.registroAuditoria.create({
        data: {
          id_usuario,
          acao: "CRIAR",
          entidade: AUDIT_ENTIDADE,
          id_entidade_afetada: func.id_funcionario,
          dados_novos: { cargo: data.cargo ?? null, id_pessoa_fisica: pf.id_pessoa_fisica },
        },
      });

      return tx.funcionario.findUniqueOrThrow({
        where: { id_funcionario: func.id_funcionario },
        include: { pessoaFisica: true },
      });
    });
    return result;
  }

  async update(id: number, data: { cargo?: string }, id_usuario: number) {
    const antes = await prisma.funcionario.findUniqueOrThrow({ where: { id_funcionario: id } });
    const depois = await prisma.funcionario.update({ where: { id_funcionario: id }, data });
    if (JSON.stringify(antes) !== JSON.stringify(depois)) {
      await registrarAuditoria(id_usuario, "ALTERAR", AUDIT_ENTIDADE, id,
        { cargo: antes.cargo },
        { cargo: depois.cargo },
      );
    }
    return depois;
  }

  async softDelete(id: number, id_usuario: number) {
    const antes = await prisma.funcionario.findUniqueOrThrow({ where: { id_funcionario: id } });
    const depois = await prisma.funcionario.update({ where: { id_funcionario: id }, data: { ativo: false } });
    await registrarAuditoria(id_usuario, "DESATIVAR", AUDIT_ENTIDADE, id,
      { ativo: antes.ativo },
      { ativo: depois.ativo },
    );
    return depois;
  }
}

export const funcionarioDAO = new FuncionarioDAO();