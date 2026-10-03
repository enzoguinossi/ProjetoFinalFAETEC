"use server";

import { veiculoDAO } from "@/dao/veiculo";
import { requireUser } from "@/lib/auth";
import { usuarioPode } from "@/lib/permissoes";

export type VeiculoListRow = {
  id_veiculo: number;
  codigo: string;
  descricao: string;
  placa: string;
  status: string;
};

export async function searchVeiculosList(query: string): Promise<VeiculoListRow[]> {
  if (query.length < 2) return [];
  const user = await requireUser();
  if (!(await usuarioPode(user, "veiculo.listar"))) return [];
  const data = await veiculoDAO.search(query);
  return data.map((v, i) => ({
    id_veiculo: v.id_veiculo,
    codigo: String(i + 1).padStart(3, "0"),
    descricao: v.modelo ?? v.placa,
    placa: v.placa,
    status: v.status === "DISPONIVEL" ? "Ativo" : v.status === "EM_ROTA" ? "Em rota" : "Indisponível",
  }));
}