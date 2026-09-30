"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { funcionarioDAO } from "@/dao/funcionario";

export type FuncionarioFormData = {
  id_funcionario: number;
  nome: string;
  cpf: string | null;
  cargo: string | null;
  condutor: boolean;
  ativo: boolean;
};

export async function createFuncionario(formData: FormData) {
  const nome = formData.get("nome") as string;
  if (!nome?.trim()) return { error: "Nome é obrigatório" };

  const user = await requireUser();

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
  const f = await funcionarioDAO.getById(id);
  if (!f) return null;
  return {
    id_funcionario: f.id_funcionario,
    nome: f.pessoaFisica.nome,
    cpf: f.pessoaFisica.cpf,
    cargo: f.cargo,
    condutor: f.condutor?.ativo ?? false,
    ativo: f.ativo,
  };
}

export async function updateFuncionario(formData: FormData) {
  const id = Number(formData.get("id_funcionario"));
  if (!id) return { error: "ID inválido" };

  const nome = formData.get("nome") as string;
  if (!nome?.trim()) return { error: "Nome é obrigatório" };

  const user = await requireUser();

  await funcionarioDAO.update(
    id,
    {
      nome: nome.trim(),
      cargo: (formData.get("cargo") as string) || undefined,
      condutor: formData.get("condutor") === "on",
    },
    user.id_usuario,
  );

  return { success: true };
}

export async function deleteFuncionario(id: number) {
  const user = await requireUser();
  await funcionarioDAO.softDelete(id, user.id_usuario);
  return { success: true };
}