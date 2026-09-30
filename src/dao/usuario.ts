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
          acao: "CRIAR", data_hora: new Date(),
          entidade: AUDIT_ENTIDADE,
          id_entidade_afetada: u.id_usuario,
          dados_novos: { login: data.login, super_admin: data.super_admin ?? false },
        },
      });
      return u;
    });
    return created;
  }

  async update(
    id: number,
    data: { login?: string; super_admin?: boolean; ativo?: boolean },
    id_usuario_resp: number,
  ) {
    return prisma.$transaction(async (tx) => {
      const antes = await tx.usuario.findUniqueOrThrow({ where: { id_usuario: id } });
      const depois = await tx.usuario.update({ where: { id_usuario: id }, data });
      await tx.registroAuditoria.create({
        data: {
          id_usuario: id_usuario_resp, acao: "ALTERAR", data_hora: new Date(),
          entidade: AUDIT_ENTIDADE, id_entidade_afetada: id,
          dados_anteriores: { login: antes.login, super_admin: antes.super_admin, ativo: antes.ativo },
          dados_novos: { login: depois.login, super_admin: depois.super_admin, ativo: depois.ativo },
        },
      });
      return depois;
    });
  }

  async updateSenha(id: number, senha_hash: string, id_usuario: number) {
    return prisma.$transaction(async (tx) => {
      const u = await tx.usuario.update({ where: { id_usuario: id }, data: { senha_hash } });
      await tx.registroAuditoria.create({
        data: { id_usuario, acao: "ALTERAR", data_hora: new Date(), entidade: AUDIT_ENTIDADE, id_entidade_afetada: id, dados_novos: { senha_alterada: true } },
      });
      return u;
    });
  }

  async verificarRelacionamentos(id: number) {
    const [movimentacoes, reservas, registros, mensagens, inventariosAbertos, inventariosAprovados] = await Promise.all([
      prisma.movimentacaoEstoque.count({ where: { id_usuario: id } }),
      prisma.reservaEstoque.count({ where: { id_usuario: id } }),
      prisma.registroAuditoria.count({ where: { id_usuario: id } }),
      prisma.mensagemMural.count({ where: { id_usuario: id } }),
      prisma.inventario.count({ where: { id_usuario_abertura: id } }),
      prisma.inventario.count({ where: { id_usuario_aprovacao: id } }),
    ]);

    const vinculos: string[] = [];
    if (movimentacoes > 0) vinculos.push(`${movimentacoes} movimentação(ões)`);
    if (reservas > 0) vinculos.push(`${reservas} reserva(s)`);
    if (registros > 0) vinculos.push(`${registros} registro(s) de auditoria`);
    if (mensagens > 0) vinculos.push(`${mensagens} mensagen(s) no mural`);
    if (inventariosAbertos > 0) vinculos.push(`${inventariosAbertos} inventário(s) aberto(s)`);
    if (inventariosAprovados > 0) vinculos.push(`${inventariosAprovados} inventário(s) aprovado(s)`);

    return { podeExcluir: vinculos.length === 0, vinculos };
  }

  async hardDelete(id: number, id_usuario_resp: number) {
    await prisma.$transaction(async (tx) => {
      await tx.usuarioPermissao.deleteMany({ where: { id_usuario: id } });
      await tx.usuario.delete({ where: { id_usuario: id } });
      await tx.registroAuditoria.create({
        data: {
          id_usuario: id_usuario_resp, acao: "EXCLUIR", data_hora: new Date(),
          entidade: AUDIT_ENTIDADE, id_entidade_afetada: id,
          dados_anteriores: { id_usuario: id },
        },
      });
    });
  }

  async softDelete(id: number, id_usuario: number) {
    return prisma.$transaction(async (tx) => {
      const antes = await tx.usuario.findUniqueOrThrow({ where: { id_usuario: id } });
      const depois = await tx.usuario.update({ where: { id_usuario: id }, data: { ativo: false } });
      await tx.registroAuditoria.create({
        data: {
          id_usuario, acao: "DESATIVAR", data_hora: new Date(),
          entidade: AUDIT_ENTIDADE, id_entidade_afetada: id,
          dados_anteriores: { ativo: antes.ativo },
          dados_novos: { ativo: depois.ativo },
        },
      });
      return depois;
    });
  }
}

export const usuarioDAO = new UsuarioDAO();