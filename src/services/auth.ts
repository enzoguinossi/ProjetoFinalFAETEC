import { prisma } from "@/lib/prisma";

export class AuthService {
  async login(login: string, senha: string) {
    const usuario = await prisma.usuario.findUnique({
      where: { login },
      include: {
        funcionario: {
          include: { pessoaFisica: true },
        },
      },
    });

    if (!usuario || !usuario.ativo) return null;

    // TODO: bcrypt compare when auth is implemented
    if (usuario.senha_hash !== senha) return null;

    return {
      id_usuario: usuario.id_usuario,
      login: usuario.login,
      nome: usuario.funcionario.pessoaFisica.nome,
      super_admin: usuario.super_admin,
    };
  }
}

export const authService = new AuthService();