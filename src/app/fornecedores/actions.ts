"use server";
import { prisma } from "@/lib/prisma";

export type FornecedorListRow = { id_fornecedor: number; codigo: string; razao: string };

export async function searchFornecedoresList(query: string): Promise<FornecedorListRow[]> {
  if (query.length < 2) return [];
  const data = await prisma.fornecedor.findMany({
    where: { ativo: true, pessoaJuridica: { razao_social: { contains: query } } },
    include: { pessoaJuridica: true },
    take: 50, orderBy: { id_fornecedor: "desc" },
  });
  return data.map((f, i) => ({ id_fornecedor: f.id_fornecedor, codigo: String(i + 1).padStart(3, "0"), razao: f.pessoaJuridica.razao_social }));
}