import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "./_audit";

const AUDIT_ENTIDADE = "Usuario";

export class UsuarioDAO {
  async getById(id: number) {
    return prisma.usuario.findUnique({
      where: { id_usuario: id },
      include: {
        funcionario: { include: { pessoaFisica: true } },
        permissoes: { include: { permissao: true } },
      },
    });
  }

  async getByLogin(login: string) {
    return prisma.usuario.findUnique({
      where: { login },
      include: {
        funcionario: { include: { pessoaFisica: true } },
        permissoes: { include: { permissao: true } },
      },
    });
  }

  async create(
    data: { id_funcionario: number; login: string; senha_hash: string; super_admin?: boolean },
    id_usuario: number,
  ) {
    const created = await prisma.$transaction(async (tx) => {
      const u = await tx.usuario.create({ data });
      await tx.registroAuditoria.create({
        data: {
          id_usuario,
          acao: "CRIAR",
          entidade: AUDIT_ENTIDADE,
          id_entidade_afetada: u.id_usuario,
          dados_novos: { login: data.login, super_admin: data.super_admin ?? false },
        },
      });
      return u;
    });
    return created;
  }

  async updateSenha(id: number, senha_hash: string, id_usuario: number) {
    return prisma.$transaction(async (tx) => {
      const u = await tx.usuario.update({ where: { id_usuario: id }, data: { senha_hash } });
      await tx.registroAuditoria.create({
        data: { id_usuario, acao: "ALTERAR", entidade: AUDIT_ENTIDADE, id_entidade_afetada: id, dados_novos: { senha_alterada: true } },
      });
      return u;
    });
  }

  async softDelete(id: number, id_usuario: number) {
    const antes = await prisma.usuario.findUniqueOrThrow({ where: { id_usuario: id } });
    const depois = await prisma.usuario.update({ where: { id_usuario: id }, data: { ativo: false } });
    await registrarAuditoria(id_usuario, "DESATIVAR", AUDIT_ENTIDADE, id,
      { ativo: antes.ativo },
      { ativo: depois.ativo },
    );
    return depois;
  }
}

export const usuarioDAO = new UsuarioDAO();