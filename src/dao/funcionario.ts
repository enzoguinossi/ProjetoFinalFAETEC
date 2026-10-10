import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { registrarAuditoria } from "./_audit";
import { EntidadeComVinculosError } from "./_errors";
import { buildPagination, type ListParams } from "@/types";
import type { CodigoInput } from "@/lib/codigo";
import type { ContatosInput } from "@/services/contato";

const AUDIT_ENTIDADE = "Funcionario";

type Db = Prisma.TransactionClient;

export class FuncionarioDAO {
  async list(params: ListParams = {}) {
    const { skip, take } = buildPagination(params);
    const where: Prisma.FuncionarioWhereInput = { ativo: true };
    if (params.search) where.pessoaFisica = { nome: { contains: params.search } };
    const [data, total] = await Promise.all([
      prisma.funcionario.findMany({
        skip, take,
        where,
        include: {
          pessoaFisica: { select: { id_pessoa_fisica: true, nome: true, cpf: true } },
          usuario: { select: { id_usuario: true, login: true, ativo: true } },
        },
        orderBy: { id_funcionario: "desc" },
      }),
      prisma.funcionario.count({ where }),
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

  async create(
    data: { nome: string; cpf?: string; cargo?: string; condutor?: boolean; codigos?: CodigoInput[] } & Partial<ContatosInput>,
    id_usuario: number,
  ) {
    const result = await prisma.$transaction(async (tx) => {
      const pf = await tx.pessoaFisica.create({
        data: { nome: data.nome, cpf: data.cpf },
      });
      await registrarAuditoria(
        id_usuario, "CRIAR", "PessoaFisica", pf.id_pessoa_fisica,
        null,
        { nome: data.nome, cpf: data.cpf ?? null },
        tx,
      );

      const func = await tx.funcionario.create({
        data: {
          id_pessoa_fisica: pf.id_pessoa_fisica,
          cargo: data.cargo,
          condutor: data.condutor ?? false,
        },
      });
      for (const c of data.codigos ?? []) {
        await tx.funcionarioCodigo.create({
          data: { id_funcionario: func.id_funcionario, id_tipo_codigo: c.id_tipo_codigo, codigo: c.codigo },
        });
      }

      for (const e of data.emails ?? []) {
        await tx.funcionarioEmail.create({
          data: { id_funcionario: func.id_funcionario, endereco: e.endereco, principal: e.principal },
        });
      }
      for (const t of data.telefones ?? []) {
        await tx.funcionarioTelefone.create({
          data: { id_funcionario: func.id_funcionario, numero: t.numero, tipo: t.tipo, principal: t.principal },
        });
      }

      await registrarAuditoria(
        id_usuario, "CRIAR", AUDIT_ENTIDADE, func.id_funcionario,
        null,
        { cargo: data.cargo ?? null, id_pessoa_fisica: pf.id_pessoa_fisica, condutor: data.condutor ?? false, codigos: data.codigos ?? [], emails: data.emails ?? [], telefones: data.telefones ?? [] },
        tx,
      );

      return tx.funcionario.findUniqueOrThrow({
        where: { id_funcionario: func.id_funcionario },
        include: { pessoaFisica: true },
      });
    });
    return result;
  }

  async update(
    id: number,
    data: { nome?: string; cargo?: string; condutor?: boolean; ativo?: boolean; codigos?: CodigoInput[] } & Partial<ContatosInput>,
    id_usuario: number,
  ) {
    return prisma.$transaction(async (tx) => {
      const antes = await tx.funcionario.findUniqueOrThrow({
        where: { id_funcionario: id },
        include: { pessoaFisica: true, funcionarioCodigos: true, emails: true, telefones: true },
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

      if (data.codigos !== undefined) {
        await tx.funcionarioCodigo.deleteMany({ where: { id_funcionario: id } });
        for (const c of data.codigos) {
          await tx.funcionarioCodigo.create({
            data: { id_funcionario: id, id_tipo_codigo: c.id_tipo_codigo, codigo: c.codigo },
          });
        }
      }

      if (data.emails !== undefined) {
        await tx.funcionarioEmail.deleteMany({ where: { id_funcionario: id } });
        for (const e of data.emails) {
          await tx.funcionarioEmail.create({
            data: { id_funcionario: id, endereco: e.endereco, principal: e.principal },
          });
        }
      }
      if (data.telefones !== undefined) {
        await tx.funcionarioTelefone.deleteMany({ where: { id_funcionario: id } });
        for (const t of data.telefones) {
          await tx.funcionarioTelefone.create({
            data: { id_funcionario: id, numero: t.numero, tipo: t.tipo, principal: t.principal },
          });
        }
      }

      await registrarAuditoria(
        id_usuario,
        data.ativo === false && antes.ativo ? "DESATIVAR" : "ALTERAR",
        AUDIT_ENTIDADE,
        id,
        { nome: antes.pessoaFisica.nome, cargo: antes.cargo, condutor: antes.condutor, ativo: antes.ativo, codigos: antes.funcionarioCodigos.map((c) => ({ id_tipo_codigo: c.id_tipo_codigo, codigo: c.codigo })), emails: antes.emails.map((e) => ({ endereco: e.endereco, principal: e.principal })), telefones: antes.telefones.map((t) => ({ numero: t.numero, tipo: t.tipo, principal: t.principal })) },
        { nome: data.nome ?? antes.pessoaFisica.nome, cargo: data.cargo ?? antes.cargo, condutor: depois.condutor, ativo: depois.ativo, codigos: (data.codigos ?? []).map((c) => ({ id_tipo_codigo: c.id_tipo_codigo, codigo: c.codigo })), emails: data.emails ?? [], telefones: data.telefones ?? [] },
        tx,
      );

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

      await registrarAuditoria(
        id_usuario, "EXCLUIR", AUDIT_ENTIDADE, id,
        { id_funcionario: id, id_pessoa_fisica: func.id_pessoa_fisica },
        null,
        tx,
      );
    });
  }
}

export const funcionarioDAO = new FuncionarioDAO();
