"use server";

import { conversaoUnidadeDAO } from "@/dao/conversao-unidade";
import { requireUser } from "@/lib/auth";
import { usuarioPode, usuarioPodeAlguma } from "@/lib/permissoes";

export type UnidadeFormData = {
  id_conversao: number;
  nome: string;
  fator: number;
  descricao: string | null;
};

export async function listarUnidades() {
  const user = await requireUser();
  if (!(await usuarioPodeAlguma(user, ["unidade_conversao.listar", "unidade_conversao.consultar", "produto.criar", "produto.alterar"]))) {
    return [];
  }
  return conversaoUnidadeDAO.list();
}

export async function getUnidade(id: number): Promise<UnidadeFormData | null> {
  const user = await requireUser();
  if (!(await usuarioPodeAlguma(user, ["unidade_conversao.consultar", "unidade_conversao.alterar"]))) return null;

  const u = await conversaoUnidadeDAO.getById(id);
  if (!u) return null;
  return { id_conversao: u.id_conversao, nome: u.nome, fator: u.fator, descricao: u.descricao };
}

export async function createUnidade(formData: FormData) {
  const user = await requireUser();
  if (!(await usuarioPode(user, "unidade_conversao.criar"))) return { error: "Sem permissão." };

  const nome = (formData.get("nome") as string)?.trim();
  const fator = Number(formData.get("fator"));
  if (!nome) return { error: "Nome é obrigatório." };
  if (!fator || fator <= 0) return { error: "Fator deve ser maior que zero." };

  const existente = (await conversaoUnidadeDAO.list()).find(
    (u) => u.nome.toLowerCase() === nome.toLowerCase(),
  );
  if (existente) return { error: "Já existe uma unidade com esse nome." };

  await conversaoUnidadeDAO.create(
    { nome, fator, descricao: (formData.get("descricao") as string) || undefined },
    user.id_usuario,
  );

  return { success: true };
}

export async function updateUnidade(formData: FormData) {
  const id = Number(formData.get("id_conversao"));
  if (!id) return { error: "ID inválido." };

  const user = await requireUser();
  if (!(await usuarioPode(user, "unidade_conversao.alterar"))) return { error: "Sem permissão." };

  const nome = (formData.get("nome") as string)?.trim();
  const fator = Number(formData.get("fator"));
  if (!nome) return { error: "Nome é obrigatório." };
  if (!fator || fator <= 0) return { error: "Fator deve ser maior que zero." };

  const existente = (await conversaoUnidadeDAO.list()).find(
    (u) => u.nome.toLowerCase() === nome.toLowerCase() && u.id_conversao !== id,
  );
  if (existente) return { error: "Já existe uma unidade com esse nome." };

  await conversaoUnidadeDAO.update(
    id,
    { nome, fator, descricao: (formData.get("descricao") as string) || undefined },
    user.id_usuario,
  );

  return { success: true };
}

export async function deleteUnidade(id: number) {
  const user = await requireUser();
  if (!(await usuarioPode(user, "unidade_conversao.excluir"))) return { error: "Sem permissão." };

  await conversaoUnidadeDAO.hardDelete(id, user.id_usuario);
  return { success: true };
}
