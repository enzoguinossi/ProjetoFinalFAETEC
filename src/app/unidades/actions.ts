"use server";

import { conversaoUnidadeDAO } from "@/dao/conversao-unidade";
import { requireUser } from "@/lib/auth";
import { usuarioPode, usuarioPodeAlguma } from "@/lib/permissoes";
import { mensagemDeErro } from "@/dao/_errors";

export type UnidadeFormData = {
  id_conversao: number;
  nome: string;
  fator: number;
  descricao: string | null;
  padrao: boolean;
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
  return {
    id_conversao: u.id_conversao,
    nome: u.nome,
    fator: u.fator,
    descricao: u.descricao,
    padrao: u.padrao,
  };
}

export async function createUnidade(formData: FormData) {
  const user = await requireUser();
  if (!(await usuarioPode(user, "unidade_conversao.criar"))) return { error: "Sem permissão." };

  const nome = (formData.get("nome") as string)?.trim();
  const fator = Number(formData.get("fator"));
  if (!nome) return { error: "Nome é obrigatório." };
  if (!fator || fator <= 0) return { error: "Fator deve ser maior que zero." };

  const unidades = await conversaoUnidadeDAO.list();
  if (unidades.some((u) => u.nome.toLowerCase() === nome.toLowerCase())) {
    return { error: "Já existe uma unidade com esse nome." };
  }

  try {
    await conversaoUnidadeDAO.create(
      { nome, fator, descricao: (formData.get("descricao") as string) || undefined },
      user.id_usuario,
    );
  } catch (e) {
    return { error: mensagemDeErro(e) };
  }

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

  const atual = await conversaoUnidadeDAO.getById(id);
  if (!atual) return { error: "Registro não encontrado." };

  // A unidade padrão do sistema não pode ter nome ou fator alterados;
  // somente a descrição é editável.
  if (atual.padrao && (nome !== atual.nome || fator !== atual.fator)) {
    return { error: "A unidade padrão não pode ser alterada." };
  }

  const unidades = await conversaoUnidadeDAO.list();
  if (unidades.some((u) => u.nome.toLowerCase() === nome.toLowerCase() && u.id_conversao !== id)) {
    return { error: "Já existe uma unidade com esse nome." };
  }

  try {
    await conversaoUnidadeDAO.update(
      id,
      { nome, fator, descricao: (formData.get("descricao") as string) || undefined },
      user.id_usuario,
    );
  } catch (e) {
    return { error: mensagemDeErro(e) };
  }

  return { success: true };
}

export async function deleteUnidade(id: number) {
  const user = await requireUser();
  if (!(await usuarioPode(user, "unidade_conversao.excluir"))) return { error: "Sem permissão." };

  try {
    await conversaoUnidadeDAO.hardDelete(id, user.id_usuario);
  } catch (e) {
    return { error: mensagemDeErro(e) };
  }
  return { success: true };
}
