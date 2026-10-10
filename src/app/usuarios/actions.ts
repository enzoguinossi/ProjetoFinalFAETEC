"use server";

import { usuarioDAO } from "@/dao/usuario";
import { permissaoService } from "@/services/permissao";
import { requireUser } from "@/lib/auth";
import { comPermissao, usuarioPode, usuarioPodeAlguma } from "@/lib/permissoes";
import { mensagemDeErro } from "@/dao/_errors";
import { parsePermissoes } from "@/lib/form-data";
import { formatarCodigo } from "@/lib/formatar";
import { resultadoVazio, type ListParams, type PaginatedResult } from "@/types";

export type UsuarioListRow = {
  id_usuario: number;
  codigo: string;
  login: string;
  nome: string;
};

export type UsuarioFormData = {
  id_usuario: number;
  id_funcionario: number;
  login: string;
  super_admin: boolean;
  ativo: boolean;
  nome_funcionario: string;
  permissoes: string[];
};

export async function listarUsuarios(
  params: ListParams = {},
): Promise<PaginatedResult<UsuarioListRow>> {
  const user = await requireUser();
  if (!(await usuarioPode(user, "usuario.listar"))) return resultadoVazio(params);

  const resultado = await usuarioDAO.list(params);
  return {
    ...resultado,
    data: resultado.data.map((u) => ({
      id_usuario: u.id_usuario,
      codigo: formatarCodigo(u.id_usuario),
      login: u.login,
      nome: u.funcionario.pessoaFisica.nome,
    })),
  };
}

export async function getUsuario(id: number): Promise<UsuarioFormData | null> {
  const user = await requireUser();
  if (!(await usuarioPodeAlguma(user, ["usuario.consultar", "usuario.alterar"]))) return null;

  const u = await usuarioDAO.getById(id);
  if (!u) return null;
  return {
    id_usuario: u.id_usuario,
    id_funcionario: u.id_funcionario,
    login: u.login,
    super_admin: u.super_admin,
    ativo: u.ativo,
    nome_funcionario: u.funcionario.pessoaFisica.nome,
    permissoes: u.permissoes.map((p) => p.permissao.nome),
  };
}

export async function createUsuario(formData: FormData) {
  return comPermissao("usuario.criar", async (user) => {
    const login = formData.get("login") as string;
    const id_funcionario = Number(formData.get("id_funcionario"));

    if (!login || !id_funcionario) {
      return { error: "Login e funcionário são obrigatórios" };
    }

    const existente = await usuarioDAO.existeLogin(login);
    if (existente) return { error: "Login já existe" };

    const permissoes = parsePermissoes(formData);

    try {
      const criado = await usuarioDAO.create(
        {
          id_funcionario,
          login,
          senha_hash: null,
        },
        user.id_usuario,
      );

      if (permissoes.length > 0) {
        await permissaoService.salvarPermissoes(criado.id_usuario, permissoes, user.id_usuario);
      }
    } catch (e) {
      return { error: mensagemDeErro(e) };
    }

    return { success: true };
  });
}

export async function updateUsuario(formData: FormData) {
  return comPermissao("usuario.alterar", async (user) => {
    const id = Number(formData.get("id_usuario"));
    if (!id) return { error: "ID inválido" };

    const login = formData.get("login") as string;
    if (!login?.trim()) return { error: "Login é obrigatório" };

    const ativo = formData.get("ativo") === "on";
    if (!ativo && !(await usuarioPode(user, "usuario.desativar"))) {
      return { error: "Sem permissão para desativar." };
    }

    const atual = await usuarioDAO.getById(id);
    if (atual?.super_admin) {
      return { error: "Super Admin não pode ser alterado." };
    }

    const permissoes = parsePermissoes(formData);

    try {
      await usuarioDAO.update(id, { login: login.trim(), ativo }, user.id_usuario);
      await permissaoService.salvarPermissoes(id, permissoes, user.id_usuario);
    } catch (e) {
      return { error: mensagemDeErro(e, "Erro ao salvar permissões.") };
    }

    return { success: true };
  });
}

export async function deleteUsuario(id: number) {
  return comPermissao("usuario.excluir", async (user) => {
    try {
      await usuarioDAO.hardDelete(id, user.id_usuario);
    } catch (e) {
      return { error: mensagemDeErro(e) };
    }
    return { success: true };
  });
}
