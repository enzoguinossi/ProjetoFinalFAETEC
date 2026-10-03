"use server";

import { requireUser } from "@/lib/auth";
import { usuarioDAO } from "@/dao/usuario";
import { funcionarioDAO } from "@/dao/funcionario";
import { usuarioPode, usuarioPodeAlguma } from "@/lib/permissoes";
import { EntidadeComVinculosError } from "@/dao/_errors";

export type UsuarioFormData = {
  id_usuario: number;
  id_funcionario: number;
  login: string;
  super_admin: boolean;
  ativo: boolean;
  nome_funcionario: string;
};

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

  await usuarioDAO.create(
    {
      id_funcionario,
      login,
      senha_hash: null,
    },
    user.id_usuario,
  );

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

  await usuarioDAO.update(
    id,
    { login: login.trim(), ativo },
    user.id_usuario,
  );

  return { success: true };
}

export async function deleteUsuario(id: number) {
  const user = await requireUser();
  if (!(await usuarioPode(user, "usuario.excluir"))) return { error: "Sem permissão." };

  const { podeExcluir, vinculos } = await usuarioDAO.verificarRelacionamentos(id);
  if (!podeExcluir) {
    return {
      error: `Não é possível excluir este usuário pois ele possui ${vinculos.join(", ")}.`,
    };
  }

  try {
    await usuarioDAO.hardDelete(id, user.id_usuario);
  } catch (e) {
    if (e instanceof EntidadeComVinculosError) return { error: e.message };
    throw e;
  }
  return { success: true };
}

export async function listFuncionarios() {
  const user = await requireUser();
  if (!(await usuarioPodeAlguma(user, ["usuario.criar", "usuario.alterar"]))) return [];

  return funcionarioDAO.listDisponiveisParaUsuario();
}