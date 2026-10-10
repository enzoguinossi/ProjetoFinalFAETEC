import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/dao/_audit";

export type PermissaoItem = { id_permissao: number; nome: string; descricao: string | null };
export type PerfilItem = { id_perfil: number; nome: string; descricao: string | null };
export type GrupoPermissoes = { prefixo: string; permissoes: PermissaoItem[] };

export class PermissaoService {
  async listarPorUsuario(id_usuario: number) {
    const permissoes = await prisma.usuarioPermissao.findMany({
      where: { id_usuario },
      include: { permissao: true },
    });
    return permissoes.map((up) => up.permissao.nome);
  }

  async listarTodas(): Promise<PermissaoItem[]> {
    const permissoes = await prisma.permissao.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
    });
    return permissoes.map((p) => ({ id_permissao: p.id_permissao, nome: p.nome, descricao: p.descricao }));
  }

  async listarTodasAgrupadas(): Promise<GrupoPermissoes[]> {
    const todas = await this.listarTodas();
    const mapa = new Map<string, PermissaoItem[]>();
    for (const p of todas) {
      const prefixo = p.nome.split(".")[0] ?? "outros";
      const lista = mapa.get(prefixo) ?? [];
      lista.push(p);
      mapa.set(prefixo, lista);
    }
    return [...mapa.entries()].map(([prefixo, permissoes]) => ({ prefixo, permissoes }));
  }

  /** Lista os perfis com suas permissões em uma única consulta. */
  async listarPerfisComPermissoes(): Promise<(PerfilItem & { permissoes: string[] })[]> {
    const perfis = await prisma.perfil.findMany({
      orderBy: { nome: "asc" },
      include: { permissoes: { include: { permissao: true } } },
    });
    return perfis.map((p) => ({
      id_perfil: p.id_perfil,
      nome: p.nome,
      descricao: p.descricao,
      permissoes: p.permissoes.map((pp) => pp.permissao.nome),
    }));
  }

  async getPerfil(id_perfil: number) {
    return prisma.perfil.findUnique({ where: { id_perfil } });
  }

  /** Cria um perfil-template com as permissões informadas. */
  async criarPerfil(
    data: { nome: string; descricao?: string; permissoes: string[] },
  ) {
    const permissoes = await prisma.permissao.findMany({
      where: { nome: { in: data.permissoes }, ativo: true },
      select: { id_permissao: true },
    });

    return prisma.$transaction(async (tx) => {
      const perfil = await tx.perfil.create({
        data: { nome: data.nome, descricao: data.descricao },
      });
      if (permissoes.length > 0) {
        await tx.perfilPermissao.createMany({
          data: permissoes.map((p) => ({ id_perfil: perfil.id_perfil, id_permissao: p.id_permissao })),
        });
      }
      return perfil;
    });
  }

  /** Atualiza um perfil-template; não afeta usuários já vinculados (não há vínculo). */
  async alterarPerfil(
    id_perfil: number,
    data: { nome?: string; descricao?: string; permissoes?: string[] },
  ) {
    const permissoes = data.permissoes
      ? await prisma.permissao.findMany({
          where: { nome: { in: data.permissoes }, ativo: true },
          select: { id_permissao: true },
        })
      : null;

    return prisma.$transaction(async (tx) => {
      const perfil = await tx.perfil.update({
        where: { id_perfil },
        data: { nome: data.nome, descricao: data.descricao },
      });
      if (permissoes) {
        await tx.perfilPermissao.deleteMany({ where: { id_perfil } });
        if (permissoes.length > 0) {
          await tx.perfilPermissao.createMany({
            data: permissoes.map((p) => ({ id_perfil, id_permissao: p.id_permissao })),
          });
        }
      }
      return perfil;
    });
  }

  /**
   * Exclui fisicamente um perfil-template. Perfis não possuem vínculo com
   * nenhuma entidade: as permissões já aplicadas aos usuários permanecem.
   */
  async excluirPerfil(id_perfil: number, id_usuario_resp: number) {
    const antes = await prisma.perfil.findUniqueOrThrow({
      where: { id_perfil },
      include: { permissoes: { include: { permissao: true } } },
    });

    await prisma.$transaction(async (tx) => {
      await tx.perfilPermissao.deleteMany({ where: { id_perfil } });
      await tx.perfil.delete({ where: { id_perfil } });
      await registrarAuditoria(
        id_usuario_resp,
        "EXCLUIR",
        "Perfil",
        id_perfil,
        {
          nome: antes.nome,
          descricao: antes.descricao,
          permissoes: antes.permissoes.map((p) => p.permissao.nome).sort(),
        },
        null,
        tx,
      );
    });
  }

  /** Permissões (nomes) de um perfil. */
  async permissoesDoPerfil(id_perfil: number): Promise<string[]> {
    const rows = await prisma.perfilPermissao.findMany({
      where: { id_perfil },
      include: { permissao: true },
    });
    return rows.map((r) => r.permissao.nome);
  }

  /**
   * Substitui as permissões do usuário pela lista informada, dentro de uma
   * transação e com registro de auditoria.
   */
  async salvarPermissoes(
    id_usuario: number,
    nomes: string[],
    id_usuario_resp: number,
  ) {
    const alvo = await prisma.usuario.findUniqueOrThrow({
      where: { id_usuario },
      include: { permissoes: { include: { permissao: true } } },
    });
    if (alvo.super_admin) {
      throw new Error("Não é possível alterar permissões do Super Admin.");
    }

    const permissoes = await prisma.permissao.findMany({
      where: { nome: { in: nomes }, ativo: true },
      select: { id_permissao: true },
    });
    const ids = permissoes.map((p) => p.id_permissao);
    const anteriores = alvo.permissoes.map((p) => p.permissao.nome).sort();

    await prisma.$transaction(async (tx) => {
      await tx.usuarioPermissao.deleteMany({ where: { id_usuario } });
      await tx.usuarioPermissao.createMany({
        data: ids.map((id_permissao) => ({ id_usuario, id_permissao })),
      });
      await registrarAuditoria(
        id_usuario_resp,
        "ALTERAR",
        "UsuarioPermissao",
        id_usuario,
        { permissoes: anteriores },
        { permissoes: [...nomes].sort() },
        tx,
      );
    });
  }
}

export const permissaoService = new PermissaoService();
