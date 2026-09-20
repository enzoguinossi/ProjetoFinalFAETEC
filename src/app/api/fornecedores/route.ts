import { NextResponse } from "next/server";
import { fornecedorDAO } from "@/dao/fornecedor";

export async function GET() {
  const { data } = await fornecedorDAO.list();
  const list = data.map((f, i) => ({
    codigo: String(i + 1).padStart(3, "0"),
    razao: f.pessoaJuridica.razao_social,
  }));
  return NextResponse.json(list);
}