import { NextResponse } from "next/server";
import { produtoDAO } from "@/dao/produto";

export async function GET() {
  const { data } = await produtoDAO.list();
  const list = data.map((p, i) => ({
    codigo: String(i + 1).padStart(6, "0"),
    descricao: p.descricao,
    qtd: "0",
    livre: "0",
  }));
  return NextResponse.json(list);
}