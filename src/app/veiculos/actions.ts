"use server";

import { prisma } from "@/lib/prisma";

export type VeiculoListRow = {
  id_veiculo: number;
  codigo: string;
  descricao: string;
  placa: string;
  status: string;
};

export async function searchVeiculosList(query: string): Promise<VeiculoListRow[]> {
  if (query.length < 2) return [];
  const data = await prisma.veiculo.findMany({
    where: { ativo: true, OR: [{ placa: { contains: query } }, { modelo: { contains: query } }] },
    take: 50,
    orderBy: { placa: "asc" },
  });
  return data.map((v, i) => ({
    id_veiculo: v.id_veiculo,
    codigo: String(i + 1).padStart(3, "0"),
    descricao: v.modelo ?? v.placa,
    placa: v.placa,
    status: v.status === "DISPONIVEL" ? "Ativo" : v.status === "EM_ROTA" ? "Em rota" : "Indisponível",
  }));
}