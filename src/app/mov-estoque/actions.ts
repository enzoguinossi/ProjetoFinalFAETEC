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
import { comPermissao, usuarioPodeAlguma } from "@/lib/permissoes";
import { notaEntradaService } from "@/services/nota-entrada";
import { notaSaidaService } from "@/services/nota-saida";
import { resultadoVazio, type PaginationParams, type PaginatedResult } from "@/types";
import type {
  CondutorItem,
  ConversaoUnidadeItem,
  DestinatarioBuscaItem,
  FornecedorBuscaItem,
  NotaEntradaListRow,
  NotaSaidaListRow,
  NovaEntradaPayload,
  NovaSaidaPayload,
  ProdutoBuscaItem,
  ProdutoEntradaDetalhe,
  ProdutoSaidaBuscaItem,
  VeiculoItem,
} from "./tipos";

const PERMISSOES_VER = ["estoque.ver_saldo", "estoque.entrada"];
const PERMISSOES_VER_SAIDA = ["estoque.ver_saldo", "estoque.saida"];

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

export async function buscarDestinatariosSaida(query: string): Promise<DestinatarioBuscaItem[]> {
  if (query.length < 2) return [];
  const user = await requireUser();
  if (!(await usuarioPodeAlguma(user, ["estoque.saida"]))) return [];

  const resultado = await destinatarioDAO.list({ search: query, limit: 20 });
  return resultado.data.map((d) => ({
    id_destinatario: d.id_destinatario,
    razao_social: d.pessoaJuridica.razao_social,
  }));
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

/**
 * Busca priorizada de produtos para a saída, com o saldo disponível de cada
 * um — exibido na UI para avisar (sem bloquear) quando a solicitada excede.
 */
export async function buscarProdutosSaida(query: string): Promise<ProdutoSaidaBuscaItem[]> {
  if (query.length < 2) return [];
  const user = await requireUser();
  if (!(await usuarioPodeAlguma(user, ["estoque.saida"]))) return [];

  const produtos = await produtoDAO.searchPriorizadoComEstoque(query);
  return produtos.map((p) => {
    const quantidade = p.estoques.reduce((acc, e) => acc + Number(e.quantidade_atual), 0);
    const reservado = p.estoques.reduce((acc, e) => acc + Number(e.saldo_reservado), 0);
    return {
      id_produto: p.id_produto,
      descricao: p.descricao,
      saldo_disponivel: quantidade - reservado,
    };
  });
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
