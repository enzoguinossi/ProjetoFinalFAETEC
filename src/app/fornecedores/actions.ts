"use server";
import { fornecedorDAO } from "@/dao/fornecedor";
import { requireUser } from "@/lib/auth";
import { usuarioPode } from "@/lib/permissoes";

export type FornecedorListRow = { id_fornecedor: number; codigo: string; razao: string };

export async function searchFornecedoresList(query: string): Promise<FornecedorListRow[]> {
  if (query.length < 2) return [];
  const user = await requireUser();
  if (!(await usuarioPode(user, "fornecedor.listar"))) return [];
  const data = await fornecedorDAO.search(query);
  return data.map((f, i) => ({ id_fornecedor: f.id_fornecedor, codigo: String(i + 1).padStart(3, "0"), razao: f.pessoaJuridica.razao_social }));
}