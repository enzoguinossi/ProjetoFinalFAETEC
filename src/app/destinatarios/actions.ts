"use server";

import { destinatarioDAO } from "@/dao/destinatario";
import { codigoService } from "@/services/codigo";
import { cepService } from "@/services/cep";
import { contatoService } from "@/services/contato";
import { requireUser } from "@/lib/auth";
import { comPermissao, comPermissaoAlguma, usuarioPode, usuarioPodeAlguma } from "@/lib/permissoes";
import { mensagemDeErro } from "@/dao/_errors";
import { lerEnderecoDoFormData, lerEnderecoParcialDoFormData } from "@/lib/form-data";
import { formatarCodigo } from "@/lib/formatar";
import { validarCnpj } from "@/lib/cnpj";
import { resultadoVazio, type ListParams, type PaginatedResult } from "@/types";

export type DestinatarioListRow = {
  id_destinatario: number;
  codigo: string;
  razao: string;
};

export type DestinatarioFormData = {
  id_destinatario: number;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string | null;
  tipo_destinatario: "ESCOLA" | "CRECHE";
  ativo: boolean;
  endereco: {
    logradouro: string;
    numero: string | null;
    complemento: string | null;
    bairro: string | null;
    cidade: string;
    uf: string | null;
    cep: string | null;
    latitude: number | null;
    longitude: number | null;
  };
  codigos: { tipo: string; valor: string }[];
  emails: { endereco: string; principal: boolean }[];
  telefones: { numero: string; tipo: "CELULAR" | "FIXO" | "COMERCIAL"; principal: boolean }[];
};

/**
 * Lê o CNPJ do formulário: vazio → sem CNPJ; preenchido → precisa ser válido e
 * é gravado só com os dígitos.
 */
function lerCnpj(formData: FormData): { cnpj?: string } | { error: string } {
  const bruto = String(formData.get("cnpj") ?? "").trim();
  if (!bruto) return {};
  const resultado = validarCnpj(bruto);
  if (!resultado.ok) return { error: resultado.erro };
  return { cnpj: resultado.cnpj };
}

/**
 * Lê o nome fantasia do formulário: vazio → undefined (não grava).
 */
function lerNomeFantasia(formData: FormData): string | undefined {
  const valor = String(formData.get("nome_fantasia") ?? "").trim();
  return valor || undefined;
}

export async function listarDestinatarios(
  params: ListParams = {},
): Promise<PaginatedResult<DestinatarioListRow>> {
  const user = await requireUser();
  if (!(await usuarioPode(user, "destinatario.listar"))) return resultadoVazio(params);

  const resultado = await destinatarioDAO.list(params);
  return {
    ...resultado,
    data: resultado.data.map((d) => ({
      id_destinatario: d.id_destinatario,
      codigo: formatarCodigo(d.id_destinatario),
      razao: d.pessoaJuridica.razao_social,
    })),
  };
}

export async function buscarCep(cep: string) {
  return comPermissaoAlguma(["destinatario.criar", "destinatario.alterar"], () =>
    cepService.buscarEnderecoPorCep(cep),
  );
}

export async function getDestinatario(id: number): Promise<DestinatarioFormData | null> {
  const user = await requireUser();
  if (!(await usuarioPodeAlguma(user, ["destinatario.consultar", "destinatario.alterar"]))) return null;

  const d = await destinatarioDAO.getById(id);
  if (!d) return null;
  return {
    id_destinatario: d.id_destinatario,
    razao_social: d.pessoaJuridica.razao_social,
    nome_fantasia: d.pessoaJuridica.nome_fantasia,
    cnpj: d.pessoaJuridica.cnpj,
    tipo_destinatario: d.tipo_destinatario,
    ativo: d.ativo,
    endereco: {
      logradouro: d.endereco.logradouro,
      numero: d.endereco.numero,
      complemento: d.endereco.complemento,
      bairro: d.endereco.bairro,
      cidade: d.endereco.cidade,
      uf: d.endereco.uf,
      cep: d.endereco.cep,
      latitude: d.endereco.latitude,
      longitude: d.endereco.longitude,
    },
    codigos: d.destinatarioCodigos.map((c) => ({ tipo: c.tipoCodigo.nome, valor: c.codigo })),
    emails: d.emails.map((e) => ({ endereco: e.endereco, principal: e.principal })),
    telefones: d.telefones.map((t) => ({ numero: t.numero, tipo: t.tipo, principal: t.principal })),
  };
}

export async function createDestinatario(formData: FormData) {
  return comPermissao("destinatario.criar", async (user) => {
    const razao_social = formData.get("razao_social") as string;
    if (!razao_social?.trim()) return { error: "Razão social é obrigatória" };

    const cnpjResult = lerCnpj(formData);
    if ("error" in cnpjResult) return { error: cnpjResult.error };

    const codigoResult = await codigoService.resolverCodigosParaSalvar("DESTINATARIO", formData);
    if ("error" in codigoResult) return { error: codigoResult.error };

    const contatoResult = contatoService.resolverContatosParaSalvar(formData);
    if ("error" in contatoResult) return { error: contatoResult.error };

    try {
      await destinatarioDAO.create({
        razao_social: razao_social.trim(),
        nome_fantasia: lerNomeFantasia(formData),
        cnpj: cnpjResult.cnpj,
        tipo_destinatario: formData.get("tipo_destinatario") as "ESCOLA" | "CRECHE",
        codigos: codigoResult.codigos,
        ...contatoResult.contatos,
        endereco: lerEnderecoDoFormData(formData),
      }, user.id_usuario);
    } catch (e) {
      return { error: mensagemDeErro(e) };
    }

    return { success: true };
  });
}

export async function updateDestinatario(formData: FormData) {
  return comPermissao("destinatario.alterar", async (user) => {
    const id = Number(formData.get("id_destinatario"));
    if (!id) return { error: "ID inválido" };

    const ativo = formData.get("ativo") === "on";
    if (!ativo && !(await usuarioPode(user, "destinatario.desativar"))) {
      return { error: "Sem permissão para desativar." };
    }

    const cnpjResult = lerCnpj(formData);
    if ("error" in cnpjResult) return { error: cnpjResult.error };

    const codigoResult = await codigoService.resolverCodigosParaSalvar("DESTINATARIO", formData);
    if ("error" in codigoResult) return { error: codigoResult.error };

    const contatoResult = contatoService.resolverContatosParaSalvar(formData);
    if ("error" in contatoResult) return { error: contatoResult.error };

    try {
      await destinatarioDAO.update(id, {
        razao_social: (formData.get("razao_social") as string)?.trim(),
        nome_fantasia: lerNomeFantasia(formData),
        cnpj: cnpjResult.cnpj,
        tipo_destinatario: formData.get("tipo_destinatario") as "ESCOLA" | "CRECHE",
        ativo,
        codigos: codigoResult.codigos,
        ...contatoResult.contatos,
        endereco: lerEnderecoParcialDoFormData(formData),
      }, user.id_usuario);
    } catch (e) {
      return { error: mensagemDeErro(e) };
    }

    return { success: true };
  });
}

export async function deleteDestinatario(id: number) {
  return comPermissao("destinatario.excluir", async (user) => {
    try {
      await destinatarioDAO.hardDelete(id, user.id_usuario);
    } catch (e) {
      return { error: mensagemDeErro(e) };
    }
    return { success: true };
  });
}
