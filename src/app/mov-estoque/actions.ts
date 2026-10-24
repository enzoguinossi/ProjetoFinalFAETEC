"use server";

import { conversaoUnidadeDAO } from "@/dao/conversao-unidade";
import { destinatarioDAO } from "@/dao/destinatario";
import { fornecedorDAO } from "@/dao/fornecedor";
import { notaEntradaDAO } from "@/dao/nota-entrada";
import { notaSaidaDAO } from "@/dao/nota-saida";
import { produtoDAO } from "@/dao/produto";
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
  AtualizacaoEntradaPayload,
  AtualizacaoNotaSaidaPayload,
  ConversaoUnidadeItem,
  DestinatarioSelecaoRow,
  FornecedorSelecaoRow,
  NotaEntradaFormData,
  NotaEntradaListRow,
  NotaSaidaFormData,
  NotaSaidaListRow,
  NovaEntradaPayload,
  NovaSaidaPayload,
  ProdutoEntradaDetalhe,
  SelecaoParams,
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
    data: resultado.data.map((nota) => ({
      id_nota_entrada: nota.id_nota_entrada,
      data: formatarData(
        nota.data_recebimento ?? nota.data_criacao,
        nota.data_recebimento !== null,
      ),
      fornecedor: nota.fornecedor?.pessoaJuridica.razao_social ?? "Sem fornecedor",
      itens: nota.itens.length,
      chave_acesso: nota.chave_acesso,
    })),
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

/** `data_recebimento` é `DATE`: o `<input type="date">` usa `YYYY-MM-DD` em UTC. */
function dataRecebimentoParaInput(data: Date | null): string | null {
  if (!data) return null;
  const dia = String(data.getUTCDate()).padStart(2, "0");
  const mes = String(data.getUTCMonth() + 1).padStart(2, "0");
  return `${data.getUTCFullYear()}-${mes}-${dia}`;
}

/**
 * Nota de entrada com cabeçalho e itens, para os modais de visualização e
 * edição. Ver exige `nota_entrada.consultar`; editar exige
 * `nota_entrada.alterar`.
 */
export async function obterNotaEntrada(
  id: number,
  modo: "view" | "edit" = "view",
): Promise<NotaEntradaFormData | null> {
  const user = await requireUser();
  const permissao = modo === "edit" ? "nota_entrada.alterar" : "nota_entrada.consultar";
  if (!(await usuarioPode(user, permissao))) return null;

  const nota = await notaEntradaDAO.getById(id);
  if (!nota) return null;

  return {
    id_nota_entrada: nota.id_nota_entrada,
    id_fornecedor: nota.fornecedor?.id_fornecedor ?? null,
    fornecedor: nota.fornecedor?.pessoaJuridica.razao_social ?? null,
    cnpj: nota.fornecedor?.pessoaJuridica.cnpj ?? null,
    data_recebimento: dataRecebimentoParaInput(nota.data_recebimento),
    observacao: nota.observacao,
    chave_acesso: nota.chave_acesso,
    itens: nota.itens.map((item) => ({
      id_item_nota_entrada: item.id_item_nota_entrada,
      id_produto: item.id_produto,
      descricao: item.produto.descricao,
      fator_conversao: Number(item.fator_conversao),
      quantidade: Number(item.quantidade),
      quantidade_convertida: Number(item.quantidade_convertida),
    })),
  };
}

/**
 * Grava a edição da nota de entrada (cabeçalho e itens). Exige
 * `nota_entrada.alterar` no servidor; remover item é recusado.
 */
export async function salvarNotaEntrada(id: number, payload: AtualizacaoEntradaPayload) {
  return comPermissao("nota_entrada.alterar", async (user) => {
    try {
      const resultado = await notaEntradaService.atualizar(id, payload, user.id_usuario);
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
  EM_PERCURSO: "Em percurso",
  PENDENTE: "Pendente",
  BAIXA_TOTAL: "Baixa total",
  BAIXA_PARCIAL: "Baixa parcial",
  BAIXA_COM_CORTE: "Baixa com corte",
  CANCELADA: "Cancelada",
};

const STATUS_NOTA_SAIDA_CANCELAVEL = ["ABERTA"];
const STATUS_NOTA_SAIDA_EDITAVEL = ["ABERTA"];

export async function listarNotasSaida(
  params: PaginationParams = {},
): Promise<PaginatedResult<NotaSaidaListRow>> {
  const user = await requireUser();
  if (!(await usuarioPodeAlguma(user, PERMISSOES_VER_SAIDA))) return resultadoVazio(params);

  const resultado = await notaSaidaDAO.list(params);
  return {
    ...resultado,
    data: resultado.data.map((nota) => {
      const destinatario = nota.destinatario?.pessoaJuridica.razao_social ?? "—";
      const itens = nota.itens.map((item) => ({
        id_item_nota_saida: item.id_item_nota_saida,
        id_produto: item.estoque.produto.id_produto,
        descricao: item.estoque.produto.descricao,
        quantidade_solicitada: Number(item.qtd_esperada),
        quantidade_entregue: Number(item.qtd_entregue),
      }));
      return {
        id_nota_saida: nota.id_nota_saida,
        data: formatarData(nota.data_criacao),
        destinatario,
        itens,
        quantidade: itens.reduce((acc, item) => acc + item.quantidade_solicitada, 0),
        status: nota.status,
        statusLabel: ROTULOS_STATUS_NOTA_SAIDA[nota.status] ?? nota.status,
        podeCancelar: STATUS_NOTA_SAIDA_CANCELAVEL.includes(nota.status),
        podeEditar: STATUS_NOTA_SAIDA_EDITAVEL.includes(nota.status),
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

/**
 * Nota de saída com destinatário, status, itens e reservas, para os modais de
 * visualização e edição. Ver exige `nota_saida.consultar`; editar exige
 * `nota_saida.alterar`.
 */
export async function obterNotaSaida(
  id: number,
  modo: "view" | "edit" = "view",
): Promise<NotaSaidaFormData | null> {
  const user = await requireUser();
  const permissao = modo === "edit" ? "nota_saida.alterar" : "nota_saida.consultar";
  if (!(await usuarioPode(user, permissao))) return null;

  const nota = await notaSaidaDAO.getNotaSaida(id);
  if (!nota) return null;

  return {
    id_nota_saida: nota.id_nota_saida,
    data: formatarData(nota.data_criacao),
    status: nota.status,
    statusLabel: ROTULOS_STATUS_NOTA_SAIDA[nota.status] ?? nota.status,
    podeEditar: STATUS_NOTA_SAIDA_EDITAVEL.includes(nota.status),
    id_destinatario: nota.id_destinatario,
    destinatario: nota.destinatario?.pessoaJuridica.razao_social ?? null,
    urgente: nota.urgente,
    observacao: nota.observacao,
    itens: nota.itens.map((item) => ({
      id_item_nota_saida: item.id_item_nota_saida,
      id_produto: item.estoque.produto.id_produto,
      descricao: item.estoque.produto.descricao,
      quantidade_solicitada: Number(item.qtd_esperada),
      quantidade_entregue: Number(item.qtd_entregue),
    })),
  };
}

/** Cria a nota de saída (destinatário, itens e reserva). Exige `nota_saida.criar`. */
export async function criarNotaSaida(payload: NovaSaidaPayload) {
  return comPermissao("nota_saida.criar", async (user) => {
    try {
      const resultado = await notaSaidaService.registrar(payload, user.id_usuario);
      if ("error" in resultado) return resultado;
      return {
        success: true,
        id_nota_saida: resultado.nota.id_nota_saida,
        aviso: resultado.aviso,
      };
    } catch (e) {
      return { error: mensagemDeErro(e) };
    }
  });
}

/**
 * Grava a edição da nota de saída (destinatário, urgência, observação e
 * quantidades). Exige `nota_saida.alterar` no servidor; remover item é
 * recusado e só notas abertas são editáveis (RN004).
 */
export async function atualizarNotaSaida(id: number, payload: AtualizacaoNotaSaidaPayload) {
  return comPermissao("nota_saida.alterar", async (user) => {
    try {
      const resultado = await notaSaidaService.atualizar(id, payload, user.id_usuario);
      if ("error" in resultado) return resultado;
      return { success: true, id_nota_saida: resultado.nota.id_nota_saida };
    } catch (e) {
      return { error: mensagemDeErro(e) };
    }
  });
}

/**
 * Cancela uma nota aberta e libera a reserva dos itens. Exige
 * `nota_saida.cancelar` no servidor; cancelar de novo é recusado.
 */
export async function cancelarNotaSaida(id: number) {
  return comPermissao("nota_saida.cancelar", async (user) => {
    try {
      const resultado = await notaSaidaService.cancelar(id, user.id_usuario);
      if ("error" in resultado) return resultado;
      return { success: true, id_nota_saida: resultado.id_nota_saida };
    } catch (e) {
      return { error: mensagemDeErro(e) };
    }
  });
}
