"use server";

import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { verifyToken, signToken } from "@/lib/jwt";

export async function definirSenhaAction(formData: FormData) {
  const senha = formData.get("senha") as string;
  const confirmacao = formData.get("confirmacao") as string;

  if (!senha || senha.length < 4) return { error: "Senha deve ter no mínimo 4 caracteres" };
  if (senha !== confirmacao) return { error: "Senhas não conferem" };

  const cookieStore = await cookies();
  const tempToken = cookieStore.get("nexus_temp_token")?.value;
  if (!tempToken) return { error: "Token inválido ou expirado" };

  const payload = verifyToken(tempToken);
  if (!payload) return { error: "Token inválido ou expirado" };

  const senha_hash = await bcrypt.hash(senha, 10);

  await prisma.usuario.update({
    where: { id_usuario: payload.id_usuario },
    data: { senha_hash, ultimo_acesso: new Date() },
  });

  // Gera token definitivo e remove o temporário
  const finalToken = signToken({
    id_usuario: payload.id_usuario,
    login: payload.login,
    super_admin: payload.super_admin,
  });

  cookieStore.set("nexus_token", finalToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  cookieStore.delete("nexus_temp_token");

  return { success: true };
}