"use server";

import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signToken } from "@/lib/jwt";

export async function loginAction(formData: FormData) {
  const login = formData.get("login") as string;
  const senha = formData.get("senha") as string;

  if (!login || !senha) return { error: "Login e senha obrigatórios" };

  const usuario = await prisma.usuario.findUnique({
    where: { login },
    include: { funcionario: { include: { pessoaFisica: true } } },
  });

  if (!usuario || !usuario.ativo) return { error: "Usuário ou senha inválidos" };

  // Primeiro acesso — senha ainda não definida
  if (usuario.senha_hash === "__PENDING__") {
    // Gera um token temporário para a página de definir senha
    const tempToken = signToken({
      id_usuario: usuario.id_usuario,
      login: usuario.login,
      super_admin: usuario.super_admin,
    });
    const cookieStore = await cookies();
    cookieStore.set("nexus_temp_token", tempToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 10, // 10 min
    });
    return { redirect: "/definir-senha" };
  }

  const valida = await bcrypt.compare(senha, usuario.senha_hash);
  if (!valida) return { error: "Usuário ou senha inválidos" };

  const token = signToken({
    id_usuario: usuario.id_usuario,
    login: usuario.login,
    super_admin: usuario.super_admin,
  });

  const cookieStore = await cookies();
  cookieStore.set("nexus_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8, // 8h
  });

  return { success: true };
}

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete("nexus_token");
  return { success: true };
}