"use server";

import { tipoDestinatarioDAO } from "@/dao/tipo-destinatario";
import { requireUser } from "@/lib/auth";
import { comPermissao, usuarioPodeAlguma } from "@/lib/permissoes";
import { mensagemDeErro } from "@/dao/_errors";
import type { TipoDestinatarioItem } from "@/types";

const PERMISSOES_VER_TIPO = [
  "tipo_destinatario.criar",
  "tipo_destinatario.alterar",
  "tipo_destinatario.excluir",
  "destinatario.criar",
  "destinatario.alterar",
];

/** Lista do cadastro de tipos (opções do formulário e do modal). */
export async function listarTiposDestinatario(): Promise<TipoDestinatarioItem[]> {
  const user = await requireUser();
  if (!(await usuarioPodeAlguma(user, PERMISSOES_VER_TIPO))) return [];
  return tipoDestinatarioDAO.list();
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

export async function criarTipoDestinatario(formData: FormData) {
  return comPermissao("tipo_destinatario.criar", async (user) => {
    const nome = lerNome(formData);
    if (typeof nome !== "string") return nome;

    try {
      await tipoDestinatarioDAO.create({ nome, padrao: lerPadrao(formData) }, user.id_usuario);
    } catch (e) {
      return { error: mensagemDeErro(e) };
    }
    return { success: true };
  });
}

export async function atualizarTipoDestinatario(formData: FormData) {
  return comPermissao("tipo_destinatario.alterar", async (user) => {
    const id = Number(formData.get("id_tipo_destinatario"));
    if (!Number.isInteger(id) || id <= 0) return { error: "ID inválido." };

    const nome = lerNome(formData);
    if (typeof nome !== "string") return nome;

    try {
      await tipoDestinatarioDAO.update(id, { nome, padrao: lerPadrao(formData) }, user.id_usuario);
    } catch (e) {
      return { error: mensagemDeErro(e) };
    }
    return { success: true };
  });
}

export async function excluirTipoDestinatario(id: number) {
  return comPermissao("tipo_destinatario.excluir", async (user) => {
    try {
      await tipoDestinatarioDAO.hardDelete(id, user.id_usuario);
    } catch (e) {
      return { error: mensagemDeErro(e) };
    }
    return { success: true };
  });
}
