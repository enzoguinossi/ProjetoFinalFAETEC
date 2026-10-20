"use server";

import { produtoDAO } from "@/dao/produto";
import { codigoService } from "@/services/codigo";
import { requireUser } from "@/lib/auth";
import { comPermissao, usuarioPode, usuarioPodeAlguma } from "@/lib/permissoes";
import { mensagemDeErro } from "@/dao/_errors";
import { lerJson } from "@/lib/form-data";
import { processarImagemWebp, processarImagemDeUrl, salvarImagemProduto, removerImagemProduto } from "@/lib/imagem";
import { produtoParaLinha, type ProdutoListRow } from "@/lib/produto-linha";
import { resultadoVazio, type ListParams, type PaginatedResult } from "@/types";

export type { ProdutoListRow };

export type ProdutoItem = { id_produto: number; descricao: string };

export type ProdutoFormData = {
  id_produto: number;
  descricao: string;
  perecivel: boolean;
  composto: boolean;
  data_validade: string | null;
  id_conversao_padrao: number | null;
  foto_url: string | null;
  ativo: boolean;
  codigos: { tipo: string; valor: string }[];
  insumos: { id: number; descricao: string; qtd: number }[];
};

export async function listarProdutos(
  params: ListParams & { excludeIds?: number[] } = {},
): Promise<PaginatedResult<ProdutoListRow>> {
  const user = await requireUser();
  if (!(await usuarioPode(user, "produto.listar"))) return resultadoVazio(params);

  if (params.search) {
    const excluidos = new Set(params.excludeIds ?? []);
    const data = (await produtoDAO.searchPriorizadoComEstoque(params.search))
      .map(produtoParaLinha)
      .filter((linha) => !excluidos.has(linha.id_produto));
    return {
      data,
      total: data.length,
      page: 1,
      limit: data.length || (params.limit ?? 20),
      totalPages: data.length > 0 ? 1 : 0,
    };
  }

  const resultado = await produtoDAO.list(params, params.excludeIds ?? []);
  return { ...resultado, data: resultado.data.map(produtoParaLinha) };
}

/**
 * Resolve a imagem do produto a partir do upload (foto_arquivo) ou de uma URL
 * externa (foto_url). Em ambos os casos converte para WEBP. Retorna o buffer
 * processado, `null` se não houver imagem, ou `{ error }` em falha.
 */
async function resolverImagem(
  formData: FormData,
  fotoUrl: string | undefined,
): Promise<{ buffer: Buffer; hash: string } | null | { error: string }> {
  const arquivo = formData.get("foto_arquivo");
  if (arquivo instanceof File && arquivo.size > 0) {
    const res = await processarImagemWebp(arquivo);
    if (!res.ok) return { error: res.error };
    return { buffer: res.buffer, hash: res.hash };
  }

  const url = fotoUrl?.trim();
  if (url && /^https?:\/\//i.test(url)) {
    const res = await processarImagemDeUrl(url);
    if (!res.ok) return { error: res.error };
    return { buffer: res.buffer, hash: res.hash };
  }

  return null;
}

/** Lê o campo `insumos` (JSON: [{ id, qtd }]) do FormData. */
function lerInsumos(formData: FormData): { id_produto_filho: number; quantidade: number }[] {
  const raw = lerJson(formData, "insumos");
  if (!Array.isArray(raw)) return [];

  const insumos: { id_produto_filho: number; quantidade: number }[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const id = Number((item as { id?: unknown }).id);
    const qtd = Number((item as { qtd?: unknown }).qtd);
    if (!id || !qtd) continue;
    insumos.push({ id_produto_filho: id, quantidade: qtd });
  }
  return insumos;
}

export async function getProduto(id: number): Promise<ProdutoFormData | null> {
  const user = await requireUser();
  if (!(await usuarioPodeAlguma(user, ["produto.consultar", "produto.alterar"]))) return null;

  const p = await produtoDAO.getById(id);
  if (!p) return null;

  return {
    id_produto: p.id_produto,
    descricao: p.descricao,
    perecivel: p.perecivel,
    composto: p.composto,
    data_validade: p.data_validade ? p.data_validade.toISOString().split("T")[0] : null,
    id_conversao_padrao: p.id_conversao_padrao,
    foto_url: p.foto_url,
    ativo: p.ativo,
    codigos: p.produtoCodigos.map((c) => ({
      tipo: c.tipoCodigo.nome,
      valor: c.codigo,
    })),
    insumos: p.insumosPai.map((i) => ({
      id: i.id_produto_filho,
      descricao: i.produtoFilho.descricao,
      qtd: Number(i.quantidade),
    })),
  };
}

export async function createProduto(formData: FormData) {
  return comPermissao("produto.criar", async (user) => {
    const descricao = formData.get("descricao") as string;
    if (!descricao?.trim()) return { error: "Descrição é obrigatória" };

    const perecivel = formData.get("perecivel") === "on";
    const composto = formData.get("composto") === "on";
    const foto_url = (formData.get("foto_url") as string) || undefined;
    const id_conversao = formData.get("id_conversao")
      ? Number(formData.get("id_conversao"))
      : undefined;
    const data_validade = perecivel
      ? (formData.get("data_validade") as string) || undefined
      : undefined;

    const codigoResult = await codigoService.resolverCodigosParaSalvar("PRODUTO", formData);
    if ("error" in codigoResult) return { error: codigoResult.error };
    const codigos = codigoResult.codigos;

    const insumos = lerInsumos(formData);

    const id_usuario = user.id_usuario;

    const imagem = await resolverImagem(formData, foto_url);
    if (imagem && "error" in imagem) return { error: imagem.error };

    let criado: { id_produto: number };
    try {
      criado = await produtoDAO.createCompleto(
        {
          descricao: descricao.trim(),
          foto_url: imagem ? undefined : foto_url,
          perecivel,
          composto,
          data_validade,
          id_conversao_padrao: id_conversao,
          codigos,
          insumos,
        },
        id_usuario,
      );
    } catch (e) {
      return { error: mensagemDeErro(e) };
    }

    if (imagem) {
      try {
        const path = await salvarImagemProduto(criado.id_produto, imagem.buffer, imagem.hash);
        await produtoDAO.setFotoUrl(criado.id_produto, path, id_usuario);
      } catch {
        await produtoDAO.rollbackCreate(criado.id_produto, id_usuario);
        return { error: "Não foi possível salvar a imagem. O produto não foi criado." };
      }
    }

    return { success: true };
  });
}

export async function updateProduto(formData: FormData) {
  return comPermissao("produto.alterar", async (user) => {
    const id = Number(formData.get("id_produto"));
    if (!id) return { error: "ID inválido" };

    const descricao = formData.get("descricao") as string;
    if (!descricao?.trim()) return { error: "Descrição é obrigatória" };

    const perecivel = formData.get("perecivel") === "on";
    const composto = formData.get("composto") === "on";
    const ativo = formData.get("ativo") === "on";
    if (!ativo && !(await usuarioPode(user, "produto.desativar"))) {
      return { error: "Sem permissão para desativar." };
    }
    const foto_url = (formData.get("foto_url") as string) || undefined;
    const id_conversao = formData.get("id_conversao")
      ? Number(formData.get("id_conversao"))
      : undefined;
    const data_validade = perecivel
      ? (formData.get("data_validade") as string) || undefined
      : undefined;

    const codigoResult = await codigoService.resolverCodigosParaSalvar("PRODUTO", formData);
    if ("error" in codigoResult) return { error: codigoResult.error };
    const codigos = codigoResult.codigos;

    const insumos = lerInsumos(formData);

    const atual = await produtoDAO.getById(id);
    const fotoAnterior = atual?.foto_url ?? null;

    const imagem = await resolverImagem(formData, foto_url);
    if (imagem && "error" in imagem) return { error: imagem.error };

    let novaFotoPath: string | null = null;
    if (imagem) {
      try {
        novaFotoPath = await salvarImagemProduto(id, imagem.buffer, imagem.hash);
      } catch {
        return { error: "Não foi possível salvar a imagem. Nenhuma alteração foi feita." };
      }
    }

    try {
      await produtoDAO.updateCompleto(
        id,
        {
          descricao: descricao.trim(),
          foto_url: novaFotoPath ?? foto_url,
          perecivel,
          composto,
          ativo,
          data_validade,
          id_conversao_padrao: id_conversao,
          codigos,
          insumos,
        },
        user.id_usuario,
      );
    } catch (e) {
      return { error: mensagemDeErro(e) };
    }

    if (novaFotoPath && fotoAnterior && fotoAnterior !== novaFotoPath) {
      await removerImagemProduto(fotoAnterior);
    }

    return { success: true };
  });
}

export async function deleteProduto(id: number) {
  return comPermissao("produto.excluir", async (user) => {
    try {
      await produtoDAO.hardDelete(id, user.id_usuario);
    } catch (e) {
      return { error: mensagemDeErro(e) };
    }
    return { success: true };
  });
}
