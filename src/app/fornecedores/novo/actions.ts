"use server";

import { fornecedorDAO } from "@/dao/fornecedor";
import { codigoService } from "@/services/codigo";
import { cepService } from "@/services/cep";
import { requireUser } from "@/lib/auth";
import { usuarioPode, usuarioPodeAlguma } from "@/lib/permissoes";
import { EntidadeComVinculosError } from "@/dao/_errors";

export async function buscarCep(cep: string) {
  const user = await requireUser();
  if (!(await usuarioPodeAlguma(user, ["fornecedor.criar", "fornecedor.alterar"]))) {
    return { error: "Sem permissão." };
  }
  return cepService.buscarEnderecoPorCep(cep);
}

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
};

export async function createFornecedor(formData: FormData) {
  const user = await requireUser();
  if (!(await usuarioPode(user, "fornecedor.criar"))) return { error: "Sem permissão." };

  const razao_social = formData.get("razao_social") as string;
  if (!razao_social?.trim()) return { error: "Razão social é obrigatória" };

  const codigoResult = await codigoService.resolverCodigosParaSalvar("FORNECEDOR", formData);
  if ("error" in codigoResult) return { error: codigoResult.error };

  const logradouro = formData.get("logradouro") as string;
  const endereco = logradouro ? {
    logradouro,
    numero: (formData.get("numero") as string) || undefined,
    complemento: (formData.get("complemento") as string) || undefined,
    bairro: (formData.get("bairro") as string) || undefined,
    cidade: formData.get("cidade") as string,
    uf: (formData.get("uf") as string) || undefined,
    cep: (formData.get("cep") as string) || undefined,
    latitude: formData.get("latitude") ? Number(formData.get("latitude")) : undefined,
    longitude: formData.get("longitude") ? Number(formData.get("longitude")) : undefined,
  } : undefined;

  await fornecedorDAO.create({
    razao_social: razao_social.trim(),
    cnpj: (formData.get("cnpj") as string) || undefined,
    contato: (formData.get("contato") as string) || undefined,
    codigos: codigoResult.codigos,
    endereco,
  }, user.id_usuario);

  return { success: true };
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
  };
}

export async function updateFornecedor(formData: FormData) {
  const id = Number(formData.get("id_fornecedor"));
  if (!id) return { error: "ID inválido" };
  const user = await requireUser();
  if (!(await usuarioPode(user, "fornecedor.alterar"))) return { error: "Sem permissão." };
  const ativo = formData.get("ativo") === "on";
  if (!ativo && !(await usuarioPode(user, "fornecedor.desativar"))) {
    return { error: "Sem permissão para desativar." };
  }

  const codigoResult = await codigoService.resolverCodigosParaSalvar("FORNECEDOR", formData);
  if ("error" in codigoResult) return { error: codigoResult.error };

  await fornecedorDAO.update(id, {
    razao_social: (formData.get("razao_social") as string)?.trim(),
    cnpj: (formData.get("cnpj") as string) || undefined,
    contato: (formData.get("contato") as string) || undefined,
    ativo,
    codigos: codigoResult.codigos,
    endereco: {
      logradouro: (formData.get("logradouro") as string) || undefined,
      numero: (formData.get("numero") as string) || undefined,
      complemento: (formData.get("complemento") as string) || undefined,
      bairro: (formData.get("bairro") as string) || undefined,
      cidade: (formData.get("cidade") as string) || undefined,
      uf: (formData.get("uf") as string) || undefined,
      cep: (formData.get("cep") as string) || undefined,
      latitude: formData.get("latitude") ? Number(formData.get("latitude")) : undefined,
      longitude: formData.get("longitude") ? Number(formData.get("longitude")) : undefined,
    },
  }, user.id_usuario);

  return { success: true };
}

export async function deleteFornecedor(id: number) {
  const user = await requireUser();
  if (!(await usuarioPode(user, "fornecedor.excluir"))) return { error: "Sem permissão." };

  const { podeExcluir, vinculos } = await fornecedorDAO.verificarRelacionamentos(id);
  if (!podeExcluir) return { error: `Não é possível excluir pois possui ${vinculos.join(", ")}.` };

  try {
    await fornecedorDAO.hardDelete(id, user.id_usuario);
  } catch (e) {
    if (e instanceof EntidadeComVinculosError) return { error: e.message };
    throw e;
  }
  return { success: true };
}