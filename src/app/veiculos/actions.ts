"use server";

import { veiculoDAO } from "@/dao/veiculo";
import { codigoService } from "@/services/codigo";
import { requireUser } from "@/lib/auth";
import { comPermissao, usuarioPode, usuarioPodeAlguma } from "@/lib/permissoes";
import { mensagemDeErro } from "@/dao/_errors";
import { formatarCodigo } from "@/lib/formatar";
import { resultadoVazio, type ListParams, type PaginatedResult } from "@/types";

export type VeiculoListRow = {
  id_veiculo: number;
  codigo: string;
  descricao: string;
  placa: string;
  status: string;
};

export type VeiculoFormData = {
  id_veiculo: number;
  placa: string;
  modelo: string | null;
  status: "DISPONIVEL" | "INDISPONIVEL" | "EM_EXPEDICAO";
  ativo: boolean;
  codigos: { tipo: string; valor: string }[];
};

export async function listarVeiculos(
  params: ListParams = {},
): Promise<PaginatedResult<VeiculoListRow>> {
  const user = await requireUser();
  if (!(await usuarioPode(user, "veiculo.listar"))) return resultadoVazio(params);

  const resultado = await veiculoDAO.list(params);
  return {
    ...resultado,
    data: resultado.data.map((v) => ({
      id_veiculo: v.id_veiculo,
      codigo: formatarCodigo(v.id_veiculo),
      descricao: v.modelo ?? v.placa,
      placa: v.placa,
      status:
        v.status === "DISPONIVEL"
          ? "Ativo"
          : v.status === "EM_EXPEDICAO"
            ? "Em expedição"
            : "Indisponível",
    })),
  };
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
    status: v.status,
    ativo: v.ativo,
    codigos: v.veiculoCodigos.map((c) => ({ tipo: c.tipoCodigo.nome, valor: c.codigo })),
  };
}

export async function createVeiculo(formData: FormData) {
  return comPermissao("veiculo.criar", async (user) => {
    const placa = formData.get("placa") as string;
    if (!placa?.trim()) return { error: "Placa é obrigatória" };

    const codigoResult = await codigoService.resolverCodigosParaSalvar("VEICULO", formData);
    if ("error" in codigoResult) return { error: codigoResult.error };

    try {
      await veiculoDAO.create({
        placa: placa.trim().toUpperCase(),
        modelo: (formData.get("modelo") as string) || undefined,
        codigos: codigoResult.codigos,
      }, user.id_usuario);
    } catch (e) {
      return { error: mensagemDeErro(e) };
    }

    return { success: true };
  });
}

export async function updateVeiculo(formData: FormData) {
  return comPermissao("veiculo.alterar", async (user) => {
    const id = Number(formData.get("id_veiculo"));
    if (!id) return { error: "ID inválido" };

    const ativo = formData.get("ativo") === "on";
    if (!ativo && !(await usuarioPode(user, "veiculo.desativar"))) {
      return { error: "Sem permissão para desativar." };
    }

    const codigoResult = await codigoService.resolverCodigosParaSalvar("VEICULO", formData);
    if ("error" in codigoResult) return { error: codigoResult.error };

    try {
      await veiculoDAO.update(id, {
        placa: (formData.get("placa") as string)?.trim().toUpperCase(),
        modelo: (formData.get("modelo") as string) || undefined,
        status: formData.get("status") as "DISPONIVEL" | "INDISPONIVEL" | "EM_EXPEDICAO",
        codigos: codigoResult.codigos,
      }, user.id_usuario);

      if (!ativo) await veiculoDAO.softDelete(id, user.id_usuario);
    } catch (e) {
      return { error: mensagemDeErro(e) };
    }

    return { success: true };
  });
}

export async function deleteVeiculo(id: number) {
  return comPermissao("veiculo.excluir", async (user) => {
    try {
      await veiculoDAO.hardDelete(id, user.id_usuario);
    } catch (e) {
      return { error: mensagemDeErro(e) };
    }
    return { success: true };
  });
}
