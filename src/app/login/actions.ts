"use server";

import bcrypt from "bcryptjs";
import { usuarioDAO } from "@/dao/usuario";
import { signToken } from "@/lib/jwt";
import { setAuthCookie, setTempAuthCookie, clearAuthCookie } from "@/lib/cookies";
import { registrarAuditoria } from "@/dao/_audit";

export async function loginAction(formData: FormData) {
  const login = formData.get("login") as string;
  const senha = formData.get("senha") as string;

  if (!login || !senha) return { error: "Login e senha obrigatórios" };

  const usuario = await usuarioDAO.getByLoginComFuncionario(login);

  if (!usuario || !usuario.ativo) {
    return { error: "Usuário ou senha inválidos" };
  }

  // Primeiro acesso — senha ainda não definida
  if (usuario.senha_hash === null) {
    const tempToken = await signToken({
      id_usuario: usuario.id_usuario,
      login: usuario.login,
      super_admin: usuario.super_admin,
      sv: usuario.senha_alterada_em?.getTime() ?? 0,
    });
    await setTempAuthCookie(tempToken);
    return { redirect: "/definir-senha" };
  }

  const valida = await bcrypt.compare(senha, usuario.senha_hash);
  if (!valida) {
    await registrarAuditoria(usuario.id_usuario, "LOGIN_FALHA", "Usuario", usuario.id_usuario, {
      login,
      motivo: "senha inválida",
    });
    return { error: "Usuário ou senha inválidos" };
  }

  const token = await signToken({
    id_usuario: usuario.id_usuario,
    login: usuario.login,
    super_admin: usuario.super_admin,
    sv: usuario.senha_alterada_em?.getTime() ?? 0,
  });

  await usuarioDAO.registrarAcesso(usuario.id_usuario);

  await setAuthCookie(token);
  await registrarAuditoria(usuario.id_usuario, "LOGIN", "Usuario", usuario.id_usuario, {
    login,
  });

  return { success: true };
}

export async function logoutAction() {
  await clearAuthCookie();
  return { success: true };
}
