"use server";

import bcrypt from "bcryptjs";
import { usuarioDAO } from "@/dao/usuario";
import { signToken } from "@/lib/jwt";
import { setAuthCookie } from "@/lib/cookies";

export async function primeiroAcessoAction(formData: FormData) {
  const nome = formData.get("nome") as string;
  const login = formData.get("login") as string;
  const senha = formData.get("senha") as string;

  if (!nome || !login || !senha) return { error: "Todos os campos são obrigatórios" };
  if (senha.length < 4) return { error: "Senha deve ter no mínimo 4 caracteres" };

  // Verifica se já existe admin (race condition improvável)
  const existente = await usuarioDAO.existeSuperAdmin();
  if (existente) return { error: "Já existe um administrador" };

  const senha_hash = await bcrypt.hash(senha, 10);

  const usuario = await usuarioDAO.criarSuperAdmin({ nome, login, senha_hash });

  // Já loga após criar
  const token = await signToken({
    id_usuario: usuario.id_usuario,
    login: usuario.login,
    super_admin: true,
    sv: usuario.senha_alterada_em?.getTime() ?? 0,
  });

  await setAuthCookie(token);

  return { success: true };
}