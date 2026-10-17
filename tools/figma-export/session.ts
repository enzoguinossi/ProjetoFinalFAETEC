/**
 * Emissão da sessão usada pela colheita.
 *
 * Reaproveita `signToken` da própria aplicação (`src/lib/jwt.ts`) para que o
 * token tenha exatamente o mesmo formato/segredo que o proxy e as páginas
 * esperam — inclusive o campo `sv`, que precisa bater com
 * `usuario.senha_alterada_em`.
 *
 * Nenhum segredo é escrito em disco: o token vive apenas em memória.
 */
import "./bootstrap";
import { signToken } from "../../src/lib/jwt";
import { prisma } from "../../src/lib/prisma";

export const COOKIE_NAME = "nexus_token";

export interface Sessao {
  token: string;
  login: string;
  id_usuario: number;
}

/**
 * Monta um token válido para o usuário informado (por padrão o Super Admin).
 * Lança se não existir usuário — o que normalmente significa que os fixtures
 * ainda não foram aplicados.
 */
export async function criarSessao(login?: string): Promise<Sessao> {
  const usuario = login
    ? await prisma.usuario.findUnique({ where: { login } })
    : await prisma.usuario.findFirst({ where: { super_admin: true } });

  if (!usuario) {
    throw new Error(
      "Nenhum usuário encontrado no banco de exportação. Rode os fixtures (passo 2) antes.",
    );
  }

  const token = await signToken({
    id_usuario: usuario.id_usuario,
    login: usuario.login,
    super_admin: usuario.super_admin,
    sv: usuario.senha_alterada_em?.getTime() ?? 0,
  });

  return { token, login: usuario.login, id_usuario: usuario.id_usuario };
}
