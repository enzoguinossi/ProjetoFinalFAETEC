import { prisma } from "@/lib/prisma";

export class PermissaoService {
  async listarPorUsuario(id_usuario: number) {
    const permissoes = await prisma.usuarioPermissao.findMany({
      where: { id_usuario },
      include: { permissao: true },
    });
    return permissoes.map((up) => up.permissao.nome);
  }

  async verificar(id_usuario: number, permissao: string) {
    const usuario = await prisma.usuario.findUnique({
      where: { id_usuario },
    });
    if (usuario?.super_admin) return true;

    const count = await prisma.usuarioPermissao.count({
      where: { id_usuario, permissao: { nome: permissao } },
    });
    return count > 0;
  }

  async aplicarPerfil(id_usuario: number, id_perfil: number) {
    const permIds = (
      await prisma.perfilPermissao.findMany({
        where: { id_perfil },
        select: { id_permissao: true },
      })
    ).map((p) => p.id_permissao);

    await prisma.$transaction([
      prisma.usuarioPermissao.deleteMany({ where: { id_usuario } }),
      prisma.usuarioPermissao.createMany({
        data: permIds.map((id_permissao) => ({ id_usuario, id_permissao })),
      }),
    ]);
  }
}

export const permissaoService = new PermissaoService();