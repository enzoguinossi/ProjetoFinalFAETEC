"use server";

import { prisma } from "@/lib/prisma";
import { destinatarioDAO } from "@/dao/destinatario";
import { requireUser } from "@/lib/auth";

export type DestinatarioFormData = {
  id_destinatario: number;
  razao_social: string;
  cnpj: string | null;
  tipo_destinatario: "ESCOLA" | "CRECHE";
  ativo: boolean;
  endereco: {
    logradouro: string;
    numero: string | null;
    complemento: string | null;
    bairro: string | null;
    cidade: string;
    cep: string | null;
    latitude: number | null;
    longitude: number | null;
  };
};

export async function createDestinatario(formData: FormData) {
  const razao_social = formData.get("razao_social") as string;
  if (!razao_social?.trim()) return { error: "Razão social é obrigatória" };

  const user = await requireUser();
  await destinatarioDAO.create({
    razao_social: razao_social.trim(),
    cnpj: (formData.get("cnpj") as string) || undefined,
    tipo_destinatario: formData.get("tipo_destinatario") as "ESCOLA" | "CRECHE",
    endereco: {
      logradouro: formData.get("logradouro") as string,
      numero: (formData.get("numero") as string) || undefined,
      complemento: (formData.get("complemento") as string) || undefined,
      bairro: (formData.get("bairro") as string) || undefined,
      cidade: formData.get("cidade") as string,
      cep: (formData.get("cep") as string) || undefined,
      latitude: formData.get("latitude") ? Number(formData.get("latitude")) : undefined,
      longitude: formData.get("longitude") ? Number(formData.get("longitude")) : undefined,
    },
  }, user.id_usuario);

  return { success: true };
}

export async function getDestinatario(id: number): Promise<DestinatarioFormData | null> {
  const d = await destinatarioDAO.getById(id);
  if (!d) return null;
  return {
    id_destinatario: d.id_destinatario,
    razao_social: d.pessoaJuridica.razao_social,
    cnpj: d.pessoaJuridica.cnpj,
    tipo_destinatario: d.tipo_destinatario,
    ativo: d.ativo,
    endereco: {
      logradouro: d.endereco.logradouro,
      numero: d.endereco.numero,
      complemento: d.endereco.complemento,
      bairro: d.endereco.bairro,
      cidade: d.endereco.cidade,
      cep: d.endereco.cep,
      latitude: d.endereco.latitude,
      longitude: d.endereco.longitude,
    },
  };
}

export async function updateDestinatario(formData: FormData) {
  const id = Number(formData.get("id_destinatario"));
  if (!id) return { error: "ID inválido" };
  const user = await requireUser();

  await destinatarioDAO.update(id, {
    razao_social: (formData.get("razao_social") as string)?.trim(),
    cnpj: (formData.get("cnpj") as string) || undefined,
    tipo_destinatario: formData.get("tipo_destinatario") as "ESCOLA" | "CRECHE",
    endereco: {
      logradouro: (formData.get("logradouro") as string) || undefined,
      numero: (formData.get("numero") as string) || undefined,
      complemento: (formData.get("complemento") as string) || undefined,
      bairro: (formData.get("bairro") as string) || undefined,
      cidade: (formData.get("cidade") as string) || undefined,
      cep: (formData.get("cep") as string) || undefined,
      latitude: formData.get("latitude") ? Number(formData.get("latitude")) : undefined,
      longitude: formData.get("longitude") ? Number(formData.get("longitude")) : undefined,
    },
  }, user.id_usuario);

  return { success: true };
}

export async function deleteDestinatario(id: number) {
  const user = await requireUser();
  const { podeExcluir, vinculos } = await destinatarioDAO.verificarRelacionamentos(id);
  if (!podeExcluir) return { error: `Não é possível excluir pois possui ${vinculos.join(", ")}.` };
  await destinatarioDAO.hardDelete(id, user.id_usuario);
  return { success: true };
}