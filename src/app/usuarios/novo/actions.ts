"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { usuarioDAO } from "@/dao/usuario";

export type UsuarioFormData = {
  id_usuario: number;
  id_funcionario: number;
  login: string;
  super_admin: boolean;
  ativo: boolean;
  nome_funcionario: string;
};

export async function createUsuario(formData: FormData) {
  const login = formData.get("login") as string;
  const id_funcionario = Number(formData.get("id_funcionario"));

  if (!login || !id_funcionario) {
    return { error: "Login e funcionário são obrigatórios" };
  }

  const existente = await prisma.usuario.findUnique({ where: { login } });
  if (existente) return { error: "Login já existe" };

  const user = await requireUser();

  await usuarioDAO.create(
    {
      id_funcionario,
      login,
      senha_hash: "__PENDING__",
    },
    user.id_usuario,
  );

  return { success: true };
}

export async function getUsuario(id: number): Promise<UsuarioFormData | null> {
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
  const ativo = formData.get("ativo") !== "off";
  const super_admin = formData.get("super_admin") === "on";

  await usuarioDAO.update(
    id,
    { login: login.trim(), ativo, super_admin },
    user.id_usuario,
  );

  return { success: true };
}

export async function deleteUsuario(id: number) {
  const user = await requireUser();
  const { podeExcluir, vinculos } = await usuarioDAO.verificarRelacionamentos(id);

  if (!podeExcluir) {
    return {
      error: `Não é possível excluir este usuário pois ele possui ${vinculos.join(", ")}.`,
    };
  }

  await usuarioDAO.hardDelete(id, user.id_usuario);
  return { success: true };
}

export async function listFuncionarios() {
  return prisma.funcionario.findMany({
    where: { ativo: true, usuario: null },
    include: { pessoaFisica: true },
    orderBy: { id_funcionario: "asc" },
  });
}