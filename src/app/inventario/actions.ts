"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import {
  comPermissao,
  comPermissaoAlguma,
  usuarioPode,
  usuarioPodeAlguma,
} from "@/lib/permissoes";
import { mensagemDeErro } from "@/dao/_errors";
import { inventarioDAO, type DecidirAjusteInput } from "@/dao/inventario";
import { produtoDAO } from "@/dao/produto";
import { formatarCodigo } from "@/lib/formatar";
import { resultadoVazio, type ListParams, type PaginatedResult } from "@/types";
import type { OrigemAjuste, StatusInventario } from "@prisma/client";
import {
  mediaContagens,
  ROTULOS_ORIGEM_AJUSTE,
  ROTULOS_STATUS_AJUSTE,
  ROTULOS_STATUS_INVENTARIO,
  temDiferenca,
} from "@/services/inventario";

const PERMISSOES_VER = [
  "inventario.abrir",
  "inventario.contar",
  "inventario.aprovar_ajuste",
] as const;

export type InventarioListRow = {
  id_inventario: number;
  observacao: string;
  data_inicio: string;
  data_fim: string | null;
  status: StatusInventario;
  status_label: string;
  produtos: number;
  contados: number;
  abertura: string;
  podeEditar: boolean;
  podeExcluir: boolean;
  podeContar: boolean;
  podeAprovar: boolean;
  podeCancelar: boolean;
};

export type InventarioContagemRow = {
  id_contagem_inventario: number;
  id_funcionario: number;
  funcionario: string;
  quantidade_contada: number;
  data_contagem: string;
  observacao: string | null;
};

export type InventarioAjusteRow = {
  id_ajuste_inventario: number;
  quantidade_contada: number | null;
  origem: OrigemAjuste | null;
  origem_label: string | null;
  id_contagem_inventario: number | null;
  status: "PENDENTE" | "APROVADO" | "REJEITADO";
  status_label: string;
  justificativa: string | null;
  aprovador: string | null;
  data_aprovacao: string | null;
  movimentacao: {
    id_movimentacao: number;
    quantidade: number;
    saldo_anterior: number | null;
    saldo_posterior: number | null;
  } | null;
};

export type InventarioItemRow = {
  id_item_inventario: number;
  id_produto: number;
  codigo: string;
  descricao: string;
  ativo: boolean;
  quantidade_sistema: number | null;
  saldo_reservado: number | null;
  contagens: InventarioContagemRow[];
  media: number | null;
  minha_contagem: InventarioContagemRow | null;
  minha_observacao: string;
  diferenca_media: number | null;
  tem_diferenca: boolean | null;
  quantidade_final: number | null;
  origem: OrigemAjuste | null;
  origem_label: string | null;
  id_contagem_inventario: number | null;
  decidido_em: string | null;
  id_usuario_decisao: number | null;
  decidido: boolean;
  ajuste: InventarioAjusteRow | null;
};

export type InventarioFuncionarioContagem = {
  id_funcionario: number;
  nome: string;
};

export type InventarioDetalhe = {
  id_inventario: number;
  observacao: string;
  data_inicio: string;
  data_fim: string | null;
  status: StatusInventario;
  status_label: string;
  contagem_cega: boolean;
  abertura: string;
  aprovacao: string | null;
  total: number;
  contados: number;
  id_funcionario: number | null;
  funcionariosContagem: InventarioFuncionarioContagem[];
  podeVerSistema: boolean;
  podeContar: boolean;
  podeFechar: boolean;
  podeAprovar: boolean;
  podeCancelar: boolean;
  podeEditar: boolean;
  podeExcluir: boolean;
  podeGerarLista: boolean;
  podeGerarRelatorio: boolean;
  itens: InventarioItemRow[];
};

export type InventarioProdutoSelecao = {
  id_produto: number;
  codigo: string;
  descricao: string;
  saldo?: number;
};

function nomeUsuario(
  usuario:
    | { funcionario: { pessoaFisica: { nome: string } } }
    | null
    | undefined,
): string {
  return usuario?.funcionario.pessoaFisica.nome ?? "—";
}

/**
 * Remove do payload de relatório os valores de sistema/saldo quando o usuário
 * não pode vê-los. A página também esconde as colunas, mas a Server Action não
 * pode devolver o valor bruto.
 */
function mascararInventario<T extends {
  itens: {
    quantidade_sistema: number;
    quantidade_final?: number | null;
    produto: { saldo: number; saldo_reservado: number };
  }[];
  ajustes: { movimentacoes: unknown[]; quantidade_contada?: number }[];
}>(inventario: T): T {
  return {
    ...inventario,
    itens: inventario.itens.map((item) => ({
      ...item,
      quantidade_sistema: 0,
      quantidade_final: 0,
      produto: { ...item.produto, saldo: 0, saldo_reservado: 0 },
    })),
    ajustes: inventario.ajustes.map((ajuste) => ({
      ...ajuste,
      quantidade_contada: 0,
      movimentacoes: [],
    })),
  };
}

function revalidar(id?: number) {
  revalidatePath("/inventario");
  if (id) {
    revalidatePath(`/inventario/${id}`);
    revalidatePath(`/inventario/${id}/aprovar`);
    revalidatePath(`/inventario/${id}/lista`);
    revalidatePath(`/inventario/${id}/relatorio`);
  }
}

function podeAbrir(user: Awaited<ReturnType<typeof requireUser>>) {
  return usuarioPode(user, "inventario.abrir");
}

function mapearAjuste(
  ajuste: {
    id_ajuste_inventario: number;
    quantidade_contada: number;
    origem: OrigemAjuste;
    id_contagem_inventario: number | null;
    status: "PENDENTE" | "APROVADO" | "REJEITADO";
    justificativa: string | null;
    data_aprovacao: Date | null;
    usuarioAprovacao: {
      funcionario: { pessoaFisica: { nome: string } };
    } | null;
    movimentacoes: {
      id_movimentacao: number;
      quantidade: number;
      saldo_anterior: number | null;
      saldo_posterior: number | null;
    }[];
  },
  podeVerSistema: boolean,
): InventarioAjusteRow {
  return {
    id_ajuste_inventario: ajuste.id_ajuste_inventario,
    quantidade_contada: podeVerSistema ? Number(ajuste.quantidade_contada) : null,
    origem: podeVerSistema ? ajuste.origem : null,
    origem_label: podeVerSistema
      ? (ROTULOS_ORIGEM_AJUSTE[ajuste.origem] ?? ajuste.origem)
      : null,
    id_contagem_inventario: podeVerSistema ? ajuste.id_contagem_inventario : null,
    status: ajuste.status,
    status_label: ROTULOS_STATUS_AJUSTE[ajuste.status] ?? ajuste.status,
    justificativa: podeVerSistema ? ajuste.justificativa : null,
    aprovador: ajuste.usuarioAprovacao
      ? nomeUsuario(ajuste.usuarioAprovacao)
      : null,
    data_aprovacao: ajuste.data_aprovacao?.toISOString() ?? null,
    movimentacao:
      podeVerSistema && ajuste.movimentacoes[0]
        ? {
            id_movimentacao: ajuste.movimentacoes[0].id_movimentacao,
            quantidade: Number(ajuste.movimentacoes[0].quantidade),
            saldo_anterior:
              ajuste.movimentacoes[0].saldo_anterior === null
                ? null
                : Number(ajuste.movimentacoes[0].saldo_anterior),
            saldo_posterior:
              ajuste.movimentacoes[0].saldo_posterior === null
                ? null
                : Number(ajuste.movimentacoes[0].saldo_posterior),
          }
        : null,
  };
}

export async function listarInventarios(
  params: ListParams & { status?: StatusInventario } = {},
): Promise<PaginatedResult<InventarioListRow>> {
  const user = await requireUser();
  if (!(await usuarioPodeAlguma(user, [...PERMISSOES_VER]))) {
    return resultadoVazio(params);
  }

  const [resultado, abrir, podeContar, podeAprovar, podeCancelar] =
    await Promise.all([
      inventarioDAO.list(params),
      podeAbrir(user),
      usuarioPode(user, "inventario.contar"),
      usuarioPode(user, "inventario.aprovar_ajuste"),
      usuarioPodeAlguma(user, [
        "inventario.abrir",
        "inventario.aprovar_ajuste",
      ]),
    ]);

  return {
    ...resultado,
    data: resultado.data.map((inventario) => {
      const contados = inventario.itens.filter(
        (item) => item._count.contagens > 0,
      ).length;
      return {
        id_inventario: inventario.id_inventario,
        observacao:
          inventario.observacao?.trim() || `Inventário #${inventario.id_inventario}`,
        data_inicio: inventario.data_inicio.toISOString(),
        data_fim: inventario.data_fim?.toISOString() ?? null,
        status: inventario.status,
        status_label:
          ROTULOS_STATUS_INVENTARIO[inventario.status] ?? inventario.status,
        produtos: inventario.itens.length,
        contados,
        abertura: nomeUsuario(inventario.usuarioAbertura),
        podeEditar: abrir && inventario.status === "ABERTO" && contados === 0,
        podeExcluir: abrir && inventario.status === "ABERTO" && contados === 0,
        podeContar:
          (inventario.status === "ABERTO" || inventario.status === "EM_CONTAGEM") &&
          podeContar,
        podeAprovar:
          inventario.status === "AGUARDANDO_APROVACAO" && podeAprovar,
        podeCancelar:
          ["ABERTO", "EM_CONTAGEM", "AGUARDANDO_APROVACAO"].includes(
            inventario.status,
          ) && podeCancelar,
      };
    }),
  };
}

export async function getInventario(
  id: number,
): Promise<InventarioDetalhe | null> {
  const user = await requireUser();
  if (!(await usuarioPodeAlguma(user, [...PERMISSOES_VER]))) return null;

  const [usuario, podeVerSaldo, podeContar, podeAprovar, podeAbrir] =
    await Promise.all([
      prisma.usuario.findUnique({
        where: { id_usuario: user.id_usuario },
        select: { id_funcionario: true },
      }),
      usuarioPode(user, "estoque.ver_saldo"),
      usuarioPode(user, "inventario.contar"),
      usuarioPode(user, "inventario.aprovar_ajuste"),
      usuarioPode(user, "inventario.abrir"),
    ]);

  const inventario = await inventarioDAO.getById(id);
  if (!inventario) return null;
  const podeVerSistema = inventario.contagem_cega ? podeVerSaldo : true;

  const ajustesPorProduto = new Map(
    inventario.ajustes.map((ajuste) => [ajuste.id_produto, ajuste]),
  );
  const idFuncionario = usuario?.id_funcionario ?? null;

  const itens: InventarioItemRow[] = inventario.itens.map((item) => {
    const contagens = item.contagens.map((contagem) => ({
      id_contagem_inventario: contagem.id_contagem_inventario,
      id_funcionario: contagem.id_funcionario,
      funcionario: contagem.funcionario.pessoaFisica.nome,
      quantidade_contada: Number(contagem.quantidade_contada),
      data_contagem: contagem.data_contagem.toISOString(),
      observacao: contagem.observacao,
    }));
    const media = mediaContagens(
      contagens.map((contagem) => contagem.quantidade_contada),
    );
    const minha = contagens.find(
      (contagem) => contagem.id_funcionario === idFuncionario,
    );
    const quantidadeSistema = Number(item.quantidade_sistema);
    const ajuste = ajustesPorProduto.get(item.id_produto);
    const quantidadeFinal =
      item.quantidade_final === null ? null : Number(item.quantidade_final);
    const decidido = quantidadeFinal !== null;

    return {
      id_item_inventario: item.id_item_inventario,
      id_produto: item.id_produto,
      codigo: formatarCodigo(item.id_produto),
      descricao: item.produto.descricao,
      ativo: item.produto.ativo,
      quantidade_sistema: podeVerSistema ? quantidadeSistema : null,
      saldo_reservado: podeVerSistema ? Number(item.produto.saldo_reservado) : null,
      contagens,
      media: podeVerSistema ? media : null,
      minha_contagem: minha ?? null,
      minha_observacao: minha?.observacao ?? "",
      diferenca_media: podeVerSistema
        ? Math.round((media - quantidadeSistema) * 1000) / 1000
        : null,
      tem_diferenca:
        decidido && podeVerSistema
          ? temDiferenca(quantidadeSistema, quantidadeFinal)
          : null,
      quantidade_final: podeVerSistema ? quantidadeFinal : null,
      origem: podeVerSistema ? item.origem : null,
      origem_label:
        podeVerSistema && item.origem
          ? (ROTULOS_ORIGEM_AJUSTE[item.origem] ?? item.origem)
          : null,
      id_contagem_inventario: podeVerSistema ? item.id_contagem_inventario : null,
      decidido_em: podeVerSistema ? (item.decidido_em?.toISOString() ?? null) : null,
      id_usuario_decisao: podeVerSistema ? item.id_usuario_decisao : null,
      decidido,
      ajuste: ajuste ? mapearAjuste(ajuste, podeVerSistema) : null,
    };
  });

  const contados = itens.filter((item) => item.contagens.length > 0).length;
  const funcionariosMap = new Map<number, InventarioFuncionarioContagem>();
  for (const item of inventario.itens) {
    for (const contagem of item.contagens) {
      if (!funcionariosMap.has(contagem.id_funcionario)) {
        funcionariosMap.set(contagem.id_funcionario, {
          id_funcionario: contagem.id_funcionario,
          nome: contagem.funcionario.pessoaFisica.nome,
        });
      }
    }
  }
  const funcionariosContagem = [...funcionariosMap.values()].sort((a, b) =>
    a.nome.localeCompare(b.nome, "pt-BR"),
  );
  const status = inventario.status;
  const podeGerarLista = await usuarioPode(user, "relatorio.gerar");

  return {
    id_inventario: inventario.id_inventario,
    observacao:
      inventario.observacao?.trim() || `Inventário #${inventario.id_inventario}`,
    data_inicio: inventario.data_inicio.toISOString(),
    data_fim: inventario.data_fim?.toISOString() ?? null,
    status,
    status_label: ROTULOS_STATUS_INVENTARIO[status] ?? status,
    contagem_cega: inventario.contagem_cega,
    abertura: nomeUsuario(inventario.usuarioAbertura),
    aprovacao: inventario.usuarioAprovacao
      ? nomeUsuario(inventario.usuarioAprovacao)
      : null,
    total: itens.length,
    contados,
    id_funcionario: idFuncionario,
    funcionariosContagem,
    podeVerSistema,
    podeContar:
      (status === "ABERTO" || status === "EM_CONTAGEM") && podeContar,
    podeFechar:
      (status === "ABERTO" || status === "EM_CONTAGEM") &&
      (podeContar || podeAbrir),
    podeAprovar: status === "AGUARDANDO_APROVACAO" && podeAprovar,
    podeCancelar:
      ["ABERTO", "EM_CONTAGEM", "AGUARDANDO_APROVACAO"].includes(status) &&
      (podeAbrir || podeAprovar),
    podeEditar:
      status === "ABERTO" && contados === 0 && podeAbrir,
    podeExcluir:
      status === "ABERTO" && contados === 0 && podeAbrir,
    podeGerarLista,
    podeGerarRelatorio:
      podeGerarLista && (status === "FINALIZADO" || status === "CANCELADO"),
    itens,
  };
}

export async function listarProdutosSelecao(
  search = "",
): Promise<InventarioProdutoSelecao[] | { error: string }> {
  return comPermissao("inventario.abrir", async (user) => {
    const podeVerSistema = await usuarioPode(user, "estoque.ver_saldo");
    const resultado = await produtoDAO.list({ search, page: 1, limit: 100 });
    return resultado.data.map((produto) => ({
      id_produto: produto.id_produto,
      codigo: formatarCodigo(produto.id_produto),
      descricao: produto.descricao,
      ...(podeVerSistema ? { saldo: Number(produto.saldo) } : {}),
    }));
  });
}

export async function abrirInventario(input: {
  observacao: string;
  contagem_cega: boolean;
  todos: boolean;
  id_produtos: number[];
}) {
  return comPermissao("inventario.abrir", async (user) => {
    try {
      const inventario = await inventarioDAO.criar(input, user.id_usuario);
      revalidar(inventario.id_inventario);
      return { ok: true as const, id: inventario.id_inventario };
    } catch (e) {
      return { error: mensagemDeErro(e, "Não foi possível abrir o inventário.") };
    }
  });
}

export async function editarInventario(
  id: number,
  input: {
    observacao: string;
    contagem_cega: boolean;
    todos: boolean;
    id_produtos: number[];
  },
) {
  return comPermissao("inventario.abrir", async (user) => {
    try {
      await inventarioDAO.atualizar(id, input, user.id_usuario);
      revalidar(id);
      return { ok: true as const };
    } catch (e) {
      return { error: mensagemDeErro(e, "Não foi possível editar o inventário.") };
    }
  });
}

export async function excluirInventario(id: number) {
  return comPermissao("inventario.abrir", async (user) => {
    try {
      await inventarioDAO.excluir(id, user.id_usuario);
      revalidar(id);
      return { ok: true as const };
    } catch (e) {
      return { error: mensagemDeErro(e, "Não foi possível excluir o inventário.") };
    }
  });
}

export async function registrarContagem(input: {
  id_inventario: number;
  id_item_inventario: number;
  quantidade: number;
  observacao?: string;
}) {
  return comPermissao("inventario.contar", async (user) => {
    try {
      const usuario = await prisma.usuario.findUnique({
        where: { id_usuario: user.id_usuario },
        select: { id_funcionario: true },
      });
      if (!usuario) throw new Error("Usuário sem funcionário vinculado.");
      const contagem = await inventarioDAO.contar(
        { ...input, id_funcionario: usuario.id_funcionario },
        user.id_usuario,
      );
      revalidar(input.id_inventario);
      return { ok: true as const, id: contagem.id_contagem_inventario };
    } catch (e) {
      return { error: mensagemDeErro(e, "Não foi possível registrar a contagem.") };
    }
  });
}

export async function fecharContagem(id: number) {
  return comPermissaoAlguma(
    ["inventario.contar", "inventario.abrir"],
    async (user) => {
      try {
        await inventarioDAO.fecharContagem(id, user.id_usuario);
        revalidar(id);
        return { ok: true as const };
      } catch (e) {
        return { error: mensagemDeErro(e, "Não foi possível fechar a contagem.") };
      }
    },
  );
}

export async function cancelarInventario(id: number) {
  return comPermissaoAlguma(
    ["inventario.abrir", "inventario.aprovar_ajuste"],
    async (user) => {
      try {
        await inventarioDAO.cancelar(id, user.id_usuario);
        revalidar(id);
        return { ok: true as const };
      } catch (e) {
        return { error: mensagemDeErro(e, "Não foi possível cancelar o inventário.") };
      }
    },
  );
}

export async function decidirAjuste(input: Omit<DecidirAjusteInput, "id_usuario">) {
  return comPermissao("inventario.aprovar_ajuste", async (user) => {
    try {
      await inventarioDAO.decidirAjuste({ ...input, id_usuario: user.id_usuario });
      revalidar(input.id_inventario);
      return { ok: true as const };
    } catch (e) {
      return { error: mensagemDeErro(e, "Não foi possível decidir o ajuste.") };
    }
  });
}

export async function finalizarInventario(id: number) {
  return comPermissao("inventario.aprovar_ajuste", async (user) => {
    try {
      await inventarioDAO.finalizar(id, user.id_usuario);
      revalidar(id);
      return { ok: true as const };
    } catch (e) {
      return { error: mensagemDeErro(e, "Não foi possível finalizar o inventário.") };
    }
  });
}

/** Dados da lista impressa: sem quantidades do sistema quando não autorizado. */
export async function getListaContagem(
  id: number,
  mostrarSistema = false,
) {
  return comPermissao("relatorio.gerar", async (user) => {
    if (!(await usuarioPodeAlguma(user, [...PERMISSOES_VER]))) return null;
    const podeSaldo = await usuarioPode(user, "estoque.ver_saldo");
    const inventario = await inventarioDAO.getById(id);
    if (!inventario) return null;
    const podeVerSistema = inventario.contagem_cega ? podeSaldo : true;
    const usuarioAtual = await prisma.usuario.findUnique({
      where: { id_usuario: user.id_usuario },
      select: {
        funcionario: { select: { pessoaFisica: { select: { nome: true } } } },
      },
    });

    return {
      id_inventario: inventario.id_inventario,
      observacao:
        inventario.observacao?.trim() || `Inventário #${inventario.id_inventario}`,
      data_inicio: inventario.data_inicio.toISOString(),
      emitente: nomeUsuario(usuarioAtual),
      abertura: nomeUsuario(inventario.usuarioAbertura),
      podeVerSistema,
      mostrarSistema: mostrarSistema && podeVerSistema,
      itens: inventario.itens.map((item) => ({
        id_item_inventario: item.id_item_inventario,
        codigo: formatarCodigo(item.id_produto),
        descricao: item.produto.descricao,
        quantidade_sistema: podeVerSistema
          ? Number(item.quantidade_sistema)
          : null,
      })),
    };
  });
}

/** Relatório de um inventário fechado/cancelado. */
export async function getRelatorioInventario(id: number) {
  return comPermissao("relatorio.gerar", async (user) => {
    if (!(await usuarioPodeAlguma(user, [...PERMISSOES_VER]))) return null;
    const podeSaldo = await usuarioPode(user, "estoque.ver_saldo");
    const inventario = await inventarioDAO.getById(id);
    if (!inventario) return null;
    if (inventario.status !== "FINALIZADO" && inventario.status !== "CANCELADO") {
      return null;
    }
    const podeVerSistema = inventario.contagem_cega ? podeSaldo : true;
    const usuarioAtual = await prisma.usuario.findUnique({
      where: { id_usuario: user.id_usuario },
      select: {
        funcionario: { select: { pessoaFisica: { select: { nome: true } } } },
      },
    });
    return {
      inventario: podeVerSistema ? inventario : mascararInventario(inventario),
      podeVerSistema,
      emitente: nomeUsuario(usuarioAtual),
    };
  });
}
