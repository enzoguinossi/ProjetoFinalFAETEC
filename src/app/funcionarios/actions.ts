"use server";

import { funcionarioDAO } from "@/dao/funcionario";
import { requireUser } from "@/lib/auth";
import { usuarioPode } from "@/lib/permissoes";

export type FuncionarioListRow = {
  id_funcionario: number;
  codigo: string;
  nome: string;
  cargo: string;
  condutor: string;
};

export async function searchFuncionariosList(query: string): Promise<FuncionarioListRow[]> {
  if (query.length < 2) return [];

  const user = await requireUser();
  if (!(await usuarioPode(user, "funcionario.listar"))) return [];

  const data = await funcionarioDAO.search(query);

  return data.map((f, i) => ({
    id_funcionario: f.id_funcionario,
    codigo: String(i + 1).padStart(3, "0"),
    nome: f.pessoaFisica.nome,
    cargo: f.cargo ?? "",
    condutor: f.condutor ? "Sim" : "Não",
  }));
}