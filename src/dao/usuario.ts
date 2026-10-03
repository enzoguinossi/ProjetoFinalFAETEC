import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { EntidadeComVinculosError } from "./_errors";

const AUDIT_ENTIDADE = "Usuario";

type Db = Prisma.TransactionClient;

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

  async getByLoginComFuncionario(login: string) {
    return prisma.usuario.findUnique({
      where: { login },
      include: { funcionario: { include: { pessoaFisica: true } } },
    });
  }

  async existeLogin(login: string) {
    return prisma.usuario.findUnique({ where: { login }, select: { id_usuario: true } });
  }

  async getAdmin() {
    return prisma.usuario.findFirst({ where: { super_admin: true }, select: { id_usuario: true } });
  }

  async existeSuperAdmin() {
    return prisma.usuario.findFirst({ where: { super_admin: true }, select: { id_usuario: true } });
  }

  async list() {
    return prisma.usuario.findMany({
      where: { ativo: true },
      include: { funcionario: { include: { pessoaFisica: true } } },
      orderBy: { id_usuario: "asc" },
    });
  }

  async search(query: string, take = 50) {
    return prisma.usuario.findMany({
      where: {
        ativo: true,
        OR: [
          { login: { contains: query } },
          { funcionario: { pessoaFisica: { nome: { contains: query } } } },
        ],
      },
      include: { funcionario: { include: { pessoaFisica: true } } },
      take,
      orderBy: { id_usuario: "asc" },
    });
  }

  async registrarAcesso(id: number) {
    return prisma.usuario.update({ where: { id_usuario: id }, data: { ultimo_acesso: new Date() } });
  }

  async criarSuperAdmin(data: { nome: string; login: string; senha_hash: string }) {
    return prisma.$transaction(async (tx) => {
      const pf = await tx.pessoaFisica.create({ data: { nome: data.nome } });
      const func = await tx.funcionario.create({
        data: { id_pessoa_fisica: pf.id_pessoa_fisica, cargo: "Administrador" },
      });
      const u = await tx.usuario.create({
        data: {
          id_funcionario: func.id_funcionario,
          login: data.login,
          senha_hash: data.senha_hash,
          senha_alterada_em: new Date(),
          super_admin: true,
        },
      });
      await tx.registroAuditoria.create({
        data: {
          id_usuario: u.id_usuario,
          acao: "CRIAR",
          data_hora: new Date(),
          entidade: AUDIT_ENTIDADE,
          id_entidade_afetada: u.id_usuario,
          dados_novos: { login: data.login, super_admin: true },
        },
      });
      return u;
    });
  }

  async definirSenha(id: number, senha_hash: string, quando: Date, id_usuario: number) {
    return prisma.$transaction(async (tx) => {
      const u = await tx.usuario.update({
        where: { id_usuario: id },
        data: { senha_hash, senha_alterada_em: quando, ultimo_acesso: quando },
      });
      await tx.registroAuditoria.create({
        data: {
          id_usuario,
          acao: "DEFINIR_SENHA",
          data_hora: new Date(),
          entidade: AUDIT_ENTIDADE,
          id_entidade_afetada: id,
          dados_novos: { senha_definida: true },
        },
      });
      return u;
    });
  }

  async create(
    data: { id_funcionario: number; login: string; senha_hash: string | null; super_admin?: boolean },
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
      const u = await tx.usuario.update({
        where: { id_usuario: id },
        data: { senha_hash, senha_alterada_em: new Date() },
      });
      await tx.registroAuditoria.create({
        data: { id_usuario, acao: "ALTERAR", data_hora: new Date(), entidade: AUDIT_ENTIDADE, id_entidade_afetada: id, dados_novos: { senha_alterada: true } },
      });
      return u;
    });
  }

  async verificarRelacionamentos(id: number, client: Db = prisma) {
    const [movimentacoes, reservas, registros, mensagens, inventariosAbertos, inventariosAprovados, ajustesAprovados] = await Promise.all([
      client.movimentacaoEstoque.count({ where: { id_usuario: id } }),
      client.reservaEstoque.count({ where: { id_usuario: id } }),
      client.registroAuditoria.count({ where: { id_usuario: id } }),
      client.mensagemMural.count({ where: { id_usuario: id } }),
      client.inventario.count({ where: { id_usuario_abertura: id } }),
      client.inventario.count({ where: { id_usuario_aprovacao: id } }),
      client.ajusteInventario.count({ where: { id_usuario_aprovacao: id } }),
    ]);

    const vinculos: string[] = [];
    if (movimentacoes > 0) vinculos.push(`${movimentacoes} movimentação(ões)`);
    if (reservas > 0) vinculos.push(`${reservas} reserva(s)`);
    if (registros > 0) vinculos.push(`${registros} registro(s) de auditoria`);
    if (mensagens > 0) vinculos.push(`${mensagens} mensagen(s) no mural`);
    if (inventariosAbertos > 0) vinculos.push(`${inventariosAbertos} inventário(s) aberto(s)`);
    if (inventariosAprovados > 0) vinculos.push(`${inventariosAprovados} inventário(s) aprovado(s)`);
    if (ajustesAprovados > 0) vinculos.push(`${ajustesAprovados} ajuste(s) de inventário aprovado(s)`);

    return { podeExcluir: vinculos.length === 0, vinculos };
  }

  async hardDelete(id: number, id_usuario_resp: number) {
    await prisma.$transaction(async (tx) => {
      const { podeExcluir, vinculos } = await this.verificarRelacionamentos(id, tx);
      if (!podeExcluir) throw new EntidadeComVinculosError("este usuário", vinculos);

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