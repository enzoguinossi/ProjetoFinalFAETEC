import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { registrarAuditoria } from "./_audit";
import { EntidadeComVinculosError } from "./_errors";
import { buildPagination, type PaginationParams } from "@/types";

const AUDIT_ENTIDADE = "Funcionario";

type Db = Prisma.TransactionClient;

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
        telefones: { where: { ativo: true } },
        emails: true,
        funcionarioCodigos: { include: { tipoCodigo: true } },
      },
    });
  }

  async listDisponiveisParaUsuario() {
    return prisma.funcionario.findMany({
      where: { ativo: true, usuario: null },
      include: { pessoaFisica: true },
      orderBy: { id_funcionario: "asc" },
    });
  }

  async search(query: string, take = 50) {
    return prisma.funcionario.findMany({
      where: { ativo: true, pessoaFisica: { nome: { contains: query } } },
      include: { pessoaFisica: { select: { nome: true } } },
      take,
      orderBy: { id_funcionario: "desc" },
    });
  }

  async create(
    data: { nome: string; cpf?: string; cargo?: string; condutor?: boolean },
    id_usuario: number,
  ) {
    const result = await prisma.$transaction(async (tx) => {
      const pf = await tx.pessoaFisica.create({
        data: { nome: data.nome, cpf: data.cpf },
      });
      await tx.registroAuditoria.create({
        data: {
          id_usuario, acao: "CRIAR", data_hora: new Date(),
          entidade: "PessoaFisica",
          id_entidade_afetada: pf.id_pessoa_fisica,
          dados_novos: { nome: data.nome, cpf: data.cpf ?? null },
        },
      });

      const func = await tx.funcionario.create({
        data: {
          id_pessoa_fisica: pf.id_pessoa_fisica,
          cargo: data.cargo,
          condutor: data.condutor ?? false,
        },
      });
      await tx.registroAuditoria.create({
        data: {
          id_usuario, acao: "CRIAR", data_hora: new Date(),
          entidade: AUDIT_ENTIDADE,
          id_entidade_afetada: func.id_funcionario,
          dados_novos: { cargo: data.cargo ?? null, id_pessoa_fisica: pf.id_pessoa_fisica, condutor: data.condutor ?? false },
        },
      });

      return tx.funcionario.findUniqueOrThrow({
        where: { id_funcionario: func.id_funcionario },
        include: { pessoaFisica: true },
      });
    });
    return result;
  }

  async update(
    id: number,
    data: { nome?: string; cargo?: string; condutor?: boolean; ativo?: boolean },
    id_usuario: number,
  ) {
    return prisma.$transaction(async (tx) => {
      const antes = await tx.funcionario.findUniqueOrThrow({
        where: { id_funcionario: id },
        include: { pessoaFisica: true },
      });

      if (data.nome !== undefined) {
        await tx.pessoaFisica.update({
          where: { id_pessoa_fisica: antes.id_pessoa_fisica },
          data: { nome: data.nome },
        });
      }

      // Remove a marcação de condutor apenas se ele nunca foi usado em remessa.
      if (data.condutor === false && antes.condutor) {
        const usos = await tx.remessa.count({ where: { id_funcionario_condutor: id } });
        if (usos > 0) {
          throw new EntidadeComVinculosError(
            "Condutor",
            [`${usos} remessa(s) utilizam este condutor`],
          );
        }
      }

      const depois = await tx.funcionario.update({
        where: { id_funcionario: id },
        data: {
          cargo: data.cargo,
          condutor: data.condutor ?? antes.condutor,
          ativo: data.ativo ?? antes.ativo,
        },
      });

      await tx.registroAuditoria.create({
        data: {
          id_usuario, acao: "ALTERAR", data_hora: new Date(),
          entidade: AUDIT_ENTIDADE, id_entidade_afetada: id,
          dados_anteriores: { nome: antes.pessoaFisica.nome, cargo: antes.cargo, condutor: antes.condutor, ativo: antes.ativo },
          dados_novos: { nome: data.nome ?? antes.pessoaFisica.nome, cargo: data.cargo ?? antes.cargo, condutor: depois.condutor, ativo: depois.ativo },
        },
      });

      return tx.funcionario.findUniqueOrThrow({
        where: { id_funcionario: id },
        include: { pessoaFisica: true },
      });
    });
  }

  async verificarRelacionamentos(id: number, client: Db = prisma) {
    const [usuario, contagens, remessas] = await Promise.all([
      client.usuario.count({ where: { id_funcionario: id } }),
      client.contagemInventario.count({ where: { id_funcionario: id } }),
      client.remessa.count({ where: { id_funcionario_condutor: id } }),
    ]);

    const vinculos: string[] = [];
    if (usuario > 0) vinculos.push(`${usuario} usuário(s) vinculado(s)`);
    if (contagens > 0) vinculos.push(`${contagens} contagem(ns) de inventário`);
    if (remessas > 0) vinculos.push(`${remessas} remessa(s) como condutor`);

    return { podeExcluir: vinculos.length === 0, vinculos };
  }

  async hardDelete(id: number, id_usuario: number) {
    return prisma.$transaction(async (tx) => {
      const { podeExcluir, vinculos } = await this.verificarRelacionamentos(id, tx);
      if (!podeExcluir) throw new EntidadeComVinculosError(`o funcionário`, vinculos);

      const func = await tx.funcionario.findUniqueOrThrow({ where: { id_funcionario: id } });

      await tx.funcionarioCodigo.deleteMany({ where: { id_funcionario: id } });
      await tx.funcionarioTelefone.deleteMany({ where: { id_funcionario: id } });
      await tx.funcionarioEmail.deleteMany({ where: { id_funcionario: id } });
      await tx.funcionario.delete({ where: { id_funcionario: id } });
      await tx.pessoaFisica.delete({ where: { id_pessoa_fisica: func.id_pessoa_fisica } });

      await tx.registroAuditoria.create({
        data: {
          id_usuario, acao: "EXCLUIR", data_hora: new Date(),
          entidade: AUDIT_ENTIDADE, id_entidade_afetada: id,
          dados_anteriores: { id_funcionario: id, id_pessoa_fisica: func.id_pessoa_fisica },
        },
      });
    });
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
