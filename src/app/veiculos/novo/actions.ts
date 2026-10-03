"use server";

import { veiculoDAO } from "@/dao/veiculo";
import { requireUser } from "@/lib/auth";
import { usuarioPode, usuarioPodeAlguma } from "@/lib/permissoes";
import { EntidadeComVinculosError } from "@/dao/_errors";

export type VeiculoFormData = {
  id_veiculo: number;
  placa: string;
  modelo: string | null;
  capacidade: number | null;
  status: "DISPONIVEL" | "INDISPONIVEL" | "EM_ROTA";
  ativo: boolean;
};

export async function createVeiculo(formData: FormData) {
  const user = await requireUser();
  if (!(await usuarioPode(user, "veiculo.criar"))) return { error: "Sem permissão." };

  const placa = formData.get("placa") as string;
  if (!placa?.trim()) return { error: "Placa é obrigatória" };

  await veiculoDAO.create({
    placa: placa.trim().toUpperCase(),
    modelo: (formData.get("modelo") as string) || undefined,
    capacidade: formData.get("capacidade") ? Number(formData.get("capacidade")) : undefined,
  }, user.id_usuario);

  return { success: true };
}

export async function getVeiculo(id: number): Promise<VeiculoFormData | null> {
  const user = await requireUser();
  if (!(await usuarioPodeAlguma(user, ["veiculo.consultar", "veiculo.alterar"]))) return null;

  const v = await veiculoDAO.getById(id);
  if (!v) return null;
  return {
    id_veiculo: v.id_veiculo,
    placa: v.placa,
    modelo: v.modelo,
    capacidade: v.capacidade,
    status: v.status,
    ativo: v.ativo,
  };
}

export async function updateVeiculo(formData: FormData) {
  const id = Number(formData.get("id_veiculo"));
  if (!id) return { error: "ID inválido" };

  const user = await requireUser();
  if (!(await usuarioPode(user, "veiculo.alterar"))) return { error: "Sem permissão." };

  const ativo = formData.get("ativo") === "on";
  if (!ativo && !(await usuarioPode(user, "veiculo.desativar"))) {
    return { error: "Sem permissão para desativar." };
  }

  await veiculoDAO.update(id, {
    placa: (formData.get("placa") as string)?.trim().toUpperCase(),
    modelo: (formData.get("modelo") as string) || undefined,
    capacidade: formData.get("capacidade") ? Number(formData.get("capacidade")) : undefined,
    status: formData.get("status") as "DISPONIVEL" | "INDISPONIVEL" | "EM_ROTA",
  }, user.id_usuario);

  if (!ativo) await veiculoDAO.softDelete(id, user.id_usuario);

  return { success: true };
}

export async function deleteVeiculo(id: number) {
  const user = await requireUser();
  if (!(await usuarioPode(user, "veiculo.excluir"))) return { error: "Sem permissão." };

  const { podeExcluir, vinculos } = await veiculoDAO.verificarRelacionamentos(id);
  if (!podeExcluir) return { error: `Não é possível excluir pois possui ${vinculos.join(", ")}.` };

  try {
    await veiculoDAO.hardDelete(id, user.id_usuario);
  } catch (e) {
    if (e instanceof EntidadeComVinculosError) return { error: e.message };
    throw e;
  }
  return { success: true };
}