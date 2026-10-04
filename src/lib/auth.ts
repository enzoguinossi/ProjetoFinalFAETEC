import { redirect } from "next/navigation";
import { getAuthToken, clearAuthCookie } from "./cookies";
import { verifyToken } from "./jwt";
import { prisma } from "./prisma";
import type { TokenPayload } from "./jwt";

export type Session = TokenPayload;

/** Limpa o cookie de sessão quando possível (ignora renders/RSC sem permissão de escrita). */
async function limparSessaoInvalida() {
  try {
    await clearAuthCookie();
  } catch {
    // Em RSC/página o cookie não pode ser alterado; o proxy/redirect cuidam do acesso.
  }
}

/**
 * Verifica o token e revalida o usuário no banco:
 * - rejeita se o usuário não existir mais ou estiver inativo;
 * - rejeita se a senha foi alterada depois da emissão do token (sv).
 * Se o token existir mas o usuário não, limpa o cookie inválido.
 */
export async function getSession(): Promise<Session | null> {
  const token = await getAuthToken();
  if (!token) return null;

  const payload = await verifyToken(token);
  if (!payload) {
    await limparSessaoInvalida();
    return null;
  }

  const usuario = await prisma.usuario.findUnique({
    where: { id_usuario: payload.id_usuario },
    select: { ativo: true, super_admin: true, senha_alterada_em: true },
  });

  // Usuário removido (ex.: banco resetado) ou inativo → sessão inválida.
  if (!usuario || !usuario.ativo) {
    await limparSessaoInvalida();
    return null;
  }

  const senhaAlteradaEm = usuario.senha_alterada_em?.getTime() ?? 0;
  if (senhaAlteradaEm !== payload.sv) {
    await limparSessaoInvalida();
    return null;
  }

  return {
    ...payload,
    super_admin: usuario.super_admin,
  };
}

export async function getCurrentUser(): Promise<Session | null> {
  return getSession();
}

/**
 * Garante uma sessão válida. Se não houver, limpa o cookie e redireciona
 * para o login em vez de lançar erro.
 */
export async function requireUser(): Promise<Session> {
  const user = await getSession();
  if (!user) redirect("/login");
  return user;
}
