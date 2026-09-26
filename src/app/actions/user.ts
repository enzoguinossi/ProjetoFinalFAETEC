"use server";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function getUserInfo() {
  const user = await getCurrentUser();
  if (!user) return null;

  const usuario = await prisma.usuario.findUnique({
    where: { id_usuario: user.id_usuario },
    include: { funcionario: { include: { pessoaFisica: true } } },
  });

  if (!usuario) return null;

  return {
    id_usuario: usuario.id_usuario,
    login: usuario.login,
    nome: usuario.funcionario.pessoaFisica.nome,
    super_admin: usuario.super_admin,
  };
}