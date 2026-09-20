import { NextResponse } from "next/server";
import { condutorDAO } from "@/dao/condutor";

export async function GET() {
  const { data } = await condutorDAO.list();
  const list = data.map((c, i) => ({
    codigo: String(i + 1).padStart(3, "0"),
    nome: c.funcionario.pessoaFisica.nome,
    cnh: c.numero_cnh ?? "",
  }));
  return NextResponse.json(list);
}