import { NextResponse } from "next/server";
import { veiculoDAO } from "@/dao/veiculo";

export async function GET() {
  const { data } = await veiculoDAO.list();
  const list = data.map((v) => ({
    descricao: v.modelo ?? v.placa,
    placa: v.placa,
    status: v.status === "DISPONIVEL" ? "Ativo" : v.status === "EM_ROTA" ? "Em rota" : "Indisponível",
  }));
  return NextResponse.json(list);
}