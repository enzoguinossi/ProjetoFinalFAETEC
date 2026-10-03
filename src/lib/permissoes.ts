import { requireUser } from "./auth";
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

export async function resolverPermissoes(entidade: string): Promise<PermissoesEntidade> {
  const user = await requireUser();
  return resolverPermissoesPara(user, entidade);
}

export async function resolverPermissoesPara(
  user: TokenPayload,
  entidade: string,
): Promise<PermissoesEntidade> {
  if (user.super_admin) return PERMISSOES_TODAS;

  const nomes = await permissaoService.listarPorUsuario(user.id_usuario);
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
  return permissaoService.verificar(user.id_usuario, permissao);
}

export async function usuarioPodeAlguma(
  user: TokenPayload,
  permissoes: string[],
): Promise<boolean> {
  if (user.super_admin) return true;
  const nomes = await permissaoService.listarPorUsuario(user.id_usuario);
  return permissoes.some((p) => nomes.includes(p));
}
