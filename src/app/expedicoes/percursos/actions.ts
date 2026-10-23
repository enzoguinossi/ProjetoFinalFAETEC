"use server";

import { percursoDAO } from "@/dao/percurso";
import { percursoService } from "@/services/percurso";
import { requireUser } from "@/lib/auth";
import { comPermissao, usuarioPode, usuarioPodeAlguma } from "@/lib/permissoes";
import { mensagemDeErro } from "@/dao/_errors";
import { lerJson } from "@/lib/form-data";
import { resultadoVazio, type ListParams, type PaginatedResult } from "@/types";

export type PercursoListRow = {
  id_percurso: number;
  nome: string;
  total_destinatarios: number;
  situacao: "Ativo" | "Desativado";
  ativo: boolean;
};

export type PercursoDestinatarioForm = {
  id_destinatario: number;
  razao_social: string;
  tipo: "ESCOLA" | "CRECHE";
  ordem_visita: number;
};

export type PercursoFormData = {
  id_percurso: number;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  destinatarios: PercursoDestinatarioForm[];
};

export type DestinatarioPercursoRow = {
  id_destinatario: number;
  razao_social: string;
  tipo: "ESCOLA" | "CRECHE";
};

export type DestinatarioPercursoParams = {
  page?: number;
  search?: string;
  limit?: number;
  excludeIds?: number[];
};

export async function listarPercursos(
  params: ListParams = {},
): Promise<PaginatedResult<PercursoListRow>> {
  const user = await requireUser();
  if (!(await usuarioPode(user, "percurso.listar"))) return resultadoVazio(params);

  const resultado = await percursoDAO.list(params);
  return {
    ...resultado,
    data: resultado.data.map((p) => ({
      id_percurso: p.id_percurso,
      nome: p.nome,
      total_destinatarios: p._count.destinatarios,
      situacao: p.ativo ? "Ativo" : "Desativado",
      ativo: p.ativo,
    })),
  };
}

export async function getPercurso(id: number): Promise<PercursoFormData | null> {
  const user = await requireUser();
  if (!(await usuarioPodeAlguma(user, ["percurso.consultar", "percurso.alterar"]))) {
    return null;
  }

  const percurso = await percursoDAO.getById(id);
  if (!percurso) return null;

  return {
    id_percurso: percurso.id_percurso,
    nome: percurso.nome,
    descricao: percurso.descricao,
    ativo: percurso.ativo,
    destinatarios: percurso.destinatarios.map((d) => ({
      id_destinatario: d.id_destinatario,
      razao_social: d.destinatario.pessoaJuridica.razao_social,
      tipo: d.destinatario.tipo_destinatario,
      ordem_visita: d.ordem_visita,
    })),
  };
}

/**
 * Seletor de destinatários do formulário de percurso. As listagens existentes
 * exigem `estoque.saida`; esta é própria do módulo e exige permissão de escrita
 * do percurso.
 */
export async function listarDestinatariosParaPercurso(
  params: DestinatarioPercursoParams = {},
): Promise<PaginatedResult<DestinatarioPercursoRow>> {
  const user = await requireUser();
  if (!(await usuarioPodeAlguma(user, ["percurso.criar", "percurso.alterar"]))) {
    return resultadoVazio(params);
  }

  const resultado = await percursoDAO.listDestinatarios(params);
  return {
    ...resultado,
    data: resultado.data.map((d) => ({
      id_destinatario: d.id_destinatario,
      razao_social: d.pessoaJuridica.razao_social,
      tipo: d.tipo_destinatario,
    })),
  };
}

export type SalvarPercursoResultado =
  | { success: true; id_percurso: number }
  | { error: string };

type DestinatariosLidos =
  | { destinatarios: { id_destinatario: number; ordem_visita: number }[] }
  | { error: string };

function lerDestinatarios(formData: FormData): DestinatariosLidos {
  const raw = lerJson(formData, "destinatarios");
  if (!Array.isArray(raw)) return { error: "Selecione ao menos um destinatário." };

  const destinatarios: { id_destinatario: number; ordem_visita: number }[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") {
      return { error: "Destinatários inválidos." };
    }
    const registro = item as Record<string, unknown>;
    const id = Number(registro.id_destinatario);
    const ordem = Number(registro.ordem_visita);
    if (!Number.isInteger(id) || id <= 0) {
      return { error: "Destinatário inválido no percurso." };
    }
    destinatarios.push({ id_destinatario: id, ordem_visita: ordem });
  }

  return { destinatarios };
}

/** Cria (sem `id_percurso`) ou altera (com `id_percurso`) um percurso. */
export async function salvarPercurso(
  formData: FormData,
): Promise<SalvarPercursoResultado> {
  const user = await requireUser();

  const idBruto = formData.get("id_percurso");
  const id = idBruto ? Number(idBruto) : null;
  if (idBruto && (!Number.isInteger(id) || (id ?? 0) <= 0)) {
    return { error: "Percurso inválido." };
  }
  const permissao = id ? "percurso.alterar" : "percurso.criar";
  if (!(await usuarioPode(user, permissao))) return { error: "Sem permissão." };

  const lidos = lerDestinatarios(formData);
  if ("error" in lidos) return lidos;

  const input = {
    nome: String(formData.get("nome") ?? ""),
    descricao: (formData.get("descricao") as string) || null,
    destinatarios: lidos.destinatarios,
  };

  try {
    const resultado = id
      ? await percursoService.alterar(id, input, user.id_usuario)
      : await percursoService.criar(input, user.id_usuario);

    if ("error" in resultado) return { error: resultado.error };
    return { success: true, id_percurso: resultado.percurso.id_percurso };
  } catch (e) {
    return { error: mensagemDeErro(e) };
  }
}

export async function desativarPercurso(id: number) {
  return comPermissao("percurso.desativar", async (user) => {
    try {
      const resultado = await percursoService.desativar(id, user.id_usuario);
      if ("error" in resultado) return { error: resultado.error };
      return { success: true };
    } catch (e) {
      return { error: mensagemDeErro(e) };
    }
  });
}
