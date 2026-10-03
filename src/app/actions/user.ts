"use server";

import { getCurrentUser } from "@/lib/auth";
import { usuarioDAO } from "@/dao/usuario";
import { permissaoService } from "@/services/permissao";

export async function getUserInfo() {
  const user = await getCurrentUser();
  if (!user) return null;

  const usuario = await usuarioDAO.getById(user.id_usuario);
  if (!usuario) return null;

  const permissoes = usuario.super_admin
    ? []
    : await permissaoService.listarPorUsuario(usuario.id_usuario);

  return {
    id_usuario: usuario.id_usuario,
    login: usuario.login,
    nome: usuario.funcionario.pessoaFisica.nome,
    super_admin: usuario.super_admin,
    permissoes,
  };
}