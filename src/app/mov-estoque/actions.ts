"use server";

import { conversaoUnidadeDAO } from "@/dao/conversao-unidade";
import { destinatarioDAO } from "@/dao/destinatario";
import { fornecedorDAO } from "@/dao/fornecedor";
import { funcionarioDAO } from "@/dao/funcionario";
import { notaEntradaDAO } from "@/dao/nota-entrada";
import { notaSaidaDAO } from "@/dao/nota-saida";
import { produtoDAO } from "@/dao/produto";
import { veiculoDAO } from "@/dao/veiculo";
import { mensagemDeErro } from "@/dao/_errors";
import { requireUser } from "@/lib/auth";
import { comPermissao, usuarioPode, usuarioPodeAlguma } from "@/lib/permissoes";
import { produtoParaLinha, type ProdutoListRow } from "@/lib/produto-linha";
import { notaEntradaService } from "@/services/nota-entrada";
import { notaSaidaService } from "@/services/nota-saida";
import {
  buildPagination,
  resultadoVazio,
  type PaginationParams,
  type PaginatedResult,
} from "@/types";
import type {
  CondutorItem,
  ConversaoUnidadeItem,
  DestinatarioSelecaoRow,
  FornecedorSelecaoRow,
  NotaEntradaListRow,
  NotaSaidaListRow,
  NovaEntradaPayload,
  NovaSaidaPayload,
  ProdutoEntradaDetalhe,
  SelecaoParams,
  VeiculoItem,
} from "./tipos";

const PERMISSOES_VER = ["estoque.ver_saldo", "estoque.entrada"];
const PERMISSOES_VER_SAIDA = ["estoque.ver_saldo", "estoque.saida"];
const PERMISSOES_SELECAO_PRODUTO = ["estoque.entrada", "estoque.saida"];

/** Normaliza os parâmetros de uma listagem de seletor (página, limite e filtro). */
function parametrosSelecao(params: SelecaoParams): {
  page: number;
  limit: number;
  search?: string;
} {
  const { take } = buildPagination(params);
  return {
    page: Math.max(1, params.page ?? 1),
    limit: take,
    search: params.search?.trim() || undefined,
  };
}

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

/**
 * Produtos para os seletores da movimentação (entrada/saída), paginados e com os
 * mesmos valores da listagem de produtos (Código, Descrição, Quantidade, Qtd. Livre).
 * Permissão: `estoque.entrada` ou `estoque.saida` (permissão da tela, não da entidade).
 */
export async function listarProdutosSelecao(
  params: SelecaoParams = {},
): Promise<PaginatedResult<ProdutoListRow>> {
  const user = await requireUser();
  if (!(await usuarioPodeAlguma(user, PERMISSOES_SELECAO_PRODUTO))) {
    return resultadoVazio(params);
  }

  const { page, limit, search } = parametrosSelecao(params);
  const excluidos = new Set(params.excludeIds ?? []);

  if (search) {
    // Mesma busca priorizada da listagem de produtos (código → descrição),
    // paginada aqui porque a busca priorizada devolve um único lote.
    const linhas = (await produtoDAO.searchPriorizadoComEstoque(search))
      .map(produtoParaLinha)
      .filter((linha) => !excluidos.has(linha.id_produto));
    const { skip, take } = buildPagination({ page, limit });
    return {
      data: linhas.slice(skip, skip + take),
      total: linhas.length,
      page,
      limit: take,
      totalPages: Math.ceil(linhas.length / take),
    };
  }

  const resultado = await produtoDAO.list({ page, limit }, [...excluidos]);
  return { ...resultado, data: resultado.data.map(produtoParaLinha) };
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

/** Fornecedores para o seletor da entrada. Permissão da tela: `estoque.entrada`. */
export async function listarFornecedoresSelecao(
  params: SelecaoParams = {},
): Promise<PaginatedResult<FornecedorSelecaoRow>> {
  const user = await requireUser();
  if (!(await usuarioPode(user, "estoque.entrada"))) return resultadoVazio(params);

  const { page, limit, search } = parametrosSelecao(params);
  const resultado = await fornecedorDAO.list({ page, limit, search });
  return {
    ...resultado,
    data: resultado.data.map((f) => ({
      id_fornecedor: f.id_fornecedor,
      razao_social: f.pessoaJuridica.razao_social,
      cnpj: f.pessoaJuridica.cnpj,
    })),
  };
}

/** Dados de um fornecedor recém-criado, para selecioná-lo na nota. */
export async function getFornecedorSelecao(
  id: number,
): Promise<FornecedorSelecaoRow | null> {
  const user = await requireUser();
  if (!(await usuarioPode(user, "estoque.entrada"))) return null;

  const fornecedor = await fornecedorDAO.getById(id);
  if (!fornecedor) return null;
  return {
    id_fornecedor: fornecedor.id_fornecedor,
    razao_social: fornecedor.pessoaJuridica.razao_social,
    cnpj: fornecedor.pessoaJuridica.cnpj,
  };
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

// ── Saída ───────────────────────────────────────────────────────────

const ROTULOS_STATUS_NOTA_SAIDA: Record<string, string> = {
  ABERTA: "Aberta",
  EM_ANDAMENTO: "Em andamento",
  BAIXA_TOTAL: "Baixa total",
  BAIXA_PARCIAL: "Baixa parcial",
  BAIXA_COM_CORTE: "Baixa com corte",
  CANCELADA: "Cancelada",
};

const ROTULOS_STATUS_REMESSA: Record<string, string> = {
  EM_PREPARACAO: "Em preparação",
  PRONTO_PARA_ENTREGA: "Pronta para entrega",
  EM_PERCURSO: "Em percurso",
  PENDENTE: "Pendente",
  FINALIZADO_TOTAL: "Finalizada",
  FINALIZADO_PARCIAL: "Finalizada parcialmente",
  CANCELADA: "Cancelada",
};

const STATUS_REMESSA_CANCELAVEL = ["EM_PREPARACAO", "PRONTO_PARA_ENTREGA"];

export async function listarNotasSaida(
  params: PaginationParams = {},
): Promise<PaginatedResult<NotaSaidaListRow>> {
  const user = await requireUser();
  if (!(await usuarioPodeAlguma(user, PERMISSOES_VER_SAIDA))) return resultadoVazio(params);

  const resultado = await notaSaidaDAO.list(params);
  return {
    ...resultado,
    data: resultado.data.map((nota) => {
      const destinatarios = [
        ...new Set(
          nota.remessas.map((r) => r.destinatario.pessoaJuridica.razao_social),
        ),
      ];
      return {
        id_nota_saida: nota.id_nota_saida,
        data: formatarData(nota.data_criacao),
        remessas: nota.remessas.length,
        destinatarios: destinatarios.length > 0 ? destinatarios.join(", ") : "—",
        status: ROTULOS_STATUS_NOTA_SAIDA[nota.status] ?? nota.status,
        listaRemessas: nota.remessas
          .slice()
          .sort((a, b) => a.id_remessa - b.id_remessa)
          .map((remessa) => ({
            id_remessa: remessa.id_remessa,
            destinatario: remessa.destinatario.pessoaJuridica.razao_social,
            status: remessa.status,
            statusLabel: ROTULOS_STATUS_REMESSA[remessa.status] ?? remessa.status,
            podeCancelar: STATUS_REMESSA_CANCELAVEL.includes(remessa.status),
          })),
      };
    }),
  };
}

/** Destinatários para o seletor da saída. Permissão da tela: `estoque.saida`. */
export async function listarDestinatariosSelecao(
  params: SelecaoParams = {},
): Promise<PaginatedResult<DestinatarioSelecaoRow>> {
  const user = await requireUser();
  if (!(await usuarioPode(user, "estoque.saida"))) return resultadoVazio(params);

  const { page, limit, search } = parametrosSelecao(params);
  const resultado = await destinatarioDAO.list({ page, limit, search });
  return {
    ...resultado,
    data: resultado.data.map((d) => ({
      id_destinatario: d.id_destinatario,
      razao_social: d.pessoaJuridica.razao_social,
      tipo: d.tipo_destinatario,
    })),
  };
}

/** Condutores disponíveis: funcionários ativos marcados `condutor = true`. */
export async function listarCondutoresSaida(): Promise<CondutorItem[]> {
  const user = await requireUser();
  if (!(await usuarioPodeAlguma(user, ["estoque.saida"]))) return [];

  const resultado = await funcionarioDAO.list({ limit: 100 });
  return resultado.data
    .filter((f) => f.condutor)
    .map((f) => ({ id_funcionario: f.id_funcionario, nome: f.pessoaFisica.nome }));
}

/** Veículos ativos para a remessa. */
export async function listarVeiculosSaida(): Promise<VeiculoItem[]> {
  const user = await requireUser();
  if (!(await usuarioPodeAlguma(user, ["estoque.saida"]))) return [];

  const resultado = await veiculoDAO.list({ limit: 100 });
  return resultado.data.map((v) => ({
    id_veiculo: v.id_veiculo,
    placa: v.placa,
    modelo: v.modelo,
  }));
}

export async function criarNotaSaida(payload: NovaSaidaPayload) {
  return comPermissao("estoque.saida", async (user) => {
    try {
      const resultado = await notaSaidaService.registrar(payload, user.id_usuario);
      if ("error" in resultado) return resultado;
      return {
        success: true,
        id_nota_saida: resultado.nota.id_nota_saida,
        remessas: resultado.remessas.length,
      };
    } catch (e) {
      return { error: mensagemDeErro(e) };
    }
  });
}

/**
 * Cancela uma remessa da nota (só em preparação ou pronta para entrega) e
 * libera a reserva dos itens. Exige `remessa.alterar_status` no servidor.
 */
export async function cancelarRemessa(id_remessa: number) {
  return comPermissao("remessa.alterar_status", async (user) => {
    try {
      const resultado = await notaSaidaService.cancelarRemessa(id_remessa, user.id_usuario);
      if ("error" in resultado) return resultado;
      return { success: true, id_remessa: resultado.id_remessa };
    } catch (e) {
      return { error: mensagemDeErro(e) };
    }
  });
}
