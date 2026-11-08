"use server";

import { destinatarioDAO } from "@/dao/destinatario";
import type { PedidoFiltros } from "@/dao/pedido";
import { produtoDAO } from "@/dao/produto";
import { requireUser } from "@/lib/auth";
import { limitesDoDiaSaoPaulo } from "@/lib/datas";
import { comPermissao, usuarioPodeAlguma } from "@/lib/permissoes";
import { mensagemDeErro } from "@/dao/_errors";
import { formatarCodigo } from "@/lib/formatar";
import { formatarDataRelatorio } from "@/services/relatorio";
import {
  pedidoService,
  ROTULOS_STATUS_PEDIDO,
  type PedidoInput,
} from "@/services/pedido";
import { resultadoVazio, type PaginatedResult } from "@/types";

export type PedidoItemRow = {
  id_produto: number;
  codigo: string;
  descricao: string;
  quantidade: number;
  observacao: string | null;
};

export type PedidoListRow = {
  id_pedido_escola: number;
  codigo: string;
  data: string;
  escola: string;
  itens: PedidoItemRow[];
  total: number;
  status: string;
  statusLabel: string;
  nota: number | null;
  podeEditar: boolean;
  podeAnalisar: boolean;
};

export type PedidoFormData = {
  id_pedido_escola: number;
  id_destinatario: number;
  escola: string;
  data: string;
  status: string;
  statusLabel: string;
  observacao: string | null;
  nota: number | null;
  podeEditar: boolean;
  itens: PedidoItemRow[];
};

export type PedidoFiltrosPayload = {
  page?: number;
  limit?: number;
  search?: string;
  /** Um id ou uma lista (chips enviam lista). */
  id_destinatario?: number | number[] | null;
  /** Um status ou uma lista (chips enviam lista). */
  status?: string | string[] | null;
  de?: string | null;
  ate?: string | null;
  /** Um id ou uma lista (chips enviam lista). */
  id_produto?: number | number[] | null;
  com_nota?: "todos" | "com" | "sem";
  /** Paginação da lista usa o mesmo formato dos demais módulos. */
  pageSize?: number;
};

export type ProdutoPedidoDetalhe = {
  id_produto: number;
  descricao: string;
  unidade_saida: string | null;
  fator: number;
};

export type EscolaSelecaoRow = {
  id_destinatario: number;
  razao_social: string;
  tipo: string;
};

const PERMISSOES_VER = [
  "pedido.listar",
  "pedido.consultar",
  "pedido.criar",
  "pedido.alterar",
  "pedido.aprovar",
];

function idPositivo(valor: unknown): number | null {
  const id = Number(valor);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** Aceita um id ou uma lista; devolve só os inteiros positivos. */
function idsPositivos(valor: unknown): number[] {
  const lista = Array.isArray(valor) ? valor : [valor];
  return lista
    .map(idPositivo)
    .filter((id): id is number => id !== null);
}

const STATUS_PEDIDO_VALIDOS = ["PENDENTE", "CONFIRMADO", "RECUSADO"] as const;

function statusDoPayload(valor: unknown): PedidoFiltros["status"] {
  const lista = Array.isArray(valor) ? valor : [valor];
  const aceitos = lista.filter((item): item is (typeof STATUS_PEDIDO_VALIDOS)[number] =>
    (STATUS_PEDIDO_VALIDOS as readonly unknown[]).includes(item),
  );
  return aceitos.length > 0 ? [...new Set(aceitos)] : [];
}

/** Texto de busca: apenas `string` vira filtro (payload pode chegar cru). */
function textoFiltro(valor: unknown): string | undefined {
  return typeof valor === "string" ? valor.trim() || undefined : undefined;
}

/** Data `YYYY-MM-DD` válida no dia civil de São Paulo; inválida não filtra. */
function dataFiltro(valor: unknown): string | undefined {
  if (typeof valor !== "string") return undefined;
  const texto = valor.trim();
  if (!texto) return undefined;
  return limitesDoDiaSaoPaulo(texto, null).inicio ? texto : undefined;
}

function filtrosDoPayload(params: PedidoFiltrosPayload = {}): PedidoFiltros {
  return {
    page: params.page,
    limit: params.limit ?? params.pageSize,
    search: textoFiltro(params.search),
    destinatarios: params.id_destinatario ? idsPositivos(params.id_destinatario) : [],
    status: statusDoPayload(params.status),
    de: dataFiltro(params.de),
    ate: dataFiltro(params.ate),
    produtos: params.id_produto ? idsPositivos(params.id_produto) : [],
    com_nota:
      params.com_nota === "com" ? true : params.com_nota === "sem" ? false : null,
  };
}

function itensDoPedido(
  itens: {
    id_produto: number;
    quantidade: number | string;
    observacao?: string | null;
    produto: { descricao: string };
  }[],
): PedidoItemRow[] {
  return itens.map((item) => ({
    id_produto: item.id_produto,
    codigo: formatarCodigo(item.id_produto),
    descricao: item.produto.descricao,
    quantidade: Number(item.quantidade),
    observacao: item.observacao ?? null,
  }));
}

/** Lista paginada com busca e todos os filtros (aplicados no banco). */
export async function listarPedidos(
  params: PedidoFiltrosPayload = {},
): Promise<PaginatedResult<PedidoListRow>> {
  const user = await requireUser();
  if (!(await usuarioPodeAlguma(user, PERMISSOES_VER))) return resultadoVazio(params);

  const resultado = await pedidoService.listar(filtrosDoPayload(params));
  return {
    ...resultado,
    data: resultado.data.map((pedido) => {
      const itens = itensDoPedido(pedido.itens);
      return {
        id_pedido_escola: pedido.id_pedido_escola,
        codigo: formatarCodigo(pedido.id_pedido_escola),
        data: formatarDataRelatorio(pedido.data_criacao),
        escola: pedido.destinatario.pessoaJuridica.razao_social,
        itens,
        total: itens.reduce((soma, item) => soma + item.quantidade, 0),
        status: pedido.status,
        statusLabel: ROTULOS_STATUS_PEDIDO[pedido.status] ?? pedido.status,
        nota: pedido.id_nota_saida,
        podeEditar: pedido.status === "PENDENTE",
        podeAnalisar: pedido.status === "PENDENTE",
      };
    }),
  };
}

/** Pedido com cabeçalho e itens, para detalhe e edição. */
export async function obterPedido(id: number): Promise<PedidoFormData | null> {
  const user = await requireUser();
  if (!(await usuarioPodeAlguma(user, PERMISSOES_VER))) return null;

  const pedido = await pedidoService.detalhar(Number(id));
  if (!pedido) return null;

  return {
    id_pedido_escola: pedido.id_pedido_escola,
    id_destinatario: pedido.id_destinatario,
    escola: pedido.destinatario.pessoaJuridica.razao_social,
    data: formatarDataRelatorio(pedido.data_criacao),
    status: pedido.status,
    statusLabel: ROTULOS_STATUS_PEDIDO[pedido.status] ?? pedido.status,
    observacao: pedido.observacao,
    nota: pedido.id_nota_saida,
    podeEditar: pedido.status === "PENDENTE",
    itens: itensDoPedido(pedido.itens),
  };
}

export async function criarPedido(payload: PedidoInput) {
  return comPermissao("pedido.criar", async (user) => {
    try {
      const resultado = await pedidoService.criar(payload, user.id_usuario);
      if ("error" in resultado) return resultado;
      return { success: true, id_pedido_escola: resultado.pedido.id_pedido_escola };
    } catch (e) {
      return { error: mensagemDeErro(e) };
    }
  });
}

export async function atualizarPedido(id: number, payload: PedidoInput) {
  return comPermissao("pedido.alterar", async (user) => {
    try {
      const resultado = await pedidoService.atualizar(id, payload, user.id_usuario);
      if ("error" in resultado) return resultado;
      return { success: true, id_pedido_escola: resultado.pedido.id_pedido_escola };
    } catch (e) {
      return { error: mensagemDeErro(e) };
    }
  });
}

export async function aprovarPedido(id: number) {
  return comPermissao("pedido.aprovar", async (user) => {
    try {
      const resultado = await pedidoService.aprovar(id, user.id_usuario);
      if ("error" in resultado) return resultado;
      return { success: true };
    } catch (e) {
      return { error: mensagemDeErro(e) };
    }
  });
}

export async function recusarPedido(id: number) {
  return comPermissao("pedido.aprovar", async (user) => {
    try {
      const resultado = await pedidoService.recusar(id, user.id_usuario);
      if ("error" in resultado) return resultado;
      return { success: true };
    } catch (e) {
      return { error: mensagemDeErro(e) };
    }
  });
}

/** Escolas para os seletores do pedido e para os filtros da lista/relatório. */
export async function listarEscolasSelecao(): Promise<EscolaSelecaoRow[]> {
  const user = await requireUser();
  if (!(await usuarioPodeAlguma(user, [...PERMISSOES_VER, "pedido.criar"]))) return [];

  const resultado = await destinatarioDAO.list({ page: 1, limit: 100 });
  return resultado.data.map((destinatario) => ({
    id_destinatario: destinatario.id_destinatario,
    razao_social: destinatario.pessoaJuridica.razao_social,
    tipo: destinatario.tipo_destinatario,
  }));
}

/** Produtos para os seletores e filtros do pedido. */
export async function listarProdutosPedido(): Promise<
  { id_produto: number; codigo: string; descricao: string }[]
> {
  const user = await requireUser();
  if (!(await usuarioPodeAlguma(user, [...PERMISSOES_VER, "pedido.criar"]))) return [];

  // Teto próprio de opções (500), não o da paginação normal (100); acima dele
  // o seletor não lista todos os produtos.
  const produtos = await produtoDAO.listOpcoes();
  return produtos.map((produto) => ({
    id_produto: produto.id_produto,
    codigo: formatarCodigo(produto.id_produto),
    descricao: produto.descricao,
  }));
}

/**
 * Produto com a conversão padrão de **saída**, usada só como auxílio de
 * preenchimento no pedido (o item grava o total).
 */
export async function getProdutoPedido(
  id: number,
): Promise<ProdutoPedidoDetalhe | null> {
  const user = await requireUser();
  if (!(await usuarioPodeAlguma(user, [...PERMISSOES_VER, "pedido.criar"]))) return null;

  const produto = await produtoDAO.getById(Number(id));
  if (!produto) return null;
  return {
    id_produto: produto.id_produto,
    descricao: produto.descricao,
    unidade_saida: produto.conversaoSaida?.nome ?? null,
    fator: Number(produto.conversaoSaida?.fator ?? 1),
  };
}
