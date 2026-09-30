"use server";
import { prisma } from "@/lib/prisma";

export type DestinatarioListRow = {
  id_destinatario: number;
  codigo: string;
  razao: string;
};

export async function searchDestinatariosList(query: string): Promise<DestinatarioListRow[]> {
  if (query.length < 2) return [];
  const data = await prisma.destinatario.findMany({
    where: { ativo: true, pessoaJuridica: { razao_social: { contains: query } } },
    include: { pessoaJuridica: true },
    take: 50, orderBy: { id_destinatario: "desc" },
  });
  return data.map((d, i) => ({
    id_destinatario: d.id_destinatario,
    codigo: String(i + 1).padStart(3, "0"),
    razao: d.pessoaJuridica.razao_social,
  }));
}