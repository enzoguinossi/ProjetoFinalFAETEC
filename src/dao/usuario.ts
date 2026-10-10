import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { registrarAuditoria } from "./_audit";
import { EntidadeComVinculosError } from "./_errors";
import { buildPagination, type ListParams } from "@/types";

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

  async list(params: ListParams = {}) {
    const { skip, take } = buildPagination(params);
    const where: Prisma.UsuarioWhereInput = { ativo: true };
    if (params.search) {
      where.OR = [
        { login: { contains: params.search } },
        { funcionario: { pessoaFisica: { nome: { contains: params.search } } } },
      ];
    }
    const [data, total] = await Promise.all([
      prisma.usuario.findMany({
        skip, take,
        where,
        include: { funcionario: { include: { pessoaFisica: true } } },
        orderBy: { id_usuario: "asc" },
      }),
      prisma.usuario.count({ where }),
    ]);
    return { data, total, page: params.page ?? 1, limit: take, totalPages: Math.ceil(total / take) };
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
      await registrarAuditoria(
        u.id_usuario, "CRIAR", AUDIT_ENTIDADE, u.id_usuario,
        null,
        { login: data.login, super_admin: true },
        tx,
      );
      return u;
    });
  }

  async definirSenha(id: number, senha_hash: string, quando: Date, id_usuario: number) {
    return prisma.$transaction(async (tx) => {
      const u = await tx.usuario.update({
        where: { id_usuario: id },
        data: { senha_hash, senha_alterada_em: quando, ultimo_acesso: quando },
      });
      await registrarAuditoria(
        id_usuario, "DEFINIR_SENHA", AUDIT_ENTIDADE, id,
        null,
        { senha_definida: true },
        tx,
      );
      return u;
    });
  }

  async create(
    data: { id_funcionario: number; login: string; senha_hash: string | null; super_admin?: boolean },
    id_usuario: number,
  ) {
    const created = await prisma.$transaction(async (tx) => {
      const u = await tx.usuario.create({ data });
      await registrarAuditoria(
        id_usuario, "CRIAR", AUDIT_ENTIDADE, u.id_usuario,
        null,
        { login: data.login, super_admin: data.super_admin ?? false },
        tx,
      );
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
      await registrarAuditoria(
        id_usuario_resp,
        data.ativo === false && antes.ativo ? "DESATIVAR" : "ALTERAR",
        AUDIT_ENTIDADE,
        id,
        { login: antes.login, super_admin: antes.super_admin, ativo: antes.ativo },
        { login: depois.login, super_admin: depois.super_admin, ativo: depois.ativo },
        tx,
      );
      return depois;
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
      await registrarAuditoria(
        id_usuario_resp, "EXCLUIR", AUDIT_ENTIDADE, id,
        { id_usuario: id },
        null,
        tx,
      );
    });
  }
}

export const usuarioDAO = new UsuarioDAO();