import { NextResponse } from "next/server";
import { destinatarioDAO } from "@/dao/destinatario";

export async function GET() {
  const { data } = await destinatarioDAO.list();
  const list = data.map((d, i) => ({
    codigo: String(i + 1).padStart(3, "0"),
    razao: d.pessoaJuridica.razao_social,
  }));
  return NextResponse.json(list);
}