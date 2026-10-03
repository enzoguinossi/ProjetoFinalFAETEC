import { getAuthToken } from "./cookies";
import { verifyToken } from "./jwt";
import { prisma } from "./prisma";
import type { TokenPayload } from "./jwt";

export type Session = TokenPayload;

/**
 * Verifica o token e revalida o usuário no banco:
 * - rejeita se o usuário não existir mais ou estiver inativo;
 * - rejeita se a senha foi alterada depois da emissão do token (sv).
 */
export async function getSession(): Promise<Session | null> {
  const token = await getAuthToken();
  if (!token) return null;

  const payload = await verifyToken(token);
  if (!payload) return null;

  const usuario = await prisma.usuario.findUnique({
    where: { id_usuario: payload.id_usuario },
    select: { ativo: true, super_admin: true, senha_alterada_em: true },
  });

  if (!usuario || !usuario.ativo) return null;

  const senhaAlteradaEm = usuario.senha_alterada_em?.getTime() ?? 0;
  if (senhaAlteradaEm !== payload.sv) return null;

  return {
    ...payload,
    super_admin: usuario.super_admin,
  };
}

export async function getCurrentUser(): Promise<Session | null> {
  return getSession();
}

export async function requireUser(): Promise<Session> {
  const user = await getSession();
  if (!user) throw new Error("Não autenticado");
  return user;
}
