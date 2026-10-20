"use server";

import { conversaoUnidadeDAO } from "@/dao/conversao-unidade";
import { fornecedorDAO } from "@/dao/fornecedor";
import { notaEntradaDAO } from "@/dao/nota-entrada";
import { produtoDAO } from "@/dao/produto";
import { mensagemDeErro } from "@/dao/_errors";
import { requireUser } from "@/lib/auth";
import { comPermissao, usuarioPodeAlguma } from "@/lib/permissoes";
import { notaEntradaService } from "@/services/nota-entrada";
import { resultadoVazio, type PaginationParams, type PaginatedResult } from "@/types";
import type {
  ConversaoUnidadeItem,
  FornecedorBuscaItem,
  NotaEntradaListRow,
  NovaEntradaPayload,
  ProdutoBuscaItem,
  ProdutoEntradaDetalhe,
} from "./tipos";

const PERMISSOES_VER = ["estoque.ver_saldo", "estoque.entrada"];

/** `data_recebimento` é `DATE` (sem hora): formata em UTC; `data_criacao` é timestamp local. */
function formatarData(data: Date | null, utc = false): string {
  if (!data) return "—";
  if (!utc) return data.toLocaleDateString("pt-BR");
  const dia = String(data.getUTCDate()).padStart(2, "0");
  const mes = String(data.getUTCMonth() + 1).padStart(2, "0");
  return `${dia}/${mes}/${data.getUTCFullYear()}`;
}

export async function listarNotasEntrada(
  params: PaginationParams = {},
): Promise<PaginatedResult<NotaEntradaListRow>> {
  const user = await requireUser();
  if (!(await usuarioPodeAlguma(user, PERMISSOES_VER))) return resultadoVazio(params);

  const resultado = await notaEntradaDAO.list(params);
  return {
    ...resultado,
    data: resultado.data.map((nota) => {
      const chaves = nota.chavesAcesso.map((c) => c.chave_acesso);
      return {
        id_nota_entrada: nota.id_nota_entrada,
        data: formatarData(
          nota.data_recebimento ?? nota.data_criacao,
          nota.data_recebimento !== null,
        ),
        fornecedor: nota.fornecedor?.pessoaJuridica.razao_social ?? "Sem fornecedor",
        itens: nota.itens.length,
        chaves,
        chavesTexto: chaves.length > 0 ? chaves.join(", ") : "—",
      };
    }),
  };
}

/** Unidades de conversão disponíveis para os itens da entrada. */
export async function listarUnidadesEntrada(): Promise<ConversaoUnidadeItem[]> {
  const user = await requireUser();
  if (!(await usuarioPodeAlguma(user, ["estoque.entrada"]))) return [];
  return conversaoUnidadeDAO.list();
}

export async function buscarProdutosEntrada(query: string): Promise<ProdutoBuscaItem[]> {
  if (query.length < 2) return [];
  const user = await requireUser();
  if (!(await usuarioPodeAlguma(user, ["estoque.entrada"]))) return [];
  return produtoDAO.searchPriorizado(query);
}

export async function getProdutoEntrada(id: number): Promise<ProdutoEntradaDetalhe | null> {
  const user = await requireUser();
  if (!(await usuarioPodeAlguma(user, ["estoque.entrada"]))) return null;

  const produto = await produtoDAO.getById(id);
  if (!produto) return null;
  return {
    id_produto: produto.id_produto,
    descricao: produto.descricao,
    id_conversao_padrao: produto.id_conversao_padrao,
    fator_padrao: produto.conversaoPadrao?.fator ?? null,
  };
}

export async function buscarFornecedoresEntrada(query: string): Promise<FornecedorBuscaItem[]> {
  if (query.length < 2) return [];
  const user = await requireUser();
  if (!(await usuarioPodeAlguma(user, ["estoque.entrada"]))) return [];

  const resultado = await fornecedorDAO.list({ search: query, limit: 20 });
  return resultado.data.map((f) => ({
    id_fornecedor: f.id_fornecedor,
    razao_social: f.pessoaJuridica.razao_social,
  }));
}

export async function criarNotaEntrada(payload: NovaEntradaPayload) {
  return comPermissao("estoque.entrada", async (user) => {
    try {
      const resultado = await notaEntradaService.registrar(payload, user.id_usuario);
      if ("error" in resultado) return resultado;
      return { success: true, id_nota_entrada: resultado.nota.id_nota_entrada };
    } catch (e) {
      return { error: mensagemDeErro(e) };
    }
  });
}
