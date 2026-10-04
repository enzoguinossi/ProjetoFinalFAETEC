"use server";

import { requireUser } from "@/lib/auth";
import { usuarioDAO } from "@/dao/usuario";
import { funcionarioDAO } from "@/dao/funcionario";
import { permissaoService } from "@/services/permissao";
import { usuarioPode, usuarioPodeAlguma } from "@/lib/permissoes";
import { mensagemDeErro } from "@/dao/_errors";
import { parsePermissoes } from "@/lib/form-data";

export type UsuarioFormData = {
  id_usuario: number;
  id_funcionario: number;
  login: string;
  super_admin: boolean;
  ativo: boolean;
  nome_funcionario: string;
  permissoes: string[];
};

export async function listarPermissoesDisponiveis() {
  const user = await requireUser();
  if (!(await usuarioPodeAlguma(user, ["usuario.consultar", "usuario.alterar", "usuario.criar"]))) return [];
  return permissaoService.listarTodasAgrupadas();
}

export async function listarPerfis() {
  const user = await requireUser();
  if (!(await usuarioPodeAlguma(user, ["usuario.consultar", "usuario.alterar", "usuario.criar"]))) return [];
  return permissaoService.listarPerfis();
}

export async function permissoesDoPerfil(id_perfil: number): Promise<string[]> {
  const user = await requireUser();
  if (!(await usuarioPodeAlguma(user, ["usuario.consultar", "usuario.alterar", "usuario.criar"]))) return [];
  return permissaoService.permissoesDoPerfil(id_perfil);
}

export async function salvarPermissoesUsuario(id_usuario: number, permissoes: string[]) {
  const user = await requireUser();
  if (!(await usuarioPode(user, "usuario.alterar"))) return { error: "Sem permissão." };
  try {
    await permissaoService.salvarPermissoes(id_usuario, permissoes, user.id_usuario);
  } catch (e) {
    return { error: mensagemDeErro(e, "Erro ao salvar permissões.") };
  }
  return { success: true };
}

export async function createUsuario(formData: FormData) {
  const user = await requireUser();
  if (!(await usuarioPode(user, "usuario.criar"))) return { error: "Sem permissão." };

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

export async function updateUsuario(formData: FormData) {
  const id = Number(formData.get("id_usuario"));
  if (!id) return { error: "ID inválido" };

  const login = formData.get("login") as string;
  if (!login?.trim()) return { error: "Login é obrigatório" };

  const user = await requireUser();
  if (!(await usuarioPode(user, "usuario.alterar"))) return { error: "Sem permissão." };

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
    await usuarioDAO.update(
      id,
      { login: login.trim(), ativo },
      user.id_usuario,
    );

    await permissaoService.salvarPermissoes(id, permissoes, user.id_usuario);
  } catch (e) {
    return { error: mensagemDeErro(e, "Erro ao salvar permissões.") };
  }

  return { success: true };
}

export async function deleteUsuario(id: number) {
  const user = await requireUser();
  if (!(await usuarioPode(user, "usuario.excluir"))) return { error: "Sem permissão." };

  try {
    await usuarioDAO.hardDelete(id, user.id_usuario);
  } catch (e) {
    return { error: mensagemDeErro(e) };
  }
  return { success: true };
}

export async function listFuncionarios() {
  const user = await requireUser();
  if (!(await usuarioPodeAlguma(user, ["usuario.criar", "usuario.alterar"]))) return [];

  return funcionarioDAO.listDisponiveisParaUsuario();
}