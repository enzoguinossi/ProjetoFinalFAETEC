"use server";

import { usuarioDAO } from "@/dao/usuario";
import { requireUser } from "@/lib/auth";
import { usuarioPode } from "@/lib/permissoes";
import { formatarCodigo } from "@/lib/formatar";

export type UsuarioListRow = {
  id_usuario: number;
  codigo: string;
  login: string;
  nome: string;
};

export async function searchUsuariosList(query: string): Promise<UsuarioListRow[]> {
  if (query.length < 2) return [];

  const user = await requireUser();
  if (!(await usuarioPode(user, "usuario.listar"))) return [];

  const data = await usuarioDAO.search(query);

  return data.map((u) => ({
    id_usuario: u.id_usuario,
    codigo: formatarCodigo(u.id_usuario),
    login: u.login,
    nome: u.funcionario.pessoaFisica.nome,
  }));
}