"use server";

import { prisma } from "@/lib/prisma";

export type FuncionarioListRow = {
  id_funcionario: number;
  codigo: string;
  nome: string;
  cargo: string;
  condutor: string;
};

export async function searchFuncionariosList(query: string): Promise<FuncionarioListRow[]> {
  if (query.length < 2) return [];

  const data = await prisma.funcionario.findMany({
    where: {
      ativo: true,
      pessoaFisica: { nome: { contains: query } },
    },
    include: {
      pessoaFisica: { select: { nome: true } },
      condutor: { select: { id_condutor: true, ativo: true } },
    },
    take: 50,
    orderBy: { id_funcionario: "desc" },
  });

  return data.map((f, i) => ({
    id_funcionario: f.id_funcionario,
    codigo: String(i + 1).padStart(3, "0"),
    nome: f.pessoaFisica.nome,
    cargo: f.cargo ?? "",
    condutor: f.condutor?.ativo ? "Sim" : "Não",
  }));
}