"use server";

import bcrypt from "bcryptjs";
import { usuarioDAO } from "@/dao/usuario";
import { verifyToken, signToken } from "@/lib/jwt";
import { setAuthCookie, clearTempAuthCookie, getTempAuthToken } from "@/lib/cookies";
import { registrarAuditoria } from "@/dao/_audit";

export async function definirSenhaAction(formData: FormData) {
  const senha = formData.get("senha") as string;
  const confirmacao = formData.get("confirmacao") as string;

  if (!senha || senha.length < 4) return { error: "Senha deve ter no mínimo 4 caracteres" };
  if (senha !== confirmacao) return { error: "Senhas não conferem" };

  const tempToken = await getTempAuthToken();
  if (!tempToken) return { error: "Token inválido ou expirado" };

  const payload = await verifyToken(tempToken);
  if (!payload) return { error: "Token inválido ou expirado" };

  const senha_hash = await bcrypt.hash(senha, 10);
  const agora = new Date();

  await usuarioDAO.definirSenha(payload.id_usuario, senha_hash, agora, payload.id_usuario);

  const finalToken = await signToken({
    id_usuario: payload.id_usuario,
    login: payload.login,
    super_admin: payload.super_admin,
    sv: agora.getTime(),
  });

  await setAuthCookie(finalToken);
  await clearTempAuthCookie();

  await registrarAuditoria(payload.id_usuario, "DEFINIR_SENHA", "Usuario", payload.id_usuario, {
    login: payload.login,
  });

  return { success: true };
}
