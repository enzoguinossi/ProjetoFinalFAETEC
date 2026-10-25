"use server";

import { funcionarioDAO } from "@/dao/funcionario";
import { codigoService } from "@/services/codigo";
import { contatoService } from "@/services/contato";
import { requireUser } from "@/lib/auth";
import { comPermissao, usuarioPode, usuarioPodeAlguma } from "@/lib/permissoes";
import { mensagemDeErro } from "@/dao/_errors";
import { formatarCodigo } from "@/lib/formatar";
import { resultadoVazio, type ListParams, type PaginatedResult } from "@/types";

export type FuncionarioListRow = {
  id_funcionario: number;
  codigo: string;
  nome: string;
  cargo: string;
  condutor: string;
};

export type FuncionarioFormData = {
  id_funcionario: number;
  nome: string;
  cpf: string | null;
  cargo: string | null;
  condutor: boolean;
  ativo: boolean;
  codigos: { tipo: string; valor: string }[];
  emails: { endereco: string; principal: boolean }[];
  telefones: { numero: string; tipo: "CELULAR" | "FIXO" | "COMERCIAL"; principal: boolean }[];
};

export async function listarFuncionarios(
  params: ListParams = {},
): Promise<PaginatedResult<FuncionarioListRow>> {
  const user = await requireUser();
  if (!(await usuarioPode(user, "funcionario.listar"))) return resultadoVazio(params);

  const resultado = await funcionarioDAO.list(params);
  return {
    ...resultado,
    data: resultado.data.map((f) => ({
      id_funcionario: f.id_funcionario,
      codigo: formatarCodigo(f.id_funcionario),
      nome: f.pessoaFisica.nome,
      cargo: f.cargo ?? "",
      condutor: f.condutor ? "Sim" : "Não",
    })),
  };
}

export async function getFuncionario(id: number): Promise<FuncionarioFormData | null> {
  const user = await requireUser();
  if (!(await usuarioPodeAlguma(user, ["funcionario.consultar", "funcionario.alterar"]))) return null;

  const f = await funcionarioDAO.getById(id);
  if (!f) return null;
  return {
    id_funcionario: f.id_funcionario,
    nome: f.pessoaFisica.nome,
    cpf: f.pessoaFisica.cpf,
    cargo: f.cargo,
    condutor: f.condutor,
    ativo: f.ativo,
    codigos: f.funcionarioCodigos.map((c) => ({ tipo: c.tipoCodigo.nome, valor: c.codigo })),
    emails: f.emails.map((e) => ({ endereco: e.endereco, principal: e.principal })),
    telefones: f.telefones.map((t) => ({ numero: t.numero, tipo: t.tipo, principal: t.principal })),
  };
}

export async function createFuncionario(formData: FormData) {
  return comPermissao("funcionario.criar", async (user) => {
    const nome = formData.get("nome") as string;
    if (!nome?.trim()) return { error: "Nome é obrigatório" };

    const codigoResult = await codigoService.resolverCodigosParaSalvar("FUNCIONARIO", formData);
    if ("error" in codigoResult) return { error: codigoResult.error };

    const contatoResult = contatoService.resolverContatosParaSalvar(formData);
    if ("error" in contatoResult) return { error: contatoResult.error };

    try {
      await funcionarioDAO.create(
        {
          nome: nome.trim(),
          cpf: (formData.get("cpf") as string) || undefined,
          cargo: (formData.get("cargo") as string) || undefined,
          condutor: formData.get("condutor") === "on",
          codigos: codigoResult.codigos,
          ...contatoResult.contatos,
        },
        user.id_usuario,
      );
    } catch (e) {
      return { error: mensagemDeErro(e) };
    }

    return { success: true };
  });
}

export async function updateFuncionario(formData: FormData) {
  return comPermissao("funcionario.alterar", async (user) => {
    const id = Number(formData.get("id_funcionario"));
    if (!id) return { error: "ID inválido" };

    const nome = formData.get("nome") as string;
    if (!nome?.trim()) return { error: "Nome é obrigatório" };

    const ativo = formData.get("ativo") === "on";
    if (!ativo && !(await usuarioPode(user, "funcionario.desativar"))) {
      return { error: "Sem permissão para desativar." };
    }

    const codigoResult = await codigoService.resolverCodigosParaSalvar("FUNCIONARIO", formData);
    if ("error" in codigoResult) return { error: codigoResult.error };

    const contatoResult = contatoService.resolverContatosParaSalvar(formData);
    if ("error" in contatoResult) return { error: contatoResult.error };

    try {
      await funcionarioDAO.update(
        id,
        {
          nome: nome.trim(),
          cpf: (formData.get("cpf") as string) || undefined,
          cargo: (formData.get("cargo") as string) || undefined,
          condutor: formData.get("condutor") === "on",
          ativo,
          codigos: codigoResult.codigos,
          ...contatoResult.contatos,
        },
        user.id_usuario,
      );
    } catch (e) {
      return { error: mensagemDeErro(e) };
    }

    return { success: true };
  });
}

export async function deleteFuncionario(id: number) {
  return comPermissao("funcionario.excluir", async (user) => {
    try {
      await funcionarioDAO.hardDelete(id, user.id_usuario);
    } catch (e) {
      return { error: mensagemDeErro(e) };
    }
    return { success: true };
  });
}
