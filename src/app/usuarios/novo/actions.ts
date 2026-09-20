"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export async function createUsuario(formData: FormData) {
  const login = formData.get("login") as string;
  const id_funcionario = Number(formData.get("id_funcionario"));

  if (!login || !id_funcionario) {
    return { error: "Login e funcionário são obrigatórios" };
  }

  const existente = await prisma.usuario.findUnique({ where: { login } });
  if (existente) return { error: "Login já existe" };

  const user = await requireUser();

  const usuarioDAO = await import("@/dao/usuario").then((m) => m.usuarioDAO);
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

export async function listFuncionarios() {
  return prisma.funcionario.findMany({
    where: { ativo: true, usuario: null },
    include: { pessoaFisica: true },
    orderBy: { id_funcionario: "asc" },
  });
}