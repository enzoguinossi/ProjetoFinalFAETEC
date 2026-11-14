"use server";

import { tipoProdutoDAO } from "@/dao/tipo-produto";
import { requireUser } from "@/lib/auth";
import { comPermissao, usuarioPodeAlguma } from "@/lib/permissoes";
import { mensagemDeErro } from "@/dao/_errors";
import type { TipoProdutoItem } from "@/types";

const PERMISSOES_VER_TIPO = [
  "tipo_produto.criar",
  "tipo_produto.alterar",
  "tipo_produto.excluir",
  "produto.criar",
  "produto.alterar",
  "produto.excluir",
];

/** Lista do cadastro de tipos (opções do formulário e do modal). */
export async function listarTiposProduto(): Promise<TipoProdutoItem[]> {
  const user = await requireUser();
  if (!(await usuarioPodeAlguma(user, PERMISSOES_VER_TIPO))) return [];
  return tipoProdutoDAO.list();
}

function lerNome(formData: FormData): string | { error: string } {
  const nome = String(formData.get("nome") ?? "").trim();
  if (!nome) return { error: "Nome é obrigatório." };
  if (nome.length > 191) return { error: "Nome muito longo (máximo 191 caracteres)." };
  return nome;
}

function lerPadrao(formData: FormData): boolean {
  const valor = String(formData.get("padrao") ?? "").toLowerCase();
  return valor === "on" || valor === "true" || valor === "1";
}

export async function criarTipoProduto(formData: FormData) {
  return comPermissao("tipo_produto.criar", async (user) => {
    const nome = lerNome(formData);
    if (typeof nome !== "string") return nome;

    try {
      await tipoProdutoDAO.create({ nome, padrao: lerPadrao(formData) }, user.id_usuario);
    } catch (e) {
      return { error: mensagemDeErro(e) };
    }
    return { success: true };
  });
}

export async function atualizarTipoProduto(formData: FormData) {
  return comPermissao("tipo_produto.alterar", async (user) => {
    const id = Number(formData.get("id_tipo_produto"));
    if (!Number.isInteger(id) || id <= 0) return { error: "ID inválido." };

    const nome = lerNome(formData);
    if (typeof nome !== "string") return nome;

    try {
      await tipoProdutoDAO.update(id, { nome, padrao: lerPadrao(formData) }, user.id_usuario);
    } catch (e) {
      return { error: mensagemDeErro(e) };
    }
    return { success: true };
  });
}

export async function excluirTipoProduto(id: number) {
  return comPermissao("tipo_produto.excluir", async (user) => {
    try {
      await tipoProdutoDAO.hardDelete(id, user.id_usuario);
    } catch (e) {
      return { error: mensagemDeErro(e) };
    }
    return { success: true };
  });
}
