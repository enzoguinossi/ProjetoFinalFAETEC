"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { signToken } from "@/lib/jwt";

export async function primeiroAcessoAction(formData: FormData) {
  const nome = formData.get("nome") as string;
  const login = formData.get("login") as string;
  const senha = formData.get("senha") as string;

  if (!nome || !login || !senha) return { error: "Todos os campos são obrigatórios" };
  if (senha.length < 4) return { error: "Senha deve ter no mínimo 4 caracteres" };

  // Verifica se já existe admin (race condition improv\u00e1vel)
  const existente = await prisma.usuario.findFirst({ where: { super_admin: true } });
  if (existente) return { error: "Já existe um administrador" };

  const senha_hash = await bcrypt.hash(senha, 10);

  const usuario = await prisma.$transaction(async (tx) => {
    const pf = await tx.pessoaFisica.create({ data: { nome } });
    const func = await tx.funcionario.create({
      data: { id_pessoa_fisica: pf.id_pessoa_fisica, cargo: "Administrador" },
    });
    const u = await tx.usuario.create({
      data: { id_funcionario: func.id_funcionario, login, senha_hash, super_admin: true },
    });
    await tx.registroAuditoria.create({
      data: {
        id_usuario: u.id_usuario,
        acao: "CRIAR",
        data_hora: new Date(),
        entidade: "Usuario",
        id_entidade_afetada: u.id_usuario,
        dados_novos: { login, super_admin: true },
      },
    });
    return u;
  });

  // Já loga após criar
  const token = signToken({
    id_usuario: usuario.id_usuario,
    login: usuario.login,
    super_admin: true,
  });

  const cookieStore = await cookies();
  cookieStore.set("nexus_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });

  return { success: true };
}