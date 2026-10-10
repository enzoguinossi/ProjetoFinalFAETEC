import { cache } from "react";
import { requireUser } from "./auth";
import type { Session } from "./auth";
import type { TokenPayload } from "./jwt";
import { permissaoService } from "@/services/permissao";
import type { PermissoesEntidade } from "@/types";

export type { PermissoesEntidade };

const PERMISSOES_TODAS: PermissoesEntidade = {
  canList: true,
  canView: true,
  canCreate: true,
  canEdit: true,
  canDelete: true,
  canDeactivate: true,
};

/** Nomes das permissões do usuário, memoizados por request. */
const nomesDePermissoes = cache((id_usuario: number) =>
  permissaoService.listarPorUsuario(id_usuario),
);

export async function resolverPermissoes(entidade: string): Promise<PermissoesEntidade> {
  const user = await requireUser();
  return resolverPermissoesPara(user, entidade);
}

export async function resolverPermissoesPara(
  user: TokenPayload,
  entidade: string,
): Promise<PermissoesEntidade> {
  if (user.super_admin) return PERMISSOES_TODAS;

  const nomes = await nomesDePermissoes(user.id_usuario);
  const has = (acao: string) => nomes.includes(`${entidade}.${acao}`);

  return {
    canList: has("listar"),
    canView: has("consultar"),
    canCreate: has("criar"),
    canEdit: has("alterar"),
    canDelete: has("excluir"),
    canDeactivate: has("desativar"),
  };
}

export async function usuarioPode(user: TokenPayload, permissao: string): Promise<boolean> {
  if (user.super_admin) return true;
  const nomes = await nomesDePermissoes(user.id_usuario);
  return nomes.includes(permissao);
}

export async function usuarioPodeAlguma(
  user: TokenPayload,
  permissoes: string[],
): Promise<boolean> {
  if (user.super_admin) return true;
  const nomes = await nomesDePermissoes(user.id_usuario);
  return permissoes.some((p) => nomes.includes(p));
}

/** Executa a ação autenticada; retorna { error } se o usuário não tiver a permissão. */
export async function comPermissao<T>(
  permissao: string,
  fn: (user: Session) => Promise<T>,
): Promise<T | { error: string }> {
  const user = await requireUser();
  if (!(await usuarioPode(user, permissao))) return { error: "Sem permissão." };
  return fn(user);
}

/** Executa a ação autenticada; retorna { error } se o usuário não tiver nenhuma das permissões. */
export async function comPermissaoAlguma<T>(
  permissoes: string[],
  fn: (user: Session) => Promise<T>,
): Promise<T | { error: string }> {
  const user = await requireUser();
  if (!(await usuarioPodeAlguma(user, permissoes))) return { error: "Sem permissão." };
  return fn(user);
}
