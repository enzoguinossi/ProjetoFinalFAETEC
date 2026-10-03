"use server";

import { requireUser } from "@/lib/auth";
import { funcionarioDAO } from "@/dao/funcionario";
import { usuarioPode, usuarioPodeAlguma } from "@/lib/permissoes";
import { EntidadeComVinculosError } from "@/dao/_errors";

export type FuncionarioFormData = {
  id_funcionario: number;
  nome: string;
  cpf: string | null;
  cargo: string | null;
  condutor: boolean;
  ativo: boolean;
};

export async function createFuncionario(formData: FormData) {
  const user = await requireUser();
  if (!(await usuarioPode(user, "funcionario.criar"))) return { error: "Sem permissão." };

  const nome = formData.get("nome") as string;
  if (!nome?.trim()) return { error: "Nome é obrigatório" };

  await funcionarioDAO.create(
    {
      nome: nome.trim(),
      cpf: (formData.get("cpf") as string) || undefined,
      cargo: (formData.get("cargo") as string) || undefined,
      condutor: formData.get("condutor") === "on",
    },
    user.id_usuario,
  );

  return { success: true };
}

export async function getFuncionario(id: number): Promise<FuncionarioFormData | null> {
  const user = await requireUser();
  if (!(await usuarioPodeAlguma(user, ["funcionario.consultar", "funcionario.alterar"]))) return null;

  const f = await funcionarioDAO.getById(id);
  if (!f) return null;
  return {
    id_funcionario: f.id_funcionario,
    nome: f.pessoaFisica.nome,
    cpf: f.pessoaFisica.cpf,
    cargo: f.cargo,
    condutor: f.condutor,
    ativo: f.ativo,
  };
}

export async function updateFuncionario(formData: FormData) {
  const id = Number(formData.get("id_funcionario"));
  if (!id) return { error: "ID inválido" };

  const nome = formData.get("nome") as string;
  if (!nome?.trim()) return { error: "Nome é obrigatório" };

  const user = await requireUser();
  if (!(await usuarioPode(user, "funcionario.alterar"))) return { error: "Sem permissão." };
  const ativo = formData.get("ativo") === "on";
  if (!ativo && !(await usuarioPode(user, "funcionario.desativar"))) {
    return { error: "Sem permissão para desativar." };
  }

  try {
    await funcionarioDAO.update(
      id,
      {
        nome: nome.trim(),
        cargo: (formData.get("cargo") as string) || undefined,
        condutor: formData.get("condutor") === "on",
        ativo,
      },
      user.id_usuario,
    );
  } catch (e) {
    if (e instanceof EntidadeComVinculosError) return { error: e.message };
    throw e;
  }

  return { success: true };
}

export async function deleteFuncionario(id: number) {
  const user = await requireUser();
  if (!(await usuarioPode(user, "funcionario.excluir"))) return { error: "Sem permissão." };

  try {
    await funcionarioDAO.hardDelete(id, user.id_usuario);
  } catch (e) {
    if (e instanceof EntidadeComVinculosError) return { error: e.message };
    throw e;
  }
  return { success: true };
}