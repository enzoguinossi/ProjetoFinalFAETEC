"use server";

import { fornecedorDAO } from "@/dao/fornecedor";
import { codigoService } from "@/services/codigo";
import { cepService } from "@/services/cep";
import { contatoService } from "@/services/contato";
import { requireUser } from "@/lib/auth";
import { comPermissao, comPermissaoAlguma, usuarioPode, usuarioPodeAlguma } from "@/lib/permissoes";
import { mensagemDeErro } from "@/dao/_errors";
import { lerEnderecoDoFormData, lerEnderecoParcialDoFormData } from "@/lib/form-data";
import { formatarCodigo } from "@/lib/formatar";
import { resultadoVazio, type ListParams, type PaginatedResult } from "@/types";

export type FornecedorListRow = {
  id_fornecedor: number;
  codigo: string;
  razao: string;
};

export type FornecedorFormData = {
  id_fornecedor: number;
  razao_social: string;
  cnpj: string | null;
  contato: string | null;
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
  } | null;
  codigos: { tipo: string; valor: string }[];
  emails: { endereco: string; principal: boolean }[];
  telefones: { numero: string; tipo: "CELULAR" | "FIXO" | "COMERCIAL"; principal: boolean }[];
};

export async function listarFornecedores(
  params: ListParams = {},
): Promise<PaginatedResult<FornecedorListRow>> {
  const user = await requireUser();
  if (!(await usuarioPode(user, "fornecedor.listar"))) return resultadoVazio(params);

  const resultado = await fornecedorDAO.list(params);
  return {
    ...resultado,
    data: resultado.data.map((f) => ({
      id_fornecedor: f.id_fornecedor,
      codigo: formatarCodigo(f.id_fornecedor),
      razao: f.pessoaJuridica.razao_social,
    })),
  };
}

export async function buscarCep(cep: string) {
  return comPermissaoAlguma(["fornecedor.criar", "fornecedor.alterar"], () =>
    cepService.buscarEnderecoPorCep(cep),
  );
}

export async function getFornecedor(id: number): Promise<FornecedorFormData | null> {
  const user = await requireUser();
  if (!(await usuarioPodeAlguma(user, ["fornecedor.consultar", "fornecedor.alterar"]))) return null;

  const f = await fornecedorDAO.getById(id);
  if (!f) return null;
  return {
    id_fornecedor: f.id_fornecedor,
    razao_social: f.pessoaJuridica.razao_social,
    cnpj: f.pessoaJuridica.cnpj,
    contato: f.contato,
    ativo: f.ativo,
    endereco: f.endereco ? {
      logradouro: f.endereco.logradouro,
      numero: f.endereco.numero,
      complemento: f.endereco.complemento,
      bairro: f.endereco.bairro,
      cidade: f.endereco.cidade,
      uf: f.endereco.uf,
      cep: f.endereco.cep,
      latitude: f.endereco.latitude,
      longitude: f.endereco.longitude,
    } : null,
    codigos: f.fornecedorCodigos.map((c) => ({ tipo: c.tipoCodigo.nome, valor: c.codigo })),
    emails: f.emails.map((e) => ({ endereco: e.endereco, principal: e.principal })),
    telefones: f.telefones.map((t) => ({ numero: t.numero, tipo: t.tipo, principal: t.principal })),
  };
}

export async function createFornecedor(formData: FormData) {
  return comPermissao("fornecedor.criar", async (user) => {
    const razao_social = formData.get("razao_social") as string;
    if (!razao_social?.trim()) return { error: "Razão social é obrigatória" };

    const codigoResult = await codigoService.resolverCodigosParaSalvar("FORNECEDOR", formData);
    if ("error" in codigoResult) return { error: codigoResult.error };

    const contatoResult = contatoService.resolverContatosParaSalvar(formData);
    if ("error" in contatoResult) return { error: contatoResult.error };

    const endereco = lerEnderecoDoFormData(formData);

    let id_fornecedor: number;
    try {
      const criado = await fornecedorDAO.create({
        razao_social: razao_social.trim(),
        cnpj: (formData.get("cnpj") as string) || undefined,
        contato: (formData.get("contato") as string) || undefined,
        codigos: codigoResult.codigos,
        ...contatoResult.contatos,
        endereco: endereco.logradouro ? endereco : undefined,
      }, user.id_usuario);
      id_fornecedor = criado.id_fornecedor;
    } catch (e) {
      return { error: mensagemDeErro(e) };
    }

    return { success: true, id_fornecedor };
  });
}

export async function updateFornecedor(formData: FormData) {
  return comPermissao("fornecedor.alterar", async (user) => {
    const id = Number(formData.get("id_fornecedor"));
    if (!id) return { error: "ID inválido" };

    const ativo = formData.get("ativo") === "on";
    if (!ativo && !(await usuarioPode(user, "fornecedor.desativar"))) {
      return { error: "Sem permissão para desativar." };
    }

    const codigoResult = await codigoService.resolverCodigosParaSalvar("FORNECEDOR", formData);
    if ("error" in codigoResult) return { error: codigoResult.error };

    const contatoResult = contatoService.resolverContatosParaSalvar(formData);
    if ("error" in contatoResult) return { error: contatoResult.error };

    try {
      await fornecedorDAO.update(id, {
        razao_social: (formData.get("razao_social") as string)?.trim(),
        cnpj: (formData.get("cnpj") as string) || undefined,
        contato: (formData.get("contato") as string) || undefined,
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

export async function deleteFornecedor(id: number) {
  return comPermissao("fornecedor.excluir", async (user) => {
    try {
      await fornecedorDAO.hardDelete(id, user.id_usuario);
    } catch (e) {
      return { error: mensagemDeErro(e) };
    }
    return { success: true };
  });
}
