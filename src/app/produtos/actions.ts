"use server";

import { produtoDAO } from "@/dao/produto";
import { codigoService } from "@/services/codigo";
import { requireUser } from "@/lib/auth";
import { comPermissao, usuarioPode, usuarioPodeAlguma } from "@/lib/permissoes";
import { mensagemDeErro } from "@/dao/_errors";
import { lerJson } from "@/lib/form-data";
import {
  processarImagemDoFormulario,
  salvarImagemAnexo,
  removerImagemAnexo,
} from "@/lib/imagem";
import { anexoService } from "@/services/anexo";
import { produtoParaLinha, type ProdutoListRow } from "@/lib/produto-linha";
import { textoFiltro } from "@/lib/filtros";
import { resultadoVazio, type ListParams, type PaginatedResult } from "@/types";

export type { ProdutoListRow };

export type ProdutoItem = { id_produto: number; descricao: string };

export type ProdutoFormData = {
  id_produto: number;
  descricao: string;
  perecivel: boolean;
  composto: boolean;
  data_validade: string | null;
  id_conversao_padrao: number;
  id_conversao_saida: number;
  foto_url: string | null;
  /** Anexos ativos do produto (o primeiro é a foto atual). */
  fotos: { id_anexo: number; url: string }[];
  ativo: boolean;
  /** Saldo atual em base (somente leitura; não editável no formulário). */
  saldo: number;
  /** Saldo reservado em base (somente leitura). */
  saldo_reservado: number;
  codigos: { tipo: string; valor: string }[];
  insumos: { id: number; descricao: string; qtd: number }[];
};

export type ProdutoListaFiltros = {
  /** true = só ativos (default) | false = só inativos | null = todos */
  ativo?: boolean | null;
  perecivel?: boolean;
  composto?: boolean;
  id_tipo_codigo?: number[];
};

export async function listarProdutos(
  params: ListParams &
    ProdutoListaFiltros & { incluirInativos?: boolean; excludeIds?: number[] } = {},
): Promise<PaginatedResult<ProdutoListRow>> {
  const user = await requireUser();
  if (!(await usuarioPode(user, "produto.listar"))) return resultadoVazio(params);

  // A permissão é conferida no servidor: sem ela, o payload não consegue
  // forçar produtos inativos — o filtro de situação cai sempre em "só ativos".
  const podeVerInativos = await usuarioPode(user, "produto.ver_inativos");
  const incluir = podeVerInativos && params.incluirInativos === true;
  const ativoRecebido =
    typeof params.ativo === "boolean" || params.ativo === null ? params.ativo : undefined;
  const ativo = incluir ? ativoRecebido : true;

  const filtros = {
    ativo,
    perecivel: typeof params.perecivel === "boolean" ? params.perecivel : undefined,
    composto: typeof params.composto === "boolean" ? params.composto : undefined,
    id_tipo_codigo: Array.isArray(params.id_tipo_codigo)
      ? params.id_tipo_codigo.filter((id) => Number.isInteger(id))
      : undefined,
  };

  const search = textoFiltro(params.search);

  if (search) {
    const excluidos = new Set(params.excludeIds ?? []);
    const data = (await produtoDAO.searchPriorizadoComSaldo(search, 50, filtros))
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

  const resultado = await produtoDAO.list(
    { ...params, ...filtros, search },
    params.excludeIds ?? [],
  );
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
): Promise<{
  buffer: Buffer;
  hash: string;
  nome_arquivo: string;
  tipo_mime: string;
} | null | { error: string }> {
  return processarImagemDoFormulario(formData, "foto_arquivo", fotoUrl);
}

/** IDs de anexos marcados para remoção no formulário (`remover_anexos`). */
function lerRemoverAnexos(formData: FormData): number[] {
  const bruto = String(formData.get("remover_anexos") ?? "").trim();
  if (!bruto) return [];
  return bruto
    .split(",")
    .map((valor) => Number(valor))
    .filter((valor) => Number.isInteger(valor) && valor > 0);
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
  // Produto inativo só é acessível por quem pode vê-los na listagem.
  if (!p.ativo && !(await usuarioPode(user, "produto.ver_inativos"))) return null;

  return {
    id_produto: p.id_produto,
    descricao: p.descricao,
    perecivel: p.perecivel,
    composto: p.composto,
    data_validade: p.data_validade ? p.data_validade.toISOString().split("T")[0] : null,
    id_conversao_padrao: p.id_conversao_padrao,
    id_conversao_saida: p.id_conversao_saida,
    foto_url: p.anexos[0]?.url ?? null,
    fotos: p.anexos.map((anexo) => ({ id_anexo: anexo.id_anexo, url: anexo.url })),
    ativo: p.ativo,
    saldo: Number(p.saldo),
    saldo_reservado: Number(p.saldo_reservado),
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
    const id_conversao_saida = formData.get("id_conversao_saida")
      ? Number(formData.get("id_conversao_saida"))
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

    let novaUrl: string | null = null;
    try {
      await produtoDAO.createCompleto(
        {
          descricao: descricao.trim(),
          perecivel,
          composto,
          data_validade,
          id_conversao_padrao: id_conversao,
          id_conversao_saida,
          codigos,
          insumos,
        },
        id_usuario,
        async (tx, idProduto) => {
          if (!imagem) return;
          novaUrl = await salvarImagemAnexo(
            `produtos/${idProduto}`,
            imagem.buffer,
            imagem.hash,
          );
          await anexoService.criarAnexos(
            { tipo: "produto", id: idProduto },
            [
              {
                nome_arquivo: imagem.nome_arquivo,
                url: novaUrl,
                tipo_mime: imagem.tipo_mime,
              },
            ],
            id_usuario,
            tx,
          );
        },
      );
    } catch (e) {
      // Transação desfeita: o arquivo recém-gravado não pode sobrar no disco.
      if (novaUrl) await removerImagemAnexo(novaUrl);
      return { error: mensagemDeErro(e) };
    }

    return { success: true };
  });
}

export async function updateProduto(formData: FormData) {
  return comPermissao("produto.alterar", async (user) => {
    const id = Number(formData.get("id_produto"));
    if (!id) return { error: "ID inválido" };

    // Editar um produto inativo exige enxergá-lo (`produto.ver_inativos`);
    // `produto.alterar` sozinho não pode alcançar registro fora da listagem.
    const atual = await produtoDAO.getById(id);
    if (!atual) return { error: "Produto não encontrado." };
    if (!atual.ativo && !(await usuarioPode(user, "produto.ver_inativos"))) {
      return { error: "Sem permissão." };
    }

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
    const id_conversao_saida = formData.get("id_conversao_saida")
      ? Number(formData.get("id_conversao_saida"))
      : undefined;
    const data_validade = perecivel
      ? (formData.get("data_validade") as string) || undefined
      : undefined;

    const codigoResult = await codigoService.resolverCodigosParaSalvar("PRODUTO", formData);
    if ("error" in codigoResult) return { error: codigoResult.error };
    const codigos = codigoResult.codigos;

    const insumos = lerInsumos(formData);

    const imagem = await resolverImagem(formData, foto_url);
    if (imagem && "error" in imagem) return { error: imagem.error };

    const id_usuario = user.id_usuario;
    const dono = { tipo: "produto" as const, id };
    const removerIds = lerRemoverAnexos(formData);
    const urlsAntigas: string[] = [];
    let novaUrl: string | null = null;

    try {
      await produtoDAO.updateCompleto(
        id,
        {
          descricao: descricao.trim(),
          perecivel,
          composto,
          ativo,
          data_validade,
          id_conversao_padrao: id_conversao,
          id_conversao_saida,
          codigos,
          insumos,
        },
        id_usuario,
        async (tx) => {
          if (removerIds.length > 0) {
            const ativos = await anexoService.listarAtivos(dono, tx);
            for (const anexo of ativos) {
              if (!removerIds.includes(anexo.id_anexo)) continue;
              await anexoService.desativar(anexo.id_anexo, id_usuario, tx);
              urlsAntigas.push(anexo.url);
            }
          }
          if (imagem) {
            novaUrl = await salvarImagemAnexo(
              `produtos/${id}`,
              imagem.buffer,
              imagem.hash,
            );
            const troca = await anexoService.substituirFoto(
              dono,
              {
                nome_arquivo: imagem.nome_arquivo,
                url: novaUrl,
                tipo_mime: imagem.tipo_mime,
              },
              id_usuario,
              tx,
            );
            urlsAntigas.push(...troca.urlsAntigas);
          }
        },
      );
    } catch (e) {
      if (novaUrl) await removerImagemAnexo(novaUrl);
      return { error: mensagemDeErro(e) };
    }

    // Só depois do commit removemos do disco as fotos substituídas.
    for (const url of urlsAntigas) {
      if (url !== novaUrl) await removerImagemAnexo(url);
    }

    return { success: true };
  });
}

export async function deleteProduto(id: number) {
  return comPermissao("produto.excluir", async (user) => {
    try {
      const urls = await produtoDAO.hardDelete(id, user.id_usuario);
      for (const url of urls) await removerImagemAnexo(url);
    } catch (e) {
      return { error: mensagemDeErro(e) };
    }
    return { success: true };
  });
}
