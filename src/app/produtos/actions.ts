"use server";

import { produtoDAO } from "@/dao/produto";
import { requireUser } from "@/lib/auth";
import { usuarioPode } from "@/lib/permissoes";
import { formatarCodigo } from "@/lib/formatar";

export type ProdutoListRow = {
  id_produto: number;
  codigo: string;
  descricao: string;
  qtd: string;
  livre: string;
};

export async function searchProdutosList(query: string): Promise<ProdutoListRow[]> {
  if (query.length < 2) return [];

  const user = await requireUser();
  if (!(await usuarioPode(user, "produto.listar"))) return [];

  const data = await produtoDAO.searchPriorizadoComEstoque(query);

  return data.map((p) => {
    const qtd = p.estoques.reduce((s, e) => s + Number(e.quantidade_atual), 0);
    const reservado = p.estoques.reduce((s, e) => s + Number(e.saldo_reservado), 0);
    return {
      id_produto: p.id_produto,
      codigo: formatarCodigo(p.id_produto),
      descricao: p.descricao,
      qtd: String(qtd),
      livre: String(qtd - reservado),
    };
  });
}