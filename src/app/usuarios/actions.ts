"use server";

import { prisma } from "@/lib/prisma";

export type UsuarioListRow = {
  id_usuario: number;
  codigo: string;
  login: string;
  nome: string;
  admin: string;
};

export async function searchUsuariosList(query: string): Promise<UsuarioListRow[]> {
  if (query.length < 2) return [];

  const data = await prisma.usuario.findMany({
    where: {
      ativo: true,
      OR: [
        { login: { contains: query } },
        { funcionario: { pessoaFisica: { nome: { contains: query } } } },
      ],
    },
    include: {
      funcionario: { include: { pessoaFisica: true } },
    },
    take: 50,
    orderBy: { id_usuario: "asc" },
  });

  return data.map((u, i) => ({
    id_usuario: u.id_usuario,
    codigo: String(i + 1).padStart(3, "0"),
    login: u.login,
    nome: u.funcionario.pessoaFisica.nome,
    admin: u.super_admin ? "Sim" : "Não",
  }));
}