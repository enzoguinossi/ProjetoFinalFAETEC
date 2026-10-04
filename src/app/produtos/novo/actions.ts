"use server";

import { produtoDAO } from "@/dao/produto";
import { codigoService } from "@/services/codigo";
import { requireUser } from "@/lib/auth";
import { usuarioPode, usuarioPodeAlguma } from "@/lib/permissoes";
import { EntidadeComVinculosError } from "@/dao/_errors";
import { processarImagemWebp, processarImagemDeUrl, salvarImagemProduto, removerImagemProduto } from "@/lib/imagem";

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

export async function searchProdutos(query: string) {
  if (query.length < 2) return [];

  const user = await requireUser();
  if (!(await usuarioPodeAlguma(user, ["produto.listar", "produto.criar", "produto.alterar"]))) {
    return [];
  }

  return produtoDAO.searchPriorizado(query);
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

export async function createProduto(formData: FormData) {
  const user = await requireUser();
  if (!(await usuarioPode(user, "produto.criar"))) return { error: "Sem permissão." };

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

  // Códigos personalizados
  const codigoResult = await codigoService.resolverCodigosParaSalvar("PRODUTO", formData);
  if ("error" in codigoResult) return { error: codigoResult.error };
  const codigos = codigoResult.codigos;

  // Insumos (BOM)
  const insumos: { id_produto_filho: number; quantidade: number }[] = [];
  const idsFilho = formData.getAll("insumo_produto") as string[];
  const quantidades = formData.getAll("insumo_qtd") as string[];
  for (let i = 0; i < idsFilho.length; i++) {
    const id = Number(idsFilho[i]);
    const qtd = Number(quantidades[i]);
    if (!id || !qtd) continue;
    insumos.push({ id_produto_filho: id, quantidade: qtd });
  }

  const id_usuario = user.id_usuario;

  // Processa a imagem (upload ou URL externa) ANTES de persistir.
  const imagem = await resolverImagem(formData, foto_url);
  if (imagem && "error" in imagem) return { error: imagem.error };

  const criado = await produtoDAO.createCompleto(
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

  if (imagem) {
    try {
      const path = await salvarImagemProduto(criado.id_produto, imagem.buffer, imagem.hash);
      await produtoDAO.setFotoUrl(criado.id_produto, path);
    } catch {
      await produtoDAO.rollbackCreate(criado.id_produto);
      return { error: "Não foi possível salvar a imagem. O produto não foi criado." };
    }
  }

  return { success: true };
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

export async function updateProduto(formData: FormData) {
  const id = Number(formData.get("id_produto"));
  if (!id) return { error: "ID inválido" };

  const descricao = formData.get("descricao") as string;
  if (!descricao?.trim()) return { error: "Descrição é obrigatória" };

  const user = await requireUser();
  if (!(await usuarioPode(user, "produto.alterar"))) return { error: "Sem permissão." };

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

  const insumos: { id_produto_filho: number; quantidade: number }[] = [];
  const idsFilho = formData.getAll("insumo_produto") as string[];
  const quantidades = formData.getAll("insumo_qtd") as string[];
  for (let i = 0; i < idsFilho.length; i++) {
    const id_filho = Number(idsFilho[i]);
    const qtd = Number(quantidades[i]);
    if (!id_filho || !qtd) continue;
    insumos.push({ id_produto_filho: id_filho, quantidade: qtd });
  }

  const atual = await produtoDAO.getById(id);
  const fotoAnterior = atual?.foto_url ?? null;

  // Processa a imagem (upload ou URL externa) ANTES de persistir.
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

  // Remove a imagem antiga apenas após o sucesso, se houve substituição.
  if (novaFotoPath && fotoAnterior && fotoAnterior !== novaFotoPath) {
    await removerImagemProduto(fotoAnterior);
  }

  return { success: true };
}

export async function deleteProduto(id: number) {
  const user = await requireUser();
  if (!(await usuarioPode(user, "produto.excluir"))) return { error: "Sem permissão." };

  const { podeExcluir, vinculos } = await produtoDAO.verificarRelacionamentos(id);
  if (!podeExcluir) {
    return {
      error: `Não é possível excluir este produto pois ele possui vínculos com: ${vinculos.join(", ")}.`,
    };
  }

  try {
    await produtoDAO.hardDelete(id, user.id_usuario);
  } catch (e) {
    if (e instanceof EntidadeComVinculosError) return { error: e.message };
    throw e;
  }
  return { success: true };
}