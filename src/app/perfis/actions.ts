"use server";

import { permissaoService } from "@/services/permissao";
import { requireUser } from "@/lib/auth";
import { usuarioPode, usuarioPodeAlguma } from "@/lib/permissoes";
import { parsePermissoes } from "@/lib/form-data";

export type PerfilListRow = {
  id_perfil: number;
  nome: string;
  descricao: string | null;
  permissoes: string[];
};

export type PerfilFormData = {
  id_perfil: number;
  nome: string;
  descricao: string | null;
  permissoes: string[];
};

export async function listarPerfisComPermissoes(): Promise<PerfilListRow[]> {
  const user = await requireUser();
  if (!(await usuarioPodeAlguma(user, ["perfil.listar", "perfil.consultar", "perfil.criar", "perfil.alterar"]))) {
    return [];
  }
  const perfis = await permissaoService.listarPerfis();
  return Promise.all(
    perfis.map(async (p) => ({
      id_perfil: p.id_perfil,
      nome: p.nome,
      descricao: p.descricao,
      permissoes: await permissaoService.permissoesDoPerfil(p.id_perfil),
    })),
  );
}

export async function listarPermissoesAgrupadas() {
  const user = await requireUser();
  if (!(await usuarioPodeAlguma(user, ["perfil.listar", "perfil.consultar", "perfil.criar", "perfil.alterar"]))) {
    return [];
  }
  return permissaoService.listarTodasAgrupadas();
}

export async function getPerfil(id: number): Promise<PerfilFormData | null> {
  const user = await requireUser();
  if (!(await usuarioPodeAlguma(user, ["perfil.consultar", "perfil.alterar"]))) return null;

  const p = await permissaoService.getPerfil(id);
  if (!p) return null;
  return {
    id_perfil: p.id_perfil,
    nome: p.nome,
    descricao: p.descricao,
    permissoes: await permissaoService.permissoesDoPerfil(id),
  };
}

export async function createPerfil(formData: FormData) {
  const user = await requireUser();
  if (!(await usuarioPode(user, "perfil.criar"))) return { error: "Sem permissão." };

  const nome = (formData.get("nome") as string)?.trim();
  if (!nome) return { error: "Nome é obrigatório." };

  await permissaoService.criarPerfil({
    nome,
    descricao: (formData.get("descricao") as string) || undefined,
    permissoes: parsePermissoes(formData),
  });

  return { success: true };
}

export async function updatePerfil(formData: FormData) {
  const id = Number(formData.get("id_perfil"));
  if (!id) return { error: "ID inválido." };

  const user = await requireUser();
  if (!(await usuarioPode(user, "perfil.alterar"))) return { error: "Sem permissão." };

  const nome = (formData.get("nome") as string)?.trim();
  if (!nome) return { error: "Nome é obrigatório." };

  await permissaoService.alterarPerfil(id, {
    nome,
    descricao: (formData.get("descricao") as string) || undefined,
    permissoes: parsePermissoes(formData),
  });

  return { success: true };
}

export async function desativarPerfil(id: number) {
  const user = await requireUser();
  if (!(await usuarioPode(user, "perfil.desativar"))) return { error: "Sem permissão." };

  await permissaoService.desativarPerfil(id);
  return { success: true };
}
