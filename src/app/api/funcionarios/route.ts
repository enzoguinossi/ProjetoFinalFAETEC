import { NextResponse } from "next/server";
import { funcionarioDAO } from "@/dao/funcionario";

export async function GET() {
  const { data } = await funcionarioDAO.list();
  const list = data.map((f, i) => ({
    codigo: String(i + 1).padStart(3, "0"),
    nome: f.pessoaFisica.nome,
    cargo: f.cargo ?? "",
  }));
  return NextResponse.json(list);
}